// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')

// In-house dependencies
const { factories, twilioHelpers } = require('brave-alert-lib')

const vitals = rewire('../../../vitals')

use(sinonChai)

const sandbox = sinon.createSandbox()

// eslint-disable-next-line no-underscore-dangle
const sendClientButtonStatusChanges = vitals.__get__('sendClientButtonStatusChanges')

const fromPhoneNumber = '+12360000000'

describe('vitals.js integration tests: sendClientButtonStatusChanges', () => {
  beforeEach(() => {
    sandbox.stub(twilioHelpers, 'sendTwilioMessage')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('given three clients with disconnected buttons, reconnected buttons, and disconnected+reconnected buttons', () => {
    beforeEach(() => {
      this.clientA = factories.clientFactory({
        id: 'ClientA',
        displayName: 'Client A',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+16040000000', '+16041111111', '+16042222222'],
        language: 'en',
      })
      this.clientB = factories.clientFactory({
        id: 'ClientB',
        displayName: 'Client B',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+17780000000', '+17781111111', '+17782222222'],
        language: 'en',
      })
      this.clientC = factories.clientFactory({
        id: 'ClientC',
        displayName: 'Client C',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+12500000000', '+12501111111', '+12502222222'],
        language: 'en',
      })

      sendClientButtonStatusChanges({
        ClientA: { client: this.clientA, disconnectedButtons: ['ButtonA', 'ButtonB'], reconnectedButtons: [] },
        ClientB: { client: this.clientB, disconnectedButtons: [], reconnectedButtons: ['ButtonA', 'ButtonB'] },
        ClientC: { client: this.clientC, disconnectedButtons: ['ButtonA'], reconnectedButtons: ['ButtonB'] },
      })
    })

    it("should send the correct message to the first client's heartbeat phone numbers", () => {
      this.clientA.heartbeatPhoneNumbers.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          fromPhoneNumber,
          phoneNumber,
          'There has been connection changes for the buttons at Client A. The following buttons have disconnected: ButtonA, ButtonB.',
        )
      })
    })

    it("should send the correct message to the second client's heartbeat phone numbers", () => {
      this.clientB.heartbeatPhoneNumbers.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          fromPhoneNumber,
          phoneNumber,
          'There has been connection changes for the buttons at Client B. The following buttons have reconnected: ButtonA, ButtonB.',
        )
      })
    })

    it("should send the correct message to the third client's heartbeat phone numbers", () => {
      this.clientC.heartbeatPhoneNumbers.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          fromPhoneNumber,
          phoneNumber,
          'There has been connection changes for the buttons at Client C. The following buttons have disconnected: ButtonA. The following buttons have reconnected: ButtonB.',
        )
      })
    })

    it('should send exactly nine messages', () => {
      expect(twilioHelpers.sendTwilioMessage).to.have.callCount(9)
    })
  })
})
