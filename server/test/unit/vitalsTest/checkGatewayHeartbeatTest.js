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
const { gatewayFactory, gatewaysVitalFactory } = require('../../testingHelpers')
const aws = require('../../../aws')
require('../../mocks/tMock')

const vitals = rewire('../../../vitals')

use(sinonChai)

const sandbox = sinon.createSandbox()

const currentDBDate = new Date('2021-11-04T22:28:28.0248Z')

const gatewayThreshold = 500
const subsequentVitalsThreshold = 1000

// Expects JS Date objects
function subtractSeconds(date, seconds) {
  const dateTime = DateTime.fromJSDate(date)
  return dateTime.minus({ seconds }).toJSDate()
}

const exceededTimestamp = subtractSeconds(currentDBDate, gatewayThreshold + 1)
const exceededReminderTimestamp = subtractSeconds(currentDBDate, subsequentVitalsThreshold + 1) // sub(currentDBDate, { seconds: subsequentVitalsThreshold + 1 })

describe('vitals.js unit tests: checkGatewayHeartbeat', () => {
  /* eslint-disable no-underscore-dangle */
  beforeEach(() => {
    const getEnvVarStub = sandbox.stub(helpers, 'getEnvVar')
    getEnvVarStub.withArgs('GATEWAY_VITALS_ALERT_THRESHOLD').returns(gatewayThreshold)
    getEnvVarStub.withArgs('SUBSEQUENT_VITALS_ALERT_THRESHOLD').returns(subsequentVitalsThreshold)

    sandbox.stub(db, 'getCurrentTime').returns(currentDBDate)
    sandbox.stub(db, 'updateGatewaySentVitalsAlerts')

    sandbox.stub(aws, 'getGatewayStats').returns(null)

    sandbox.stub(helpers, 'logSentry')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')

    this.sendNotificationStub = sandbox.stub()
    vitals.__set__('sendNotification', this.sendNotificationStub)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when last seen gateway is less than the threshold and no alerts have been sent ', () => {
    beforeEach(async () => {
      this.gateway = gatewayFactory({ sentVitalsAlertAt: null })
      sandbox.stub(db, 'getGateways').returns([this.gateway])
      this.gatewaysVital = gatewaysVitalFactory({
        lastSeenAt: currentDBDate,
        gateway: this.gateway,
      })
      sandbox.stub(db, 'getRecentGatewaysVitalWithGatewayId').returns(this.gatewaysVital)
    })

    it('should not send a disconnection message to Sentry', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not send any notifications', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(this.sendNotificationStub).to.not.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(db.updateGatewaySentVitalsAlerts).to.not.be.called
    })
  })

  describe('when last seen gateway is less than the threshold and an alert was sent ', () => {
    beforeEach(async () => {
      this.gateway = gatewayFactory({ sentVitalsAlertAt: currentDBDate })
      sandbox.stub(db, 'getGateways').returns([this.gateway])
      this.gatewaysVital = gatewaysVitalFactory({
        lastSeenAt: currentDBDate,
        gateway: this.gateway,
      })
      sandbox.stub(db, 'getRecentGatewaysVitalWithGatewayId').returns(this.gatewaysVital)
    })

    it('should send the reconnection message to Sentry', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(helpers.logSentry).to.be.called
    })

    it('should send a reconnection notifications', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(this.sendNotificationStub).to.be.calledWithExactly(
        'gatewayReconnection',
        this.gateway.client.responderPhoneNumbers.concat(this.gateway.client.heartbeatPhoneNumbers),
        this.gateway.client.fromPhoneNumber,
      )
    })

    it("should update the gateway's sentVitalsAlertAt the database to null", async () => {
      await vitals.checkGatewayHeartbeat()
      expect(db.updateGatewaySentVitalsAlerts).to.be.calledWithExactly(this.gateway.id, false)
    })
  })

  describe('when last seen gateway is more than the threshold and no alerts have been sent', () => {
    beforeEach(async () => {
      this.gateway = gatewayFactory({ sentVitalsAlertAt: null })
      sandbox.stub(db, 'getGateways').returns([this.gateway])
      this.gatewaysVital = gatewaysVitalFactory({
        lastSeenAt: exceededTimestamp,
        gateway: this.gateway,
      })
      sandbox.stub(db, 'getRecentGatewaysVitalWithGatewayId').returns(this.gatewaysVital)
    })

    it('should send the disconnection message to Sentry', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(helpers.logSentry).to.be.called
    })

    it('should send a disconnection notifications', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(this.sendNotificationStub).to.be.calledWithExactly(
        'gatewayDisconnectionInitial',
        this.gateway.client.responderPhoneNumbers.concat(this.gateway.client.heartbeatPhoneNumbers),
        this.gateway.client.fromPhoneNumber,
      )
    })

    it("should update the gateway's sentVitalsAlertAt the database to now", async () => {
      await vitals.checkGatewayHeartbeat()
      expect(db.updateGatewaySentVitalsAlerts).to.be.calledWithExactly(this.gateway.id, true)
    })
  })

  describe('when last seen gateway is more than the threshold and the last alert was sent less than the subsequent alert threshold', () => {
    beforeEach(async () => {
      this.gateway = gatewayFactory({ sentVitalsAlertAt: currentDBDate })
      sandbox.stub(db, 'getGateways').returns([this.gateway])
      this.gatewaysVital = gatewaysVitalFactory({
        lastSeenAt: exceededTimestamp,
        gateway: this.gateway,
      })
      sandbox.stub(db, 'getRecentGatewaysVitalWithGatewayId').returns(this.gatewaysVital)
    })

    it('should not sent any messages to Sentry', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should not send any notifications', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(this.sendNotificationStub).not.to.be.called
    })

    it('should not update the database', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(db.updateGatewaySentVitalsAlerts).to.not.be.called
    })
  })

  describe('when last seen gateway is more than the threshold and the last alert was sent more than the subsequent alert threshold', () => {
    beforeEach(async () => {
      this.gateway = gatewayFactory({ sentVitalsAlertAt: exceededReminderTimestamp })
      sandbox.stub(db, 'getGateways').returns([this.gateway])
      this.gatewaysVital = gatewaysVitalFactory({
        lastSeenAt: exceededTimestamp,
        gateway: this.gateway,
      })
      sandbox.stub(db, 'getRecentGatewaysVitalWithGatewayId').returns(this.gatewaysVital)
    })

    it('should not send any messages to Sentry', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(helpers.logSentry).not.to.be.called
    })

    it('should send a disconnection reminder notifications', async () => {
      await vitals.checkGatewayHeartbeat()
      expect(this.sendNotificationStub).to.be.calledWithExactly(
        'gatewayDisconnectionReminder',
        this.gateway.client.responderPhoneNumbers.concat(this.gateway.client.heartbeatPhoneNumbers),
        this.gateway.client.fromPhoneNumber,
      )
    })

    it("should update the gateway's sentVitalsAlertAt the database to now", async () => {
      await vitals.checkGatewayHeartbeat()
      expect(db.updateGatewaySentVitalsAlerts).to.be.calledWithExactly(this.gateway.id, true)
    })
  })
})
