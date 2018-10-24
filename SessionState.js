const STATES = require('./SessionStateEnum.js'); 

class SessionState {

  constructor(uuid, unit, state=STATES.STARTED, numPresses=1) {
        this.uuid = uuid;
        this.unit = unit;
        this.state = state;
        this.completed = this.isCompleted();
        this.numPresses = numPresses;
  } 


  update(uuid, unit, state) {

  	if (!this.isCompleted()) //there is an ongoing request for help 
		{ if (this.uuid == uuid) {
				this.incrementButtonPresses();
			} else { // TODO: add queue
			}
		} else {
			this.uuid = uuid;
			this.unit = unit;
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