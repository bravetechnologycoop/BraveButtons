// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { DateTime } = require('luxon')
const rewire = require('rewire')

// In-house dependencies
const { helpers, factories, twilioHelpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { buttonFactory, buttonsVitalFactory, gatewayFactory } = require('../../testingHelpers')

const vitals = rewire('../../../vitals')

use(sinonChai)

const sandbox = sinon.createSandbox()

const currentDBDate = new Date('2021-11-04T22:28:28.0248Z')

const heartbeatThreshold = 3600

// Expects JS Date objects
function subtractSeconds(date, seconds) {
  const dateTime = DateTime.fromJSDate(date)
  return dateTime.minus({ seconds }).toJSDate()
}

const exceededThresholdTimestamp = subtractSeconds(currentDBDate, heartbeatThreshold + 1) // sub(currentDBDate, { seconds: subsequentVitalsThreshold + 1 })

describe('vitals.js unit tests: checkButtonHeartbeat', () => {
  beforeEach(() => {
    const getEnvVarStub = sandbox.stub(helpers, 'getEnvVar')
    getEnvVarStub.withArgs('RAK_BUTTONS_VITALS_ALERT_THRESHOLD').returns(heartbeatThreshold)
    this.sendClientButtonStatusChangesStub = sandbox.stub()
    // eslint-disable-next-line no-underscore-dangle
    vitals.__set__('sendClientButtonStatusChanges', this.sendClientButtonStatusChangesStub)

    sandbox.stub(db, 'getCurrentTime').returns(currentDBDate)
    sandbox.stub(db, 'updateButtonsSentVitalsAlerts')
    sandbox.stub(twilioHelpers, 'sendTwilioMessage')
    sandbox.stub(helpers, 'logSentry')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('for a client that is sending vitals and has no disconnected gateways', () => {
    beforeEach(async () => {
      this.client = factories.clientFactory({ isSendingVitals: true })
      sandbox.stub(db, 'getDisconnectedGatewaysWithClient').returns([])
    })

    describe('when button that is sending vitals last seen is more recent than the threshold and no alerts have been sent ', () => {
      beforeEach(async () => {
        this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: true, client: this.client })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: currentDBDate, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
      })

      it('should not send any messages to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.not.be.called
      })

      it('should not update the database', async () => {
        await vitals.checkButtonHeartbeat()
        expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
      })
    })

    describe('when button that is sending vitals last seen exceeds the threshold and no alerts have been sent', () => {
      beforeEach(async () => {
        this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: true, client: this.client })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: exceededThresholdTimestamp, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
        this.buttonStatusChanges = {}
        this.buttonStatusChanges[this.client.id] = {
          client: this.client,
          disconnectedButtons: [this.button.displayName],
          reconnectedButtons: [],
        }
      })

      it('should send the initial disconnection message to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledWith(
          `Disconnection: ${this.button.client.displayName} ${this.button.displayName} Button delay is ${heartbeatThreshold + 1} seconds.`,
        )
      })

      it('should update the buttons sentVitalsAlertAt in the database to now', async () => {
        await vitals.checkButtonHeartbeat()
        expect(db.updateButtonsSentVitalsAlerts).to.be.calledWithExactly(this.button.id, true)
      })

      it('should send a Twilio message summarizing button status changes', async () => {
        await vitals.checkButtonHeartbeat()
        expect(this.sendClientButtonStatusChangesStub).to.be.calledWith(this.buttonStatusChanges)
      })

      it('should only log to Sentry once', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledOnce
      })
    })

    describe('when button that is not sending vitals last seen exceeds the threshold and no alerts have been sent', () => {
      beforeEach(async () => {
        this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: false, client: this.client })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: exceededThresholdTimestamp, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
      })

      it('should not send any messages to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.not.be.called
      })

      it('should not update the database', async () => {
        await vitals.checkButtonHeartbeat()
        expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
      })
    })

    describe('when button that is sending vitals last seen is more recent than the threshold and an alert was sent ', () => {
      beforeEach(async () => {
        this.button = buttonFactory({
          sentVitalsAlertAt: new Date(),
          isSendingVitals: true,
          client: this.client,
        })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: currentDBDate, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
        this.buttonStatusChanges = {}
        this.buttonStatusChanges[this.client.id] = {
          client: this.client,
          disconnectedButtons: [],
          reconnectedButtons: [this.button.displayName],
        }
      })

      it('should send the reconnection message to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledWith(`Reconnection: ${this.button.client.displayName} ${this.button.displayName} Button.`)
      })

      it("should update the button's sentVitalsAlertAt the database to null", async () => {
        await vitals.checkButtonHeartbeat()
        expect(db.updateButtonsSentVitalsAlerts).to.be.calledWithExactly(this.button.id, false)
      })

      it('should send a Twilio message summarizing button status changes', async () => {
        await vitals.checkButtonHeartbeat()
        expect(this.sendClientButtonStatusChangesStub).to.be.calledWith(this.buttonStatusChanges)
      })

      it('should only log to Sentry once', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledOnce
      })
    })

    describe('when button that is not sending vitals last seen is more recent than the threshold and an alert was sent ', () => {
      beforeEach(async () => {
        this.button = buttonFactory({
          sentVitalsAlertAt: new Date(),
          isSendingVitals: false,
          client: this.client,
        })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: currentDBDate, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
      })

      it('should not send any messages to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.not.be.called
      })

      it('should not update the database', async () => {
        await vitals.checkButtonHeartbeat()
        expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
      })
    })

    describe('when two buttons that are sending vitals last seen exceeds the threshold and no alerts have been sent', () => {
      beforeEach(async () => {
        // Set up scenario where one client has two buttons that have just disconnected
        this.buttonA = buttonFactory({ id: 'fakeIdA', displayName: 'Unit A', sentVitalsAlertAt: null, isSendingVitals: true, client: this.client })
        this.buttonB = buttonFactory({
          id: 'fakeIdB',
          displayName: 'Unit B',
          buttonSerialNumber: 'AB12-23456',
          sentVitalsAlertAt: null,
          isSendingVitals: true,
          client: this.client,
        })
        this.buttonsVitalA = buttonsVitalFactory({ createdAt: exceededThresholdTimestamp, button: this.buttonA })
        this.buttonsVitalB = buttonsVitalFactory({ createdAt: exceededThresholdTimestamp, button: this.buttonB })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVitalB, this.buttonsVitalA])
        this.buttonStatusChanges = {}
        this.buttonStatusChanges[this.client.id] = {
          client: this.client,
          disconnectedButtons: [this.buttonB.displayName, this.buttonA.displayName],
          reconnectedButtons: [],
        }
      })

      it('should only log to Sentry twice', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledTwice
      })

      it('should send the initial disconnection message to Sentry, for the first disconnected button', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledWith(
          `Disconnection: ${this.buttonA.client.displayName} ${this.buttonA.displayName} Button delay is ${heartbeatThreshold + 1} seconds.`,
        )
      })

      it('should send the initial disconnection message to Sentry, for the second disconnected button', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledWith(
          `Disconnection: ${this.buttonB.client.displayName} ${this.buttonB.displayName} Button delay is ${heartbeatThreshold + 1} seconds.`,
        )
      })

      it('should send a Twilio message summarizing button status changes, with the buttons display name in alphabetical order', async () => {
        await vitals.checkButtonHeartbeat()
        expect(this.sendClientButtonStatusChangesStub).to.be.calledWith(this.buttonStatusChanges)
      })
    })

    describe('when one button sending vitals has just disconnected, one button sending vitals has reconnected and one button sendings vitals remains connected', () => {
      beforeEach(async () => {
        // Set up scenario where the same client has a button disconnected, a button recconected, and a button connected with no change
        this.buttonA = buttonFactory({ id: 'fakeIdA', displayName: 'Unit A', sentVitalsAlertAt: null, isSendingVitals: true, client: this.client })
        this.buttonB = buttonFactory({
          id: 'fakeIdB',
          displayName: 'Unit B',
          buttonSerialNumber: 'AB12-23456',
          sentVitalsAlertAt: new Date(),
          isSendingVitals: true,
          client: this.client,
        })
        this.buttonC = buttonFactory({
          id: 'fakeIdC',
          displayName: 'Unit C',
          buttonSerialNumber: 'AB12-34567',
          sentVitalsAlertAt: null,
          isSendingVitals: true,
          client: this.client,
        })
        this.buttonsVitalA = buttonsVitalFactory({ createdAt: exceededThresholdTimestamp, button: this.buttonA })
        this.buttonsVitalB = buttonsVitalFactory({ createdAt: currentDBDate, button: this.buttonB })
        this.buttonsVitalC = buttonsVitalFactory({ createdAt: currentDBDate, button: this.buttonC })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVitalA, this.buttonsVitalB, this.buttonsVitalC])
        this.buttonStatusChanges = {}
        this.buttonStatusChanges[this.client.id] = {
          client: this.client,
          disconnectedButtons: [this.buttonA.displayName],
          reconnectedButtons: [this.buttonB.displayName],
        }
      })

      it('should only log to Sentry twice', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledTwice
      })

      it('should send one button disconnection message', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledWith(
          `Disconnection: ${this.buttonA.client.displayName} ${this.buttonA.displayName} Button delay is ${heartbeatThreshold + 1} seconds.`,
        )
      })

      it('should send one reconnection message to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledWith(`Reconnection: ${this.buttonB.client.displayName} ${this.buttonB.displayName} Button.`)
      })

      it('should send a Twilio message summarizing button status changes', async () => {
        await vitals.checkButtonHeartbeat()
        expect(this.sendClientButtonStatusChangesStub).to.be.calledWith(this.buttonStatusChanges)
      })
    })
  })

  describe('for a client that is not sending vitals and has no disconnected gateways', () => {
    beforeEach(async () => {
      this.client = factories.clientFactory({ isSendingVitals: false })
      sandbox.stub(db, 'getDisconnectedGatewaysWithClient').returns([])
    })

    describe('when button that is sending vitals last seen exceeds the threshold and no alerts have been sent', () => {
      beforeEach(async () => {
        this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: true, client: this.client })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: exceededThresholdTimestamp, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
      })

      it('should not send any messages to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.not.be.called
      })

      it('should not update the database', async () => {
        await vitals.checkButtonHeartbeat()
        expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
      })
    })

    describe('when button that is not sending vitals last seen exceeds the threshold and no alerts have been sent', () => {
      beforeEach(async () => {
        this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: false, client: this.client })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: exceededThresholdTimestamp, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
      })

      it('should not send any messages to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.not.be.called
      })

      it('should not update the database', async () => {
        await vitals.checkButtonHeartbeat()
        expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
      })
    })

    describe('when button that is sending vitals last seen is more recent than the threshold and an alert was sent', () => {
      beforeEach(async () => {
        this.button = buttonFactory({
          sentVitalsAlertAt: new Date(),
          isSendingVitals: true,
          client: this.client,
        })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: currentDBDate, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
      })

      it('should not send any messages to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.not.be.called
      })

      it('should not update the database', async () => {
        await vitals.checkButtonHeartbeat()
        expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
      })
    })

    describe('when button that is not sending vitals last seen is more recent than the threshold and an alert was sent', () => {
      beforeEach(async () => {
        this.button = buttonFactory({
          sentVitalsAlertAt: new Date(),
          isSendingVitals: false,
          client: this.client,
        })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: currentDBDate, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
      })

      it('should not send any messages to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.not.be.called
      })

      it('should not update the database', async () => {
        await vitals.checkButtonHeartbeat()
        expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
      })
    })
  })

  describe('for a client that is sending vitals and has a disconnected gateway', () => {
    beforeEach(async () => {
      this.client = factories.clientFactory({ isSendingVitals: true })
      sandbox.stub(db, 'getDisconnectedGatewaysWithClient').returns([gatewayFactory()])
    })

    describe('when button that is sending vitals last seen exceeds the threshold and no alerts have been sent', () => {
      beforeEach(async () => {
        this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: true, client: this.client })
        sandbox.stub(db, 'getButtons').returns([this.button])
        this.buttonsVital = buttonsVitalFactory({ createdAt: exceededThresholdTimestamp, button: this.button })
        sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
      })

      it('should log one Sentry messages', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledOnce
      })

      it('should send one button disconnection message to Sentry', async () => {
        await vitals.checkButtonHeartbeat()
        expect(helpers.logSentry).to.be.calledWith(
          `Disconnection: ${this.button.client.displayName} ${this.button.displayName} Button delay is ${heartbeatThreshold + 1} seconds.`,
        )
      })

      it('should not send a Twilio message summarizing button status changes', async () => {
        await vitals.checkButtonHeartbeat()
        expect(this.sendClientButtonStatusChangesStub).to.be.calledWith({})
      })
    })
  })
})
