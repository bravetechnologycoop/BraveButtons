// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { ALERT_STATE, AlertSession } = require('brave-alert-lib')
const db = require('../../../db/db.js')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

describe('BraveAlerterConfigurator.js integration tests: getAlertSessionByPhoneNumber', () => {
  beforeEach(async () => {
    this.sessionState = ALERT_STATE.WAITING_FOR_DETAILS
    this.sessionIncidentType = '2'
    this.sessionNotes = 'sessionNotes'
    this.sessionToPhoneNumber = '+13335557777'
    this.message = 'message'
    this.installationResponderPhoneNumber = '+17775558888'
    this.installationIncidentCategories = ['Cat1', 'Cat2', 'Cat3']

    await db.clearSessions()
    await db.clearNotifications()
    await db.clearInstallations()
    await db.createInstallation('', this.installationResponderPhoneNumber, '{}', this.installationIncidentCategories, null)
    const installations = await db.getInstallations()
    await db.createSession(installations[0].id, '', '701', this.sessionToPhoneNumber, 1)
    const sessions = await db.getAllSessions()
    const session = sessions[0]
    this.sessionId = session.id
    session.state = this.sessionState
    session.incidentType = this.sessionIncidentType
    session.notes = this.sessionNotes
    await db.saveSession(session)
  })

  afterEach(async () => {
    await db.clearSessions()
    await db.clearNotifications()
    await db.clearInstallations()
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
