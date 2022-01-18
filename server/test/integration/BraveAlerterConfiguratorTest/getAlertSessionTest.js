// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE, AlertSession, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

describe('BraveAlerterConfigurator.js integration tests: getAlertSession', () => {
  beforeEach(async () => {
    this.sessionState = CHATBOT_STATE.WAITING_FOR_DETAILS
    this.sessionIncidentType = '2'
    this.sessionNotes = 'sessionNotes'
    this.message = 'message'
    this.installationResponderPhoneNumber = '+17775558888'
    this.installationIncidentCategories = ['Cat1', 'Cat2', 'Cat3']

    await db.clearTables()

    const client = await factories.clientDBFactory(db, {
      displayName: '',
      responderPhoneNumber: this.installationResponderPhoneNumber,
      fallbackPhoneNumbers: '{}',
      incidentCategories: this.installationIncidentCategories,
      alertApiKey: null,
      responderPushId: null,
    })
    const session = await db.createSession(client.id, '', '701', '', 1, null)
    this.sessionId = session.id
    session.state = this.sessionState
    session.incidentType = this.sessionIncidentType
    session.notes = this.sessionNotes
    await db.saveSession(session)
  })

  afterEach(async () => {
    await db.clearTables()
  })

  it('should return an AlertSession with the values from the DB', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    const alertSession = await braveAlerter.getAlertSession(this.sessionId)

    expect(alertSession).to.eql(
      new AlertSession(
        this.sessionId,
        this.sessionState,
        this.sessionIncidentType,
        this.sessionNotes,
        'There has been a request for help from Unit 701 . Please respond "Ok" when you have followed up on the call.',
        this.installationResponderPhoneNumber,
        ['0', '1', '2'],
        this.installationIncidentCategories,
      ),
    )
  })
})
