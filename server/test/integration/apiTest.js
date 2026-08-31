// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const crypto = require('crypto')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')

process.env.BUTTONS_CONFIG_HMAC_SECRET_TEST = process.env.BUTTONS_CONFIG_HMAC_SECRET_TEST || 'test-buttons-config-secret'

chai.use(chaiHttp)
chai.use(sinonChai)

const expect = chai.expect
const sandbox = sinon.createSandbox()

const braveApiKey = helpers.getEnvVar('PA_API_KEY_PRIMARY')
const portalHmacSecret = helpers.getEnvVar('BUTTONS_CONFIG_HMAC_SECRET')
const api = require('../../api')
const { server, db } = require('../../server')

async function getRequest(route) {
  return chai.request(server).get(route).set('authorization', braveApiKey)
}

function getPortalSignature(timestamp, rawBody = '') {
  return crypto.createHmac('sha256', portalHmacSecret).update(`${timestamp}.${rawBody}`).digest('hex')
}

function portalGetRequest(route, timestamp = Math.floor(Date.now() / 1000).toString()) {
  return chai.request(server).get(route).set('X-Portal-Timestamp', timestamp).set('X-Portal-Signature', getPortalSignature(timestamp))
}

function portalPutRequest(route, body, timestamp = Math.floor(Date.now() / 1000).toString()) {
  const rawBody = JSON.stringify(body)

  return chai
    .request(server)
    .put(route)
    .set('Content-Type', 'application/json')
    .set('X-Portal-Timestamp', timestamp)
    .set('X-Portal-Signature', getPortalSignature(timestamp, rawBody))
    .send(rawBody)
}

