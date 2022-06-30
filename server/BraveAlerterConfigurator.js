/* eslint-disable class-methods-use-this */
// Third-party dependencies
const { t } = require('i18next')

// In-house dependencies
const { BraveAlerter, AlertSession, CHATBOT_STATE, helpers, Location, SYSTEM, HistoricAlert, ActiveAlert } = require('brave-alert-lib')
const db = require('./db/db.js')

class BraveAlerterConfigurator {
  createBraveAlerter() {
    return new BraveAlerter(
      this.getAlertSession.bind(this),
      this.getAlertSessionByPhoneNumber.bind(this),
      this.getAlertSessionBySessionIdAndAlertApiKey.bind(this),
      this.alertSessionChangedCallback,
      this.getLocationByAlertApiKey.bind(this),
      this.getActiveAlertsByAlertApiKey.bind(this),
      this.getHistoricAlertsByAlertApiKey.bind(this),
      this.getNewNotificationsCountByAlertApiKey.bind(this),
      this.getReturnMessageToRespondedByPhoneNumber.bind(this),
      this.getReturnMessageToOtherResponderPhoneNumbers.bind(this),
    )
  }

  async getAlertSession(sessionId) {
    let alertSession = null
    try {
      const session = await db.getSessionWithSessionId(sessionId)
      if (session === null) {
        return null
      }

      const incidentCategoryKeys = this.createIncidentCategoryKeys(session.button.client.incidentCategories)

      const client = session.button.client
      alertSession = new AlertSession(
        session.id,
        session.chatbotState,
        session.respondedByPhoneNumber,
        session.incidentCategory,
        client.responderPhoneNumbers,
        incidentCategoryKeys,
        client.incidentCategories,
        client.language,
      )
    } catch (e) {
      helpers.logError(`getAlertSession: failed to get and create a new alert session: ${JSON.stringify(e)}`)
    }

    return alertSession
  }

  async createAlertSessionFromSession(session) {
    const incidentCategoryKeys = this.createIncidentCategoryKeys(session.button.client.incidentCategories)

    const client = session.button.client
    return new AlertSession(
      session.id,
      session.chatbotState,
      session.respondedByPhoneNumber,
      session.incidentCategory,
      client.responderPhoneNumbers,
      incidentCategoryKeys,
      client.incidentCategories,
      client.language,
    )
  }

  async getAlertSessionByPhoneNumber(toPhoneNumber) {
    let alertSession = null

    try {
      const session = await db.getMostRecentSessionWithPhoneNumber(toPhoneNumber)
      if (session === null) {
        return null
      }

      alertSession = await this.createAlertSessionFromSession(session)
    } catch (e) {
      helpers.logError(`getAlertSessionByPhoneNumber: failed to get and create a new alert session: ${e.toString()}`)
    }

    return alertSession
  }

  async getAlertSessionBySessionIdAndAlertApiKey(sessionId, alertApiKey) {
    let alertSession = null
    try {
      const session = await db.getSessionWithSessionIdAndAlertApiKey(sessionId, alertApiKey)
      if (session === null) {
        return null
      }

      alertSession = await this.createAlertSessionFromSession(session)
    } catch (e) {
      helpers.logError(`getAlertSessionBySessionIdAndAlertApiKey: failed to get and create a new alert session: ${e.toString()}`)
    }

    return alertSession
  }

