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
const imports = require('../../server.js')

const server = imports.server
const db = imports.db

const sandbox = sinon.createSandbox()

const validApiKey = helpers.getEnvVar('FLIC_BUTTON_PRESS_API_KEY')

describe('Chatbot server', () => {
  const unit1UUID = '111'
  const unit1SerialNumber = 'AAAA-A0A0A0'
  const unit1PhoneNumber = '+15005550006'

  const unit2UUID = '222'
  const unit2SerialNumber = 'BBBB-B0B0B0'
  const unit2PhoneNumber = '+15005550006'

  const installationResponderPhoneNumber = '+12345678900'
  const installationFallbackPhoneNumbers = ['+12345678900']
  const installationIncidentCategories = ['Accidental', 'Safer Use', 'Overdose', 'Other']

  const twilioMessageUnit1_InitialStaffResponse = {
    From: installationResponderPhoneNumber,
    Body: 'Ok',
    To: unit1PhoneNumber,
  }

  const twilioMessageUnit1_IncidentCategoryResponse = {
    From: installationResponderPhoneNumber,
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

  describe('POST request: flic button press', () => {
    beforeEach(async () => {
      const client = await factories.clientDBFactory(db, {
        displayName: 'TestInstallation',
        responderPhoneNumber: installationResponderPhoneNumber,
        fallbackPhoneNumbers: installationFallbackPhoneNumbers,
        incidentCategories: installationIncidentCategories,
        alertApiKey: null,
        responderPushId: null,
        reminderTimeout: 1,
        fallbackTimeout: 2,
        fromPhoneNumber: '+15005550006',
      })
      await buttonDBFactory(db, {
        buttonId: unit1UUID,
        clientId: client.id,
        displayName: '1',
        phoneNumber: unit1PhoneNumber,
        buttonSerialNumber: unit1SerialNumber,
      })
      await buttonDBFactory(db, {
        buttonId: unit2UUID,
        clientId: client.id,
        displayName: '2',
        phoneNumber: unit2PhoneNumber,
        buttonSerialNumber: unit2SerialNumber,
      })
    })

    it('should return 400 to a request with no headers', async () => {
      // prettier-ignore
      const response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .send({})
      expect(response).to.have.status(400)
    })

    it('should return 200 to a request with only button-serial-number', async () => {
      const response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .send({})

      expect(response).to.have.status(200)
    })

    it('should return 400 to a request with only button-battery-level', async () => {
      const responseNoSerialNumber = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-battery-level', '100')
        .send({})

      expect(responseNoSerialNumber).to.have.status(400)
    })

    it('should return 400 to a request with an unregistered button', async () => {
      const response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', 'CCCC-C0C0C0')
        .set('button-battery-level', '100')
        .send()
      expect(response).to.have.status(400)
    })

    it('should return 200 to a valid request', async () => {
      const response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      expect(response).to.have.status(200)
    })

    it('should be able to create a valid session state from valid request', async () => {
      const response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      expect(response).to.have.status(200)

      const sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)

      const session = sessions[0]
      expect(session).to.not.be.null
      expect(session).to.have.property('buttonId')
      expect(session).to.have.property('unit')
      expect(session).to.have.property('state')
      expect(session).to.have.property('numPresses')
      expect(session.buttonId).to.equal(unit1UUID)
      expect(session.unit).to.equal('1')
      expect(session.numPresses).to.equal(1)
      expect(session.buttonBatteryLevel).to.equal(100)
    })

    it('should not confuse button presses from different rooms', async () => {
      let response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit2SerialNumber)
        .set('button-battery-level', '100')
        .send()
      expect(response).to.have.status(200)

      const sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)

      const session = sessions[0]
      expect(session).to.not.be.null
      expect(session).to.have.property('buttonId')
      expect(session).to.have.property('unit')
      expect(session).to.have.property('numPresses')
      expect(session.buttonId).to.equal(unit1UUID)
      expect(session.unit).to.equal('1')
      expect(session.numPresses).to.equal(1)
    })

    it('should only create one new session when receiving multiple presses from the same button', async () => {
      await Promise.all([
        chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send(),
        chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send(),
        chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send(),
      ])

      const sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
    })

    it('should count button presses accurately during an active session', async () => {
      let response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      expect(response).to.have.status(200)

      const sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)

      const session = sessions[0]
      expect(session).to.not.be.null
      expect(session).to.have.property('buttonId')
      expect(session).to.have.property('unit')
      expect(session).to.have.property('state')
      expect(session).to.have.property('numPresses')
      expect(session.buttonId).to.equal(unit1UUID)
      expect(session.unit).to.equal('1')
      expect(session.numPresses).to.equal(4)
    })

    it('should leave battery level null if initial request do not provide button-battery-level', async () => {
      const response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .send()

      expect(response).to.have.status(200)
      const sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      const session = sessions[0]
      expect(session.buttonBatteryLevel).to.be.null
    })

    it('should leave battery level null if initial battery level is < 0', async () => {
      const response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '-1')
        .send()

      expect(response).to.have.status(200)
      const sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      const session = sessions[0]
      expect(session.buttonBatteryLevel).to.be.null
    })

    it('should leave battery level null if initial battery level is > 100', async () => {
      const response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '101')
        .send()

      expect(response).to.have.status(200)
      const sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      const session = sessions[0]
      expect(session.buttonBatteryLevel).to.be.null
    })

    it('should update battery level column with values from new requests', async () => {
      let response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()

      expect(response).to.have.status(200)

      let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      let session = sessions[0]
      expect(session.buttonBatteryLevel).to.equal(100)

      response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '1')
        .send()
      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      session = sessions[0]
      expect(session.buttonBatteryLevel).to.equal(1)

      response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '0')
        .send()
      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      session = sessions[0]
      expect(session.buttonBatteryLevel).to.equal(0)
    })

    it('should not change battery level column if subsequent requests do not provide button-battery-level', async () => {
      const fakeBatteryLevel = 23
      let response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', fakeBatteryLevel.toString())
        .send()
      expect(response).to.have.status(200)
      let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      let session = sessions[0]
      expect(session.buttonBatteryLevel).to.equal(fakeBatteryLevel)

      // prettier-ignore
      response = await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .send()

      expect(response).to.have.status(200)
      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      session = sessions[0]
      expect(session.buttonBatteryLevel).to.equal(fakeBatteryLevel)
    })

    it('should return 401 when given an incorrect API key', async () => {
      const buttonName = 'fakeButtonName'
      const response = await chai
        .request(server)
        .post('/flic_button_press?apikey=NOTtestFlicApiKey')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-name', buttonName)
        .send()
      expect(response).to.have.status(401)
    })

    it('should log an invalid request when given an incorrect API key', async () => {
      const buttonName = 'fakeButtonName'
      await chai
        .request(server)
        .post('/flic_button_press?apikey=NOTtestFlicApiKey')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-name', buttonName)
        .send()
      expect(helpers.logError).to.have.been.calledWith(`INVALID api key from '${buttonName}' (${unit1SerialNumber})`)
    })

    it('should return 401 when not given an API key', async () => {
      const buttonName = 'fakeButtonName'
      const response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-name', buttonName)
        .send()
      expect(response).to.have.status(401)
    })

    it('should log a invalid request when not given an API key', async () => {
      const buttonName = 'fakeButtonName'
      // prettier-ignore
      await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-name', buttonName)
        .send()

      expect(helpers.logError).to.have.been.calledWith(`INVALID api key from '${buttonName}' (${unit1SerialNumber})`)
    })
  })

  describe('POST request: twilio message', () => {
    beforeEach(async () => {
      const client = await factories.clientDBFactory(db, {
        displayName: 'TestInstallation',
        responderPhoneNumber: installationResponderPhoneNumber,
        fallbackPhoneNumbers: installationFallbackPhoneNumbers,
        incidentCategories: installationIncidentCategories,
        alertApiKey: null,
        responderPushId: null,
        reminderTimeout: 1,
        fallbackTimeout: 2,
        fromPhoneNumber: '+15005550006',
      })
      await buttonDBFactory(db, {
        buttonId: unit1UUID,
        clientId: client.id,
        displayName: '1',
        phoneNumber: unit1PhoneNumber,
        buttonSerialNumber: unit1SerialNumber,
      })
      await buttonDBFactory(db, {
        buttonId: unit2UUID,
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

    it('should send the initial text message after a valid request to /flic_button_press', async () => {
      await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()

      expect(imports.braveAlerter.startAlertSession).to.be.calledOnce
    })

    it('should send the initial and urgent text messages after two valid requests to /flic_button_press', async () => {
      await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()

      await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()

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

        // prettier-ignore
        await chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .send()

        expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

        // prettier-ignore
        await chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .send()

        expect(imports.braveAlerter.startAlertSession).to.have.been.calledTwice
      })

      it('should start a new session if it has been >= 2 hours since last update of most recent open session, with battery level sent', async () => {
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
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

        expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

        await chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

        expect(imports.braveAlerter.startAlertSession).to.have.been.calledTwice
      })

      it('should send an additional urgent message if it has been >= 2 minutes since last session update even for non-multiples of 5, with no battery level sent', async () => {
        const delayMs = 9 * 60 * 1000 // 9 minutes, to compensate for reminder/fallback messages + 2 mins + a bit extra
        const timeNow = await db.getCurrentTime()
        const timeNowMs = Date.parse(timeNow)

        sandbox
          .stub(db, 'getCurrentTime')
          .onFirstCall()
          .returns(timeNow)
          .onThirdCall()
          .returns(timeNowMs + delayMs)

        // prettier-ignore
        await chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .send()

        // prettier-ignore
        await chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .send()

        expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

        expect(imports.braveAlerter.sendAlertSessionUpdate).to.be.calledWith(
          sandbox.match.any,
          sandbox.match.any,
          sandbox.match.any,
          sandbox.match.any,
          'This in an urgent request. The button has been pressed 2 times. Please respond "Ok" when you have followed up on the call.',
          'URGENT Button Press Alert:\n1',
        )
        // prettier-ignore
        await chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .send()

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

      it('should send an additional urgent message if it has been >= 2 minutes since last session update even for non-multiples of 5, with battery level sent', async () => {
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
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

        await chai
          .request(server)
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

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
          .post(`/flic_button_press?apikey=${validApiKey}`)
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

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
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .send()

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
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit1SerialNumber)
        .send()

      let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after initial button press').to.deep.equal(CHATBOT_STATE.STARTED)

      // prettier-ignore
      let response = await chai
        .request(server)
        .post('/alert/sms')
        .send(twilioMessageUnit1_InitialStaffResponse)
      expect(response).to.have.status(200)

      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after initial staff response').to.deep.equal(CHATBOT_STATE.WAITING_FOR_CATEGORY)

      // prettier-ignore
      response = await chai
        .request(server)
        .post('/alert/sms')
        .send(twilioMessageUnit1_IncidentCategoryResponse)
      expect(response).to.have.status(200)

      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after staff have categorized the incident').to.deep.equal(CHATBOT_STATE.COMPLETED)

      // now start a new session for a different unit
      // prettier-ignore
      await chai
        .request(server)
        .post(`/flic_button_press?apikey=${validApiKey}`)
        .set('button-serial-number', unit2SerialNumber)
        .send()

      sessions = await db.getAllSessionsWithButtonId(unit2UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after new button press from a different unit').to.deep.equal(CHATBOT_STATE.STARTED)
      expect(sessions[0].buttonId).to.deep.equal(unit2UUID)
      expect(sessions[0].unit).to.deep.equal('2')
      expect(sessions[0].numPresses).to.deep.equal(1)
    })
  })
})
