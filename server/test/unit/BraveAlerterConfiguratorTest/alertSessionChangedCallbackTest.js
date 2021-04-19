// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const { ALERT_STATE, AlertSession } = require('brave-alert-lib')
const db = require('../../../db/db.js')
const { createTestSessionState } = require('../../testingHelpers.js')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

// Configure Chai
use(sinonChai)

describe('BraveAlerterConfigurator.js unit tests: alertSessionChangedCallback', () => {
  beforeEach(() => {
    sinon.stub(db, 'beginTransaction')
    sinon.stub(db, 'getSessionWithSessionId').returns(createTestSessionState())
    sinon.stub(db, 'getInstallationWithSessionId').returns({
      incidentCategories: ['Cat0', 'Cat1', 'Cat2'],
    })
    sinon.stub(db, 'saveSession')
    sinon.stub(db, 'commitTransaction')
  })

  afterEach(() => {
    db.commitTransaction.restore()
    db.saveSession.restore()
    db.getInstallationWithSessionId.restore()
    db.getSessionWithSessionId.restore()
    db.beginTransaction.restore()
  })

  it('if given only alertState should update only alertState', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(this.fakeSessionId, ALERT_STATE.WAITING_FOR_REPLY))

    const expectedSession = createTestSessionState()
    expectedSession.state = ALERT_STATE.WAITING_FOR_REPLY

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })

  it('if given alertState and categoryKey should update alertState and category', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, ALERT_STATE.WAITING_FOR_DETAILS, '0'))

    const expectedSession = createTestSessionState()
    expectedSession.state = ALERT_STATE.WAITING_FOR_DETAILS
    expectedSession.incidentType = 'Cat0'

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })

  it('if given alertState and details should update alertState and details', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, ALERT_STATE.COMPLETED, undefined, 'fakeDetails'))

    const expectedSession = createTestSessionState()
    expectedSession.state = ALERT_STATE.COMPLETED
    expectedSession.notes = 'fakeDetails'

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })

  it('if given only fallback return message should update only fallback return message', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, undefined, undefined, undefined, 'fakeFallbackReturnMessage'))

    const expectedSession = createTestSessionState()
    expectedSession.fallBackAlertTwilioStatus = 'fakeFallbackReturnMessage'

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })
})
