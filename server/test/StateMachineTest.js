let chai = require('chai')
const expect = chai.expect
var beforeEach = require('mocha').beforeEach
var describe = require('mocha').describe
var it = require('mocha').it

let SessionState = require('../SessionState.js')
let Installation = require('../Installation.js')
let StateMachine = require('../StateMachine.js')
const STATES = require('../SessionStateEnum.js')

describe('StateMachine class', () => {

    const sessionId = '12345'
    const installationId = '67890'
    const installationName = 'TestInstallation'
    const buttonId = '12345'
    const unit = '1'
    const phoneNumber = '+14206666969'
    const incidentCategories = ['Accidental', 'Safer Use', 'Overdose', 'Other']
    const createdAt = Date()
    const updatedAt = Date()

    let state
    let installation
    let stateMachine

    beforeEach(function() {
        state = new SessionState(sessionId, installationId, buttonId, unit, phoneNumber, STATES.STARTED, 1, createdAt, updatedAt, null, null)
        installation = new Installation(installationId, installationName, phoneNumber, phoneNumber, incidentCategories, createdAt)
        stateMachine = new StateMachine(installation)
    })

    it('should advance the session when receiving an initial message', () => {
        expect(state.state).to.deep.equal(STATES.STARTED)
        let {newSessionState, returnMessage} = stateMachine.processStateTransitionWithMessage(state, 'ok')
        expect(newSessionState.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY)
        expect(returnMessage).to.not.be.null
    })

    it('should advance the session when receiving an initial message (after a reminder has been sent)', () => {
        state.state = STATES.WAITING_FOR_REPLY
        let {newSessionState, returnMessage} = stateMachine.processStateTransitionWithMessage(state, 'ok')
        expect(newSessionState.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY)
        expect(returnMessage).to.not.be.null
    })

    it('should advance the session when receiving a message categorizing the incident', () => {
        state.state = STATES.WAITING_FOR_CATEGORY
        let {newSessionState, returnMessage} = stateMachine.processStateTransitionWithMessage(state, '3')
        expect(newSessionState.state).to.deep.equal(STATES.WAITING_FOR_DETAILS)
        expect(returnMessage).to.not.be.null
    })

    it('should advance the session when receiving a message categorizing the incident that contains whitespace', () => {
        state.state = STATES.WAITING_FOR_CATEGORY
        let {newSessionState, returnMessage} = stateMachine.processStateTransitionWithMessage(state, '3  ')
        expect(newSessionState.state).to.deep.equal(STATES.WAITING_FOR_DETAILS)
        expect(returnMessage).to.not.be.null
    })

    it('should not advance the session when receiving an invalid incident category', () => {
        state.state = STATES.WAITING_FOR_CATEGORY
        let {newSessionState, returnMessage} = stateMachine.processStateTransitionWithMessage(state, 'fff')
        expect(newSessionState.state).to.deep.equal(STATES.WAITING_FOR_CATEGORY)
        expect(returnMessage).to.not.be.null
    })
})
