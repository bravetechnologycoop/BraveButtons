// Third-party dependencies
/* eslint-disable no-continue */
const { DateTime } = require('luxon')
const { t } = require('i18next')

// In-house dependencies
const { helpers, twilioHelpers } = require('brave-alert-lib')
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
              t('gatewayDisconnectionInitial', { lng: client.language, gatewayDisplayName: gateway.displayName }),
              client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
              client.fromPhoneNumber,
            )
          } else if (differenceInSeconds(currentTime, gateway.sentVitalsAlertAt) > SUBSEQUENT_THRESHOLD) {
            await db.updateGatewaySentVitalsAlerts(gateway.id, true)

            sendNotification(
              t('gatewayDisconnectionReminder', { lng: client.language, gatewayDisplayName: gateway.displayName }),
              client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
              client.fromPhoneNumber,
            )
          }
        } else if (gateway.sentVitalsAlertAt !== null) {
          const logMessage = `Reconnection: ${gateway.displayName} Gateway.`
          helpers.logSentry(logMessage)

          await db.updateGatewaySentVitalsAlerts(gateway.id, false)

          sendNotification(
            t('gatewayReconnection', { lng: client.language, gatewayDisplayName: gateway.displayName }),
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
              t('buttonLowBatteryInitial', { lng: client.language, buttonDisplayName: button.displayName }),
              client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
              client.fromPhoneNumber,
            )
          } else if (differenceInSeconds(currentTime, button.sentLowBatteryAlertAt) > SUBSEQUENT_THRESHOLD) {
            await db.updateButtonsSentLowBatteryAlerts(button.id, true)

            sendNotification(
              t('buttonLowBatteryReminder', { lng: client.language, buttonDisplayName: button.displayName }),
              client.responderPhoneNumbers.concat(client.heartbeatPhoneNumbers),
              client.fromPhoneNumber,
            )
          }
        } else if (button.sentLowBatteryAlertAt !== null && buttonsVital.batteryLevel > 80) {
          const logMessage = `Battery recharged: ${client.displayName} ${button.displayName} Button.`
          helpers.logSentry(logMessage)

          await db.updateButtonsSentLowBatteryAlerts(button.id, false)

          sendNotification(
            t('buttonLowBatteryNoLonger', { lng: client.language, buttonDisplayName: button.displayName }),
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

// Send button status changes as text messages to every client that has them.
// This function expects an object (clientButtonStatusChanges) with client IDs as keys, and each each value an object with members:
// - client: The client object
// - disconnectedButtons: An array of button display names that refer to buttons that have recently disconnected
// - reconnectedButtons: An array of button display names that refer to buttons that have recently reconnected
function sendClientButtonStatusChanges(clientButtonStatusChanges) {
  // Loop through each client to create the Twilio messages
  Object.values(clientButtonStatusChanges).forEach(({ client, disconnectedButtons, reconnectedButtons }) => {
    let message = [t('buttonStatusChangeStart', { lng: client.language, clientDisplayName: client.displayName })]

    if (disconnectedButtons.length > 0) {
      const buttonDisplayNames = disconnectedButtons.sort().join(', ') // sorted alphabetically
      message.append(t('buttonStatusChangeDisconnected', { lng: client.language, buttonDisplayNames }))
    }

    if (reconnectedButtons.length > 0) {
      const buttonDisplayNames = reconnectedButtons.sort().join(', ') // sorted alphabetically
      message.append(t('buttonStatusChangeReconnected', { lng: client.language, buttonDisplayNames }))
    }

    // join the message parts with spaces
    message = message.join(' ')

    // send SMS text messages to each of the client's heartbeat phone numbers
    client.heartbeatPhoneNumbers.forEach(phoneNumber => {
      twilioHelpers.sendTwilioMessage(client.fromPhoneNumber, phoneNumber, message)
    })
  })
}

async function checkButtonHeartbeat() {
  try {
    // Object to track initial button disconnections and/or reconnections per client
    const clientButtonStatusChanges = {}

    const THRESHOLD = helpers.getEnvVar('RAK_BUTTONS_VITALS_ALERT_THRESHOLD')

    const buttonsVitals = await db.getRecentButtonsVitals()

    for (const buttonsVital of buttonsVitals) {
      const button = buttonsVital.button
      const client = button.client

      if (button.isSendingVitals && client.isSendingVitals) {
        const currentTime = await db.getCurrentTime()
        const buttonDelay = differenceInSeconds(currentTime, buttonsVital.createdAt)
        const buttonThresholdExceeded = buttonDelay > THRESHOLD
        if (buttonThresholdExceeded) {
          if (button.sentVitalsAlertAt === null) {
            const logMessage = `Disconnection: ${client.displayName} ${button.displayName} Button delay is ${buttonDelay} seconds.`
            helpers.logSentry(logMessage)

            // Check for disconnected gateways - if any disconnected gateways are returned, do not message the client
            const gateways = await db.getDisconnectedGatewaysWithClient(client)
            if (gateways !== null && gateways.length === 0) {
              // Store the client info
              if (!clientButtonStatusChanges[client.id]) {
                clientButtonStatusChanges[client.id] = { client, disconnectedButtons: [], reconnectedButtons: [] }
              }

              // Store the disconnected button name
              clientButtonStatusChanges[client.id].disconnectedButtons.push(button.displayName)
            }
            await db.updateButtonsSentVitalsAlerts(button.id, true)
          }
          // TODO Also send a text message reminder once we know that these messages are reliable
        } else if (button.sentVitalsAlertAt !== null) {
          const logMessage = `Reconnection: ${client.displayName} ${button.displayName} Button.`
          helpers.logSentry(logMessage)

          // Store the client info
          if (!clientButtonStatusChanges[client.id]) {
            clientButtonStatusChanges[client.id] = { client, disconnectedButtons: [], reconnectedButtons: [] }
          }

          // Store the reconnected button name
          clientButtonStatusChanges[client.id].reconnectedButtons.push(button.displayName)

          await db.updateButtonsSentVitalsAlerts(button.id, false)
        }
      }
    }

    // Send one message per client with button status changes
    sendClientButtonStatusChanges(clientButtonStatusChanges)
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
