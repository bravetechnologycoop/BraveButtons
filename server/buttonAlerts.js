// Third-party dependencies
const { t } = require('i18next')

// In-house dependencies
const { ALERT_TYPE, helpers, CHATBOT_STATE } = require('brave-alert-lib')
const db = require('./db/db')

const SUBSEQUENT_URGENT_MESSAGE_THRESHOLD = 2 * 60 * 1000

let braveAlerter

function setup(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

async function handleValidRequest(button, numberOfAlerts) {
  // Log the request
  helpers.log(
    `id: ${button.id.toString()} SerialNumber: ${
      button.buttonSerialNumber
    } Unit: ${button.displayName.toString()} Presses: ${numberOfAlerts.toString()} Is Sending Alerts?: ${
      button.isSendingAlerts && button.client.isSendingAlerts
    }`,
  )

  // Don't start any sessions if this Button or Client is not sending alerts
  if (!button.isSendingAlerts || !button.client.isSendingAlerts) {
    return
  }

  let pgClient

  try {
    pgClient = await db.beginTransaction()
    if (pgClient === null) {
      helpers.logError(`handleValidRequest: Error starting transaction`)
      return
    }

    let currentSession = await db.getUnrespondedSessionWithButtonId(button.id, pgClient)
    const currentTime = await db.getCurrentTime(pgClient)

    if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_TIMEOUT')) {
      currentSession = await db.createSession(button.id, CHATBOT_STATE.STARTED, numberOfAlerts, null, null, null, pgClient)
    } else {
      currentSession.incrementButtonPresses(numberOfAlerts)
      await db.saveSession(currentSession, pgClient)
    }

    await db.commitTransaction(pgClient)

    if (currentSession.numberOfAlerts === 1) {
      const alertInfo = {
        sessionId: currentSession.id,
        toPhoneNumbers: button.client.responderPhoneNumbers,
        fromPhoneNumber: button.phoneNumber,
        deviceName: button.displayName,
        alertType: ALERT_TYPE.BUTTONS_NOT_URGENT,
        language: button.client.language,
        message: t('alertStart', { lng: button.client.language, buttonDisplayName: button.displayName.toString() }),
        reminderTimeoutMillis: button.client.reminderTimeout * 1000,
        fallbackTimeoutMillis: button.client.fallbackTimeout * 1000,
        reminderMessage: t('alertReminder', { lng: button.client.language }),
        fallbackMessage: t('alertFallback', {
          lng: button.client.language,
          clientDisplayName: button.client.displayName,
          buttonDisplayName: button.displayName,
        }),
        fallbackToPhoneNumbers: button.client.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: button.client.fromPhoneNumber,
      }
      await braveAlerter.startAlertSession(alertInfo) // includes a transaction, so must have already committed before this point
    } else if (
      currentSession.numberOfAlerts % 5 === 0 ||
      currentSession.numberOfAlerts === 2 ||
      currentTime - currentSession.updatedAt >= SUBSEQUENT_URGENT_MESSAGE_THRESHOLD
    ) {
      braveAlerter.sendAlertSessionUpdate(
        currentSession.id,
        button.client.responderPhoneNumbers,
        button.phoneNumber,
        t('alertUrgent', { lng: button.client.language, numberOfAlerts: currentSession.numberOfAlerts.toString() }),
        `${helpers.getAlertTypeDisplayName(ALERT_TYPE.BUTTONS_URGENT, button.client.language, t)} Alert:\n${button.displayName.toString()}`,
      )
    } else {
      // no alert to be sent
    }
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
