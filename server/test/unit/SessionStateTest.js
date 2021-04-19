const chai = require('chai')

const expect = chai.expect
const beforeEach = require('mocha').beforeEach
const describe = require('mocha').describe
const it = require('mocha').it
const ALERT_STATE = require('brave-alert-lib').ALERT_STATE

const SessionState = require('../../SessionState.js')

describe('SessionState class', () => {
  const sessionId = '12345'
  const installationId = '67890'
  const buttonId = '12345'
  const unit = '1'
  const phoneNumber = '+14206666969'
  const createdAt = Date()
  const updatedAt = Date()

  let state

  beforeEach(() => {
    state = new SessionState(sessionId, installationId, buttonId, unit, phoneNumber, ALERT_STATE.STARTED, 1, createdAt, updatedAt, null, null)
  })

  it('should start off with 1 button press', () => {
    expect(state).to.have.property('numPresses')
    expect(state.numPresses).to.deep.equal(1)
  })

  it('should increment properly', () => {
    state.incrementButtonPresses(1)
    expect(state.numPresses).to.deep.equal(2)
    state.incrementButtonPresses(2)
    expect(state.numPresses).to.deep.equal(4)
  })
})
