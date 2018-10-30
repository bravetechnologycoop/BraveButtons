const STATES = require('./SessionStateEnum.js'); 

const incidentTypes = {
	'0': 'Accidental',
	'1': 'Safer Use',
	'2': 'Unsafe Guest',
	'3': 'Overdose'
};

class SessionState {

  constructor(uuid, unit, phoneNumber, state=STATES.STARTED, numPresses=1) {
        this.uuid = uuid;
        this.unit = unit;
        this.phoneNumber = phoneNumber;
        this.state = state;
        this.completed = this.isCompleted();
        this.incidentType = null;
        this.numPresses = numPresses;
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
			this.state = STATES.COMPLETED;
			returnMessage = 'Thank you.';
			break;
		case STATES.COMPLETED:
			break;
		case STATES.TIMED_OUT:
			break;
		default:
			returnMessage = 'Thank you for responding. Unfortunately, we have encountered an error in our system and will deal with it shortly.';
			break;	
  	}

  	return returnMessage;		

  }

  setIncidentType(numType) {   //TODO: how strict do we want to be with this? 

  	if (numType in incidentTypes) {
  		this.incidentType = incidentTypes[numType];
  		return true;
  	}
  	return false;

  }

  update(uuid, unit, phoneNumber, state) {

  	if (!this.isCompleted()) //there is an ongoing request for help 
		{ if (this.uuid == uuid) {
			this.incrementButtonPresses();
		} 
		} else {
			this.uuid = uuid;
			this.unit = unit;
			this.phoneNumber = phoneNumber;
			this.state = state;
			this.completed = this.isCompleted();
			this.numPresses = 1;
		}
	}
  
  incrementButtonPresses() {
  	this.numPresses += 1;
  }

  isCompleted() { // a request can move down the queue once the incident is dealt with
  	return (this.state == STATES.WAITING_FOR_CATEGORY || this.state == STATES.WAITING_FOR_DETAILS || this.state == STATES.COMPLETED || this.state == STATES.TIMED_OUT);
  }

  complete() {
  	this.state = STATES.COMPLETED;
  	this.completed = true;
  }
}

module.exports = SessionState;