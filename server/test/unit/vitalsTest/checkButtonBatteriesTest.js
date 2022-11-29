// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')
const { DateTime } = require('luxon')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { buttonFactory, buttonsVitalFactory } = require('../../testingHelpers')
require('../../mocks/tMock')

const vitals = rewire('../../../vitals')

use(sinonChai)

const sandbox = sinon.createSandbox()

const currentDBDate = new Date('2021-11-04T22:28:28.0248Z')

const lowBatteryThreshold = 10
const subsequentVitalsThreshold = 1000

// Expects JS Date objects
function subtractSeconds(date, seconds) {
  const dateTime = DateTime.fromJSDate(date)
  return dateTime.minus({ seconds }).toJSDate()
}

const exceededReminderTimestamp = subtractSeconds(currentDBDate, subsequentVitalsThreshold + 1) // sub(currentDBDate, { seconds: subsequentVitalsThreshold + 1 })

describe('vitals.js unit tests: checkButtonBatteries', () => {
  /* eslint-disable no-underscore-dangle */
  beforeEach(() => {
    const getEnvVarStub = sandbox.stub(helpers, 'getEnvVar')
    getEnvVarStub.withArgs('BUTTON_LOW_BATTERY_ALERT_THRESHOLD').returns(lowBatteryThreshold)
    getEnvVarStub.withArgs('SUBSEQUENT_VITALS_ALERT_THRESHOLD').returns(subsequentVitalsThreshold)

    sandbox.stub(db, 'getCurrentTime').returns(currentDBDate)
    sandbox.stub(db, 'updateButtonsSentLowBatteryAlerts')

    sandbox.stub(helpers, 'logSentry')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')

    this.sendNotificationStub = sandbox.stub()
    vitals.__set__('sendNotification', this.sendNotificationStub)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when battery level is higher than the threshold and no alerts have been sent ', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentLowBatteryAlertAt: null })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold + 1,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send a disconnection message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not send any notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).to.not.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateButtonsSentLowBatteryAlerts).to.not.be.called
    })
  })

  describe('when battery level is higher than 80% and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentLowBatteryAlertAt: currentDBDate })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: 81,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should send the reconnection message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).to.be.called
    })

    it('should send a no longer low battery notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).to.be.calledWithExactly(
        'buttonLowBatteryNoLonger',
        this.button.client.responderPhoneNumbers.concat(this.button.client.heartbeatPhoneNumbers),
        this.button.client.fromPhoneNumber,
      )
    })

    it("should update the button's sentLowBatteryAlertAt the database to null", async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateButtonsSentLowBatteryAlerts).to.be.calledWithExactly(this.button.id, false)
    })
  })

  describe('when battery level is higher than the threshold but less than 80% and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentLowBatteryAlertAt: currentDBDate })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold + 1,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send a disconnection message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not send any notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).to.not.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateButtonsSentLowBatteryAlerts).to.not.be.called
    })
  })

  describe('when battery level is less than the threshold and no alerts have been sent', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentLowBatteryAlertAt: null })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should send the low battery message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).to.be.called
    })

    it('should send a low battery notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).to.be.calledWithExactly(
        'buttonLowBatteryInitial',
        this.button.client.responderPhoneNumbers.concat(this.button.client.heartbeatPhoneNumbers),
        this.button.client.fromPhoneNumber,
      )
    })

    it('should update the buttons sentLowBatteryAlertAt in the database to now', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateButtonsSentLowBatteryAlerts).to.be.calledWithExactly(this.button.id, true)
    })
  })

  describe('when battery level is less than the threshold and the last alert was sent less than the subsequent alert threshold', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentLowBatteryAlertAt: currentDBDate })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not sent any messages to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send any notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateButtonsSentLowBatteryAlerts).to.not.be.called
    })
  })

  describe('when battery level is less than the threshold and the last alert was sent more than the subsequent alert threshold', () => {
    beforeEach(async () => {
      this.button = buttonFactory({ sentLowBatteryAlertAt: exceededReminderTimestamp })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        button: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send any messages to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should send a low battery reminder notification', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).to.be.calledWithExactly(
        'buttonLowBatteryReminder',
        this.button.client.responderPhoneNumbers.concat(this.button.client.heartbeatPhoneNumbers),
        this.button.client.fromPhoneNumber,
      )
    })

    it('should update the buttons sentLowBatteryAlertAt in the database to now', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateButtonsSentLowBatteryAlerts).to.be.calledWithExactly(this.button.id, true)
    })
  })
})
