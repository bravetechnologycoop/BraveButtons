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

async function checkGatewayHeartbeat() {
  try {
    const THRESHOLD = helpers.getEnvVar('GATEWAY_VITALS_ALERT_THRESHOLD')
    const SUBSEQUENT_THRESHOLD = helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD')

    const gateways = await db.getGateways()

    for (const gateway of gateways) {
      // Get latest gateway statistics from AWS and store them in the DB
      const gatewayStats = await aws.getGatewayStats(gateway.id)
      if (gatewayStats !== null) {
        await db.logGatewaysVital(gateway.id, gatewayStats)
      }

      if (gateway.isSendingVitals && gateway.client.isSendingVitals) {
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

      if (button.isSendingVitals && client.isSendingVitals) {
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

function logClientMessage(clientMessages) {
  if (Object.keys(clientMessages).length > 0) {
    Object.values(clientMessages).forEach(({ client, disconnectedButtons, reconnectedButtons }) => {
      const clientDisplayName = client.displayName
      let buttonLogMessage = ''

      if (disconnectedButtons.length > 0) {
        const buttonNames = disconnectedButtons.join(', ')
        buttonLogMessage += ` The following buttons have been disconnected: ${buttonNames}.`
      }

      if (reconnectedButtons.length > 0) {
        const buttonNames = reconnectedButtons.join(', ')
        buttonLogMessage += ` The following buttons have been reconnected: ${buttonNames}.`
      }

      helpers.logSentry(`Button status change for: ${clientDisplayName}.${buttonLogMessage}`)
    })
  }
}

async function checkButtonHeartbeat() {
  try {
    // Object to track disconnected and reconnected buttons
    const clientMessages = {}

    const THRESHOLD = helpers.getEnvVar('RAK_BUTTONS_VITALS_ALERT_THRESHOLD')

    const buttonsVitals = await db.getRecentButtonsVitals()

    for (const buttonsVital of buttonsVitals) {
      const button = buttonsVital.button
      const client = button.client

      if (button.isSendingVitals && client.isSendingVitals) {
        const currentTime = await db.getCurrentTime()
        const buttonDelay = differenceInSeconds(currentTime, buttonsVital.createdAt)
        const buttonThreholdExceeded = buttonDelay > THRESHOLD
        if (buttonThreholdExceeded) {
          if (button.sentVitalsAlertAt === null) {
            const logMessage = `Disconnection: ${client.displayName} ${button.displayName} Button delay is ${buttonDelay} seconds.`
            helpers.logSentry(logMessage)

            await db.updateButtonsSentVitalsAlerts(button.id, true)

            // Check for inactive gateways - if an inactive gateway is returned, do not message the client
            const gateways = await db.getInactiveGatewaysWithClient(client)
            if (gateways !== null && gateways.length === 0) {
              // Store the client info
              if (!clientMessages[client.id]) {
                clientMessages[client.id] = {
                  client,
                  disconnectedButtons: [],
                  reconnectedButtons: [],
                }
              }
              // Store the disconnected button name and exit out of loop
              clientMessages[client.id].disconnectedButtons.push(button.displayName)
            }
          }
          // TODO Also send a text message reminder once we know that these messages are reliable
        } else if (button.sentVitalsAlertAt !== null) {
          const logMessage = `Reconnection: ${client.displayName} ${button.displayName} Button.`
          helpers.logSentry(logMessage)

          await db.updateButtonsSentVitalsAlerts(button.id, false)

          // Store the client info
          if (!clientMessages[client.id]) {
            clientMessages[client.id] = {
              client,
              disconnectedButtons: [],
              reconnectedButtons: [],
            }
          }
          // Store the reconnected button name
          clientMessages[client.id].reconnectedButtons.push(button.displayName)
        }
      }
    }
    // TODO - look into feature flag to turn sending notifications on/off

    // Log one message per client
    logClientMessage(clientMessages)
  } catch (e) {
    helpers.logError(`Failed to check button heartbeat: ${e}`)
  }
}

module.exports = {
  checkButtonBatteries,
  checkButtonHeartbeat,
  checkGatewayHeartbeat,
  setup,
}
