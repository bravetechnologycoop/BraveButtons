/* eslint-disable class-methods-use-this */
// Third-party dependencies
const { t } = require('i18next')

// In-house dependencies
const { BraveAlerter, AlertSession, CHATBOT_STATE, helpers } = require('brave-alert-lib')
const db = require('./db/db')

class BraveAlerterConfigurator {
  createBraveAlerter() {
    return new BraveAlerter(
      this.getAlertSession.bind(this),
      this.getAlertSessionByPhoneNumbers.bind(this),
      this.alertSessionChangedCallback,
      this.getReturnMessageToRespondedByPhoneNumber.bind(this),
      this.getReturnMessageToOtherResponderPhoneNumbers.bind(this),
      this.getClientMessageForRequestToReset.bind(this),
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

  async getAlertSessionByPhoneNumbers(devicePhoneNumber, responderPhoneNumber) {
    let alertSession = null

    try {
      const session = await db.getMostRecentSessionWithPhoneNumbers(devicePhoneNumber, responderPhoneNumber)
      if (session === null) {
        return null
      }

      alertSession = await this.createAlertSessionFromSession(session)
    } catch (e) {
      helpers.logError(`getAlertSessionByPhoneNumbers: failed to get and create a new alert session: ${e.toString()}`)
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
        // If the session has no respondedByPhoneNumber, then this is the first SMS response, so assign it as the session's respondedByPhoneNumber
        if (session.respondedByPhoneNumber === null) {
          session.respondedByPhoneNumber = alertSession.respondedByPhoneNumber
        }

        // If the SMS came from the session's respondedByPhoneNumber
        if (alertSession.respondedByPhoneNumber === session.respondedByPhoneNumber) {
          if (alertSession.alertState) {
            // If the client sends a request to reset, reject it by throwing an Error. This will result in the session not updating in the database.
            // NOTE: this *should* never happen, as the getClientMessageForRequestToReset function returns null. Thus, the alert state machine should
            // never transition from `STARTED` or `WAITING_FOR_REPLY` to `RESET`.
            if (alertSession.alertState === CHATBOT_STATE.RESET) {
              throw new Error('Alert state was RESET; this should not happen for Buttons.')
            }

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

    return { respondedByPhoneNumber: session.respondedByPhoneNumber }
  }

  getReturnMessageToRespondedByPhoneNumber(language, fromAlertState, toAlertState, incidentCategories) {
    let returnMessage

    switch (fromAlertState) {
      case CHATBOT_STATE.STARTED:
      case CHATBOT_STATE.WAITING_FOR_REPLY:
        if (toAlertState === CHATBOT_STATE.RESET) {
          returnMessage = t('thankYou', { lng: language })
        } else {
          returnMessage = t('incidentCategoryRequest', {
            lng: language,
            incidentCategories: this.createResponseStringFromIncidentCategories(incidentCategories, language),
          })
        }
        break

      case CHATBOT_STATE.WAITING_FOR_CATEGORY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = t('incidentCategoryInvalid', { lng: language })
        } else if (toAlertState === CHATBOT_STATE.COMPLETED) {
          returnMessage = t('alertCompleted', { lng: language })
        }
        break

      case CHATBOT_STATE.COMPLETED:
      case CHATBOT_STATE.RESET:
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
      case CHATBOT_STATE.RESET:
        returnMessage = null
        break

      default:
        returnMessage = t('errorNoSession', { lng: language })
        break
    }

    return returnMessage
  }

  getClientMessageForRequestToReset() {
    // disable reset functionality of the chatbot by returning null
    return null
  }

  createIncidentCategoryKeys(incidentCategories) {
    // Incident categories in Buttons are always 0-indexed
    const incidentCategoryKeys = []
    for (let i = 0; i < incidentCategories.length; i += 1) {
      incidentCategoryKeys.push(i.toString())
    }

    return incidentCategoryKeys
  }

  createResponseStringFromIncidentCategories(categories, language) {
    function reducer(accumulator, currentValue, currentIndex) {
      return `${accumulator}${currentIndex} - ${t(currentValue, { lng: language })}\n`
    }

    return categories.reduce(reducer, '')
  }
}

module.exports = BraveAlerterConfigurator
