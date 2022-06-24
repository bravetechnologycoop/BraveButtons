// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE, AlertSession, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const { sessionDBFactory, buttonDBFactory } = require('../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getAlertSessionByPhoneNumber', () => {
  beforeEach(async () => {
    this.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
    this.sessionIncidentCategory = '2'
    this.sessionToPhoneNumber = '+13335557777'
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
    const button = await buttonDBFactory(db, {
      clientId: client.id,
      displayName: '701',
      phoneNumber: this.sessionToPhoneNumber,
    })
    const session = await sessionDBFactory(db, {
      buttonId: button.button_id,
      numButtonPresses: 1,
      chatbotState: this.chatbotState,
      incidentCategory: this.sessionIncidentCategory,
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
        this.chatbotState,
        this.sessionIncidentCategory,
        undefined,
        'There has been a request for help from 701 . Please respond "Ok" when you have followed up on the call.',
        this.installationResponderPhoneNumber,
        ['0', '1', '2'],
        this.installationIncidentCategories,
      ),
    )
  })
})
