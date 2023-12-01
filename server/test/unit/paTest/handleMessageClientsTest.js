// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { helpers, twilioHelpers } = require('brave-alert-lib')
const { mockResponse } = require('../../testingHelpers')
const pa = require('../../../pa')
const db = require('../../../db/db')

const successfulPhoneNumbers = [
  '+16040000000',
  '+16041111111',
  '+16042222222',
  '+16043333333',
  '+16044444444',
  '+16045555555',
  '+16046666666',
  '+16047777777',
  '+16048888888',
  '+16049999999',
]

const failPhoneNumbers = [
  '+16040001111', // for use with testBadFromPhoneNumber
]

const testFromPhoneNumber = '+17780000000'
const testBadFromPhoneNumber = '+17781111111'
const testTwilioMessage = 'Hello, Brave!'

// fake Google ID token; just needs to not be undefined for the validator
const testGoogleIdToken = 'google-id-token'

// handleMessageClients needs:
// - id
// - displayName
// - responderPhoneNumbers
// - fallbackPhoneNumbers
// - heartbeatPhoneNumbers
// - fromPhoneNumber
// from each client
const activeClients = [
  {
    id: 'client-just-responder-phone-number',
    displayName: 'Client Just Responder Phone Number',
    responderPhoneNumbers: [successfulPhoneNumbers[0]],
    fallbackPhoneNumbers: [],
    heartbeatPhoneNumbers: [],
    fromPhoneNumber: testFromPhoneNumber,
  },
  {
    id: 'client-just-fallback-phone-number',
    displayName: 'Client Just Fallback Phone Number',
    responderPhoneNumbers: [],
    fallbackPhoneNumbers: [successfulPhoneNumbers[1]],
    heartbeatPhoneNumbers: [],
    fromPhoneNumber: testFromPhoneNumber,
  },
  {
    id: 'client-just-heartbeat-phone-number',
    displayName: 'Client Just Heartbeat Phone Number',
    responderPhoneNumbers: [],
    fallbackPhoneNumbers: [],
    heartbeatPhoneNumbers: [successfulPhoneNumbers[2]],
    fromPhoneNumber: testFromPhoneNumber,
  },
  {
    id: 'client-duplicate-phone-numbers',
    displayName: 'Client Duplicate Phone Numbers',
    responderPhoneNumbers: [successfulPhoneNumbers[3]],
    fallbackPhoneNumbers: [successfulPhoneNumbers[3]],
    heartbeatPhoneNumbers: [successfulPhoneNumbers[3]],
    fromPhoneNumber: testFromPhoneNumber,
  },
  {
    id: 'client-no-duplicate-phone-numbers',
    displayName: 'Client No Duplicate Phone Numbers',
    responderPhoneNumbers: [successfulPhoneNumbers[4]],
    fallbackPhoneNumbers: [successfulPhoneNumbers[5]],
    heartbeatPhoneNumbers: [successfulPhoneNumbers[6]],
    fromPhoneNumber: testFromPhoneNumber,
  },
  {
    id: 'client-duplicate-and-multiple-phone-numbers',
    displayName: 'Client Duplicate And Multiple Phone Numbers',
    responderPhoneNumbers: [successfulPhoneNumbers[7]],
    fallbackPhoneNumbers: [successfulPhoneNumbers[8], successfulPhoneNumbers[9]],
    heartbeatPhoneNumbers: [successfulPhoneNumbers[7]],
    fromPhoneNumber: testFromPhoneNumber,
  },
  {
    id: 'client-bad-from-phone-number',
    displayName: 'Client Bad From Phone Number',
    responderPhoneNumbers: [failPhoneNumbers[0]],
    fallbackPhoneNumbers: [],
    heartbeatPhoneNumbers: [],
    fromPhoneNumber: testBadFromPhoneNumber,
  },
]

async function mockSendTwilioMessage(toPhoneNumber, fromPhoneNumber, twilioMessage) {
  if (fromPhoneNumber === testBadFromPhoneNumber) {
    return { status: 'error' }
  }

  // twilioHelpers.sendTwilioMessage does:
  // helpers.log(`Sent by Twilio: ${response.sid}`)
  // where 'response' comes from a Twilio API call.
  helpers.log(`Sent by (mock) Twilio: ${twilioMessage}`)
  return { status: 'queued' }
}

use(sinonChai)

const sandbox = sinon.createSandbox()

