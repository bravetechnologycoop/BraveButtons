const chai = require('chai')
const chaiHttp = require('chai-http')
const expect = chai.expect
const { after, afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require("sinon-chai")

chai.use(chaiHttp)
chai.use(sinonChai)

const STATES = require('../SessionStateEnum.js')
const imports = require('../server.js')
const server = imports.server
const db = imports.db
const twilioClient = imports.twilioClient

require('dotenv').load()

const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis))

describe('Chatbot server', () => {

    const unit1UUID = '111'
    const unit1SerialNumber = 'AAAA-A0A0A0'
    const unit1PhoneNumber = '+15005550006'

    const unit2UUID = '222'
    const unit2SerialNumber = 'BBBB-B0B0B0'
    const unit2PhoneNumber = '+15005550006'

    const installationResponderPhoneNumber = '+12345678900'
    const installationFallbackPhoneNumber = '+12345678900'
    const installationIncidentCategories = ['Accidental', 'Safer Use', 'Overdose', 'Other']

    const unit1FlicRequest_SingleClick = {
        'UUID': unit1UUID,
        'Type': 'click'
    };

    const unit1FlicRequest_DoubleClick = {
        'UUID': unit1UUID,
        'Type': 'double click'
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
        'From': installationResponderPhoneNumber,
        'Body': 'Ok',
        'To': unit1PhoneNumber
    };

    const twilioMessageUnit1_IncidentCategoryResponse = {
        'From': installationResponderPhoneNumber,
        'Body': '0',
        'To': unit1PhoneNumber
    }

    const twilioMessageUnit1_IncidentNotesResponse = {
        'From': installationResponderPhoneNumber,
        'Body': 'Resident accidentally pressed button',
        'To': unit1PhoneNumber
    }

    describe('POST request: power automate button press', () => {

        beforeEach(async function() {
            await db.clearSessions()
            await db.clearButtons()
            await db.clearInstallations()
            await db.createInstallation("TestInstallation", installationResponderPhoneNumber, installationFallbackPhoneNumber, installationIncidentCategories)
            let installations = await db.getInstallations()
            await db.createButton(unit1UUID, installations[0].id, "1", unit1PhoneNumber, unit1SerialNumber)
            await db.createButton(unit2UUID, installations[0].id, "2", unit2PhoneNumber, unit2SerialNumber)
        });

        afterEach(async function() {
            await db.clearSessions()
            await db.clearButtons()
            await db.clearInstallations()
            console.log('\n')
        });

        it('should return 400 to a request with an empty body', async () => {
            // Power Automate always sends two requests
            let response = await chai.request(server).post('/').send({})
            response = await chai.request(server).post('/').send({})

            expect(response).to.have.status(400);
        });

        it('should return 400 to a request with an unregistered button', async () => {
            // Power Automate always sends two requests
            let response = await chai.request(server).post('/').send({'UUID': '666','Type': 'click'})
            response = await chai.request(server).post('/').send({'UUID': '666','Type': 'click'})

            expect(response).to.have.status(400);
        });

        it('should return 200 to a valid request', async () => {
            // Power Automate always sends two requests
            let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)
            response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)

            expect(response).to.have.status(200);
        });

        it('should be able to create a valid session state from valid request', async () => {
            // Power Automate always sends two requests
            let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)
            response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)

            expect(response).to.have.status(200);

            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)
            
            let session = sessions[0]
            expect(session).to.not.be.null;
            expect(session).to.have.property('buttonId');
            expect(session).to.have.property('unit');
            expect(session).to.have.property('state');
            expect(session).to.have.property('numPresses');
            expect(session.buttonId).to.deep.equal(unit1UUID);
            expect(session.unit).to.deep.equal('1');
            expect(session.numPresses).to.deep.equal(1);
        });

        it('should not confuse button presses from different rooms', async () => {
            // Power Automate always sends two requests
            let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)
            response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)

            // Power Automate always sends two requests
            response = await chai.request(server).post('/').send(unit2FlicRequest_SingleClick)
            response = await chai.request(server).post('/').send(unit2FlicRequest_SingleClick)

            expect(response).to.have.status(200);

            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)

            let session = sessions[0]
            expect(session).to.not.be.null;
            expect(session).to.have.property('buttonId');
            expect(session).to.have.property('unit');
            expect(session).to.have.property('numPresses');
            expect(session.buttonId).to.deep.equal(unit1UUID);
            expect(session.unit).to.deep.equal('1');
            expect(session.numPresses).to.deep.equal(1);
        });

        it('should only create one new session when receiving multiple presses from the same button', async () => {

            await Promise.all([
                // Power Automate always sends two requests
                chai.request(server).post('/').send(unit1FlicRequest_SingleClick),
                chai.request(server).post('/').send(unit1FlicRequest_SingleClick),

                // Power Automate always sends two requests
                chai.request(server).post('/').send(unit1FlicRequest_DoubleClick),
                chai.request(server).post('/').send(unit1FlicRequest_DoubleClick),

                // Power Automate always sends two requests
                chai.request(server).post('/').send(unit1FlicRequest_Hold),
                chai.request(server).post('/').send(unit1FlicRequest_Hold),
            ])

            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)
        });

        it('should count button presses accurately during an active session', async () => {
            // Power Automate always sends two requests
            let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)
            response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)

            // Power Automate always sends two requests
            response = await chai.request(server).post('/').send(unit1FlicRequest_DoubleClick)
            response = await chai.request(server).post('/').send(unit1FlicRequest_DoubleClick)

            // Power Automate always sends two requests
            response = await chai.request(server).post('/').send(unit1FlicRequest_Hold)
            response = await chai.request(server).post('/').send(unit1FlicRequest_Hold)

            expect(response).to.have.status(200);

            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)

            let session = sessions[0]
            expect(session).to.not.be.null;
            expect(session).to.have.property('buttonId');
            expect(session).to.have.property('unit');
            expect(session).to.have.property('state');
            expect(session).to.have.property('numPresses');
            expect(session.buttonId).to.deep.equal(unit1UUID);
            expect(session.unit).to.deep.equal('1');
            expect(session.numPresses).to.deep.equal(4);
        });
    });

    describe('POST request: flic button press', () => {

        beforeEach(async function() {
            await db.clearSessions()
            await db.clearButtons()
            await db.clearInstallations()
            await db.createInstallation("TestInstallation", installationResponderPhoneNumber, installationFallbackPhoneNumber, installationIncidentCategories)
            let installations = await db.getInstallations()
            await db.createButton(unit1UUID, installations[0].id, "1", unit1PhoneNumber, unit1SerialNumber)
            await db.createButton(unit2UUID, installations[0].id, "2", unit2PhoneNumber, unit2SerialNumber)
        });

        afterEach(async function() {
            await db.clearSessions()
            await db.clearButtons()
            await db.clearInstallations()
            console.log('\n')
        });

        it('should return 400 to a request with no headers', async () => {
            let response = await chai.request(server).post('/flic_button_press').send({})
            expect(response).to.have.status(400)
        });

        it('should return 200 to a request with only button-serial-number', async () => {
            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).send({})
            expect(response).to.have.status(200)
        })

        it('should return 400 to a request with only button-battery-level', async () => {
            let responseNoSerialNumber = await chai.request(server).post('/flic_button_press').set('button-battery-level', '100').send({})
            expect(responseNoSerialNumber).to.have.status(400)
        });


        it('should return 400 to a request with an unregistered button', async () => {
            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', 'CCCC-C0C0C0').set('button-battery-level', '100').send()
            expect(response).to.have.status(400)
        });

        it('should return 200 to a valid request', async () => {
            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send()
            expect(response).to.have.status(200)
        });

        it('should be able to create a valid session state from valid request', async () => {
            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send()
            expect(response).to.have.status(200)

            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)
            
            let session = sessions[0]
            expect(session).to.not.be.null
            expect(session).to.have.property('buttonId')
            expect(session).to.have.property('unit')
            expect(session).to.have.property('state')
            expect(session).to.have.property('numPresses')
            expect(session.buttonId).to.equal(unit1UUID)
            expect(session.unit).to.equal('1')
            expect(session.numPresses).to.equal(1)
        });

        it('should not confuse button presses from different rooms', async () => {

            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send()
            response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit2SerialNumber).set('button-battery-level', '100').send()
            expect(response).to.have.status(200)

            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)

            let session = sessions[0]
            expect(session).to.not.be.null
            expect(session).to.have.property('buttonId')
            expect(session).to.have.property('unit')
            expect(session).to.have.property('numPresses')
            expect(session.buttonId).to.equal(unit1UUID)
            expect(session.unit).to.equal('1')
            expect(session.numPresses).to.equal(1)
        });

        it('should only create one new session when receiving multiple presses from the same button', async () => {

            await Promise.all([
                chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send(),
                chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send(),
                chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send(),
            ])

            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)
        });

        it('should count button presses accurately during an active session', async () => {

            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send()
            response = await chai.request(server).post('/flic_button_press?presses=2').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send()
            response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send()
            expect(response).to.have.status(200)

            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)

            let session = sessions[0]
            expect(session).to.not.be.null
            expect(session).to.have.property('buttonId')
            expect(session).to.have.property('unit')
            expect(session).to.have.property('state')
            expect(session).to.have.property('numPresses')
            expect(session.buttonId).to.equal(unit1UUID)
            expect(session.unit).to.equal('1')
            expect(session.numPresses).to.equal(4)
        });

        it('should leave battery level null if initial request do not provide button-battery-level', async () => {
            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).send()

            expect(response).to.have.status(200)

            let button = await db.getButtonWithSerialNumber(unit1SerialNumber)
            expect(button.button_battery_level).to.be.null
        })

        it('should leave battery level null if initial battery level is < 0', async () => {
            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '-1').send()

            expect(response).to.have.status(200)

            let button = await db.getButtonWithSerialNumber(unit1SerialNumber)
            expect(button.button_battery_level).to.be.null
        })

        it('should leave battery level null if initial battery level is > 100', async () => {
            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '101').send()

            expect(response).to.have.status(200)

            let button = await db.getButtonWithSerialNumber(unit1SerialNumber)
            expect(button.button_battery_level).to.be.null
        })

        it('should update battery level column with values from new requests', async () => {
            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send()

            expect(response).to.have.status(200)
            let button = await db.getButtonWithSerialNumber(unit1SerialNumber)
            expect(button.button_battery_level).to.equal(100)

            response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '1').send()
            button = await db.getButtonWithSerialNumber(unit1SerialNumber)
            expect(button.button_battery_level).to.equal(1)

            response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '0').send()
            button = await db.getButtonWithSerialNumber(unit1SerialNumber)
            expect(button.button_battery_level).to.equal(0)
        })

        it('should not change battery level column if subsequent requests do not provide button-battery-level', async () => {
            const fakeBatteryLevel = 23

            let response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', fakeBatteryLevel.toString()).send()
            expect(response).to.have.status(200)

            let button = await db.getButtonWithSerialNumber(unit1SerialNumber)
            expect(button.button_battery_level).to.equal(fakeBatteryLevel)

            response = await chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).send()
            expect(response).to.have.status(200)
            
            let buttonAgain = await db.getButtonWithSerialNumber(unit1SerialNumber)
            expect(buttonAgain.button_battery_level).to.equal(fakeBatteryLevel)
        })
    })

    describe('POST request: twilio message', () => {

        beforeEach(async function() {
            await db.clearSessions()
            await db.clearButtons()
            await db.clearInstallations()
            await db.createInstallation("TestInstallation", installationResponderPhoneNumber, installationFallbackPhoneNumber, installationIncidentCategories)
            let installations = await db.getInstallations()
            await db.createButton(unit1UUID, installations[0].id, "1", unit1PhoneNumber, unit1SerialNumber)
            await db.createButton(unit2UUID, installations[0].id, "2", unit2PhoneNumber, unit2SerialNumber)

            sinon.spy(twilioClient.messages, 'create')
        });

        afterEach(async function() {
            twilioClient.messages.create.restore()

            await db.clearSessions()
            await db.clearButtons()
            await db.clearInstallations()
            console.log('\n')
        });

        after(async function() {

            // wait for the staff reminder timers to finish
            await sleep(3000)
            
            await db.close()
            server.close()
        })

        it('should send the initial text message after a valid single click request to /', async () => {
            // Power Automate always sends two requests
            await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)
            await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)

            expect(twilioClient.messages.create).to.be.calledOnce
        })

        it('should send the initial text message after a valid double click request to /', async () => {
            // Power Automate always sends two requests
            await chai.request(server).post('/').send(unit1FlicRequest_DoubleClick)
            await chai.request(server).post('/').send(unit1FlicRequest_DoubleClick)

            expect(twilioClient.messages.create).to.be.calledOnce
        })

        it('should send the initial text message after a valid single click request to /flic_button_press', async () => {
            await chai.request(server)
                .post('/flic_button_press')
                .set('button-serial-number', unit1SerialNumber)
                .set('button-battery-level', '100')
                .send()

            expect(twilioClient.messages.create).to.be.calledOnce
        })

        it('should send the initial text message after a valid double click request to /flic_button_press', async () => {
            await chai.request(server)
                .post('/flic_button_press?presses=2')
                .set('button-serial-number', unit1SerialNumber)
                .set('button-battery-level', '100')
                .send()

            expect(twilioClient.messages.create).to.be.calledOnce
        })

        it('should return ok to a valid request', async () => {
            // Power Automate always sends two requests
            await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)
            await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)

            let response = await chai.request(server).post('/message').send(twilioMessageUnit1_InitialStaffResponse);
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
            // Power Automate always sends two requests
            await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)
            await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)

            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].state, 'state after initial button press').to.deep.equal(STATES.STARTED);

            let response = await chai.request(server).post('/message').send(twilioMessageUnit1_InitialStaffResponse);
            expect(response).to.have.status(200);

            sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].state, 'state after initial staff response').to.deep.equal(STATES.WAITING_FOR_CATEGORY);

            response = await chai.request(server).post('/message').send(twilioMessageUnit1_IncidentCategoryResponse)
            expect(response).to.have.status(200)
 
            sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].state, 'state after staff have categorized the incident').to.deep.equal(STATES.WAITING_FOR_DETAILS)

            response = await chai.request(server).post('/message').send(twilioMessageUnit1_IncidentNotesResponse)
            expect(response).to.have.status(200)
 
            sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].state, 'state after staff have provided incident notes').to.deep.equal(STATES.COMPLETED) 

            // now start a new session for a different unit
            // Power Automate always sends two requests
            await chai.request(server).post('/').send(unit2FlicRequest_SingleClick)
            await chai.request(server).post('/').send(unit2FlicRequest_SingleClick)

            sessions = await db.getAllSessionsWithButtonId(unit2UUID)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].state, 'state after new button press from a different unit').to.deep.equal(STATES.STARTED)
            expect(sessions[0].buttonId).to.deep.equal(unit2UUID)
            expect(sessions[0].unit).to.deep.equal('2')
            expect(sessions[0].numPresses).to.deep.equal(1)
        });

        it('should send a message to the fallback phone number if enough time has passed without a response', async () => {
            // Power Automate always sends two requests
            let response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)
            response = await chai.request(server).post('/').send(unit1FlicRequest_SingleClick)

            expect(response).to.have.status(200);
            await sleep(4000)
            let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].state, 'state after reminder timeout has elapsed').to.deep.equal(STATES.WAITING_FOR_REPLY);
            expect(sessions[0].fallBackAlertTwilioStatus).to.not.be.null
            expect(sessions[0].fallBackAlertTwilioStatus).to.not.equal('failed')
            expect(sessions[0].fallBackAlertTwilioStatus).to.not.equal('undelivered')
            expect(sessions[0].fallBackAlertTwilioStatus).to.be.oneOf(['queued', 'sent', 'delivered'])

        });
    });
});
