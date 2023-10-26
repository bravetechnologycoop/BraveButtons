// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')
const { DateTime } = require('luxon')

// In-house dependencies
const { helpers, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const { buttonFactory, buttonsVitalFactory } = require('../../testingHelpers')
require('../../mocks/tMock')

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
  /* eslint-disable no-underscore-dangle */
  beforeEach(() => {
    const getEnvVarStub = sandbox.stub(helpers, 'getEnvVar')
    getEnvVarStub.withArgs('RAK_BUTTONS_VITALS_ALERT_THRESHOLD').returns(heartbeatThreshold)

    sandbox.stub(db, 'getCurrentTime').returns(currentDBDate)
    sandbox.stub(db, 'updateButtonsSentVitalsAlerts')

    sandbox.stub(helpers, 'logSentry')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')

    this.sendNotificationStub = sandbox.stub()
    vitals.__set__('sendNotification', this.sendNotificationStub)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when button that is sending vitals last seen is more recent than the threshold and no alerts have been sent ', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: true, client: factories.clientFactory({ isSendingVitals: true }) })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        createdAt: currentDBDate,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send a disconnection message to Sentry', async () => {
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
      this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: true, client: factories.clientFactory({ isSendingVitals: true }) })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        createdAt: exceededThresholdTimestamp,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should send the disconnection message to Sentry', async () => {
      await vitals.checkButtonHeartbeat()
      expect(helpers.logSentry).to.be.called
    })

    it('should update the buttons sentVitalsAlertAt in the database to now', async () => {
      await vitals.checkButtonHeartbeat()
      expect(db.updateButtonsSentVitalsAlerts).to.be.calledWithExactly(this.button.id, true)
    })

    it('should send a disconnection message to the client', async () => {
      await vitals.checkButtonHeartbeat()
      expect(this.sendNotificationStub).to.be.calledWithExactly(
        'buttonDisconnection',
        [this.button.client.responderPhoneNumbers[0], this.button.client.heartbeatPhoneNumbers[0]],
        this.button.client.fromPhoneNumber,
      )
    })
  })

  describe('when button that is not sending vitals last seen exceeds the threshold and no alerts have been sent', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: false, client: factories.clientFactory({ isSendingVitals: true }) })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        createdAt: exceededThresholdTimestamp,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send a disconnection message to Sentry', async () => {
      await vitals.checkButtonHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkButtonHeartbeat()
      expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
    })
  })

  describe("when client that is not sending vitals's button that is sending vitals last seen exceeds the threshold and no alerts have been sent", () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: true, client: factories.clientFactory({ isSendingVitals: false }) })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        createdAt: exceededThresholdTimestamp,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send a disconnection message to Sentry', async () => {
      await vitals.checkButtonHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkButtonHeartbeat()
      expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
    })
  })

  describe("when client that is not sending vitals's button that is not sending vitals last seen exceeds the threshold and no alerts have been sent", () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: null, isSendingVitals: false, client: factories.clientFactory({ isSendingVitals: false }) })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        createdAt: exceededThresholdTimestamp,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send a disconnection message to Sentry', async () => {
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
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        createdAt: currentDBDate,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should send the reconnection message to Sentry', async () => {
      await vitals.checkButtonHeartbeat()
      expect(helpers.logSentry).to.be.called
    })

    it("should update the button's sentVitalsAlertAt the database to null", async () => {
      await vitals.checkButtonHeartbeat()
      expect(db.updateButtonsSentVitalsAlerts).to.be.calledWithExactly(this.button.id, false)
    })

    it('should send a reconnection message to the client', async () => {
      await vitals.checkButtonHeartbeat()
      expect(this.sendNotificationStub).to.be.calledWithExactly(
        'buttonReconnection',
        [this.button.client.responderPhoneNumbers[0], this.button.client.heartbeatPhoneNumbers[0]],
        this.button.client.fromPhoneNumber,
      )
    })
  })

  describe('when button that is not sending vitals last seen is more recent than the threshold and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = buttonFactory({
        sentVitalsAlertAt: new Date(),
        isSendingVitals: false,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        createdAt: currentDBDate,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send a disconnection message to Sentry', async () => {
      await vitals.checkButtonHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkButtonHeartbeat()
      expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
    })
  })

  describe("when client that is not sending vitals's button that is sending vitals last seen is more recent than the threshold and an alert was sent ", () => {
    beforeEach(async () => {
      this.button = buttonFactory({
        sentVitalsAlertAt: new Date(),
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: false }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        createdAt: currentDBDate,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send a disconnection message to Sentry', async () => {
      await vitals.checkButtonHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkButtonHeartbeat()
      expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
    })
  })

  describe("when client that is not sending vitals's button that is not sending vitals last seen is more recent than the threshold and an alert was sent ", () => {
    beforeEach(async () => {
      this.button = buttonFactory({
        sentVitalsAlertAt: new Date(),
        isSendingVitals: false,
        client: factories.clientFactory({ isSendingVitals: false }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        createdAt: currentDBDate,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send a disconnection message to Sentry', async () => {
      await vitals.checkButtonHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkButtonHeartbeat()
      expect(db.updateButtonsSentVitalsAlerts).to.not.be.called
    })
  })
})
