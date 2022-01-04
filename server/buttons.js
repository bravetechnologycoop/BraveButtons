// Third-party dependencies

// In-house dependencies
const { ALERT_TYPE, helpers } = require('brave-alert-lib')
const db = require('./db/db.js')

const SUBSEQUENT_URGENT_MESSAGE_THRESHOLD = 2 * 60 * 1000
const unrespondedSessionReminderTimeoutMillis = helpers.getEnvVar('REMINDER_TIMEOUT_MS')
const unrespondedSessionAlertTimeoutMillis = helpers.getEnvVar('FALLBACK_TIMEOUT_MS')

let braveAlerter

function setup(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

async function handleValidRequest(button, numPresses, batteryLevel) {
  helpers.log(
    `UUID: ${button.button_id.toString()} SerialNumber: ${
      button.button_serial_number
    } Unit: ${button.unit.toString()} Presses: ${numPresses.toString()} BatteryLevel: ${batteryLevel}`,
  )

  let client

  try {
    client = await db.beginTransaction()
    if (client === null) {
      helpers.logError(`handleValidRequest: Error starting transaction`)
      return
    }

    let currentSession = await db.getUnrespondedSessionWithButtonId(button.button_id, client)
    const currentTime = await db.getCurrentTime(client)

    if (batteryLevel !== undefined && batteryLevel >= 0 && batteryLevel <= 100) {
      if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_TIMEOUT')) {
        currentSession = await db.createSession(
          button.installation_id,
          button.button_id,
          button.unit,
          button.phone_number,
          numPresses,
          batteryLevel,
          null,
          client,
        )
      } else {
        currentSession.incrementButtonPresses(numPresses)
        currentSession.updateBatteryLevel(batteryLevel)
        await db.saveSession(currentSession, client)
      }
    } else if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_TIMEOUT')) {
      currentSession = await db.createSession(
        button.installation_id,
        button.button_id,
        button.unit,
        button.phone_number,
        numPresses,
        null,
        null,
        client,
      )
    } else {
      currentSession.incrementButtonPresses(numPresses)
      await db.saveSession(currentSession, client)
    }

    const installation = await db.getInstallationWithInstallationId(currentSession.installationId, client)

    if (currentSession.numPresses === 1) {
      const alertInfo = {
        sessionId: currentSession.id,
        toPhoneNumber: installation.responderPhoneNumber,
        fromPhoneNumber: currentSession.phoneNumber,
        responderPushId: installation.responderPushId,
        deviceName: currentSession.unit,
        alertType: ALERT_TYPE.BUTTONS_NOT_URGENT,
        message: `There has been a request for help from Unit ${currentSession.unit.toString()} . Please respond "Ok" when you have followed up on the call.`,
        reminderTimeoutMillis: unrespondedSessionReminderTimeoutMillis,
        fallbackTimeoutMillis: unrespondedSessionAlertTimeoutMillis,
        reminderMessage:
          'Please Respond "Ok" if you have followed up on your call. If you do not respond within 2 minutes an emergency alert will be issued to staff.',
        fallbackMessage: `There has been an unresponded request at ${installation.name} unit ${currentSession.unit.toString()}`,
        fallbackToPhoneNumbers: installation.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: helpers.getEnvVar('TWILIO_FALLBACK_FROM_NUMBER'),
      }
      braveAlerter.startAlertSession(alertInfo)
    } else if (
      currentSession.numPresses % 5 === 0 ||
      currentSession.numPresses === 2 ||
      currentTime - currentSession.updatedAt >= SUBSEQUENT_URGENT_MESSAGE_THRESHOLD
    ) {
      braveAlerter.sendAlertSessionUpdate(
        currentSession.id,
        installation.responderPushId,
        installation.responderPhoneNumber,
        currentSession.phoneNumber,
        `This in an urgent request. The button has been pressed ${currentSession.numPresses.toString()} times. Please respond "Ok" when you have followed up on the call.`,
        `${helpers.getAlertTypeDisplayName(ALERT_TYPE.BUTTONS_URGENT)} Alert:\n${currentSession.unit.toString()}`,
      )
    } else {
      // no alert to be sent
    }

    await db.commitTransaction(client)
  } catch (e) {
    try {
      await db.rollbackTransaction(client)
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
