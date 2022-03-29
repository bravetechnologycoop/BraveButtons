// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE, AlertSession, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const { sessionDBFactory } = require('../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getAlertSessionByPhoneNumber', () => {
  beforeEach(async () => {
    this.sessionState = CHATBOT_STATE.WAITING_FOR_DETAILS
    this.sessionIncidentType = '2'
    this.sessionNotes = 'sessionNotes'
    this.sessionToPhoneNumber = '+13335557777'
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
    const session = await sessionDBFactory(db, {
      clientId: client.id,
      unit: '701',
      numPresses: 1,
      phoneNumber: this.sessionToPhoneNumber,
      chatbotState: this.sessionState,
      incidentType: this.sessionIncidentType,
      notes: this.sessionNotes,
    })
    this.sessionId = session.id
  })

  afterEach(async () => {
    await db.clearTables()
  })

  it('should return an AlertSession with the values from the DB', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    const alertSession = await braveAlerter.getAlertSessionByPhoneNumber(this.sessionToPhoneNumber)

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
