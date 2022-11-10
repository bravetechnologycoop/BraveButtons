// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { DateTime } = require('luxon')

// In-house dependencies
const { helpers, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const { buttonFactory, buttonsVitalFactory } = require('../../testingHelpers')
const vitals = require('../../../vitals')

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
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when active button last seen is more recent than the threshold and no alerts have been sent ', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: null, isActive: true, client: factories.clientFactory({ isActive: true }) })
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

  describe('when active button last seen exceeds the threshold and no alerts have been sent', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: null, isActive: true, client: factories.clientFactory({ isActive: true }) })
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
  })

  describe('when inactive button last seen exceeds the threshold and no alerts have been sent', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: null, isActive: false, client: factories.clientFactory({ isActive: true }) })
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

  describe("when inactive client's active button last seen exceeds the threshold and no alerts have been sent", () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: null, isActive: true, client: factories.clientFactory({ isActive: false }) })
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

  describe("when inactive client's inactive button last seen exceeds the threshold and no alerts have been sent", () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: null, isActive: false, client: factories.clientFactory({ isActive: false }) })
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

  describe('when active button last seen is more recent than the threshold and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: new Date(), isActive: true, client: factories.clientFactory({ isActive: true }) })
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
  })

  describe('when inactive button last seen is more recent than the threshold and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: new Date(), isActive: false, client: factories.clientFactory({ isActive: true }) })
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

  describe("when inactive client's active button last seen is more recent than the threshold and an alert was sent ", () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: new Date(), isActive: true, client: factories.clientFactory({ isActive: false }) })
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

  describe("when inactive client's inactive button last seen is more recent than the threshold and an alert was sent ", () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentVitalsAlertAt: new Date(), isActive: false, client: factories.clientFactory({ isActive: false }) })
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