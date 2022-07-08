// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const { AlertSession, CHATBOT_STATE, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const { sessionFactory, buttonFactory } = require('../../testingHelpers')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

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
    const testSession = sessionFactory({
      respondedAt: null,
      responedByPhoneNumber: null,
      incidentCategory: null,
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.STARTED))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.STARTED })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState WAITING_FOR_REPLY should update only chatbotState', async () => {
    const testSession = sessionFactory({
      respondedAt: null,
      responedByPhoneNumber: null,
      incidentCategory: null,
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.WAITING_FOR_REPLY))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.WAITING_FOR_REPLY })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState WAITING_FOR_CATEGORY and it has not already been responded to should update chatbotState, respondedAt, and respondedByPhoneNumber', async () => {
    const testSession = sessionFactory({
      respondedAt: null,
      respondedByPhoneNumber: null,
      incidentCategory: null,
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    const expectedRespondedByPhoneNumber = '+18887775555'
    await braveAlerter.alertSessionChangedCallback(
      new AlertSession(testSession.id, CHATBOT_STATE.WAITING_FOR_CATEGORY, expectedRespondedByPhoneNumber),
    )

    const expectedSession = sessionFactory({
      ...testSession,
      chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY,
      respondedAt: this.fakeCurrentTime,
      respondedByPhoneNumber: expectedRespondedByPhoneNumber,
    })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState WAITING_FOR_CATEGORY and it has already been responded to should update chatbotState', async () => {
    const testSession = sessionFactory({
      respondedAt: new Date('2010-06-06T06:06:06.000Z'),
      respondedByPhoneNumber: '+1665554444',
      incidentCategory: null,
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(
      new AlertSession(testSession.id, CHATBOT_STATE.WAITING_FOR_CATEGORY, testSession.respondedByPhoneNumber),
    )

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState COMPLETED and a phone number that is the respondedByPhoneNumber should update only chatbotState', async () => {
    const testSession = sessionFactory({
      respondedAt: new Date('2010-06-06T06:06:06.000Z'),
      respondedByPhoneNumber: '+1665554444',
      incidentCategory: 'Cat1',
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.COMPLETED, testSession.respondedByPhoneNumber))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.COMPLETED })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState COMPLETED but a phone number that is not the respondedByPhoneNumber should not update anything', async () => {
    const testSession = sessionFactory({
      respondedAt: new Date('2010-06-06T06:06:06.000Z'),
      respondedByPhoneNumber: '+1665554444',
      incidentCategory: 'Cat1',
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.COMPLETED, 'a different phone number'))

    expect(db.saveSession).not.to.be.called
  })

  it('if given chatbotState and categoryKey and a phone number that is the respondedByPhoneNumber should update chatbotState and category', async () => {
    const testSession = sessionFactory({
      button: buttonFactory({
        client: factories.clientFactory({ incidentCategories: ['Cat0', 'Cat1', 'Cat2'] }),
      }),
      respondedByPhoneNumber: '+1665554444',
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.COMPLETED, testSession.respondedByPhoneNumber, '0'))

    const expectedSession = sessionFactory({ ...testSession, chatbotState: CHATBOT_STATE.COMPLETED, incidentCategory: 'Cat0' })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given chatbotState and categoryKey and a phone number that is not the respondedByPhoneNumber should not update anything', async () => {
    const testSession = sessionFactory({
      button: buttonFactory({
        client: factories.clientFactory({ incidentCategories: ['Cat0', 'Cat1', 'Cat2'] }),
      }),
      respondedByPhoneNumber: '+1665554444',
    })
    sandbox.stub(db, 'getSessionWithSessionId').returns(testSession)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(testSession.id, CHATBOT_STATE.COMPLETED, 'a different phone number', '0'))

    expect(db.saveSession).not.to.be.called
  })
})
