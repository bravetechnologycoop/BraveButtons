const { ALERT_STATE, AlertSession } = require('brave-alert-lib')
const chai = require('chai')

const expect = chai.expect
const { afterEach, before, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const db = require('../db/db.js')
const { createTestSessionState } = require('./testingHelpers.js')

const BraveAlerterConfigurator = require('../BraveAlerterConfigurator.js')

// Configure Chai
chai.use(sinonChai)

describe('BraveAlerterConfigurator', () => {
  describe('createBraveAlerter', () => {
    it('returns a BraveAlerter', () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()

      expect(braveAlerter.constructor.name).to.equal('BraveAlerter')
    })
  })

  describe('getAlertSession', () => {
    beforeEach(async () => {
      this.sessionState = ALERT_STATE.WAITING_FOR_DETAILS
      this.sessionIncidentType = '2'
      this.sessionNotes = 'sessionNotes'
      this.message = 'message'
      this.installationResponderPhoneNumber = '+17775558888'
      this.installationIncidentCategories = ['Cat1', 'Cat2', 'Cat3']

      await db.clearSessions()
      await db.clearInstallations()
      await db.createInstallation('', this.installationResponderPhoneNumber, '', this.installationIncidentCategories)
      const installations = await db.getInstallations()
      await db.createSession(installations[0].id, '', '701', '', 1, null)
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
      await db.clearInstallations()
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

  describe('getAlertSessionByPhoneNumber', () => {
    beforeEach(async () => {
      this.sessionState = ALERT_STATE.WAITING_FOR_DETAILS
      this.sessionIncidentType = '2'
      this.sessionNotes = 'sessionNotes'
      this.sessionToPhoneNumber = '+13335557777'
      this.message = 'message'
      this.installationResponderPhoneNumber = '+17775558888'
      this.installationIncidentCategories = ['Cat1', 'Cat2', 'Cat3']

      await db.clearSessions()
      await db.clearInstallations()
      await db.createInstallation('', this.installationResponderPhoneNumber, '', this.installationIncidentCategories)
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

  describe('alertSessionChangedCallback', () => {
    beforeEach(() => {
      sinon.stub(db, 'beginTransaction')
      sinon.stub(db, 'getSessionWithSessionId').returns(createTestSessionState())
      sinon.stub(db, 'getInstallationWithSessionId').returns({
        incidentCategories: ['Cat0', 'Cat1', 'Cat2'],
      })
      sinon.stub(db, 'saveSession')
      sinon.stub(db, 'commitTransaction')
    })

    afterEach(() => {
      db.commitTransaction.restore()
      db.saveSession.restore()
      db.getInstallationWithSessionId.restore()
      db.getSessionWithSessionId.restore()
      db.beginTransaction.restore()
    })

    it('if given only alertState should update only alertState', async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(this.fakeSessionId, ALERT_STATE.WAITING_FOR_REPLY))

      const expectedSession = createTestSessionState()
      expectedSession.state = ALERT_STATE.WAITING_FOR_REPLY

      expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
    })

    it('if given alertState and categoryKey should update alertState and category', async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, ALERT_STATE.WAITING_FOR_DETAILS, '0'))

      const expectedSession = createTestSessionState()
      expectedSession.state = ALERT_STATE.WAITING_FOR_DETAILS
      expectedSession.incidentType = 'Cat0'

      expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
    })

    it('if given alertState and details should update alertState and details', async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, ALERT_STATE.COMPLETED, undefined, 'fakeDetails'))

      const expectedSession = createTestSessionState()
      expectedSession.state = ALERT_STATE.COMPLETED
      expectedSession.notes = 'fakeDetails'

      expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
    })

    it('if given only fallback return message should update only fallback return message', async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, undefined, undefined, undefined, 'fakeFallbackReturnMessage'))

      const expectedSession = createTestSessionState()
      expectedSession.fallBackAlertTwilioStatus = 'fakeFallbackReturnMessage'

      expect(db.saveSession).to.be.calledWith(expectedSession, sinon.any)
    })
  })

  describe('getReturnMessage', () => {
    before(() => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      this.alertStateMachine = braveAlerter.alertStateMachine
    })

    it('should get message when STARTED => WAITING_FOR_REPLY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.STARTED, ALERT_STATE.WAITING_FOR_REPLY, ['Cat0', 'Cat1'])

      expect(returnMessage).to.equal(
        'Now that you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n',
      )
    })

    it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.STARTED, ALERT_STATE.WAITING_FOR_CATEGORY, ['Cat0', 'Cat1'])

      expect(returnMessage).to.equal(
        'Now that you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n',
      )
    })

    it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_REPLY, ALERT_STATE.WAITING_FOR_CATEGORY, ['Cat0', 'Cat1'])

      expect(returnMessage).to.equal(
        'Now that you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n',
      )
    })

    it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.WAITING_FOR_CATEGORY, [
        'Cat0',
        'Cat1',
      ])

      expect(returnMessage).to.equal("Sorry, the incident type wasn't recognized. Please try again.")
    })

    it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_DETAILS', () => {
      const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.WAITING_FOR_DETAILS, [
        'Cat0',
        'Cat1',
      ])

      expect(returnMessage).to.equal('Thank you. If you like, you can reply with any further details about the incident.')
    })

    it('should get message when WAITING_FOR_DETAILS => COMPLETED', () => {
      const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_DETAILS, ALERT_STATE.COMPLETED, ['Cat0', 'Cat1'])

      expect(returnMessage).to.equal("Thank you. This session is now complete. (You don't need to respond to this message.)")
    })

    it('should get message when COMPLETED => COMPLETED', () => {
      const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.COMPLETED, ALERT_STATE.COMPLETED, ['Cat0', 'Cat1'])

      expect(returnMessage).to.equal("There is no active session for this button. (You don't need to respond to this message.)")
    })

    it('should get default message if given something funky', () => {
      const returnMessage = this.alertStateMachine.getReturnMessage('something funky', ALERT_STATE.COMPLETED, ['Cat0', 'Cat1'])

      expect(returnMessage).to.equal(
        'Thank you for responding. Unfortunately, we have encountered an error in our system and will deal with it shortly.',
      )
    })
  })
})
