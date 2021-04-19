// Third-party dependencies
const { expect } = require('chai')
const { before, describe, it } = require('mocha')

// In-house dependencies
const { ALERT_STATE } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

describe('BraveAlerterConfigurator.js unit tests: getReturnMessage', () => {
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
    const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.WAITING_FOR_DETAILS, ['Cat0', 'Cat1'])
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
