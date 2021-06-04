const chai = require('chai')
const chaiHttp = require('chai-http')

const expect = chai.expect
const { after, afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const twilio = require('twilio')
const { ALERT_STATE, helpers } = require('brave-alert-lib')

chai.use(chaiHttp)
chai.use(sinonChai)

const imports = require('../../server.js')

const server = imports.server
const db = imports.db

// eslint-disable-next-line func-style
const sleep = millis => new Promise(resolve => setTimeout(resolve, millis))

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

  const twilioMessageUnit1_IncidentNotesResponse = {
    From: installationResponderPhoneNumber,
    Body: 'Resident accidentally pressed button',
    To: unit1PhoneNumber,
  }

  describe('POST request: flic button press', () => {
    beforeEach(async () => {
      sinon.spy(helpers, 'log')
      sinon.spy(helpers, 'logError')

      await db.clearSessions()
      await db.clearButtons()
      await db.clearInstallations()
      await db.createInstallation(
        'TestInstallation',
        installationResponderPhoneNumber,
        installationFallbackPhoneNumbers,
        installationIncidentCategories,
        null,
      )
      const installations = await db.getInstallations()
      await db.createButton(unit1UUID, installations[0].id, '1', unit1PhoneNumber, unit1SerialNumber)
      await db.createButton(unit2UUID, installations[0].id, '2', unit2PhoneNumber, unit2SerialNumber)
    })

    afterEach(async () => {
      await db.clearSessions()
      await db.clearButtons()
      await db.clearInstallations()

      helpers.log.restore()
      helpers.logError.restore()
      helpers.log('\n')
    })

    it('should return 400 to a request with no headers', async () => {
      const response = await chai.request(server).post('/flic_button_press').send({})
      expect(response).to.have.status(400)
    })

    it('should return 200 to a request with only button-serial-number', async () => {
      // eslint-disable-next-line prettier/prettier
      const response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .send({})

      expect(response).to.have.status(200)
    })

    it('should return 400 to a request with only button-battery-level', async () => {
      // eslint-disable-next-line prettier/prettier
      const responseNoSerialNumber = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-battery-level', '100')
        .send({})

      expect(responseNoSerialNumber).to.have.status(400)
    })

    it('should return 400 to a request with an unregistered button', async () => {
      const response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', 'CCCC-C0C0C0')
        .set('button-battery-level', '100')
        .send()
      expect(response).to.have.status(400)
    })

    it('should return 200 to a valid request', async () => {
      const response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      expect(response).to.have.status(200)
    })

    it('should be able to create a valid session state from valid request', async () => {
      const response = await chai
        .request(server)
        .post('/flic_button_press')
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
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      response = await chai
        .request(server)
        .post('/flic_button_press')
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
        chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send(),
        chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send(),
        chai.request(server).post('/flic_button_press').set('button-serial-number', unit1SerialNumber).set('button-battery-level', '100').send(),
      ])

      const sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
    })

    it('should count button presses accurately during an active session', async () => {
      let response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()
      response = await chai
        .request(server)
        .post('/flic_button_press')
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
      // eslint-disable-next-line prettier/prettier
      const response = await chai
        .request(server)
        .post('/flic_button_press')
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
        .post('/flic_button_press')
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
        .post('/flic_button_press')
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
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()

      expect(response).to.have.status(200)

      let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      let session = sessions[0]
      expect(session.buttonBatteryLevel).to.equal(100)

      response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '1')
        .send()
      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      session = sessions[0]
      expect(session.buttonBatteryLevel).to.equal(1)

      response = await chai
        .request(server)
        .post('/flic_button_press')
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
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', fakeBatteryLevel.toString())
        .send()
      expect(response).to.have.status(200)
      let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      let session = sessions[0]
      expect(session.buttonBatteryLevel).to.equal(fakeBatteryLevel)

      // eslint-disable-next-line prettier/prettier
      response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .send()

      expect(response).to.have.status(200)
      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      session = sessions[0]
      expect(session.buttonBatteryLevel).to.equal(fakeBatteryLevel)
    })

    it('should log a valid request when given the correct API key', async () => {
      const buttonName = 'fakeButtonName'
      await chai
        .request(server)
        .post('/flic_button_press?apikey=testFlicApiKey')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-name', buttonName)
        .send()
      expect(helpers.log).to.have.been.calledWith(`VALID api key from '${buttonName}' (${unit1SerialNumber})`)
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

    it('should log a valid request when not given an API key', async () => {
      const buttonName = 'fakeButtonName'
      // eslint-disable-next-line prettier/prettier
      await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-name', buttonName
        ).send()

      expect(helpers.logError).to.have.been.calledWith(`INVALID api key from '${buttonName}' (${unit1SerialNumber})`)
    })
  })

  describe('POST request: twilio message', () => {
    beforeEach(async () => {
      await db.clearSessions()
      await db.clearButtons()
      await db.clearInstallations()
      await db.createInstallation(
        'TestInstallation',
        installationResponderPhoneNumber,
        installationFallbackPhoneNumbers,
        installationIncidentCategories,
        null,
      )
      const installations = await db.getInstallations()
      await db.createButton(unit1UUID, installations[0].id, '1', unit1PhoneNumber, unit1SerialNumber)
      await db.createButton(unit2UUID, installations[0].id, '2', unit2PhoneNumber, unit2SerialNumber)

      sinon.spy(imports.braveAlerter, 'startAlertSession')
      sinon.spy(imports.braveAlerter, 'sendSingleAlert')

      sinon.stub(twilio, 'validateExpressRequest').returns(true)
    })

    afterEach(async () => {
      imports.braveAlerter.sendSingleAlert.restore()
      imports.braveAlerter.startAlertSession.restore()

      twilio.validateExpressRequest.restore()

      await db.clearSessions()
      await db.clearButtons()
      await db.clearInstallations()
      helpers.log('\n')
    })

    after(async () => {
      // wait for the staff reminder timers to finish
      await sleep(3000)

      await db.close()
      server.close()
    })

    it('should send the initial text message after a valid request to /flic_button_press', async () => {
      // eslint-disable-next-line prettier/prettier
      await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()

      expect(imports.braveAlerter.startAlertSession).to.be.calledOnce
    })

    it('should send the initial and urgent text messages after two valid requests to /flic_button_press', async () => {
      // eslint-disable-next-line prettier/prettier
      await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()

      // eslint-disable-next-line prettier/prettier
      await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .set('button-battery-level', '100')
        .send()

      expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

      expect(imports.braveAlerter.sendSingleAlert).to.be.calledWith(
        sinon.match.any,
        sinon.match.any,
        'This in an urgent request. The button has been pressed 2 times. Please respond "Ok" when you have followed up on the call.',
      )
    })

    describe('updated button press handling', () => {
      afterEach(async () => {
        await db.getCurrentTime.restore()
      })

      it('should start a new session if it has been >= 2 hours since last update of most recent open session, with no battery level sent', async () => {
        const delayMs = 2 * 60 * 60 * 1000 + 7 * 60 * 1000 // 2h, + 7 mins to compensate for reminder/fallback updates
        const timeNow = await db.getCurrentTime()
        const timeNowMs = Date.parse(timeNow)

        sinon
          .stub(db, 'getCurrentTime')
          .onFirstCall()
          .returns(timeNow)
          .onSecondCall()
          .returns(timeNowMs + delayMs)

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .send()

        expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .send()

        expect(imports.braveAlerter.startAlertSession).to.have.been.calledTwice
      })

      it('should start a new session if it has been >= 2 hours since last update of most recent open session, with battery level sent', async () => {
        const delayMs = 2 * 60 * 60 * 1000 + 7 * 60 * 1000 // 2h, + 7 mins to compensate for reminder/fallback updates
        const timeNow = await db.getCurrentTime()
        const timeNowMs = Date.parse(timeNow)

        sinon
          .stub(db, 'getCurrentTime')
          .onFirstCall()
          .returns(timeNow)
          .onSecondCall()
          .returns(timeNowMs + delayMs)

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

        expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

        expect(imports.braveAlerter.startAlertSession).to.have.been.calledTwice
      })

      it('should send an additional urgent message if it has been >= 2 minutes since last session update even for non-multiples of 5, with no battery level sent', async () => {
        const delayMs = 9 * 60 * 1000 // 9 minutes, to compensate for reminder/fallback messages + 2 mins + a bit extra
        const timeNow = await db.getCurrentTime()
        const timeNowMs = Date.parse(timeNow)

        sinon
          .stub(db, 'getCurrentTime')
          .onFirstCall()
          .returns(timeNow)
          .onThirdCall()
          .returns(timeNowMs + delayMs)

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .send()

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .send()

        expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

        expect(imports.braveAlerter.sendSingleAlert).to.be.calledWith(
          sinon.match.any,
          sinon.match.any,
          'This in an urgent request. The button has been pressed 2 times. Please respond "Ok" when you have followed up on the call.',
        )

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .send()

        expect(imports.braveAlerter.sendSingleAlert).to.be.calledWith(
          sinon.match.any,
          sinon.match.any,
          'This in an urgent request. The button has been pressed 3 times. Please respond "Ok" when you have followed up on the call.',
        )

        expect(imports.braveAlerter.sendSingleAlert).to.have.been.calledTwice
      })

      it('should send an additional urgent message if it has been >= 2 minutes since last session update even for non-multiples of 5, with battery level sent', async () => {
        const delayMs = 9 * 60 * 1000 // 9 minutes, to compensate for reminder/fallback messages + 2 mins + a bit extra
        const timeNow = await db.getCurrentTime()
        const timeNowMs = Date.parse(timeNow)

        sinon
          .stub(db, 'getCurrentTime')
          .onFirstCall()
          .returns(timeNow)
          .onThirdCall()
          .returns(timeNowMs + delayMs)

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

        expect(imports.braveAlerter.startAlertSession).to.be.calledOnce

        expect(imports.braveAlerter.sendSingleAlert).to.be.calledWith(
          sinon.match.any,
          sinon.match.any,
          'This in an urgent request. The button has been pressed 2 times. Please respond "Ok" when you have followed up on the call.',
        )

        // eslint-disable-next-line prettier/prettier
        await chai
          .request(server)
          .post('/flic_button_press')
          .set('button-serial-number', unit1SerialNumber)
          .set('button-battery-level', '100')
          .send()

        expect(imports.braveAlerter.sendSingleAlert).to.be.calledWith(
          sinon.match.any,
          sinon.match.any,
          'This in an urgent request. The button has been pressed 3 times. Please respond "Ok" when you have followed up on the call.',
        )

        expect(imports.braveAlerter.sendSingleAlert).to.have.been.calledTwice
      })
    })

    it('should return ok to a valid request', async () => {
      // eslint-disable-next-line prettier/prettier
      await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .send()

      const response = await chai.request(server).post('/alert/sms').send(twilioMessageUnit1_InitialStaffResponse)
      expect(response).to.have.status(200)
    })

    it('should return 400 to a request with incomplete data', async () => {
      const response = await chai.request(server).post('/alert/sms').send({ Body: 'hi' })
      expect(response).to.have.status(400)
    })

    it('should return 400 to a request from an invalid phone number', async () => {
      const response = await chai.request(server).post('/alert/sms').send({ Body: 'hi', From: '+16664206969' })
      expect(response).to.have.status(400)
    })

    it('should return ok to a valid request and advance the session appropriately', async () => {
      // eslint-disable-next-line prettier/prettier
      await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .send()

      let sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after initial button press').to.deep.equal(ALERT_STATE.STARTED)

      let response = await chai.request(server).post('/alert/sms').send(twilioMessageUnit1_InitialStaffResponse)
      expect(response).to.have.status(200)

      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after initial staff response').to.deep.equal(ALERT_STATE.WAITING_FOR_CATEGORY)

      response = await chai.request(server).post('/alert/sms').send(twilioMessageUnit1_IncidentCategoryResponse)
      expect(response).to.have.status(200)

      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after staff have categorized the incident').to.deep.equal(ALERT_STATE.WAITING_FOR_DETAILS)

      response = await chai.request(server).post('/alert/sms').send(twilioMessageUnit1_IncidentNotesResponse)
      expect(response).to.have.status(200)

      sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after staff have provided incident notes').to.deep.equal(ALERT_STATE.COMPLETED)

      // now start a new session for a different unit
      // eslint-disable-next-line prettier/prettier
      await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit2SerialNumber)
        .send()

      sessions = await db.getAllSessionsWithButtonId(unit2UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after new button press from a different unit').to.deep.equal(ALERT_STATE.STARTED)
      expect(sessions[0].buttonId).to.deep.equal(unit2UUID)
      expect(sessions[0].unit).to.deep.equal('2')
      expect(sessions[0].numPresses).to.deep.equal(1)
    })

    it('should send a message to the fallback phone number if enough time has passed without a response', async () => {
      // eslint-disable-next-line prettier/prettier
      const response = await chai
        .request(server)
        .post('/flic_button_press')
        .set('button-serial-number', unit1SerialNumber)
        .send()

      expect(response).to.have.status(200)
      await sleep(4000)
      const sessions = await db.getAllSessionsWithButtonId(unit1UUID)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].state, 'state after reminder timeout has elapsed').to.deep.equal(ALERT_STATE.WAITING_FOR_REPLY)
      expect(sessions[0].fallBackAlertTwilioStatus).to.not.be.null
      expect(sessions[0].fallBackAlertTwilioStatus).to.not.equal('failed, ')
      expect(sessions[0].fallBackAlertTwilioStatus).to.not.equal('undelivered, ')
      expect(sessions[0].fallBackAlertTwilioStatus).to.be.oneOf(['queued', 'sent', 'delivered'])
    })
  })
})
