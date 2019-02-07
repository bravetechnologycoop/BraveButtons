let chai = require('chai');
let SessionState = require('../SessionState.js');
const STATES = require('../SessionStateEnum.js');
let imports = require('../server.js')
let server = imports.server
let registry = imports.registry
let sessions = imports.sessions
let fs = require('fs');
let chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;
require('dotenv').load();
let Datastore = require('nedb-promise')

describe('Chatbot server', () => {

    const unit1UUID = '111'
    const unit1PhoneNumber = '+16664206969'

    const unit2UUID = '222'
    const unit2PhoneNumber = '+17774106868'

    const unit1FlicRequest_SingleClick = {
		'UUID': unit1UUID,
		'Type': 'click'
	};

	const unit1FlicRequest_DoubleClick = {
		'UUID': unit1UUID,
		'Type': 'double_click'
	};

	const unit1FlicRequest_Hold = {
		'UUID': unit1UUID,
		'Type': 'hold'
	};

	const unit2FlicRequest_SingleClick = {
		'UUID': unit2UUID,
		'Type': 'click'
	};

	const twilioMessageUnit1_InitialStaffResponse = {
		'From': process.env.RESPONDER_PHONE_TEST,
		'Body': 'Ok',
		'To': unit1PhoneNumber
	};

    const twilioMessageUnit1_IncidentCategoryResponse = {
        'From': process.env.RESPONDER_PHONE_TEST,
        'Body': '0',
        'To': unit1PhoneNumber
    }

    const twilioMessageUnit1_IncidentNotesResponse = {
        'From': process.env.RESPONDER_PHONE_TEST,
        'Body': 'Resident accidentally pressed button',
        'To': unit1PhoneNumber
    }

	describe('POST request: button press', () => {

		beforeEach(async function() {
            await sessions.remove({}, {multi: true})
            await registry.insert([{"uuid":unit1UUID,"unit":"1","phone":unit1PhoneNumber},
                                   {"uuid":unit2UUID,"unit":"2","phone":unit2PhoneNumber}])
		});

		afterEach(async function() {
            await sessions.remove({}, {multi: true})
            await registry.remove({}, {multi: true})
            sessions.nedb.persistence.compactDatafile()
            registry.nedb.persistence.compactDatafile()
	    });

		it('should return 400 to a request with an empty body', async () => {
			let response = await chai.request(server).post('/').send({});
			expect(response).to.have.status(400);
		});

		it('should return 400 to a request with an unregistered button', async () => {
			let response = await chai.request(server).post('/').send({'UUID': '666','Type': 'click'});
			expect(response).to.have.status(400);
		});

		it('should return 200 to a valid request', async () => {
			let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick);
			expect(response).to.have.status(200);
		});

		it('should be able to create a valid session state from valid request', async () => {
			
			let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick);

			let session = await sessions.findOne({'phoneNumber': unit1PhoneNumber})
            expect(session).to.not.be.null

            let currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);            
            expect(currentState).to.not.be.null;
            expect(currentState).to.have.property('uuid');
            expect(currentState).to.have.property('unit');
            expect(currentState).to.have.property('completed');
            expect(currentState).to.have.property('state');
            expect(currentState).to.have.property('numPresses');
            expect(currentState.uuid).to.deep.equal(unit1UUID);
            expect(currentState.unit).to.deep.equal('1');
            expect(currentState.completed).to.be.false;
            expect(currentState.numPresses).to.deep.equal(1);
		});

		it('should not confuse button presses from different rooms', async () => {

			let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick);
			response = await chai.request(server).post('/').send(unit2FlicRequest_SingleClick);

			let session = await sessions.findOne({'phoneNumber': unit1PhoneNumber})
            let currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            
            expect(currentState).to.not.be.null;
            expect(currentState).to.have.property('uuid');
            expect(currentState).to.have.property('unit');
            expect(currentState).to.have.property('completed');
            expect(currentState).to.have.property('numPresses');
            expect(currentState.uuid).to.deep.equal(unit1UUID);
            expect(currentState.unit).to.deep.equal('1');
            expect(currentState.completed).to.be.false;
            expect(currentState.numPresses).to.deep.equal(1);
		});

		it('should count button presses accurately during an active session', async () => {

			let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick);
		    response = await chai.request(server).post('/').send(unit1FlicRequest_DoubleClick);
			response = await chai.request(server).post('/').send(unit1FlicRequest_Hold);

			let session = await sessions.findOne({'phoneNumber': unit1PhoneNumber})
            let currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);

            expect(currentState).to.not.be.null;
            expect(currentState).to.have.property('uuid');
            expect(currentState).to.have.property('unit');
            expect(currentState).to.have.property('completed');
            expect(currentState).to.have.property('state');
            expect(currentState).to.have.property('numPresses');
            expect(currentState.uuid).to.deep.equal(unit1UUID);
            expect(currentState.unit).to.deep.equal('1');
            expect(currentState.completed).to.be.false;
            expect(currentState.numPresses).to.deep.equal(4);
		});
	});

	describe('POST request: twilio message', () => {

		beforeEach(async function() {
            await sessions.remove({}, {multi: true})
            await registry.insert([{"uuid":unit1UUID,"unit":"1","phone":unit1PhoneNumber},
                                   {"uuid":unit2UUID,"unit":"2","phone":unit2PhoneNumber}])
		});

		afterEach(async function() {
            await sessions.remove({}, {multi: true})
            await registry.remove({}, {multi: true})
            sessions.nedb.persistence.compactDatafile()
            registry.nedb.persistence.compactDatafile()
	    });

		it('should return ok to a valid request', async () => {
		    let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick);
			response = await chai.request(server).post('/message').send(twilioMessageUnit1_InitialStaffResponse);
			expect(response).to.have.status(200);
		});

		it('should return 400 to a request with incomplete data', async () => {
			let response = await chai.request(server).post('/message').send({'Body': 'hi'});
			expect(response).to.have.status(400);
		});

		it('should return 400 to a request from an invalid phone number', async () => {
			let response = await chai.request(server).post('/message').send({'Body': 'hi', 'From': '+16664206969'});
			expect(response).to.have.status(400);
		});

		it('should return ok to a valid request and advance the session appropriately', async () => {
            
		    let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick);

			let session = await sessions.findOne({'phoneNumber': unit1PhoneNumber})
            let currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            expect(currentState.state, 'state after initial button press').to.deep.equal(STATES.STARTED);

			response = await chai.request(server).post('/message').send(twilioMessageUnit1_InitialStaffResponse);
			expect(response).to.have.status(200);

            session = await sessions.findOne({'phoneNumber': unit1PhoneNumber})
            currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses);
            expect(currentState.state, 'state after initial staff response').to.deep.equal(STATES.WAITING_FOR_CATEGORY);

            response = await chai.request(server).post('/message').send(twilioMessageUnit1_IncidentCategoryResponse)
            expect(response).to.have.status(200)
 
            session = await sessions.findOne({'phoneNumber': unit1PhoneNumber})
            currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses)
            expect(currentState.state, 'state after staff have categorized the incident').to.deep.equal(STATES.WAITING_FOR_DETAILS)

            response = await chai.request(server).post('/message').send(twilioMessageUnit1_IncidentNotesResponse)
            expect(response).to.have.status(200)
 
            session = await sessions.findOne({'phoneNumber': unit1PhoneNumber})
            currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses)
            expect(currentState.state, 'state after staff have provided incident notes').to.deep.equal(STATES.COMPLETED) 
            expect(currentState.completed).to.be.true;

			// now start a new session for a different unit
			response = await chai.request(server).post('/').send(unit2FlicRequest_SingleClick);

    	    session = await sessions.findOne({'phoneNumber': unit2PhoneNumber})
            currentState = new SessionState(session.uuid, session.unit, session.phoneNumber, session.state, session.numPresses)
            expect(currentState.uuid).to.deep.equal(unit2UUID)
            expect(currentState.unit).to.deep.equal('2')
            expect(currentState.completed).to.be.false
            expect(currentState.numPresses).to.deep.equal(1)
		});
	});
});
