const chai = require('chai')
const chaiHttp = require('chai-http')

const expect = chai.expect
const { after, afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const twilio = require('twilio')
const { CHATBOT_STATE, factories, helpers } = require('brave-alert-lib')

chai.use(chaiHttp)
chai.use(sinonChai)

const { buttonDBFactory } = require('../testingHelpers')
const imports = require('../../server')

const server = imports.server
const db = imports.db

const sandbox = sinon.createSandbox()

const rakApiKeyPrimary = helpers.getEnvVar('RAK_API_KEY_PRIMARY')

describe('Chatbot server', () => {
  const unit1SerialNumber = 'AAAA-A0A0A0'
  const unit1PhoneNumber = '+15005550006'

  const unit2SerialNumber = 'BBBB-B0B0B0'
  const unit2PhoneNumber = '+15005550006'

  const installationResponderPhoneNumbers = ['+12345678900', '+18564520000']
  const installationFallbackPhoneNumbers = ['+12345678900']
  const installationIncidentCategories = ['Accidental', 'Safer Use', 'Overdose', 'Other']

  const twilioMessageUnit1_InitialStaffResponse = {
    From: installationResponderPhoneNumbers[0],
    Body: 'Ok',
    To: unit1PhoneNumber,
  }

  const twilioMessageUnit1_IncidentCategoryResponse = {
    From: installationResponderPhoneNumbers[0],
    Body: '0',
    To: unit1PhoneNumber,
  }

  const twilioMessageUnit1_IncidentCategoryResponseFromOtherResponderPhone = {
    From: installationResponderPhoneNumbers[1],
    Body: '0',
    To: unit1PhoneNumber,
  }

  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    await db.clearTables()
  })

  afterEach(async () => {
    sandbox.restore()

    await db.clearTables()
  })

  describe('POST request: twilio message', () => {
    beforeEach(async () => {
      const client = await factories.clientDBFactory(db, {
        displayName: 'TestInstallation',
        responderPhoneNumbers: installationResponderPhoneNumbers,
        fallbackPhoneNumbers: installationFallbackPhoneNumbers,
        incidentCategories: installationIncidentCategories,
        alertApiKey: null,
        responderPushId: null,
        reminderTimeout: 1,
        fallbackTimeout: 2,
        fromPhoneNumber: '+15005550006',
      })
      this.button1 = await buttonDBFactory(db, {
        clientId: client.id,
        displayName: '1',
        phoneNumber: unit1PhoneNumber,
        buttonSerialNumber: unit1SerialNumber,
      })
      this.button2 = await buttonDBFactory(db, {
        clientId: client.id,
        displayName: '2',
        phoneNumber: unit2PhoneNumber,
        buttonSerialNumber: unit2SerialNumber,
      })

      sandbox.spy(imports.braveAlerter, 'startAlertSession')
      sandbox.spy(imports.braveAlerter, 'sendAlertSessionUpdate')

      sandbox.stub(twilio, 'validateExpressRequest').returns(true)
    })

    after(async () => {
      // wait for the staff reminder timers to finish
      await helpers.sleep(3000)

      await db.close()
      server.close()
    })

    it('should send the initial text message after a valid request to /rak_button_press', async () => {
      // prettier-ignore
      await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: unit1SerialNumber, payload: 'Qw==' })

      expect(imports.braveAlerter.startAlertSession).to.be.calledOnce
    })

    it('should send the initial and urgent text messages after two valid requests to /rak_button_press', async () => {
      // prettier-ignore
      await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: unit1SerialNumber, payload: 'Qw==' })

      // prettier-ignore
      await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: unit1SerialNumber, payload: 'Qw==' })
      expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

      expect(imports.braveAlerter.sendAlertSessionUpdate).to.be.calledWith(
        sandbox.match.any,
        sandbox.match.any,
        sandbox.match.any,
        sandbox.match.any,
        'This in an urgent request. The button has been pressed 2 times. Please respond "Ok" when you have followed up on the call.',
        'URGENT Button Press Alert:\n1',
      )
    })

    describe('updated button press handling', () => {
      it('should start a new session if it has been >= 2 hours since last update of most recent open session, with no battery level sent', async () => {
        const delayMs = 2 * 60 * 60 * 1000 + 7 * 60 * 1000 // 2h, + 7 mins to compensate for reminder/fallback updates
        const timeNow = await db.getCurrentTime()
        const timeNowMs = Date.parse(timeNow)

        sandbox
          .stub(db, 'getCurrentTime')
          .onFirstCall()
          .returns(timeNow)
          .onSecondCall()
          .returns(timeNowMs + delayMs)

        await chai
          .request(server)
          .post('/rak_button_press')
          .set('authorization', rakApiKeyPrimary)
          .send({ devEui: unit1SerialNumber, payload: 'Qw==' })

        expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

        await chai
          .request(server)
          .post('/rak_button_press')
          .set('authorization', rakApiKeyPrimary)
          .send({ devEui: unit1SerialNumber, payload: 'Qw==' })

        expect(imports.braveAlerter.startAlertSession).to.have.been.calledTwice
      })

      it('should send an additional urgent message if it has been >= 2 minutes since last session update even for non-multiples of 5', async () => {
        const delayMs = 9 * 60 * 1000 // 9 minutes, to compensate for reminder/fallback messages + 2 mins + a bit extra
        const timeNow = await db.getCurrentTime()
        const timeNowMs = Date.parse(timeNow)

        sandbox
          .stub(db, 'getCurrentTime')
          .onFirstCall()
          .returns(timeNow)
          .onThirdCall()
          .returns(timeNowMs + delayMs)

        await chai
          .request(server)
          .post('/rak_button_press')
          .set('authorization', rakApiKeyPrimary)
          .send({ devEui: unit1SerialNumber, payload: 'Qw==' })

        await chai
          .request(server)
          .post('/rak_button_press')
          .set('authorization', rakApiKeyPrimary)
          .send({ devEui: unit1SerialNumber, payload: 'Qw==' })

        expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

        expect(imports.braveAlerter.sendAlertSessionUpdate).to.be.calledWith(
          sandbox.match.any,
          sandbox.match.any,
          sandbox.match.any,
          sandbox.match.any,
          'This in an urgent request. The button has been pressed 2 times. Please respond "Ok" when you have followed up on the call.',
          'URGENT Button Press Alert:\n1',
        )

        await chai
          .request(server)
          .post('/rak_button_press')
          .set('authorization', rakApiKeyPrimary)
          .send({ devEui: unit1SerialNumber, payload: 'Qw==' })

        expect(imports.braveAlerter.sendAlertSessionUpdate).to.be.calledWith(
          sandbox.match.any,
          sandbox.match.any,
          sandbox.match.any,
          sandbox.match.any,
          'This in an urgent request. The button has been pressed 3 times. Please respond "Ok" when you have followed up on the call.',
          'URGENT Button Press Alert:\n1',
        )

        expect(imports.braveAlerter.sendAlertSessionUpdate).to.have.been.calledTwice
      })
    })

    it('should return ok to a valid request', async () => {
      // prettier-ignore
      await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: unit1SerialNumber, payload: 'Qw==' })

      // prettier-ignore
      const response = await chai
        .request(server)
        .post('/alert/sms')
        .send(twilioMessageUnit1_InitialStaffResponse)
      expect(response).to.have.status(200)
    })

    it('should return 400 to a request with incomplete data', async () => {
      // prettier-ignore
      const response = await chai
        .request(server)
        .post('/alert/sms')
        .send({ Body: 'hi' })
      expect(response).to.have.status(400)
    })

    it('should return 400 to a request from an invalid phone number', async () => {
      // prettier-ignore
      const response = await chai
        .request(server)
        .post('/alert/sms')
        .send({ Body: 'hi', From: '+16664206969' })
      expect(response).to.have.status(400)
    })

    it('should return ok to a valid request and advance the session appropriately', async () => {
      // prettier-ignore
      await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: unit1SerialNumber, payload: 'Qw==' })

      let sessions = await db.getAllSessionsWithButtonId(this.button1.id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].chatbotState, 'state after initial button press').to.equal(CHATBOT_STATE.STARTED)
      expect(sessions[0].respondedByPhoneNumber).to.equal(null)
      expect(sessions[0].respondedAt).to.equal(null)

      // prettier-ignore
      let response = await chai
        .request(server)
        .post('/alert/sms')
        .send(twilioMessageUnit1_InitialStaffResponse)
      expect(response).to.have.status(200)

      sessions = await db.getAllSessionsWithButtonId(this.button1.id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].chatbotState, 'state after initial staff response').to.equal(CHATBOT_STATE.WAITING_FOR_CATEGORY)
      expect(sessions[0].respondedByPhoneNumber).to.equal(installationResponderPhoneNumbers[0])
      expect(sessions[0].respondedAt).not.to.equal(null)

      // prettier-ignore
      response = await chai
        .request(server)
        .post('/alert/sms')
        .send(twilioMessageUnit1_IncidentCategoryResponseFromOtherResponderPhone)
      expect(response).to.have.status(200)

      sessions = await db.getAllSessionsWithButtonId(this.button1.id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].chatbotState, 'state after one of the other responders sent a message').to.equal(CHATBOT_STATE.WAITING_FOR_CATEGORY)
      expect(sessions[0].respondedByPhoneNumber).to.equal(installationResponderPhoneNumbers[0])
      expect(sessions[0].respondedAt).not.to.equal(null)

      // prettier-ignore
      response = await chai
        .request(server)
        .post('/alert/sms')
        .send(twilioMessageUnit1_IncidentCategoryResponse)
      expect(response).to.have.status(200)

      sessions = await db.getAllSessionsWithButtonId(this.button1.id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].chatbotState, 'state after staff have categorized the incident').to.equal(CHATBOT_STATE.COMPLETED)
      expect(sessions[0].respondedByPhoneNumber).to.equal(installationResponderPhoneNumbers[0])
      expect(sessions[0].respondedAt).not.to.equal(null)

      // now start a new session for a different unit
      // prettier-ignore
      await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: unit2SerialNumber, payload: 'Qw==' })

      sessions = await db.getAllSessionsWithButtonId(this.button2.id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].chatbotState, 'state after new button press from a different unit').to.equal(CHATBOT_STATE.STARTED)
      expect(sessions[0].button.id).to.equal(this.button2.id)
      expect(sessions[0].numButtonPresses).to.equal(1)
      expect(sessions[0].respondedByPhoneNumber).to.equal(null)
      expect(sessions[0].respondedAt).to.equal(null)
    })
  })
})
