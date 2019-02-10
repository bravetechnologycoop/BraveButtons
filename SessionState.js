const STATES = require('./SessionStateEnum.js');
let moment = require('moment');

const incidentTypes = {
	'0': 'Accidental',
	'1': 'Safer Use',
	'2': 'Unsafe Guest',
	'3': 'Overdose'
};

class SessionState {

    constructor(uuid, unit, phoneNumber, state=STATES.STARTED, numPresses) {
        this.uuid = uuid
        this.unit = unit
        this.phoneNumber = phoneNumber
        this.state = state
        this.numPresses = numPresses
        
        this.incidentType = null
        this.notes = null
        
        this.respondedTo = this.isRespondedTo()        
        this.createdAt = moment().toISOString()
        this.updatedAt = moment().toISOString()
    }

    static createSessionStateFromJSON(json) {

        let sessionState = new SessionState(json.uuid, json.unit, json.phoneNumber, json.state, json.numPresses)

        sessionState.createdAt = json.createdAt
        sessionState.updatedAt = json.updatedAt

        if(json.hasOwnProperty('incidentType')) {
            sessionState.incidentType = json.incidentType
        }
        if(json.hasOwnProperty('notes')) {
            sessionState.notes = json.notes
        }

        return sessionState        
    }

    toJSON() {
        let json = {
            'uuid': this.uuid,
            'unit': this.unit,
            'phoneNumber': this.phoneNumber,
            'state': this.state,
            'numPresses': this.numPresses,
            'createdAt': this.createdAt,
            'updatedAt': this.updatedAt,
            'respondedTo': this.respondedTo
        }
        
        if(this.hasOwnProperty('incidentType')) {
            json['incidentType'] = this.incidentType
        }
        if(this.hasOwnProperty('notes')) {
            json['notes'] = this.notes
        }

        return json
    }

    advanceSession(messageText) {

  	    let returnMessage;

        switch (this.state) {
            case STATES.STARTED:
                this.state = STATES.WAITING_FOR_CATEGORY;
                returnMessage = 'Thank you for responding.\n Please reply with the number that best describes the nature of the incident\n0 - accidental\n1 - safer use\n2 - unsafe guest\n3 - overdose';
                break;
            case STATES.WAITING_FOR_REPLY:
                this.state = STATES.WAITING_FOR_CATEGORY;
                returnMessage = 'Thank you for responding.\n Please reply with the number that best describes the nature of the incident\n0 - accidental\n1 - safer use\n2 - unsafe guest\n3 - overdose';
                break;
            case STATES.WAITING_FOR_CATEGORY:
                let isValid = this.setIncidentType(messageText.trim());
                this.state = isValid ? STATES.WAITING_FOR_DETAILS : STATES.WAITING_FOR_CATEGORY;
                returnMessage = this.setIncidentType(messageText.trim()) ? 'Thank you. Please add any further details about the incident or comment about this interface.' : 'Sorry, the incident type wasn\'nt recognized. Please try again';
                break;
            case STATES.WAITING_FOR_DETAILS:
                this.notes = messageText.trim();
                this.state = STATES.COMPLETED;
                returnMessage = 'Thank you.';
                break;
            case STATES.COMPLETED:
                returnMessage = 'There is no active session for this button.';
                break;
            case STATES.TIMED_OUT:
                returnMessage = 'There is no active session for this button.';
                break;
            default:
                returnMessage = 'Thank you for responding. Unfortunately, we have encountered an error in our system and will deal with it shortly.';
                break;
        }

        this.updatedAt = moment().toISOString();

        return returnMessage;
    }

    setIncidentType(numType) {

        if (numType in incidentTypes) {
            this.incidentType = incidentTypes[numType];
            return true;
        }
        return false;
    }

    incrementButtonPresses(numPresses) {
        this.numPresses += numPresses
        this.updatedAt = moment().toISOString();
    }

	isRespondedTo() {
		return (this.state == STATES.WAITING_FOR_CATEGORY || this.state == STATES.WAITING_FOR_DETAILS || this.state == STATES.COMPLETED);
	}
}

module.exports = SessionState;
