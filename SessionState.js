module.exports = class SessionState {

  constructor(uuid, unit, completed=false, numPresses=1) {
        this.uuid = uuid;
        this.unit = unit;
        this.completed = completed;
        this.numPresses = numPresses;
  } 

  update(uuid, unit, completed) {

  	if (!this.completed) //there is an ongoing request for help 
		{ if (this.uuid == uuid) {
				this.incrementButtonPresses();
			} else { // TODO: add queue
			}
		} else {
			this.uuid = uuid;
			this.unit = unit;
			this.completed = completed;
			this.numPresses = 1;
		}
	}
  
  incrementButtonPresses() {
  	this.numPresses += 1;
  }

  complete() {
  	this.completed = true;
  }
}