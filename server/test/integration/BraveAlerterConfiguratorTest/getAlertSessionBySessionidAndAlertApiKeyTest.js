// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE, AlertSession, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const { sessionDBFactory } = require('../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getAlertSessionBySessionidAndAlertApiKey', () => {
  beforeEach(async () => {
    this.sessionState = CHATBOT_STATE.COMPLETED
    this.sessionIncidentType = '2'
    this.sessionToPhoneNumber = '+13335557777'
    this.message = 'message'
    this.installationResponderPhoneNumber = '+17775558888'
    this.installationIncidentCategories = ['Cat1', 'Cat2', 'Cat3']
    this.alertApiKey = 'myApiKey'

    await db.clearTables()

    const client = await factories.clientDBFactory(db, {
      displayName: '',
      responderPhoneNumber: this.installationResponderPhoneNumber,
      fallbackPhoneNumbers: '{}',
      incidentCategories: this.installationIncidentCategories,
      alertApiKey: this.alertApiKey,
      responderPushId: null,
    })
    const session = await sessionDBFactory(db, {
      clientId: client.id,
      phoneNumber: this.sessionToPhoneNumber,
      numPresses: 1,
      state: this.sessionState,
      incidentType: this.sessionIncidentType,
      unit: '701',
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
        this.sessionState,
        this.sessionIncidentType,
        undefined,
        'There has been a request for help from 701 . Please respond "Ok" when you have followed up on the call.',
        this.installationResponderPhoneNumber,
        ['0', '1', '2'],
        this.installationIncidentCategories,
      ),
    )
  })
})
