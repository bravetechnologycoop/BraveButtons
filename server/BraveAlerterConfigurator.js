const { BraveAlerter, AlertSession, ALERT_STATE } = require('brave-alert-lib')
const db = require('./db/db.js')

class BraveAlerterConfigurator {
    createBraveAlerter() {
        return new BraveAlerter(
            this.getAlertSession.bind(this),
            this.getAlertSessionByPhoneNumber.bind(this),
            this.alertSessionChangedCallback,
            true,
            this.getReturnMessage.bind(this),
        )
    }

    async getAlertSession(sessionId) {
        const session = await db.getSessionWithSessionId(sessionId)
        if (session === null) {
            return null
        }

        const installation = await db.getInstallationWithInstallationId(session.installationId)
    
        const incidentCategoryKeys = this.createIncidentCategoryKeys(installation.incidentCategories)
    
        let alertSession = new AlertSession(
            session.id,
            session.state,
            session.incidentType,
            session.notes,
            `There has been a request for help from Unit ${session.unit} . Please respond "Ok" when you have followed up on the call.`,
            installation.responderPhoneNumber,
            incidentCategoryKeys,
            installation.incidentCategories,
        )
    
        return alertSession
    }

    async getAlertSessionByPhoneNumber(toPhoneNumber) {
        const session = await db.getMostRecentIncompleteSessionWithPhoneNumber(toPhoneNumber)
        if (session === null) {
            return null
        }

        const installation = await db.getInstallationWithInstallationId(session.installationId)
    
        const incidentCategoryKeys = this.createIncidentCategoryKeys(installation.incidentCategories)
    
        let alertSession = new AlertSession(
            session.id,
            session.state,
            session.incidentType,
            session.notes,
            `There has been a request for help from Unit ${session.unit} . Please respond "Ok" when you have followed up on the call.`,
            installation.responderPhoneNumber,
            incidentCategoryKeys,
            installation.incidentCategories,
        )
    
        return alertSession
    }

    async alertSessionChangedCallback(alertSession) {
        let client = await db.beginTransaction()

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

            await db.saveSession(session, client)
        }

        await db.commitTransaction(client)
    }

    getReturnMessage(fromAlertState, toAlertState, incidentCategories) {
        let returnMessage

        switch(fromAlertState) {
            case ALERT_STATE.STARTED:
            case ALERT_STATE.WAITING_FOR_REPLY:
                returnMessage = this.createResponseStringFromIncidentCategories(incidentCategories)
                break

            case ALERT_STATE.WAITING_FOR_CATEGORY:
                if (toAlertState === ALERT_STATE.WAITING_FOR_CATEGORY) {
                    returnMessage = 'Sorry, the incident type wasn\'t recognized. Please try again.'
                }
                else if (toAlertState === ALERT_STATE.WAITING_FOR_DETAILS) {
                    returnMessage = 'Thank you. If you like, you can reply with any further details about the incident.'
                }
                break

            case ALERT_STATE.WAITING_FOR_DETAILS:
                returnMessage = 'Thank you. This session is now complete. (You don\'t need to respond to this message.)'
                break

            case ALERT_STATE.COMPLETED:
                returnMessage = 'There is no active session for this button. (You don\'t need to respond to this message.)'
                break

            default:
                returnMessage = 'Thank you for responding. Unfortunately, we have encountered an error in our system and will deal with it shortly.'
                break
        }

        return returnMessage
    }

    createIncidentCategoryKeys(incidentCategories) {
        // Incident categories in Buttons are always 0-indexed
        let incidentCategoryKeys = []
        for (var i = 0; i < incidentCategories.length; i++) {
            incidentCategoryKeys.push(i.toString())
        }
    
        return incidentCategoryKeys
    }
    
    createResponseStringFromIncidentCategories(categories) {
        const reducer = (accumulator, currentValue, currentIndex) => `${accumulator}${currentIndex} - ${currentValue}\n`
        const s = `Now that you have responded, please reply with the number that best describes the incident:\n${categories.reduce(reducer, '')}`
    
        return s
    }
}

module.exports = BraveAlerterConfigurator