  async alertSessionChangedCallback(alertSession) {
    let pgClient
    let session

    try {
      pgClient = await db.beginTransaction()
      if (pgClient === null) {
        helpers.logError(`alertSessionChangedCallback: Error starting transaction`)
        return
      }

      session = await db.getSessionWithSessionId(alertSession.sessionId, pgClient)

      if (session) {
        // If this is not a OneSignal session (i.e. we are given a respondedByPhoneNumber) and the session has no respondedByPhoneNumber, then this is the first SMS response, so assign it as the session's respondedByPhoneNumber
        if (alertSession.respondedByPhoneNumber !== undefined && session.respondedByPhoneNumber === null) {
          session.respondedByPhoneNumber = alertSession.respondedByPhoneNumber
        }

        // If this is a OneSignal session (i.e. it isn't given the respondedByPhoneNumber) or if the SMS came from the session's respondedByPhoneNumber
        if (alertSession.respondedByPhoneNumber === undefined || alertSession.respondedByPhoneNumber === session.respondedByPhoneNumber) {
          if (alertSession.alertState) {
            session.chatbotState = alertSession.alertState
          }

          if (alertSession.incidentCategoryKey) {
            session.incidentCategory = session.button.client.incidentCategories[alertSession.incidentCategoryKey]
          }

          if (alertSession.alertState === CHATBOT_STATE.WAITING_FOR_CATEGORY && session.respondedAt === null) {
            session.respondedAt = await db.getCurrentTime(pgClient)
          }

          await db.saveSession(session, pgClient)
        }
      } else {
        helpers.logError(`alertSessionChangedCallback was called for a non-existent session: ${alertSession.sessionId}`)
      }

      await db.commitTransaction(pgClient)
    } catch (e) {
      try {
        await db.rollbackTransaction(pgClient)
        helpers.logError(`alertSessionChangedCallback: Rolled back transaction because of error: ${e}`)
      } catch (error) {
        // Do nothing
        helpers.logError(`alertSessionChangedCallback: Error rolling back transaction: ${e}`)
      }
    }

    return session.respondedByPhoneNumber
  }

  async getLocationByAlertApiKey(alertApiKey) {
    const clients = await db.getClientsWithAlertApiKey(alertApiKey)

    if (!Array.isArray(clients) || clients.length === 0) {
      return null
    }

    // Even if there is more than one matching clients, we only return one and it will
    // be used by the Alert App to indentify this client
    return new Location(clients[0].displayName, SYSTEM.BUTTONS)
  }

  createActiveAlertFromRow(row) {
    return new ActiveAlert(row.id, row.chatbot_state, row.display_name, row.alert_type, row.incident_categories, row.created_at)
  }

  // Active Alerts are those with status that is not "Completed" and were last updated SESSION_RESET_TIMEOUT ago or more recently
  async getActiveAlertsByAlertApiKey(alertApiKey) {
    const maxTimeAgoInMillis = helpers.getEnvVar('SESSION_RESET_TIMEOUT')

    const activeAlerts = await db.getActiveAlertsByAlertApiKey(alertApiKey, maxTimeAgoInMillis)

    if (!Array.isArray(activeAlerts)) {
      return null
    }

    return activeAlerts.map(this.createActiveAlertFromRow)
  }

  createHistoricAlertFromRow(row) {
    return new HistoricAlert(
      row.id,
      row.display_name,
      row.incident_category,
      row.alert_type,
      row.num_button_presses,
      row.created_at,
      row.responded_at,
    )
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

  getReturnMessageToRespondedByPhoneNumber(language, fromAlertState, toAlertState, incidentCategories) {
    let returnMessage

    switch (fromAlertState) {
      case CHATBOT_STATE.STARTED:
      case CHATBOT_STATE.WAITING_FOR_REPLY:
        returnMessage = t('incidentCategoryRequest', {
          lng: language,
          incidentCategories: this.createResponseStringFromIncidentCategories(incidentCategories),
        })
        break

      case CHATBOT_STATE.WAITING_FOR_CATEGORY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = t('incidentCategoryInvalid', { lng: language })
        } else if (toAlertState === CHATBOT_STATE.COMPLETED) {
          returnMessage = t('alertCompleted', { lng: language })
        }
        break

      case CHATBOT_STATE.COMPLETED:
        returnMessage = t('thankYou', { lng: language })
        break

      default:
        returnMessage = t('errorNoSession', { lng: language })
        break
    }

    return returnMessage
  }

  getReturnMessageToOtherResponderPhoneNumbers(language, fromAlertState, toAlertState, selectedIncidentCategory) {
    let returnMessage

    switch (fromAlertState) {
      case CHATBOT_STATE.STARTED:
      case CHATBOT_STATE.WAITING_FOR_REPLY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = t('alertAcknowledged', { lng: language })
        } else {
          returnMessage = null
        }
        break

      case CHATBOT_STATE.WAITING_FOR_CATEGORY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = null
        } else if (toAlertState === CHATBOT_STATE.COMPLETED) {
          returnMessage = t('incidentCategorized', { lng: language, incidentCategory: selectedIncidentCategory })
        }
        break

      case CHATBOT_STATE.COMPLETED:
        returnMessage = null
        break

      default:
        returnMessage = t('errorNoSession', { lng: language })
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

    return categories.reduce(reducer, '')
  }
}

module.exports = BraveAlerterConfigurator
