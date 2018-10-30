let chai = require('chai');
let SessionState = require('../SessionState.js');
const STATES = require('../SessionStateEnum.js'); 

const expect = chai.expect;

describe('Session state manager', () => {

		let state;

		beforeEach(function() {
			state = new SessionState('111', '222', '+14206666969', STATES.STARTED);
		});

		it('should start off with 1 button press', () => {
			expect(state).to.have.property('numPresses');
			expect(state.numPresses).to.deep.equal(1);
		});

		it('should increment properly', () => {
			state.incrementButtonPresses();
			expect(state.numPresses).to.deep.equal(2);
			state.incrementButtonPresses();
			expect(state.numPresses).to.deep.equal(3);
		});

		it('completes properly', () => {
			expect(state.completed).to.be.false;
			state.complete();
			expect(state.state).to.deep.equal(STATES.COMPLETED);
			expect(state.completed).to.be.true;
		})

		it('should update numPresses when updated with same uuid and current session not complete', () => {
			state.update('111', '222', STATES.STARTED);
			expect(state.uuid).to.deep.equal('111');
			expect(state.numPresses).to.deep.equal(2);
		});

		it('should ignore updates with different uuid when current session not complete', () => {
			state.update('222', '222', STATES.STARTED);
			expect(state.uuid).to.deep.equal('111');
			expect(state.numPresses).to.deep.equal(1);
		});

		it('should reset numPresses when updated with same uuid and current session is complete', () => {
			state.update('111', '222', STATES.STARTED);
			expect(state.numPresses).to.deep.equal(2);
			state.update('111', '222', STATES.STARTED);
			expect(state.numPresses).to.deep.equal(3);
			state.complete();
			state.update('111', '222', STATES.STARTED); 
			expect(state.numPresses).to.deep.equal(1);
			expect(state.completed).to.be.false;
		});

		it('should update uuid when updated with different uuid and current session is complete', () => {
			state.update('111', '222', STATES.STARTED);
			expect(state.numPresses).to.deep.equal(2);
			state.update('111', '222', STATES.STARTED);
			expect(state.numPresses).to.deep.equal(3);
			state.complete();
			state.update('222', '333', STATES.STARTED); 
			expect(state.uuid).to.deep.equal('222');
			expect(state.unit).to.deep.equal('333');
			expect(state.numPresses).to.deep.equal(1);
			expect(state.completed).to.be.false;
		});

		it('should update numPresses even after having ignored updates', () => {
			state.update('111', '222', STATES.STARTED);
			expect(state.numPresses).to.deep.equal(2);
			state.update('111', '222', STATES.STARTED);
			expect(state.numPresses).to.deep.equal(3);
			state.update('222', '222', STATES.STARTED); 
			expect(state.numPresses).to.deep.equal(3);
			state.update('111', '222', STATES.STARTED); 
			expect(state.numPresses).to.deep.equal(4);
		});

		it ('advancing the session from started', () => {
			state.state = STATES.STARTED;
			state.advanceSession('ok');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY);
		});

		it ('advancing the session from waiting for reply', () => {
			state.state = STATES.WAITING_FOR_REPLY;
			state.advanceSession('ok');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY);
		});

		it ('advancing the session from waiting for category - valid category', () => {
			state.state = STATES.WAITING_FOR_CATEGORY;
			state.advanceSession('3');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_DETAILS);
		});

		it ('advancing the session from waiting for category - valid category (w whitespace)', () => {
			state.state = STATES.WAITING_FOR_CATEGORY;
			state.advanceSession('3  ');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_DETAILS);
		});

		it ('advancing the session from waiting for category - invalid category', () => {
			state.state = STATES.WAITING_FOR_CATEGORY;
			state.advanceSession('fff');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY);
		});



});