describe('pa.js unit tests: handleMessageClients', () => {
  beforeEach(() => {
    sandbox.stub(db, 'getActiveClients').returns(activeClients)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('for a request when Twilio is operating as expected', () => {
    beforeEach(async () => {
      sandbox.stub(twilioHelpers, 'sendTwilioMessage').callsFake(mockSendTwilioMessage)

      this.res = mockResponse(sandbox)
      await pa.handleMessageClients(
        {
          body: { twilioMessage: testTwilioMessage, googleIdToken: testGoogleIdToken },
        },
        this.res,
      )
    })

    it('should respond with status 200', () => {
      expect(this.res.status).to.be.calledWith(200)
    })

    it('should respond with the Twilio message as twilioMessage', () => {
      expect(this.res.body.twilioMessage).to.equal(testTwilioMessage)
    })

    it('should respond with the expected phone numbers in successfullyMessaged', () => {
      const toPhoneNumbers = this.res.body.successfullyMessaged.map(twilioTraceObject => {
        return twilioTraceObject.to
      })

      // deep equal; no other phone numbers should be contacted
      expect(toPhoneNumbers).to.eql(successfulPhoneNumbers)
    })

    it('should respond with the expected phone numbers in failedToMessage', () => {
      const toPhoneNumbers = this.res.body.failedToMessage.map(twilioTraceObject => {
        return twilioTraceObject.to
      })

      // deep equal; no other phone numbers should fail
      expect(toPhoneNumbers).to.eql(failPhoneNumbers)
    })

    it('should call twilioHelpers.sendTwilioMessage for all active clients', () => {
      const expectedArguments = []

      activeClients.forEach(client => {
        // gather all phone numbers for this client
        const phoneNumbers = []
        phoneNumbers.push(...client.responderPhoneNumbers, ...client.fallbackPhoneNumbers, ...client.heartbeatPhoneNumbers)

        // gather all unique phone numbers for this client
        const uniquePhoneNumbers = new Set()
        phoneNumbers.forEach(phoneNumber => {
          uniquePhoneNumbers.add(phoneNumber)
        })

        // create expected arguments for each unique phone number
        uniquePhoneNumbers.forEach(phoneNumber => {
          expectedArguments.push({
            toPhoneNumber: phoneNumber,
            fromPhoneNumber: client.fromPhoneNumber,
            twilioMessage: testTwilioMessage,
          })
        })
      })

      // expect twilioHelpers.sendTwilioMessage to be called with each of the expected arguments
      expectedArguments.forEach(args => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(args.toPhoneNumber, args.fromPhoneNumber, args.twilioMessage)
      })
    })
  })

  describe('for a request when Twilio is not operating as expected', () => {
    beforeEach(async () => {
      sandbox.stub(twilioHelpers, 'sendTwilioMessage').returns(undefined)

      this.res = mockResponse(sandbox)
      await pa.handleMessageClients(
        {
          body: { twilioMessage: testTwilioMessage, googleIdToken: testGoogleIdToken },
        },
        this.res,
      )
    })

    it('should respond with status 200', () => {
      expect(this.res.status).to.be.calledWith(200)
    })

    it('should respond with the Twilio message as twilioMessage', () => {
      expect(this.res.body.twilioMessage).to.equal(testTwilioMessage)
    })

    it('should respond with no phone numbers in successfullyMessaged', () => {
      expect(this.res.body.successfullyMessaged).to.eql([])
    })

    it('should respond with all phone numbers in failedToMessage', () => {
      // create array of all phone numbers (successful and fail)
      const allPhoneNumbers = []
      allPhoneNumbers.push(...successfulPhoneNumbers, ...failPhoneNumbers)

      // create array of to phone numbers
      const toPhoneNumbers = this.res.body.failedToMessage.map(twilioTraceObject => {
        return twilioTraceObject.to
      })

      // expect all (failed) to phone numbers to be equal to all phone numbers
      expect(toPhoneNumbers).to.eql(allPhoneNumbers)
    })

    it('should call twilioHelpers.sendTwilioMessage for all active clients', () => {
      const expectedArguments = []

      activeClients.forEach(client => {
        // gather all phone numbers for this client
        const phoneNumbers = []
        phoneNumbers.push(...client.responderPhoneNumbers, ...client.fallbackPhoneNumbers, ...client.heartbeatPhoneNumbers)

        // gather all unique phone numbers for this client
        const uniquePhoneNumbers = new Set()
        phoneNumbers.forEach(phoneNumber => {
          uniquePhoneNumbers.add(phoneNumber)
        })

        // create expected arguments for each unique phone number
        uniquePhoneNumbers.forEach(phoneNumber => {
          expectedArguments.push({
            toPhoneNumber: phoneNumber,
            fromPhoneNumber: client.fromPhoneNumber,
            twilioMessage: testTwilioMessage,
          })
        })
      })

      // expect twilioHelpers.sendTwilioMessage to be called with each of the expected arguments
      expectedArguments.forEach(args => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(args.toPhoneNumber, args.fromPhoneNumber, args.twilioMessage)
      })
    })
  })
})
