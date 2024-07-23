// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')
const { DateTime } = require('luxon')
const i18next = require('i18next')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { buttonsVitalFactory } = require('../../testingHelpers')

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

    sandbox.stub(i18next, 't').returnsArg(0)
    sandbox.stub(db, 'getCurrentTime').returns(currentDBDate)
    sandbox.stub(db, 'updateDevicesSentLowBatteryAlerts')
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
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: null,
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold + 1,
        device: this.button,
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
      expect(db.updateDevicesSentLowBatteryAlerts).to.not.be.called
    })
  })

  describe('when a button that is sending vitals battery level is higher than 80% and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: currentDBDate,
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: 81,
        device: this.button,
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
      expect(db.updateDevicesSentLowBatteryAlerts).to.be.calledWithExactly(this.button.id, false)
    })
  })

  describe('when a button that is not sending vitals battery level is higher than 80% and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: currentDBDate,
        isSendingVitals: false,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: 81,
        device: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send the reconnection message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send a no longer low battery notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it("should not update the button's sentLowBatteryAlertAt the database to null", async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateDevicesSentLowBatteryAlerts).not.to.be.called
    })
  })

  describe('when a button that is sending vitals but whose client is not sending vitals battery level is higher than 80% and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: currentDBDate,
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: false }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: 81,
        device: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send the reconnection message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send a no longer low battery notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it("should not update the button's sentLowBatteryAlertAt the database to null", async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateDevicesSentLowBatteryAlerts).not.to.be.called
    })
  })

  describe('when a button that is not sending vitals and whose client is also not sending vitals battery level is higher than 80% and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: currentDBDate,
        isSendingVitals: false,
        client: factories.clientFactory({ isSendingVitals: false }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: 81,
        device: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send the reconnection message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send a no longer low battery notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it("should not update the button's sentLowBatteryAlertAt the database to null", async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateDevicesSentLowBatteryAlerts).not.to.be.called
    })
  })

  describe('when battery level is higher than the threshold but less than 80% and an alert was sent ', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: currentDBDate,
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold + 1,
        device: this.button,
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
      expect(db.updateDevicesSentLowBatteryAlerts).to.not.be.called
    })
  })

  describe('when a button that is sending vitals battery level is less than the threshold and no alerts have been sent', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: null,
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        device: this.button,
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
      expect(db.updateDevicesSentLowBatteryAlerts).to.be.calledWithExactly(this.button.id, true)
    })
  })

  describe('when a button that is not sending vitals battery level is less than the threshold and no alerts have been sent', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: null,
        isSendingVitals: false,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        device: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send the low battery message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send a low battery notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it('should not update the buttons sentLowBatteryAlertAt in the database to now', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateDevicesSentLowBatteryAlerts).not.to.be.called
    })
  })

  describe('when a button that is sending vitals but whose client is not sending vitals battery level is less than the threshold and no alerts have been sent', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: null,
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: false }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        device: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send the low battery message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send a low battery notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it('should not update the buttons sentLowBatteryAlertAt in the database to now', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateDevicesSentLowBatteryAlerts).not.to.be.called
    })
  })

  describe('when a button that is not sending vitals and whose client is not sending vitals battery level is less than the threshold and no alerts have been sent', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: null,
        isSendingVitals: false,
        client: factories.clientFactory({ isSendingVitals: false }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        device: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send the low battery message to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send a low battery notifications', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it('should not update the buttons sentLowBatteryAlertAt in the database to now', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateDevicesSentLowBatteryAlerts).not.to.be.called
    })
  })

  describe('when battery level is less than the threshold and the last alert was sent less than the subsequent alert threshold', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: currentDBDate,
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        device: this.button,
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
      expect(db.updateDevicesSentLowBatteryAlerts).to.not.be.called
    })
  })

  describe('when a button that is sending vitals battery level is less than the threshold and the last alert was sent more than the subsequent alert threshold', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: exceededReminderTimestamp,
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        device: this.button,
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
      expect(db.updateDevicesSentLowBatteryAlerts).to.be.calledWithExactly(this.button.id, true)
    })
  })

  describe('when a button that is not sending vitals battery level is less than the threshold and the last alert was sent more than the subsequent alert threshold', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: exceededReminderTimestamp,
        isSendingVitals: false,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        device: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send any messages to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send a low battery reminder notification', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it('should not update the buttons sentLowBatteryAlertAt in the database to now', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateDevicesSentLowBatteryAlerts).not.to.be.called
    })
  })

  describe('when a button that is sending vitals but whose client is not sending vitals battery level is less than the threshold and the last alert was sent more than the subsequent alert threshold', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: exceededReminderTimestamp,
        isSendingVitals: true,
        client: factories.clientFactory({ isSendingVitals: false }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        device: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send any messages to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send a low battery reminder notification', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it('should not update the buttons sentLowBatteryAlertAt in the database to now', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateDevicesSentLowBatteryAlerts).not.to.be.called
    })
  })

  describe('when a button that is not sending vitals and whose client is also not sending vitals battery level is less than the threshold and the last alert was sent more than the subsequent alert threshold', () => {
    beforeEach(async () => {
      this.button = factories.buttonFactory({
        sentLowBatteryAlertAt: exceededReminderTimestamp,
        isSendingVitals: false,
        client: factories.clientFactory({ isSendingVitals: false }),
      })
      sandbox.stub(db, 'getButtons').returns([this.button])
      this.buttonsVital = buttonsVitalFactory({
        batteryLevel: lowBatteryThreshold - 1,
        device: this.button,
      })
      sandbox.stub(db, 'getRecentButtonsVitals').returns([this.buttonsVital])
    })

    it('should not send any messages to Sentry', async () => {
      await vitals.checkButtonBatteries()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send a low battery reminder notification', async () => {
      await vitals.checkButtonBatteries()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it('should not update the buttons sentLowBatteryAlertAt in the database to now', async () => {
      await vitals.checkButtonBatteries()
      expect(db.updateDevicesSentLowBatteryAlerts).not.to.be.called
    })
  })
})
