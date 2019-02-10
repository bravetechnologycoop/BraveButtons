let chai = require('chai');
let SessionState = require('../SessionState.js');
const STATES = require('../SessionStateEnum.js');

const expect = chai.expect;

describe('Session state manager', () => {

        const uuid = '12345'
        const unit = '1'
        const phoneNumber = '+14206666969'

		let state;

		beforeEach(function() {
			state = new SessionState(uuid, unit, phoneNumber, STATES.STARTED, 1);
		});

		it('should start off with 1 button press', () => {
			expect(state).to.have.property('numPresses');
			expect(state.numPresses).to.deep.equal(1);
		});

		it('should increment properly', () => {
			state.incrementButtonPresses(1);
			expect(state.numPresses).to.deep.equal(2);
			state.incrementButtonPresses(2);
			expect(state.numPresses).to.deep.equal(4);
		});

        it('should save and restore from json properly', () => {
            let json = state.toJSON()
            let newState = SessionState.createSessionStateFromJSON(json)
            expect(newState.uuid).to.deep.equal(uuid)
            expect(newState.unit).to.deep.equal(unit)
            expect(newState.phoneNumber).to.deep.equal(phoneNumber)
            expect(newState.state).to.deep.equal(STATES.STARTED)
            expect(newState.numPresses).to.deep.equal(1)
        })

		it('should advance the session when receiving an initial message', () => {
            expect(state.state).to.deep.equal(STATES.STARTED)
			state.advanceSession('ok');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY);
		});

		it('should advance the session when receiving an initial message (after a reminder has been sent)', () => {
			state.state = STATES.WAITING_FOR_REPLY;
			state.advanceSession('ok');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY);
		});

		it('should advance the session when receiving a message categorizing the incident', () => {
			state.state = STATES.WAITING_FOR_CATEGORY;
			state.advanceSession('3');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_DETAILS);
		});

		it('should advance the session when receiving a message categorizing the incident that contains whitespace', () => {
			state.state = STATES.WAITING_FOR_CATEGORY;
			state.advanceSession('3  ');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_DETAILS);
		});

		it('should not advance the session when receiving an invalid incident category', () => {
			state.state = STATES.WAITING_FOR_CATEGORY;
			state.advanceSession('fff');
			expect(state.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY);
		});
});
