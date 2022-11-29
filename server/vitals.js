// Third-party dependencies
/* eslint-disable no-continue */
const { DateTime } = require('luxon')
const i18next = require('i18next')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')
const aws = require('./aws')

let braveAlerter

function setup(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

// Expects a JS Date object and an integer and returns a JS Date object
function subtractSeconds(date, seconds) {
  const dateTime = DateTime.fromJSDate(date)
  return dateTime.minus({ seconds }).toJSDate()
}

// Expects JS Date objects and returns an int
function differenceInSeconds(date1, date2) {
  const dateTime1 = DateTime.fromJSDate(date1)
  const dateTime2 = DateTime.fromJSDate(date2)
  return dateTime1.diff(dateTime2, 'seconds').seconds
}

function sendNotification(message, toPhoneNumbers, fromPhoneNumber) {
  toPhoneNumbers.forEach(toPhoneNumber => {
    braveAlerter.sendSingleAlert(toPhoneNumber, fromPhoneNumber, message)
  })
}

async function checkHubHeartbeat() {
  try {
    const hubs = await db.getHubs()
    for (const hub of hubs) {
      if (hub.muted) {
        continue
      }

      const client = hub.client
      const currentTime = await db.getCurrentTime()
      const flicDelayinSeconds = differenceInSeconds(currentTime, hub.flicLastSeenTime)
      const piDelayinSeconds = differenceInSeconds(currentTime, hub.heartbeatLastSeenTime)
      const pingDelayinSeconds = differenceInSeconds(currentTime, hub.flicLastPingTime)
      const externalThreshold = helpers.getEnvVar('VITALS_ALERT_THRESHOLD')

      const flicInternalHeartbeatExceeded = flicDelayinSeconds > helpers.getEnvVar('LAST_SEEN_FLIC_THRESHOLD')
      const pingInternalHeartbeatExceeded = pingDelayinSeconds > helpers.getEnvVar('LAST_SEEN_PING_THRESHOLD')
      const piInternalHeartbeatExceeded = piDelayinSeconds > helpers.getEnvVar('LAST_SEEN_HEARTBEAT_THRESHOLD')

      if (flicInternalHeartbeatExceeded && !hub.sentInternalFlicAlert) {
        hub.sentInternalFlicAlert = true
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Disconnection: flic threshold exceeded for ${hub.systemName}; flic delay is ${flicDelayinSeconds} s.`)
      } else if (!flicInternalHeartbeatExceeded && hub.sentInternalFlicAlert) {
        hub.sentInternalFlicAlert = false
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Reconnection: flic back to normal for ${hub.systemName}`)
      }

      if (pingInternalHeartbeatExceeded && !hub.sentInternalPingAlert) {
        hub.sentInternalPingAlert = true
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Disconnection: ping threshold exceeded for ${hub.systemName}; ping delay is ${pingDelayinSeconds} ms.`)
      } else if (!pingInternalHeartbeatExceeded && hub.sentInternalPingAlert) {
        hub.sentInternalPingAlert = false
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Reconnection: ping back to normal for ${hub.systemName}`)
      }

      if (piInternalHeartbeatExceeded && !hub.sentInternalPiAlert) {
        helpers.logSentry(`Disconnection: heartbeat threshold exceeded for ${hub.systemName}; heartbeat delay is ${piDelayinSeconds} ms.`)
        hub.sentInternalPiAlert = true
        await db.updateSentInternalAlerts(hub)
      } else if (!piInternalHeartbeatExceeded && hub.sentInternalPiAlert) {
        hub.sentInternalPiAlert = false
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Reconnection: heartbeat back to normal for ${hub.systemName}`)
      }

      const externalHeartbeatExceeded =
        flicDelayinSeconds > externalThreshold || pingDelayinSeconds > externalThreshold || piDelayinSeconds > externalThreshold

      if (externalHeartbeatExceeded) {
        if (hub.sentVitalsAlertAt === null) {
          await db.updateHubSentVitalsAlerts(hub.systemId, true)
          sendNotification(
            i18next.t('hubDisconnectionInitial', { lng: client.language, hubLocationDescription: hub.locationDescription }),
            client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
            client.fromPhoneNumber,
          )
        } else if (differenceInSeconds(currentTime, hub.sentVitalsAlertAt) > helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD')) {
          await db.updateHubSentVitalsAlerts(hub.systemId, true)
          sendNotification(
            i18next.t('hubDisconnectionReminder', { lng: client.language, hubLocationDescription: hub.locationDescription }),
            client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
            client.fromPhoneNumber,
          )
        }
      } else if (hub.sentVitalsAlertAt !== null) {
        await db.updateHubSentVitalsAlerts(hub.systemId, false)
        sendNotification(
          i18next.t('hubReconnection', { lng: client.language, hubLocationDescription: hub.locationDescription }),
          client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
          client.fromPhoneNumber,
        )
      }
    }
  } catch (e) {
    helpers.logError(`Failed to check heartbeat: ${e}`)
  }
}

async function checkGatewayHeartbeat() {
  try {
    const THRESHOLD = helpers.getEnvVar('GATEWAY_VITALS_ALERT_THRESHOLD')
    const SUBSEQUENT_THRESHOLD = helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD')

    const gateways = await db.getGateways()

    for (const gateway of gateways) {
      // Get latest gateway statistics from AWS
      const gatewayStats = await aws.getGatewayStats(gateway.id)
      if (gatewayStats !== null) {
        await db.logGatewaysVital(gateway.id, gatewayStats)
      }

      if (gateway.isActive && gateway.client.isActive) {
        const currentTime = await db.getCurrentTime()
        const gatewaysVital = await db.getRecentGatewaysVitalWithGatewayId(gateway.id)
        const gatewayDelay = differenceInSeconds(currentTime, gatewaysVital.lastSeenAt)
        const gatewayThreholdExceeded = gatewayDelay > THRESHOLD
        const client = gateway.client
        if (gatewayThreholdExceeded) {
          if (gateway.sentVitalsAlertAt === null) {
            const logMessage = `Disconnection: ${gateway.displayName} Gateway delay is ${gatewayDelay} seconds.`
            helpers.logSentry(logMessage)

            await db.updateGatewaySentVitalsAlerts(gateway.id, true)

            sendNotification(
              i18next.t('gatewayDisconnectionInitial', { lng: client.language, gatewayDisplayName: gateway.displayName }),
              client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
              client.fromPhoneNumber,
            )
          } else if (differenceInSeconds(currentTime, gateway.sentVitalsAlertAt) > SUBSEQUENT_THRESHOLD) {
            await db.updateGatewaySentVitalsAlerts(gateway.id, true)

            sendNotification(
              i18next.t('gatewayDisconnectionReminder', { lng: client.language, gatewayDisplayName: gateway.displayName }),
              client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
              client.fromPhoneNumber,
            )
          }
        } else if (gateway.sentVitalsAlertAt !== null) {
          const logMessage = `Reconnection: ${gateway.displayName} Gateway.`
          helpers.logSentry(logMessage)

          await db.updateGatewaySentVitalsAlerts(gateway.id, false)

          sendNotification(
            i18next.t('gatewayReconnection', { lng: client.language, gatewayDisplayName: gateway.displayName }),
            client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
            client.fromPhoneNumber,
          )
        }
      }
    }
  } catch (e) {
    helpers.logError(`Failed to check gateway heartbeat: ${e}`)
  }
}

async function checkButtonBatteries() {
  try {
    const THRESHOLD = helpers.getEnvVar('BUTTON_LOW_BATTERY_ALERT_THRESHOLD')
    const SUBSEQUENT_THRESHOLD = helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD')

    const buttonsVitals = await db.getRecentButtonsVitals()

    for (const buttonsVital of buttonsVitals) {
      const currentTime = await db.getCurrentTime()
      const button = buttonsVital.button
      const client = button.client

      if (button.isActive && client.isActive) {
        if (buttonsVital.batteryLevel !== null && buttonsVital.batteryLevel < THRESHOLD) {
          if (button.sentLowBatteryAlertAt === null) {
            const logMessage = `Low Battery: ${client.displayName} ${button.displayName} Button battery level is ${buttonsVital.batteryLevel}%.`
            helpers.logSentry(logMessage)

            await db.updateButtonsSentLowBatteryAlerts(button.id, true)

            sendNotification(
              i18next.t('buttonLowBatteryInitial', { lng: client.language, buttonDisplayName: button.displayName }),
              client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
              client.fromPhoneNumber,
            )
          } else if (differenceInSeconds(currentTime, button.sentLowBatteryAlertAt) > SUBSEQUENT_THRESHOLD) {
            await db.updateButtonsSentLowBatteryAlerts(button.id, true)

            sendNotification(
              i18next.t('buttonLowBatteryReminder', { lng: client.language, buttonDisplayName: button.displayName }),
              client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
              client.fromPhoneNumber,
            )
          }
        } else if (button.sentLowBatteryAlertAt !== null && buttonsVital.batteryLevel > 80) {
          const logMessage = `Battery recharged: ${client.displayName} ${button.displayName} Button.`
          helpers.logSentry(logMessage)

          await db.updateButtonsSentLowBatteryAlerts(button.id, false)

          sendNotification(
            i18next.t('buttonLowBatteryNoLonger', { lng: client.language, buttonDisplayName: button.displayName }),
            client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
            client.fromPhoneNumber,
          )
        }
      }
    }
  } catch (e) {
    helpers.logError(`Failed to check button batteries: ${e}`)
  }
}

async function checkButtonHeartbeat() {
  try {
    const THRESHOLD = helpers.getEnvVar('RAK_BUTTONS_VITALS_ALERT_THRESHOLD')

    const buttonsVitals = await db.getRecentButtonsVitals()

    for (const buttonsVital of buttonsVitals) {
      const button = buttonsVital.button
      const client = button.client

      if (button.isActive && client.isActive) {
        const currentTime = await db.getCurrentTime()
        const buttonDelay = differenceInSeconds(currentTime, buttonsVital.createdAt)
        const buttonThreholdExceeded = buttonDelay > THRESHOLD
        if (buttonThreholdExceeded) {
          if (button.sentVitalsAlertAt === null) {
            const logMessage = `Disconnection: ${client.displayName} ${button.displayName} Button delay is ${buttonDelay} seconds.`
            helpers.logSentry(logMessage)

            await db.updateButtonsSentVitalsAlerts(button.id, true)

            // TODO Also send a text message to Responders and Heartbeat Phone Numbers once we know that these messages are reliable
          }
          // TODO Also send a text message reminder once we know that these messages are reliable
        } else if (button.sentVitalsAlertAt !== null) {
          const logMessage = `Reconnection: ${client.displayName} ${button.displayName} Button.`
          helpers.logSentry(logMessage)

          await db.updateButtonsSentVitalsAlerts(button.id, false)

          // TODO Also send a text message to Responders and Heartbeat Phone Numbers once we know that these messages are reliable
        }
      }
    }
  } catch (e) {
    helpers.logError(`Failed to check button heartbeat: ${e}`)
  }
}

async function handleHeartbeat(req, res) {
  try {
    const currentTime = new Date(await db.getCurrentTime())
    const flicLastSeenTime = subtractSeconds(currentTime, req.body.flic_last_seen_secs)
    const flicLastPingTime = subtractSeconds(currentTime, req.body.flic_last_ping_secs)
    const heartbeatLastSeenTime = currentTime
    await db.saveHeartbeat(req.body.system_id, flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime)
    res.status(200).send()
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
}

module.exports = {
  checkButtonBatteries,
  checkButtonHeartbeat,
  checkGatewayHeartbeat,
  checkHubHeartbeat,
  handleHeartbeat,
  setup,
}
