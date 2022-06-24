// Third-party dependencies

// In-house dependencies
const { ALERT_TYPE, helpers, CHATBOT_STATE } = require('brave-alert-lib')
const db = require('./db/db.js')

const SUBSEQUENT_URGENT_MESSAGE_THRESHOLD = 2 * 60 * 1000

let braveAlerter

function setup(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

async function handleValidRequest(button, numButtonPresses, batteryLevel) {
  helpers.log(
    `UUID: ${button.buttonId.toString()} SerialNumber: ${
      button.buttonSerialNumber
    } Unit: ${button.displayName.toString()} Presses: ${numButtonPresses.toString()} BatteryLevel: ${batteryLevel}`,
  )

  let pgClient

  try {
    pgClient = await db.beginTransaction()
    if (pgClient === null) {
      helpers.logError(`handleValidRequest: Error starting transaction`)
      return
    }

    let currentSession = await db.getUnrespondedSessionWithButtonId(button.buttonId, pgClient)
    const currentTime = await db.getCurrentTime(pgClient)

    if (batteryLevel !== undefined && batteryLevel >= 0 && batteryLevel <= 100) {
      if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_TIMEOUT')) {
        currentSession = await db.createSession(button.buttonId, CHATBOT_STATE.STARTED, numButtonPresses, null, batteryLevel, null, null, pgClient)
      } else {
        currentSession.incrementButtonPresses(numButtonPresses)
        currentSession.updateBatteryLevel(batteryLevel)
        await db.saveSession(currentSession, pgClient)
      }
    } else if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_TIMEOUT')) {
      currentSession = await db.createSession(button.buttonId, CHATBOT_STATE.STARTED, numButtonPresses, null, null, null, null, pgClient)
    } else {
      currentSession.incrementButtonPresses(numButtonPresses)
      await db.saveSession(currentSession, pgClient)
    }

    if (currentSession.numButtonPresses === 1) {
      const alertInfo = {
        sessionId: currentSession.id,
        toPhoneNumbers: button.client.responderPhoneNumbers,
        fromPhoneNumber: button.phoneNumber,
        responderPushId: button.client.responderPushId,
        deviceName: button.displayName,
        alertType: ALERT_TYPE.BUTTONS_NOT_URGENT,
        message: `There has been a request for help from ${button.displayName.toString()} . Please respond "Ok" when you have followed up on the call.`,
        reminderTimeoutMillis: button.client.reminderTimeout * 1000,
        fallbackTimeoutMillis: button.client.fallbackTimeout * 1000,
        reminderMessage:
          'Please Respond "Ok" if you have followed up on your call. If you do not respond within 2 minutes an emergency alert will be issued to staff.',
        fallbackMessage: `There has been an unresponded request at ${button.client.displayName} ${button.displayName.toString()}`,
        fallbackToPhoneNumbers: button.client.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: button.client.fromPhoneNumber,
      }
      braveAlerter.startAlertSession(alertInfo)
    } else if (
      currentSession.numButtonPresses % 5 === 0 ||
      currentSession.numButtonPresses === 2 ||
      currentTime - currentSession.updatedAt >= SUBSEQUENT_URGENT_MESSAGE_THRESHOLD
    ) {
      braveAlerter.sendAlertSessionUpdate(
        currentSession.id,
        button.client.responderPushId,
        button.client.responderPhoneNumbers,
        button.phoneNumber,
        `This in an urgent request. The button has been pressed ${currentSession.numButtonPresses.toString()} times. Please respond "Ok" when you have followed up on the call.`,
        `${helpers.getAlertTypeDisplayName(ALERT_TYPE.BUTTONS_URGENT)} Alert:\n${button.displayName.toString()}`,
      )
    } else {
      // no alert to be sent
    }

    await db.commitTransaction(pgClient)
  } catch (e) {
    try {
      await db.rollbackTransaction(pgClient)
      helpers.logError(`handleValidRequest: Rolled back transaction because of error: ${e}`)
    } catch (error) {
      // Do nothing
      helpers.logError(`handleValidRequest: Error rolling back transaction: ${error} Rollback attempted because of error: ${e}`)
    }
  }
}

module.exports = {
  handleValidRequest,
  setup,
}
