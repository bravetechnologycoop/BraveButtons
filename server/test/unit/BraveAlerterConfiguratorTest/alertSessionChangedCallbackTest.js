// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const { CHATBOT_STATE, AlertSession } = require('brave-alert-lib')
const db = require('../../../db/db.js')
const { sessionFactory } = require('../../testingHelpers.js')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('BraveAlerterConfigurator.js unit tests: alertSessionChangedCallback', () => {
  beforeEach(() => {
    this.fakeCurrentTime = new Date('2020-12-25T10:09:08.000Z')
    sandbox.stub(db, 'getCurrentTime').returns(this.fakeCurrentTime)
    sandbox.stub(db, 'beginTransaction')
    sandbox.stub(db, 'getClientWithSessionId').returns({
      incidentCategories: ['Cat0', 'Cat1', 'Cat2'],
    })
    sandbox.stub(db, 'saveSession')
    sandbox.stub(db, 'commitTransaction')
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('if given alertState STARTED should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.STARTED))

    const expectedSession = sessionFactory()
    expectedSession.state = CHATBOT_STATE.STARTED

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_REPLY should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_REPLY))

    const expectedSession = sessionFactory({ id: sessionId, state: CHATBOT_STATE.WAITING_FOR_REPLY })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_CATEGORY and it has not already been responded to should update alertState and respondedAt', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId, respondedAt: null }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY))

    const expectedSession = sessionFactory({ id: sessionId, state: CHATBOT_STATE.WAITING_FOR_CATEGORY, respondedAt: this.fakeCurrentTime })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_CATEGORY and it has already been responded to should update alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const testRespondedAtTime = new Date('2010-06-06T06:06:06.000Z')
    const testSessionState = sessionFactory({ id: sessionId, respondedAt: testRespondedAtTime })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSessionState)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY))

    const expectedSession = sessionFactory({ id: sessionId, state: CHATBOT_STATE.WAITING_FOR_CATEGORY, respondedAt: testRespondedAtTime })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_DETAILS should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_DETAILS))

    const expectedSession = sessionFactory({ id: sessionId, state: CHATBOT_STATE.WAITING_FOR_DETAILS })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState COMPLETED should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.COMPLETED))

    const expectedSession = sessionFactory({ id: sessionId, state: CHATBOT_STATE.COMPLETED })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState and categoryKey should update alertState and category', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_DETAILS, '0'))

    const expectedSession = sessionFactory({ id: sessionId, state: CHATBOT_STATE.WAITING_FOR_DETAILS, incidentType: 'Cat0' })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState and details should update alertState and details', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.COMPLETED, undefined, 'fakeDetails'))

    const expectedSession = sessionFactory({ id: sessionId, state: CHATBOT_STATE.COMPLETED, notes: 'fakeDetails' })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })
})
