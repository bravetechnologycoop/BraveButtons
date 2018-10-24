let chai = require('chai');
let SessionState = require('../SessionState.js');
const STATES = require('../SessionStateEnum.js'); 
let app = require('../server.js');
let fs = require('fs');
let chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;


describe('Chatbot server', () => {

	let baseUrl = "https://chatbot.brave.coop";
	let stateFilename = "buttonPressesTest"

	let defaultBody = {
		'Unit': '123',
		'UUID': '111'
	};

	let defaultBody2 = {
		'Unit': '222',
		'UUID': '222'
	};

	let twilioMessageBody = {
		'From': process.env.RESPONDER_PHONE,
		'Body': 'Please answer "Ok" to this message when you have responded to the alert.'
	};

    
	describe('POST request: button press', () => {

		let currentState;

		before(() => {
			fs.writeFileSync('./' + stateFilename + '.json', '{}');
		});

		it('should return 400 to a request with an empty body', async () => {
			let response = await chai.request(app).post('/') .send({});
			expect(response).to.have.status(400);
		});

		it('should return 400 to a request with an incomplete body', async () => {
			let response = await chai.request(app).post('/') .send({'Unit': '400'});
			expect(response).to.have.status(400);
		});

		it('should return ok to a valid request', async () => {
			let response = await chai.request(app).post('/') .send(defaultBody);
			expect(response).to.have.status(200);
		});

		it('should update the session state for a valid request', async () => {

			let currentState = null;

			let response = await chai.request(app).post('/').send(defaultBody);

			let stateData = JSON.parse(fs.readFileSync('./' + stateFilename + '.json'));
			currentState = new SessionState(stateData.uuid, stateData.unit, stateData.completed, stateData.numPresses);

			expect(currentState).to.not.be.null;
			expect(currentState).to.have.property('uuid');
			expect(currentState).to.have.property('unit');
			expect(currentState).to.have.property('completed');
			expect(currentState).to.have.property('state');
			expect(currentState).to.have.property('numPresses');
			expect(currentState.uuid).to.deep.equal(defaultBody.UUID);
			expect(currentState.unit).to.deep.equal(defaultBody.Unit);
			expect(currentState.completed).to.be.false;
			expect(currentState.numPresses).to.deep.equal(2);
		});

		it('should ignore requests from different uuid if session not completed', async () => {

			let currentState = null;

			let response = await chai.request(app).post('/').send(defaultBody);
			response = await chai.request(app).post('/').send(defaultBody2);

			let stateData = JSON.parse(fs.readFileSync('./' + stateFilename + '.json'));
			currentState = new SessionState(stateData.uuid, stateData.unit, stateData.completed, stateData.numPresses);

			expect(currentState).to.not.be.null;
			expect(currentState).to.have.property('uuid');
			expect(currentState).to.have.property('unit');
			expect(currentState).to.have.property('completed');
			expect(currentState).to.have.property('numPresses');
			expect(currentState.uuid).to.deep.equal(defaultBody.UUID);
			expect(currentState.unit).to.deep.equal(defaultBody.Unit);
			expect(currentState.completed).to.be.false;
			expect(currentState.numPresses).to.deep.equal(3);
		});

		it('should increment button presses when requests from same uuid if session not completed', async () => {

			let currentState = null;

			let response = await chai.request(app).post('/').send(defaultBody);
		    response = await chai.request(app).post('/').send(defaultBody);
			response = await chai.request(app).post('/').send(defaultBody);

			let stateData = JSON.parse(fs.readFileSync('./' + stateFilename + '.json'));
			currentState = new SessionState(stateData.uuid, stateData.unit, stateData.completed, stateData.numPresses);

			expect(currentState).to.not.be.null;
			expect(currentState).to.have.property('uuid');
			expect(currentState).to.have.property('unit');
			expect(currentState).to.have.property('completed');
			expect(currentState).to.have.property('numPresses');
			expect(currentState.uuid).to.deep.equal(defaultBody.UUID);
			expect(currentState.unit).to.deep.equal(defaultBody.Unit);
			expect(currentState.completed).to.be.false;
			expect(currentState.numPresses).to.deep.equal(6);
		});

	});

	describe('POST request: twilio message', () => {
		it('should return ok to a valid request', async () => {
			let response = await chai.request(app).post('/message').send(twilioMessageBody);
			expect(response).to.have.status(200);
		});
	});

	describe('POST request: twilio message', () => {
		it('should return ok to a valid request', async () => {
			let response = await chai.request(app).post('/message').send(twilioMessageBody);
			expect(response).to.have.status(200);
		});
	});

	after(() => {
			fs.writeFileSync('./' + stateFilename + '.json', '{}');
    });
});