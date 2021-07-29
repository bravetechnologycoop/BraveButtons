// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const { CHATBOT_STATE, AlertSession } = require('brave-alert-lib')
const db = require('../../../db/db.js')
const { createTestSessionState } = require('../../testingHelpers.js')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

// Configure Chai
use(sinonChai)

describe('BraveAlerterConfigurator.js unit tests: alertSessionChangedCallback', () => {
  beforeEach(() => {
    this.fakeCurrentTime = new Date('2020-12-25T10:09:08.000Z')
    sinon.stub(db, 'getCurrentTime').returns(this.fakeCurrentTime)
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
    db.getCurrentTime.restore()
  })

  it('if given alertState STARTED should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.STARTED))

    const expectedSession = createTestSessionState()
    expectedSession.state = CHATBOT_STATE.STARTED

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })

  it('if given alertState WAITING_FOR_REPLY should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_REPLY))

    const expectedSession = createTestSessionState()
    expectedSession.state = CHATBOT_STATE.WAITING_FOR_REPLY

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })

  it('if given alertState WAITING_FOR_CATEGORY should update alertState and respondedAt', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY))

    const expectedSession = createTestSessionState()
    expectedSession.state = CHATBOT_STATE.WAITING_FOR_CATEGORY
    expectedSession.respondedAt = this.fakeCurrentTime

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })

  it('if given alertState WAITING_FOR_DETAILS should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_DETAILS))

    const expectedSession = createTestSessionState()
    expectedSession.state = CHATBOT_STATE.WAITING_FOR_DETAILS

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })

  it('if given alertState COMPLETED should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.COMPLETED))

    const expectedSession = createTestSessionState()
    expectedSession.state = CHATBOT_STATE.COMPLETED

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })

  it('if given alertState and categoryKey should update alertState and category', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_DETAILS, '0'))

    const expectedSession = createTestSessionState()
    expectedSession.state = CHATBOT_STATE.WAITING_FOR_DETAILS
    expectedSession.incidentType = 'Cat0'

    expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
  })

  it('if given alertState and details should update alertState and details', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.COMPLETED, undefined, 'fakeDetails'))

    const expectedSession = createTestSessionState()
    expectedSession.state = CHATBOT_STATE.COMPLETED
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
