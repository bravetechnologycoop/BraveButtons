// Third-party dependencies
const { expect } = require('chai')
const { before, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

describe('BraveAlerterConfigurator.js unit tests: getReturnMessage', () => {
  before(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    this.alertStateMachine = braveAlerter.alertStateMachine
  })

  it('should get message when STARTED => WAITING_FOR_REPLY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.STARTED,
      CHATBOT_STATE.WAITING_FOR_REPLY,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal(
      'Now that you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n',
    )
  })

  it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.STARTED,
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal(
      'Now that you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n',
    )
  })

  it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.WAITING_FOR_REPLY,
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal(
      'Now that you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n',
    )
  })

  it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal("Sorry, the incident type wasn't recognized. Please try again.")
  })

  it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_DETAILS', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      CHATBOT_STATE.WAITING_FOR_DETAILS,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal('Thank you. If you like, you can reply with any further details about the incident.')
  })

  it('should get message when WAITING_FOR_DETAILS => COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.WAITING_FOR_DETAILS,
      CHATBOT_STATE.COMPLETED,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal("Thank you. This session is now complete. (You don't need to respond to this message.)")
  })

  it('should get message when COMPLETED => COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(CHATBOT_STATE.COMPLETED, CHATBOT_STATE.COMPLETED, ['Cat0', 'Cat1'], 'funNewName')
    expect(returnMessage).to.equal("There is no active session for this button. (You don't need to respond to this message.)")
  })

  it('should get message when NAMING_STARTED => NAMING_STARTED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.NAMING_STARTED,
      CHATBOT_STATE.NAMING_STARTED,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal(
      'Sorry, that name is invalid.\n\nTo give your Button a name now, please reply with the name.\nTo give your Button a name later, please reply with "Later".',
    )
  })

  it('should get message when NAMING_STARTED => NAMING_POSTPONED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.NAMING_STARTED,
      CHATBOT_STATE.NAMING_POSTPONED,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal('No problem. You will be asked to name this Brave Button again next time you press it.')
  })

  it('should get message when NAMING_STARTED => NAMING_COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.NAMING_STARTED,
      CHATBOT_STATE.NAMING_COMPLETED,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal(
      'Great! This Brave Button is now called "funNewName".\n\nIf this is incorrect or if you want to change this name, please email clientsupport@brave.coop.',
    )
  })

  it('should get default message if given something funky', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage('something funky', CHATBOT_STATE.COMPLETED, ['Cat0', 'Cat1'], 'funNewName')
    expect(returnMessage).to.equal(
      'Thank you for responding. Unfortunately, we have encountered an error in our system and will deal with it shortly.',
    )
  })
})
