// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE, AlertSession, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

describe('BraveAlerterConfigurator.js integration tests: getAlertSession', () => {
  beforeEach(async () => {
    this.chatbotState = CHATBOT_STATE.COMPLETED
    this.sessionIncidentCategory = '2'
    this.message = 'message'
    this.installationResponderPhoneNumbers = ['+17775558888']
    this.installationIncidentCategories = ['Cat1', 'Cat2', 'Cat3']
    this.language = 'de'

    await db.clearTables()

    const client = await factories.clientDBFactory(db, {
      displayName: '',
      responderPhoneNumbers: this.installationResponderPhoneNumbers,
      fallbackPhoneNumbers: '{}',
      incidentCategories: this.installationIncidentCategories,
      language: this.language,
    })
    const button = await factories.buttonDBFactory(db, {
      clientId: client.id,
      displayName: '701',
    })
    const session = await factories.sessionDBFactory(db, {
      deviceId: button.id,
      numberOfAlerts: 1,
      chatbotState: this.chatbotState,
      incidentCategory: this.sessionIncidentCategory,
      respondedByPhoneNumber: this.installationResponderPhoneNumbers[0],
    })
    this.sessionId = session.id
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
        this.chatbotState,
        this.installationResponderPhoneNumbers[0],
        this.sessionIncidentCategory,
        this.installationResponderPhoneNumbers,
        ['0', '1', '2'],
        this.installationIncidentCategories,
        this.language,
      ),
    )
  })
})
