const { ALERT_STATE, AlertSession } = require('brave-alert-lib')
const chai = require('chai')
const expect = chai.expect
const { afterEach, before, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require("sinon-chai")
const db = require('../db/db.js')

const BraveAlerterConfigurator = require('./../BraveAlerterConfigurator.js')

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
            await db.createInstallation('', this.installationResponderPhoneNumber, '',this.installationIncidentCategories)
            let installations = await db.getInstallations()
            await db.createSession(installations[0].id, '', '701', '', 1)
            let sessions = await db.getAllSessions()
            this.sessionId = sessions[0].id
            await db.updateSessionState(this.sessionId, this.sessionState)
            await db.updateSessionIncidentCategory(this.sessionId, this.sessionIncidentType)
            await db.updateSessionNotes(this.sessionId, this.sessionNotes)
        })

        afterEach(async () => {
            await db.clearSessions()
            await db.clearInstallations()
        })

        it('should return an AlertSession with the values from the DB', async () => {
            const braveAlerterConfigurator = new BraveAlerterConfigurator()
            const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
            const alertSession = await braveAlerter.getAlertSession(this.sessionId)

            expect(alertSession).to.eql(new AlertSession(
                this.sessionId,
                this.sessionState,
                this.sessionIncidentType,
                this.sessionNotes,
                'There has been a request for help from Unit 701 . Please respond "Ok" when you have followed up on the call.',
                this.installationResponderPhoneNumber,
                ['0', '1', '2'],
                this.installationIncidentCategories
            ))
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
            await db.createInstallation('', this.installationResponderPhoneNumber, '',this.installationIncidentCategories)
            let installations = await db.getInstallations()
            await db.createSession(installations[0].id, '', '701', this.sessionToPhoneNumber, 1)
            let sessions = await db.getAllSessions()
            this.sessionId = sessions[0].id
            await db.updateSessionState(this.sessionId, this.sessionState)
            await db.updateSessionIncidentCategory(this.sessionId, this.sessionIncidentType)
            await db.updateSessionNotes(this.sessionId, this.sessionNotes)
        })

        afterEach(async () => {
            await db.clearSessions()
            await db.clearInstallations()
        })

        it('should return an AlertSession with the values from the DB', async () => {
            const braveAlerterConfigurator = new BraveAlerterConfigurator()
            const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
            const alertSession = await braveAlerter.getAlertSessionByPhoneNumber(this.sessionToPhoneNumber)

            expect(alertSession).to.eql(new AlertSession(
                this.sessionId,
                this.sessionState,
                this.sessionIncidentType,
                this.sessionNotes,
                'There has been a request for help from Unit 701 . Please respond "Ok" when you have followed up on the call.',
                this.installationResponderPhoneNumber,
                ['0', '1', '2'],
                this.installationIncidentCategories
            ))
        })
    })

    describe('alertSessionChangedCallback', () => {
        beforeEach(() => {
            sinon.stub(db, 'updateSessionState')
            sinon.stub(db, 'getInstallationWithSessionId').returns({
                incidentCategories: ['Cat0', 'Cat1', 'Cat2']
            })
            sinon.stub(db, 'updateSessionIncidentCategory')
            sinon.stub(db, 'updateSessionNotes')
            sinon.stub(db, 'updateFallbackReturnMessage')
        })

        afterEach(() => {
            db.updateFallbackReturnMessage.restore()
            db.updateSessionNotes.restore()
            db.updateSessionIncidentCategory.restore()
            db.getInstallationWithSessionId.restore()
            db.updateSessionState.restore()
        })

        it('if given only alertState should update only alertState', async () => {
            const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
            const braveAlerterConfigurator = new BraveAlerterConfigurator()
            const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
            await braveAlerter.alertSessionChangedCallback(new AlertSession(
                sessionId,
                ALERT_STATE.WAITING_FOR_REPLY,
            ))

            expect(db.updateSessionState).to.be.calledWith(sessionId, ALERT_STATE.WAITING_FOR_REPLY)
            expect(db.updateSessionIncidentCategory).not.to.be.called
            expect(db.updateSessionNotes).not.to.be.called
            expect(db.updateFallbackReturnMessage).not.to.be.called
        })

        it('if given alertState and categoryKey should update alertState and category', async () => {
            const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
            const braveAlerterConfigurator = new BraveAlerterConfigurator()
            const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
            await braveAlerter.alertSessionChangedCallback(new AlertSession(
                sessionId,
                ALERT_STATE.WAITING_FOR_DETAILS,
                '0'
            ))

            expect(db.updateSessionState).to.be.calledWith(sessionId, ALERT_STATE.WAITING_FOR_DETAILS)
            expect(db.updateSessionIncidentCategory).to.be.calledWith(sessionId, 'Cat0')
            expect(db.updateSessionNotes).not.to.be.called
            expect(db.updateFallbackReturnMessage).not.to.be.called
        })

        it('if given alertState and details should update alertState and details', async () => {
            const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
            const braveAlerterConfigurator = new BraveAlerterConfigurator()
            const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
            await braveAlerter.alertSessionChangedCallback(new AlertSession(
                sessionId,
                ALERT_STATE.COMPLETED,
                undefined,
                'fakeDetails'
            ))

            expect(db.updateSessionState).to.be.calledWith(sessionId, ALERT_STATE.COMPLETED)
            expect(db.updateSessionIncidentCategory).not.to.be.called
            expect(db.updateSessionNotes).to.be.calledWith(sessionId, 'fakeDetails')
            expect(db.updateFallbackReturnMessage).not.to.be.called
        })

        it('if given only fallback return message should update only fallback return message', async () => {
            const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
            const braveAlerterConfigurator = new BraveAlerterConfigurator()
            const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
            await braveAlerter.alertSessionChangedCallback(new AlertSession(
                sessionId,
                undefined,
                undefined,
                undefined,
                'fakeFallbackReturnMessage'
            ))

            expect(db.updateSessionState).not.to.be.called
            expect(db.updateSessionIncidentCategory).not.to.be.called
            expect(db.updateSessionNotes).not.to.be.called
            expect(db.updateFallbackReturnMessage).to.be.calledWith(sessionId, 'fakeFallbackReturnMessage')
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

            expect(returnMessage).to.equal('Now that you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n')
        })

        it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.STARTED, ALERT_STATE.WAITING_FOR_CATEGORY, ['Cat0', 'Cat1'])

            expect(returnMessage).to.equal('Now that you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n')
        })

        it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_REPLY, ALERT_STATE.WAITING_FOR_CATEGORY, ['Cat0', 'Cat1'])

            expect(returnMessage).to.equal('Now that you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n')
        })

        it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.WAITING_FOR_CATEGORY, ['Cat0', 'Cat1'])

            expect(returnMessage).to.equal('Sorry, the incident type wasn\'t recognized. Please try again.')
        })

        it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_DETAILS', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.WAITING_FOR_DETAILS, ['Cat0', 'Cat1'])

            expect(returnMessage).to.equal('Thank you. If you like, you can reply with any further details about the incident.')
        })

        it('should get message when WAITING_FOR_DETAILS => COMPLETED', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_DETAILS, ALERT_STATE.COMPLETED, ['Cat0', 'Cat1'])

            expect(returnMessage).to.equal('Thank you. This session is now complete. (You don\'t need to respond to this message.)')
        })

        it('should get message when COMPLETED => COMPLETED', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.COMPLETED, ALERT_STATE.COMPLETED, ['Cat0', 'Cat1'])

            expect(returnMessage).to.equal('There is no active session for this button. (You don\'t need to respond to this message.)')
        })

        it('should get default message if given something funky', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage('something funky', ALERT_STATE.COMPLETED, ['Cat0', 'Cat1'])

            expect(returnMessage).to.equal('Thank you for responding. Unfortunately, we have encountered an error in our system and will deal with it shortly.')
        })
    })
})