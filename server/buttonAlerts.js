// Third-party dependencies

// In-house dependencies
const { ALERT_TYPE, helpers, CHATBOT_STATE } = require('brave-alert-lib')
const db = require('./db/db.js')

const SUBSEQUENT_URGENT_MESSAGE_THRESHOLD = 2 * 60 * 1000

let braveAlerter

function setup(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

async function handleValidRequest(button, numPresses, batteryLevel) {
  helpers.log(
    `UUID: ${button.buttonId.toString()} SerialNumber: ${
      button.buttonSerialNumber
    } Unit: ${button.unit.toString()} Presses: ${numPresses.toString()} BatteryLevel: ${batteryLevel}`,
  )

  let pgClient

  try {
    pgClient = await db.beginTransaction()
    if (pgClient === null) {
      helpers.logError(`handleValidRequest: Error starting transaction`)
      return
    }

    // Need to check the Button's name again inside the transaction to avoid a race condition
    const isUnnamedDevice = helpers.isUnnamedDevice((await db.getButtonWithSerialNumber(button.buttonSerialNumber, pgClient)).unit)

    let currentSession = await db.getUnrespondedSessionWithButtonId(button.buttonId, pgClient)
    const currentTime = await db.getCurrentTime(pgClient)

    if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_TIMEOUT')) {
      currentSession = await db.createSession(
        button.client.id,
        button.buttonId,
        button.unit,
        button.phoneNumber,
        numPresses,
        batteryLevel !== undefined && batteryLevel >= 0 && batteryLevel <= 100 ? batteryLevel : null,
        null,
        isUnnamedDevice ? CHATBOT_STATE.NAMING_STARTED : CHATBOT_STATE.STARTED,
        null,
        null,
        pgClient,
      )
    } else {
      currentSession.incrementButtonPresses(numPresses)
      if (batteryLevel !== undefined && batteryLevel >= 0 && batteryLevel <= 100) {
        currentSession.updateBatteryLevel(batteryLevel)
      }
      await db.saveSession(currentSession, pgClient)
    }

    const client = await db.getClientWithId(currentSession.clientId, pgClient)

    if (isUnnamedDevice) {
      const alertInfo = {
        sessionId: currentSession.id,
        toPhoneNumber: client.responderPhoneNumber,
        fromPhoneNumber: currentSession.phoneNumber,
        responderPushId: client.responderPushId,
        deviceName: button.buttonSerialNumber,
        alertType: ALERT_TYPE.BUTTONS_NAMING,
        message: `Hello!\n\nLet's set up your new Brave Button (Serial #: ${button.buttonSerialNumber}) by giving it a recognizable name (for example, "Room 205").\n\nTo give your Button a name now, please reply with the name.\nTo give your Button a name later, please reply with "Later".`,
      }
      braveAlerter.startAlertSession(alertInfo)
    } else if (currentSession.numPresses === 1) {
      const alertInfo = {
        sessionId: currentSession.id,
        toPhoneNumber: client.responderPhoneNumber,
        fromPhoneNumber: currentSession.phoneNumber,
        responderPushId: client.responderPushId,
        deviceName: currentSession.unit,
        alertType: ALERT_TYPE.BUTTONS_NOT_URGENT,
        message: `There has been a request for help from Unit ${currentSession.unit.toString()} . Please respond "Ok" when you have followed up on the call.`,
        reminderTimeoutMillis: client.reminderTimeout * 1000,
        fallbackTimeoutMillis: client.fallbackTimeout * 1000,
        reminderMessage:
          'Please Respond "Ok" if you have followed up on your call. If you do not respond within 2 minutes an emergency alert will be issued to staff.',
        fallbackMessage: `There has been an unresponded request at ${client.displayName} unit ${currentSession.unit.toString()}`,
        fallbackToPhoneNumbers: client.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: client.fromPhoneNumber,
      }
      braveAlerter.startAlertSession(alertInfo)
    } else if (
      currentSession.numPresses % 5 === 0 ||
      currentSession.numPresses === 2 ||
      currentTime - currentSession.updatedAt >= SUBSEQUENT_URGENT_MESSAGE_THRESHOLD
    ) {
      braveAlerter.sendAlertSessionUpdate(
        currentSession.id,
        client.responderPushId,
        client.responderPhoneNumber,
        currentSession.phoneNumber,
        `This in an urgent request. The button has been pressed ${currentSession.numPresses.toString()} times. Please respond "Ok" when you have followed up on the call.`,
        `${helpers.getAlertTypeDisplayName(ALERT_TYPE.BUTTONS_URGENT)} Alert:\n${currentSession.unit.toString()}`,
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
