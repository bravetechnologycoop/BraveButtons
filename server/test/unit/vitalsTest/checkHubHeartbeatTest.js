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
const { hubFactory } = require('../../testingHelpers')

const vitals = rewire('../../../vitals')

use(sinonChai)

const sandbox = sinon.createSandbox()

const currentDBDate = new Date('2021-11-04T22:28:28.0248Z')

const flicThreshold = 210
const piThreshold = 75
const pingThreshold = 320
const clientThreshold = 640
const subsequentVitalsThreshold = 1000

// Expects JS Date objects
function subtractSeconds(date, seconds) {
  const dateTime = DateTime.fromJSDate(date)
  return dateTime.minus({ seconds }).toJSDate()
}

const exceededFlicTimestamp = subtractSeconds(currentDBDate, flicThreshold + 1) // sub(currentDBDate, { seconds: flicThreshold + 1 })
const exceededPingTimestamp = subtractSeconds(currentDBDate, pingThreshold + 1) // sub(currentDBDate, { seconds: pingThreshold + 1 })
const exceededPiTimestamp = subtractSeconds(currentDBDate, piThreshold + 1) // sub(currentDBDate, { seconds: piThreshold + 1 })
const exceededExternalTimestamp = subtractSeconds(currentDBDate, clientThreshold + 1) // sub(currentDBDate, { seconds: clientThreshold + 1 })
const exceededReminderTimestamp = subtractSeconds(currentDBDate, subsequentVitalsThreshold + 1) // sub(currentDBDate, { seconds: subsequentVitalsThreshold + 1 })

