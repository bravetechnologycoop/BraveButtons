// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')

// In-house dependencies
const { factories, helpers, twilioHelpers } = require('brave-alert-lib')
const { buttonDBFactory } = require('../../testingHelpers')
const { server, db } = require('../../../server')

chai.use(chaiHttp)
chai.use(sinonChai)

const expect = chai.expect
const sandbox = sinon.createSandbox()
const braveKey = helpers.getEnvVar('PA_API_KEY_PRIMARY')
const badBraveKey = 'badbravekey'
const message = 'Hello, world!'
const testFromPhoneNumber = '+11234567890'

// information about clients that should be contacted
const testExpectPhoneNumbers = ['+11111111111', '+12222222222', '+13333333333', '+14444444444']
// contents are set once clients are created from factories.clientDBFactory
const testExpectResponse = []

// information about clients that should not be contacted
const testNotExpectPhoneNumbers = ['+15555555555', '+16666666666', '+17777777777', '+18888888888']
// contents are set once clients are created from factories.clientDBFactory
const testNotExpectResponse = []

describe('api.js integration tests: messageClients', () => {
  beforeEach(async () => {
    await db.clearTables()

    // active clients
    const activeClients = []

    // clear these arrays
    testExpectResponse.length = 0
    testNotExpectResponse.length = 0

    // has responder phone number
    activeClients.push(
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Responder',
        responderPhoneNumbers: [testExpectPhoneNumbers[0]],
        fallbackPhoneNumbers: [],
        heartbeatPhoneNumbers: [],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Fallback',
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [testExpectPhoneNumbers[1]],
        heartbeatPhoneNumbers: [],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Heartbeat',
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [],
        heartbeatPhoneNumbers: [testExpectPhoneNumbers[2]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Duplicates',
        responderPhoneNumbers: [testExpectPhoneNumbers[3]],
        fallbackPhoneNumbers: [testExpectPhoneNumbers[3]],
        heartbeatPhoneNumbers: [testExpectPhoneNumbers[3]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
    )
    for (let i = 0; i < 4; i += 1) {
      testExpectResponse.push({
        to: testExpectPhoneNumbers[i],
        from: testFromPhoneNumber,
        clientId: activeClients[i].id,
        clientDisplayName: activeClients[i].displayName,
      })
      await buttonDBFactory(db, {
        clientId: activeClients[i].id,
        displayName: `Button for ${activeClients[i].displayName}`,
        buttonSerialNumber: `Button${activeClients[i].id.substr(0, 8)}`,
        isSendingAlerts: true,
        isSendingVitals: true,
      })
    }

    // non-active clients
    const nonActiveClients = []

    const testClientNoButton = await factories.clientDBFactory(db, {
      displayName: 'Test Client No Button',
      responderPhoneNumbers: [testNotExpectPhoneNumbers[0]],
      fallbackPhoneNumbers: [],
      heartbeatPhoneNumbers: [],
      fromPhoneNumber: testFromPhoneNumber,
      isSendingAlerts: true,
      isSendingVitals: true,
    })
    testNotExpectResponse.push({
      to: testNotExpectPhoneNumbers[0],
      from: testFromPhoneNumber,
      clientId: testClientNoButton.id,
      clientDisplayName: testClientNoButton.displayName,
    })

    nonActiveClients.push(
      await factories.clientDBFactory(db, {
        displayName: "Test Client Don't Send Alerts",
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [testNotExpectPhoneNumbers[1]],
        heartbeatPhoneNumbers: [],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: false,
        isSendingVitals: true,
      }),
      await factories.clientDBFactory(db, {
        displayName: "Test Client Don't Send Vitals",
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [],
        heartbeatPhoneNumbers: [testNotExpectPhoneNumbers[2]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: false,
      }),
      await factories.clientDBFactory(db, {
        displayName: "Test Client Don't Send",
        responderPhoneNumbers: [testNotExpectPhoneNumbers[3]],
        fallbackPhoneNumbers: [testNotExpectPhoneNumbers[3]],
        heartbeatPhoneNumbers: [testNotExpectPhoneNumbers[3]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: false,
        isSendingVitals: false,
      }),
    )

    // create buttons for all non-active clients
    for (let i = 0; i < 3; i += 1) {
      testNotExpectResponse.push({
        to: testNotExpectPhoneNumbers[i + 1],
        from: testFromPhoneNumber,
        clientId: nonActiveClients[i].id,
        clientDisplayName: nonActiveClients[i].displayName,
      })
      await buttonDBFactory(db, {
        clientId: nonActiveClients[i].id,
        displayName: `Button for ${nonActiveClients[i].displayName}`,
        buttonSerialNumber: `Button${nonActiveClients[i].id.substr(0, 8)}`,
        isSendingAlerts: Math.round(Math.random()),
        isSendingVitals: Math.round(Math.random()),
      })
    }

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    await db.clearTables()
    this.agent.close()
  })

  describe('for a request that uses the correct PA API key, and where Twilio is operating correctly', () => {
    beforeEach(async () => {
      // stub twilioHelpers.sendTwilioMessage
      sandbox.stub(twilioHelpers, 'sendTwilioMessage').returns({ status: 'queued' })
    })

    afterEach(async () => {
      sandbox.restore()
    })

    it('should respond with status 200 (OK)', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey, message })

      expect(response).to.have.status(200)
    })

    it('should respond with the same message that was posted', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey, message })

      expect(response.body.data).to.not.be.undefined
      expect(response.body.data.message).to.be.a('string').that.equals(message)
    })

    it('should attempt to message all active clients', async () => {
      await this.agent.post('/api/message-clients').send({ braveKey, message })

      testExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })

    it('should not attempt to message any non-active clients', async () => {
      await this.agent.post('/api/message-clients').send({ braveKey, message })

      testNotExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.not.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })

    it('should respond with contacted client information in the `contacted` field of the response body', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey, message })

      expect(response.body.data).to.not.be.undefined
      expect(response.body.data.contacted).to.be.an('array').that.has.deep.members(testExpectResponse)
    })

    it('should respond with no clients in the `failed` field of the response body', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey, message })

      expect(response.body.data).to.not.be.undefined
      expect(response.body.data.failed).to.be.an('array').that.is.empty
    })
  })

  describe('for a request that uses the correct PA API key, and where Twilio is not operating correctly', () => {
    beforeEach(async () => {
      // stub twilioHelpers.sendTwilioMessage
      sandbox.stub(twilioHelpers, 'sendTwilioMessage').returns(undefined)
    })

    afterEach(async () => {
      sandbox.restore()
    })

    it('should respond with status 200 (OK)', async () => {
      const response = await this.agent.post('/api/message-clients?test=1').send({ braveKey, message })

      expect(response).to.have.status(200)
    })

    it('should respond with the same message that was posted', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey, message })

      expect(response.body.data).to.not.be.undefined
      expect(response.body.data.message).to.be.a('string').that.equal(message)
    })

    it('should attempt to message all active clients', async () => {
      await this.agent.post('/api/message-clients').send({ braveKey, message })

      testExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })

    it('should not attempt to message any non-active clients', async () => {
      await this.agent.post('/api/message-clients').send({ braveKey, message })

      testNotExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.not.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })

    it('should respond with no clients in the `contacted` field of the response body', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey, message })

      expect(response.body.data).to.not.be.undefined
      expect(response.body.data.contacted).to.be.an('array').that.is.empty
    })

    it('should respond with active clients in the `failed` field of the response body', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey, message })

      expect(response.body.data).to.not.be.undefined
      expect(response.body.data.failed).to.be.an('array').that.has.deep.members(testExpectResponse)
    })
  })

  describe('for a request that uses an incorrect PA API key', () => {
    beforeEach(async () => {
      // stub twilioHelpers.sendTwilioMessage;
      // it shouldn't be called, so don't bother with providing a return value
      sandbox.stub(twilioHelpers, 'sendTwilioMessage')
    })

    afterEach(async () => {
      sandbox.restore()
    })

    it('should respond with status 401 (Unauthorized)', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey: badBraveKey, message })

      expect(response).to.have.status(401)
    })

    it('should not message anyone', async () => {
      await this.agent.post('/api/message-clients').send({ braveKey: badBraveKey, message })

      expect(twilioHelpers.sendTwilioMessage).to.not.be.called
    })
  })

  describe('for a request that does not provide any PA API key', () => {
    beforeEach(async () => {
      // stub twilioHelpers.sendTwilioMessage;
      // it shouldn't be called, so don't bother with providing a return value
      sandbox.stub(twilioHelpers, 'sendTwilioMessage')
    })

    afterEach(async () => {
      sandbox.restore()
    })

    it('should respond with status 401 (Unauthorized)', async () => {
      const response = await this.agent.post('/api/message-clients').send({ message })

      expect(response).to.have.status(401)
    })

    it('should not message anyone', async () => {
      await this.agent.post('/api/message-clients').send({ message })

      expect(twilioHelpers.sendTwilioMessage).to.not.be.called
    })
  })
})