describe('api.js integration tests', () => {
  beforeEach(async () => {
    api.resetPortalRateLimits()
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearTables()
  })

  afterEach(async () => {
    sandbox.restore()
  })

  describe('for authorization', () => {
    it('should accept an authorized request (200)', async () => {
      const res = await getRequest('/api/clients')
      expect(res).to.have.status(200)
      expect(helpers.logError).not.to.be.called
    })

    it('should reject an unauthorized request (401)', async () => {
      const res = await chai.request(server).get('/api/clients').set('authorization', 'badApiKey')
      expect(res).to.have.status(401)
      expect(helpers.logError).to.be.calledWith('Unauthorized request to /api/clients.')
    })

    it('should reject a bad request (401)', async () => {
      const res = await chai.request(server).get('/api/clients')
      expect(res).to.have.status(401)
      expect(helpers.logError).to.be.calledWith('Unauthorized request to /api/clients.')
    })
  })

  describe('for /api/clients', () => {
    beforeEach(async () => {
      this.client1 = await factories.clientDBFactory(db, { displayName: 'client1' })
      this.client2 = await factories.clientDBFactory(db, { displayName: 'client2' })
    })

    it('should return an array of clients', async () => {
      const res = await getRequest('/api/clients')
      expect(JSON.stringify(res.body)).to.equal(
        JSON.stringify({
          status: 'success',
          data: [this.client1, this.client2],
        }),
      )
    })
  })

  describe('for portal config authorization', () => {
    it('should reject portal config requests when the HMAC secret is not configured (503)', async () => {
      const configuredSecret = process.env.BUTTONS_CONFIG_HMAC_SECRET_TEST
      delete process.env.BUTTONS_CONFIG_HMAC_SECRET_TEST

      const res = await portalGetRequest('/api/portal/clients/fake-client-id/alert-recipients')

      process.env.BUTTONS_CONFIG_HMAC_SECRET_TEST = configuredSecret

      expect(res).to.have.status(503)
      expect(helpers.logError).to.be.calledWith(
        'Portal config request to /api/portal/clients/fake-client-id/alert-recipients rejected because BUTTONS_CONFIG_HMAC_SECRET is not configured.',
      )
    })

    it('should reject a bad portal signature (401)', async () => {
      const res = await chai
        .request(server)
        .get('/api/portal/clients/fake-client-id/alert-recipients')
        .set('X-Portal-Timestamp', Math.floor(Date.now() / 1000).toString())
        .set('X-Portal-Signature', '0'.repeat(64))

      expect(res).to.have.status(401)
      expect(helpers.logError).to.be.calledWith('Unauthorized portal config request to /api/portal/clients/fake-client-id/alert-recipients.')
    })

    it('should reject an expired portal timestamp (401)', async () => {
      const timestamp = (Math.floor(Date.now() / 1000) - 301).toString()
      const res = await portalGetRequest('/api/portal/clients/fake-client-id/alert-recipients', timestamp)

      expect(res).to.have.status(401)
    })

    it('should rate limit bad portal signatures (429)', async () => {
      let res

      for (let i = 0; i < 11; i += 1) {
        res = await chai
          .request(server)
          .get('/api/portal/clients/fake-client-id/alert-recipients')
          .set('X-Portal-Timestamp', Math.floor(Date.now() / 1000).toString())
          .set('X-Portal-Signature', '0'.repeat(64))
      }

      expect(res).to.have.status(429)
      expect(res.body).to.include({
        status: 'error',
        code: 'RATE_LIMITED',
        message: 'Too Many Requests',
      })
    })
  })

  describe('for /api/portal/clients/:clientId/alert-recipients', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db, {
        displayName: 'Portal Client',
        responderPhoneNumbers: ['+17781234567'],
        fallbackPhoneNumbers: ['+13336669999'],
        heartbeatPhoneNumbers: ['+18889997777'],
      })
    })

    it('should return only portal-editable alert recipient fields', async () => {
      const res = await portalGetRequest(`/api/portal/clients/${this.client.id}/alert-recipients`)

      expect(res).to.have.status(200)
      expect(res.body).to.deep.equal({
        status: 'success',
        data: {
          client_id: this.client.id,
          display_name: 'Portal Client',
          responder_phone_numbers: ['+17781234567'],
          fallback_phone_numbers: ['+13336669999'],
          heartbeat_phone_numbers: ['+18889997777'],
        },
      })
      expect(res.body.data).not.to.have.property('from_phone_number')
    })

    it('should return 404 when the client is not portal editable', async () => {
      const hiddenClient = await factories.clientDBFactory(db, {
        displayName: 'Hidden Client',
        isDisplayed: false,
      })

      const res = await portalGetRequest(`/api/portal/clients/${hiddenClient.id}/alert-recipients`)

      expect(res).to.have.status(404)
    })

    it('should trim and update provided phone arrays while preserving omitted arrays', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: [' +15551234567 ', '+15550000000'],
        heartbeat_phone_numbers: [],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.id}/alert-recipients`, body)

      expect(res).to.have.status(200)
      expect(res.body.data).to.deep.equal({
        client_id: this.client.id,
        display_name: 'Portal Client',
        responder_phone_numbers: ['+15551234567', '+15550000000'],
        fallback_phone_numbers: ['+13336669999'],
        heartbeat_phone_numbers: [],
      })
      expect(helpers.log).to.be.calledWith(
        `Portal alert recipients updated by operator@example.org for client ${this.client.id}; fields: responder_phone_numbers, heartbeat_phone_numbers`,
      )
    })

    it('should reject unknown fields', async () => {
      const body = {
        acting_email: 'operator@example.org',
        from_phone_number: '+15551234567',
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.id}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'UNKNOWN_FIELD',
        field: 'from_phone_number',
        detail: 'Unknown field: from_phone_number',
      })
    })

    it('should reject blank phone strings', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: ['+15551234567', ' '],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.id}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'BLANK_PHONE_NUMBER',
        field: 'responder_phone_numbers',
      })
    })

    it('should reject non-E.164 phone numbers', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: ['555-123-4567'],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.id}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'INVALID_PHONE_NUMBER',
        field: 'responder_phone_numbers',
      })
    })

    it('should reject more than 5 responder phone numbers', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: ['+15551234567', '+15551234568', '+15551234569', '+15551234560', '+15551234561', '+15551234562'],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.id}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'TOO_MANY_PHONE_NUMBERS',
        field: 'responder_phone_numbers',
        detail: 'responder_phone_numbers must contain no more than 5 phone numbers',
      })
    })

    it('should reject more than 5 fallback phone numbers', async () => {
      const body = {
        acting_email: 'operator@example.org',
        fallback_phone_numbers: ['+15551234567', '+15551234568', '+15551234569', '+15551234560', '+15551234561', '+15551234562'],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.id}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'TOO_MANY_PHONE_NUMBERS',
        field: 'fallback_phone_numbers',
        detail: 'fallback_phone_numbers must contain no more than 5 phone numbers',
      })
    })

    it('should rate limit portal writes (429)', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: ['+15551234567'],
      }
      let res

      for (let i = 0; i < 31; i += 1) {
        res = await portalPutRequest(`/api/portal/clients/${this.client.id}/alert-recipients`, body)
      }

      expect(res).to.have.status(429)
      expect(res.body).to.include({
        status: 'error',
        code: 'RATE_LIMITED',
        message: 'Too Many Requests',
      })
    })
  })
})
