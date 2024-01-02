// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE, AlertSession, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const { sessionDBFactory, buttonDBFactory } = require('../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getAlertSessionByPhoneNumbers', () => {
  beforeEach(async () => {
    this.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
    this.sessionIncidentCategory = '2'
    this.sessionToPhoneNumber = '+13335557777'
    this.installationResponderPhoneNumbers = ['+17775558888', '+18885554444']
    this.installationIncidentCategories = ['Cat1', 'Cat2', 'Cat3']
    this.language = 'de'
    this.respondedByPhoneNumber = '+11114442222'

    await db.clearTables()

    const client = await factories.clientDBFactory(db, {
      displayName: '',
      responderPhoneNumbers: this.installationResponderPhoneNumbers,
      fallbackPhoneNumbers: '{}',
      incidentCategories: this.installationIncidentCategories,
      language: this.language,
    })
    const button = await buttonDBFactory(db, {
      clientId: client.id,
      displayName: '701',
      phoneNumber: this.sessionToPhoneNumber,
    })
    const session = await sessionDBFactory(db, {
      buttonId: button.id,
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

  it('when given a matching set of phone numbers, should return an AlertSession with the values from the DB', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    const alertSession = await braveAlerter.getAlertSessionByPhoneNumbers(this.sessionToPhoneNumber, this.installationResponderPhoneNumbers[1])

    expect(alertSession).to.eql(
      new AlertSession(
        this.sessionId,
        this.chatbotState,
        this.respondedByPhoneNumber,
        this.sessionIncidentCategory,
        this.installationResponderPhoneNumbers,
        ['0', '1', '2'],
        this.installationIncidentCategories,
        this.language,
      ),
    )
  })

  it('when given a matching devicePhoneNumber but mismatched responderPhoneNumber, should return null', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    const alertSession = await braveAlerter.getAlertSessionByPhoneNumbers(this.sessionToPhoneNumber, 'not one of the responderPhoneNumbers')

    expect(alertSession).to.be.null
  })

  it('when given a matching responderPhoneNumber but mismatched devicePhoneNumber, should return null', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    const alertSession = await braveAlerter.getAlertSessionByPhoneNumbers('not the device phone number', this.installationResponderPhoneNumbers[0])

    expect(alertSession).to.be.null
  })
})
