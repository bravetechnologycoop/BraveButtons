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

/* 
logClientMessage expects an object containing key-values that represent clients with recently disconnected and/or reconnected button(s)
Each key is a clientID that holds an object with the client information and arrays of any disconnected and/or reconnected buttons
The function will compile all this information into one message per client, and log the message to Sentry
*/
function logClientMessage(clientButtonStatusChanges) {
  // Loop through each client to create the log message
  Object.values(clientButtonStatusChanges).forEach(({ client, disconnectedButtons, reconnectedButtons }) => {
    const clientDisplayName = client.displayName
    let buttonLogMessage = ''

    if (disconnectedButtons.length > 0) {
      const buttonNames = disconnectedButtons.sort().join(', ')
      buttonLogMessage += ` The following buttons have been disconnected: ${buttonNames}.`
    }

    if (reconnectedButtons.length > 0) {
      const buttonNames = reconnectedButtons.sort().join(', ')
      buttonLogMessage += ` The following buttons have been reconnected: ${buttonNames}.`
    }

    helpers.logSentry(`Button status change for: ${clientDisplayName}.${buttonLogMessage}`)
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
        const buttonThreholdExceeded = buttonDelay > THRESHOLD
        if (buttonThreholdExceeded) {
          if (button.sentVitalsAlertAt === null) {
            const logMessage = `Disconnection: ${client.displayName} ${button.displayName} Button delay is ${buttonDelay} seconds.`
            helpers.logSentry(logMessage)

            // Check for disconnected gateways - if any disconnected gateways are returned, do not message the client
            const gateways = await db.getDisconnectedGatewaysWithClient(client)
            if (gateways !== null && gateways.length === 0) {
              // Store the client info
              if (!clientButtonStatusChanges[client.id]) {
                clientButtonStatusChanges[client.id] = {
                  client,
                  disconnectedButtons: [],
                  reconnectedButtons: [],
                }
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
            clientButtonStatusChanges[client.id] = {
              client,
              disconnectedButtons: [],
              reconnectedButtons: [],
            }
          }
          // Store the reconnected button name
          clientButtonStatusChanges[client.id].reconnectedButtons.push(button.displayName)
          await db.updateButtonsSentVitalsAlerts(button.id, false)
        }
      }
    }
    // Log one message per client
    logClientMessage(clientButtonStatusChanges)
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
