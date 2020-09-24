const STATES = require('./SessionStateEnum.js')
const _ = require('lodash')

function createResponseStringFromIncidentCategories(categories) {
    const reducer = (accumulator, currentValue, currentIndex) => `${accumulator}${currentIndex} - ${currentValue}\n`
    return `Now that you have responded, please reply with the number that best describes the incident:\n${categories.reduce(reducer, '')}`
}

function stringToNumber(string) {
    if(string.length === 0) {
        return NaN
    }
    return Number(string)   
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
                returnMessage = createResponseStringFromIncidentCategories(this.installation.incidentCategories)
                break
            case STATES.WAITING_FOR_REPLY:
                newSessionState.state = STATES.WAITING_FOR_CATEGORY
                returnMessage = createResponseStringFromIncidentCategories(this.installation.incidentCategories)
                break
            case STATES.WAITING_FOR_CATEGORY: {
                let categoryString = messageText.trim()
                let categoryNumber = stringToNumber(categoryString)
                if(categoryNumber >= 0 && categoryNumber < this.installation.incidentCategories.length) {
                    newSessionState.state = STATES.WAITING_FOR_DETAILS
                    newSessionState.incidentType = this.installation.incidentCategories[categoryNumber]
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