describe('vitals.js unit tests: checkHubHeartbeat', () => {
  /* eslint-disable no-underscore-dangle */
  beforeEach(() => {
    const getEnvVarStub = sandbox.stub(helpers, 'getEnvVar')
    getEnvVarStub.withArgs('LAST_SEEN_FLIC_THRESHOLD').returns(flicThreshold)
    getEnvVarStub.withArgs('LAST_SEEN_PING_THRESHOLD').returns(pingThreshold)
    getEnvVarStub.withArgs('LAST_SEEN_HEARTBEAT_THRESHOLD').returns(piThreshold)
    getEnvVarStub.withArgs('VITALS_ALERT_THRESHOLD').returns(clientThreshold)
    getEnvVarStub.withArgs('SUBSEQUENT_VITALS_ALERT_THRESHOLD').returns(subsequentVitalsThreshold)

    sandbox.stub(db, 'getCurrentTime').returns(currentDBDate)
    sandbox.stub(db, 'updateHubSentVitalsAlerts')
    sandbox.stub(db, 'updateSentInternalAlerts')

    sandbox.stub(helpers, 'logSentry')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')

    this.sendDisconnectionMessageStub = sandbox.stub()
    vitals.__set__('sendDisconnectionMessage', this.sendDisconnectionMessageStub)
    this.sendDisconnectionReminderStub = sandbox.stub()
    vitals.__set__('sendDisconnectionReminder', this.sendDisconnectionReminderStub)
    this.sendReconnectionMessageStub = sandbox.stub()
    vitals.__set__('sendReconnectionMessage', this.sendReconnectionMessageStub)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when time since flic last seen, last ping, and last heartbeat are all less than threshold, and alerts have not been sent ', () => {
    beforeEach(async () => {
      this.hub = hubFactory({ flicLastPingTime: currentDBDate, flicLastSeenTime: currentDBDate, heartbeatLastSeenTime: currentDBDate })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should not send a disconnection message to Sentry', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not send any alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })
  })

  describe('when just time since flic last seen exceeds the internal threshold, but is less than external threshold, and no internal alerts have been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastSeenTime: exceededFlicTimestamp,
        sentInternalFlicAlert: false,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should send a disconnection message to Sentry', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.be.called
    })

    it('should update flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.be.calledWith(hubFactory({ flicLastSeenTime: exceededFlicTimestamp, sentInternalFlicAlert: true }))
    })
  })

  describe('when just time since last ping exceeds the internal threshold but is less than external threshold, and no internal alerts have been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastPingTime: exceededPingTimestamp,
        sentInternalPingAlert: false,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should send a disconnection message to Sentry', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.be.called
    })

    it('should update flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.be.calledWith(hubFactory({ flicLastPingTime: exceededPingTimestamp, sentInternalPingAlert: true }))
    })
  })

  describe('when just time since last pi heartbeat exceeds the internal threshold but is less than external threshold, and no internal alerts have been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        heartbeatLastSeenTime: exceededPiTimestamp,
        sentInternalPiAlert: false,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should send a disconnection message to Sentry', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.be.called
    })

    it('should update flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.be.calledWith(hubFactory({ heartbeatLastSeenTime: exceededPiTimestamp, sentInternalPiAlert: true }))
    })
  })

  describe('when just time since flic last seen exceeds the internal threshold, but is less than external threshold, and internal alert has been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastSeenTime: exceededFlicTimestamp,
        sentInternalFlicAlert: true,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should not send another disconnection message to Sentry', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.not.be.called
    })
  })

  describe('when just time since last ping exceeds the internal threshold, but is less than external threshold, and internal alert has been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastPingTime: exceededPingTimestamp,
        sentInternalPingAlert: true,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should not send another disconnection message to Sentry', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.not.be.called
    })
  })

  describe('when just time since last pi heartbeat exceeds the internal threshold, but is less than external threshold, and internal alert has been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        heartbeatLastSeenTime: exceededPiTimestamp,
        sentInternalPiAlert: true,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should not send another disconnection message to Sentry', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.not.be.called
    })
  })

  describe('when just time since flic last seen no longer exceeds the internal threshold, but is less than external threshold, and internal alert has been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastSeenTime: currentDBDate,
        sentInternalFlicAlert: true,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should update flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.be.calledWith(hubFactory({ flicLastSeenTime: currentDBDate, sentInternalFlicAlert: false }))
    })
  })

  describe('when just time since flic last seen no longer exceeds the internal threshold, but is less than external threshold, and internal alert has been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastPingTime: currentDBDate,
        sentInternalPingAlert: true,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should update flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.be.calledWith(hubFactory({ flicLastPingTime: currentDBDate, sentInternalPingAlert: false }))
    })
  })

  describe('when just time since flic last seen no longer exceeds the internal threshold, but is less than external threshold, and internal alert has been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        heartbeatLastSeenTime: currentDBDate,
        sentInternalPiAlert: true,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should update flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.be.calledWith(hubFactory({ heartbeatLastSeenTime: currentDBDate, sentInternalPiAlert: false }))
    })
  })

  describe('when time since flic last seen, last ping, and last heartbeat are all greater than internal threshold, and alerts have not been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastPingTime: exceededPingTimestamp,
        flicLastSeenTime: exceededFlicTimestamp,
        heartbeatLastSeenTime: exceededPiTimestamp,
        sentInternalFlicAlert: false,
        sentInternalPiAlert: false,
        sentInternalPingAlert: false,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should send three disconnection messages to Sentry', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.be.calledThrice
    })

    it('should update each flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.be.calledThrice
    })

    it('should not send any alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })
  })

  describe('when time since flic last seen, last ping, and last heartbeat are all less than internal threshold, and alerts have been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        sentInternalFlicAlert: true,
        sentInternalPiAlert: true,
        sentInternalPingAlert: true,
        flicLastPingTime: currentDBDate,
        flicLastSeenTime: currentDBDate,
        heartbeatLastSeenTime: currentDBDate,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should send reconnection messages', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.be.calledThrice
    })

    it('should update each flag for internal alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.be.calledThrice
    })
  })

  describe('when time since flic last seen, last ping, and last heartbeat are all greater than external threshold, and alerts have not been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastPingTime: exceededExternalTimestamp,
        flicLastSeenTime: exceededExternalTimestamp,
        heartbeatLastSeenTime: exceededExternalTimestamp,
        sentInternalFlicAlert: true,
        sentInternalPiAlert: true,
        sentInternalPingAlert: true,
        sentVitalsAlertAt: null,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should update external alerts flag', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateHubSentVitalsAlerts).to.be.called
    })

    it('should send disconnection alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(this.sendDisconnectionMessageStub).to.be.called
    })
  })

  describe('when time since flic last seen, last ping, and last heartbeat are all greater than external threshold, and alerts have been sent and the subsequent alert time threshold is not yet exceeded', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastPingTime: exceededExternalTimestamp,
        flicLastSeenTime: exceededExternalTimestamp,
        heartbeatLastSeenTime: exceededExternalTimestamp,
        sentInternalFlicAlert: true,
        sentInternalPiAlert: true,
        sentInternalPingAlert: true,
        sentVitalsAlertAt: currentDBDate,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should not update external alerts flag', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateHubSentVitalsAlerts).to.not.be.called
    })

    it('should not send reminder alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(this.sendDisconnectionReminderStub).to.not.be.called
    })
  })

  describe('when time since flic last seen, last ping, and last heartbeat are all greater than external threshold, and alerts have been sent and the subsequent alert time threshold has been exceeded', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastPingTime: exceededReminderTimestamp,
        flicLastSeenTime: exceededReminderTimestamp,
        heartbeatLastSeenTime: exceededReminderTimestamp,
        sentInternalFlicAlert: true,
        sentInternalPiAlert: true,
        sentInternalPingAlert: true,
        sentVitalsAlertAt: exceededReminderTimestamp,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should update external alerts with new timestamp', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateHubSentVitalsAlerts).to.be.called
    })

    it('should not send reminder alerts', async () => {
      await vitals.checkHubHeartbeat()
      expect(this.sendDisconnectionReminderStub).to.be.called
    })
  })

  describe('when one of the heartbeat metrics is below threshold, but the other ones are still over threshold, and alerts have been sent and reminders have been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastPingTime: currentDBDate,
        flicLastSeenTime: exceededFlicTimestamp,
        heartbeatLastSeenTime: exceededPiTimestamp,
        sentInternalFlicAlert: true,
        sentInternalPiAlert: true,
        sentInternalPingAlert: true,
        sentVitalsAlertAt: currentDBDate,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should send a reconnection message for the metric which has gotten back to normal', async () => {
      await vitals.checkHubHeartbeat()
      expect(helpers.logSentry).to.be.calledOnce
    })

    it('should update internal alert flag for the metric which has gotten back to normal', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateSentInternalAlerts).to.be.calledOnce
    })

    it('should not update external alerts flag', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateHubSentVitalsAlerts).to.be.called
    })

    it('should not send reconnection messages', async () => {
      await vitals.checkHubHeartbeat()
      expect(this.sendReconnectionMessageStub).to.be.called
    })
  })

  describe('when time since flic last seen, last ping, and last heartbeat are all below threshold, and alerts have been sent and reminders have been sent', () => {
    beforeEach(async () => {
      this.hub = hubFactory({
        flicLastPingTime: currentDBDate,
        flicLastSeenTime: currentDBDate,
        heartbeatLastSeenTime: currentDBDate,
        sentInternalFlicAlert: true,
        sentInternalPiAlert: true,
        sentInternalPingAlert: true,
        sentVitalsAlertAt: currentDBDate,
      })
      sandbox.stub(db, 'getHubs').returns([this.hub])
    })

    it('should update external alerts flag', async () => {
      await vitals.checkHubHeartbeat()
      expect(db.updateHubSentVitalsAlerts).to.be.called
    })

    it('should send reconnection messages', async () => {
      await vitals.checkHubHeartbeat()
      expect(this.sendReconnectionMessageStub).to.be.called
    })
  })
})
