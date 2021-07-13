/* eslint-disable class-methods-use-this */
const { BraveAlerter, AlertSession, ALERT_TYPE, ALERT_STATE, helpers, Location, SYSTEM, HistoricAlert } = require('brave-alert-lib')
const db = require('./db/db.js')

class BraveAlerterConfigurator {
  createBraveAlerter() {
    return new BraveAlerter(
      this.getAlertSession.bind(this),
      this.getAlertSessionByPhoneNumber.bind(this),
      this.alertSessionChangedCallback,
      this.getLocationByAlertApiKey.bind(this),
      this.getHistoricAlertsByAlertApiKey.bind(this),
      this.getNewNotificationsCountByAlertApiKey.bind(this),
      true,
      this.getReturnMessage.bind(this),
    )
  }

  async getAlertSession(sessionId) {
    let alertSession = null
    try {
      const session = await db.getSessionWithSessionId(sessionId)
      if (session === null) {
        return null
      }

      const installation = await db.getInstallationWithInstallationId(session.installationId)

      const incidentCategoryKeys = this.createIncidentCategoryKeys(installation.incidentCategories)

      alertSession = new AlertSession(
        session.id,
        session.state,
        session.incidentType,
        session.notes,
        `There has been a request for help from Unit ${session.unit} . Please respond "Ok" when you have followed up on the call.`,
        installation.responderPhoneNumber,
        incidentCategoryKeys,
        installation.incidentCategories,
      )
    } catch (e) {
      helpers.logError(`getAlertSession: failed to get and create a new alert session: ${JSON.stringify(e)}`)
    }

    return alertSession
  }

  async getAlertSessionByPhoneNumber(toPhoneNumber) {
    let alertSession = null

    try {
      const session = await db.getMostRecentIncompleteSessionWithPhoneNumber(toPhoneNumber)
      if (session === null) {
        return null
      }

      const installation = await db.getInstallationWithInstallationId(session.installationId)

      const incidentCategoryKeys = this.createIncidentCategoryKeys(installation.incidentCategories)

      alertSession = new AlertSession(
        session.id,
        session.state,
        session.incidentType,
        session.notes,
        `There has been a request for help from Unit ${session.unit} . Please respond "Ok" when you have followed up on the call.`,
        installation.responderPhoneNumber,
        incidentCategoryKeys,
        installation.incidentCategories,
      )
    } catch (e) {
      helpers.logError(`getAlertSessionByPhoneNumber: failed to get and create a new alert session: ${JSON.stringify(e)}`)
    }

    return alertSession
  }

  async alertSessionChangedCallback(alertSession) {
    let client

    try {
      client = await db.beginTransaction()
      if (client === null) {
        helpers.logError(`alertSessionChangedCallback: Error starting transaction`)
        return
      }

      const session = await db.getSessionWithSessionId(alertSession.sessionId, client)

      if (session) {
        if (alertSession.alertState) {
          session.state = alertSession.alertState
        }

        if (alertSession.incidentCategoryKey) {
          const installation = await db.getInstallationWithSessionId(alertSession.sessionId, client)
          session.incidentType = installation.incidentCategories[alertSession.incidentCategoryKey]
        }

        if (alertSession.details) {
          session.notes = alertSession.details
        }

        if (alertSession.fallbackReturnMessage) {
          session.fallBackAlertTwilioStatus = alertSession.fallbackReturnMessage
        }

        if (alertSession.alertState === ALERT_STATE.WAITING_FOR_CATEGORY) {
          session.respondedAt = await db.getCurrentTime(client)
        }

        await db.saveSession(session, client)
      }

      await db.commitTransaction(client)
    } catch (e) {
      try {
        await db.rollbackTransaction(client)
        helpers.logError(`alertSessionChangedCallback: Rolled back transaction because of error: ${e}`)
      } catch (error) {
        // Do nothing
        helpers.logError(`alertSessionChangedCallback: Error rolling back transaction: ${e}`)
      }
    }
  }

  async getLocationByAlertApiKey(alertApiKey) {
    const installations = await db.getInstallationsWithApiKey(alertApiKey)

    if (!Array.isArray(installations) || installations.length === 0) {
      return null
    }

    // Even if there is more than one matching installation, we only return one and it will
    // be used by the Alert App to indentify this installation
    return new Location(installations[0].name, SYSTEM.BUTTONS)
  }

  createHistoricAlertFromRow(row) {
    const alertType = row.num_presses > 1 ? ALERT_TYPE.BUTTONS_URGENT : ALERT_TYPE.BUTTONS_NOT_URGENT
    return new HistoricAlert(row.id, row.unit, row.incident_type, alertType, row.num_presses, row.created_at, row.responded_at)
  }

  // Historic Alerts are those with status "Completed" or that were last updated longer ago than the SESSION_RESET_TIMEOUT
  async getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts) {
    const maxTimeAgoInMillis = helpers.getEnvVar('SESSION_RESET_TIMEOUT')

    const historicAlerts = await db.getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts, maxTimeAgoInMillis)

    if (!Array.isArray(historicAlerts)) {
      return null
    }

    return historicAlerts.map(this.createHistoricAlertFromRow)
  }

  async getNewNotificationsCountByAlertApiKey(alertApiKey) {
    const count = await db.getNewNotificationsCountByAlertApiKey(alertApiKey)
    return count
  }

  getReturnMessage(fromAlertState, toAlertState, incidentCategories) {
    let returnMessage

    switch (fromAlertState) {
      case ALERT_STATE.STARTED:
      case ALERT_STATE.WAITING_FOR_REPLY:
        returnMessage = this.createResponseStringFromIncidentCategories(incidentCategories)
        break

      case ALERT_STATE.WAITING_FOR_CATEGORY:
        if (toAlertState === ALERT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = "Sorry, the incident type wasn't recognized. Please try again."
        } else if (toAlertState === ALERT_STATE.WAITING_FOR_DETAILS) {
          returnMessage = 'Thank you. If you like, you can reply with any further details about the incident.'
        }
        break

      case ALERT_STATE.WAITING_FOR_DETAILS:
        returnMessage = "Thank you. This session is now complete. (You don't need to respond to this message.)"
        break

      case ALERT_STATE.COMPLETED:
        returnMessage = "There is no active session for this button. (You don't need to respond to this message.)"
        break

      default:
        returnMessage = 'Thank you for responding. Unfortunately, we have encountered an error in our system and will deal with it shortly.'
        break
    }

    return returnMessage
  }

  createIncidentCategoryKeys(incidentCategories) {
    // Incident categories in Buttons are always 0-indexed
    const incidentCategoryKeys = []
    for (let i = 0; i < incidentCategories.length; i += 1) {
      incidentCategoryKeys.push(i.toString())
    }

    return incidentCategoryKeys
  }

  createResponseStringFromIncidentCategories(categories) {
    function reducer(accumulator, currentValue, currentIndex) {
      return `${accumulator}${currentIndex} - ${currentValue}\n`
    }

    const s = `Now that you have responded, please reply with the number that best describes the incident:\n${categories.reduce(reducer, '')}`

    return s
  }
}

module.exports = BraveAlerterConfigurator
