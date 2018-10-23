let chai = require('chai');
let SessionState = require('../SessionState.js');
const expect = chai.expect;

describe('Session state manager', () => {

		let state;

		beforeEach(function() {
			state = new SessionState('111', '222', false);
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
			expect(state.completed).to.be.true;
		})

		it('should update numPresses when updated with same uuid and current session not complete', () => {
			state.update('111', '222', false);
			expect(state.uuid).to.deep.equal('111');
			expect(state.numPresses).to.deep.equal(2);
		});

		it('should ignore updates with different uuid when current session not complete', () => {
			state.update('222', '222', false);
			expect(state.uuid).to.deep.equal('111');
			expect(state.numPresses).to.deep.equal(1);
		});

		it('should reset numPresses when updated with same uuid and current session is complete', () => {
			state.update('111', '222', false);
			expect(state.numPresses).to.deep.equal(2);
			state.update('111', '222', false);
			expect(state.numPresses).to.deep.equal(3);
			state.complete();
			state.update('111', '222', false); 
			expect(state.numPresses).to.deep.equal(1);
			expect(state.completed).to.be.false;
		});

		it('should update uuid when updated with different uuid and current session is complete', () => {
			state.update('111', '222', false);
			expect(state.numPresses).to.deep.equal(2);
			state.update('111', '222', false);
			expect(state.numPresses).to.deep.equal(3);
			state.complete();
			state.update('222', '333', false); 
			expect(state.uuid).to.deep.equal('222');
			expect(state.unit).to.deep.equal('333');
			expect(state.numPresses).to.deep.equal(1);
			expect(state.completed).to.be.false;
		});

		it('should update numPresses even after having ignored updates', () => {
			state.update('111', '222', false);
			expect(state.numPresses).to.deep.equal(2);
			state.update('111', '222', false);
			expect(state.numPresses).to.deep.equal(3);
			state.update('222', '222', false); 
			expect(state.numPresses).to.deep.equal(3);
			state.update('111', '222', false); 
			expect(state.numPresses).to.deep.equal(4);
		});



});