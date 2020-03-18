const STATES = require('./SessionStateEnum.js')
const _ = require('lodash')

const incidentTypes = {
    '0': 'Accidental',
    '1': 'Safer Use',
    '2': 'Unsafe Guest',
    '3': 'Overdose',
    '4': 'Other'
}

class StateMachine {
    
    constructor(installation) {
        this.installation = installation
    }

    processStateTransitionWithMessage(sessionState, messageText) {
            
        let returnMessage
        let newSessionState = _.cloneDeep(sessionState)

        switch (sessionState.state) {
            case STATES.STARTED:
                newSessionState.state = STATES.WAITING_FOR_CATEGORY
                returnMessage = 'Now that you have responded, please reply with the number that best describes the incident:\n0 - accidental\n1 - safer use\n2 - unsafe guest\n3 - overdose\n4 - other'
                break
            case STATES.WAITING_FOR_REPLY:
                newSessionState.state = STATES.WAITING_FOR_CATEGORY
                returnMessage = 'Now that you have responded, please reply with the number that best describes the incident:\n0 - accidental\n1 - safer use\n2 - unsafe guest\n3 - overdose\n4 - other'
                break
            case STATES.WAITING_FOR_CATEGORY: {
                let numType = messageText.trim()
                if(numType in incidentTypes) {
                    newSessionState.state = STATES.WAITING_FOR_DETAILS
                    newSessionState.incidentType = numType
                    returnMessage = 'Thank you. If you like, you can reply with any further details about the incident.'
                }
                else {
                    returnMessage = 'Sorry, the incident type wasn\'t recognized. Please try again.'
                }
                break
            }
            case STATES.WAITING_FOR_DETAILS:
                newSessionState.notes = messageText.trim()
                newSessionState.state = STATES.COMPLETED
                returnMessage = "Thank you. This session is now complete. (You don't need to respond to this message.)"
                break
            case STATES.COMPLETED:
                returnMessage = "There is no active session for this button. (You don't need to respond to this message.)"
                break
            case STATES.TIMED_OUT:
                returnMessage = "There is no active session for this button. (You don't need to respond to this message.)"
                break
            default:
                returnMessage = 'Thank you for responding. Unfortunately, we have encountered an error in our system and will deal with it shortly.'
                break
        }

        return {newSessionState: newSessionState, returnMessage: returnMessage}
    }
}

module.exports = StateMachine
