// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE, AlertSession, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const { sessionDBFactory, buttonDBFactory } = require('../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getAlertSessionBySessionidAndAlertApiKey', () => {
  beforeEach(async () => {
    this.chatbotState = CHATBOT_STATE.COMPLETED
    this.sessionIncidentCategory = '2'
    this.sessionToPhoneNumber = '+13335557777'
    this.message = 'message'
    this.installationResponderPhoneNumbers = ['+17775558888']
    this.installationIncidentCategories = ['Cat1', 'Cat2', 'Cat3']
    this.alertApiKey = 'myApiKey'
    this.respondedByPhoneNumber = '+17775554444'

    await db.clearTables()

    const client = await factories.clientDBFactory(db, {
      displayName: '',
      responderPhoneNumbers: this.installationResponderPhoneNumbers,
      fallbackPhoneNumbers: '{}',
      incidentCategories: this.installationIncidentCategories,
      alertApiKey: this.alertApiKey,
      responderPushId: null,
    })
    const button = await buttonDBFactory(db, {
      clientId: client.id,
      displayName: '701',
      phoneNumber: this.sessionToPhoneNumber,
    })
    const session = await sessionDBFactory(db, {
      buttonId: button.buttonId,
      numButtonPresses: 1,
      chatbotState: this.chatbotState,
      incidentCategory: this.sessionIncidentCategory,
      respondedByPhoneNumber: this.respondedByPhoneNumber,
    })
    this.sessionId = session.id
  })

  afterEach(async () => {
    await db.clearTables()
  })

  it('should return an AlertSession with the values from the DB', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    const alertSession = await braveAlerter.getAlertSessionBySessionIdAndAlertApiKey(this.sessionId, this.alertApiKey)

    expect(alertSession).to.eql(
      new AlertSession(
        this.sessionId,
        this.chatbotState,
        this.respondedByPhoneNumber,
        this.sessionIncidentCategory,
        this.installationResponderPhoneNumbers,
        ['0', '1', '2'],
        this.installationIncidentCategories,
      ),
    )
  })
})
