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

  it('if given chatbotState STARTED should update only chatbotState', async () => {
    const testSession = sessionFactory()
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.STARTED))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.STARTED })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState WAITING_FOR_REPLY should update only chatbotState', async () => {
    const testSession = sessionFactory()
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.WAITING_FOR_REPLY))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.WAITING_FOR_REPLY })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState WAITING_FOR_CATEGORY and it has not already been responded to should update chatbotState and respondedAt', async () => {
    const testSession = sessionFactory({
      respondedAt: null,
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.WAITING_FOR_CATEGORY))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY, respondedAt: this.fakeCurrentTime })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState WAITING_FOR_CATEGORY and it has already been responded to should update chatbotState', async () => {
    const testSession = sessionFactory({
      respondedAt: new Date('2010-06-06T06:06:06.000Z'),
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.WAITING_FOR_CATEGORY))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState COMPLETED should update only chatbotState', async () => {
    const testSession = sessionFactory()
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.COMPLETED))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.COMPLETED })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState and categoryKey should update chatbotState and category', async () => {
    const testSession = sessionFactory()
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.COMPLETED, '0'))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.COMPLETED, incidentCategory: 'Cat0' })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })
})
