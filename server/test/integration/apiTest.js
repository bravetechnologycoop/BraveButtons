// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')

chai.use(chaiHttp)
chai.use(sinonChai)

const expect = chai.expect
const sandbox = sinon.createSandbox()

const braveApiKey = helpers.getEnvVar('PA_API_KEY_PRIMARY')
const { server, db } = require('../../server')

async function getRequest(route) {
  return chai.request(server).get(route).set('authorization', braveApiKey)
}

describe('api.js integration tests', () => {
  beforeEach(async () => {
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

  describe('for GET /api/clients', () => {
    beforeEach(async () => {
      this.client1 = await factories.clientDBFactory(db, { displayName: 'client1' })
      this.client2 = await factories.clientDBFactory(db, { displayName: 'client2' })
    })

    it('should return an array of clients with pagination', async () => {
      const res = await getRequest('/api/clients')
      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(2)
      expect(res.body.pagination).to.deep.equal({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      })
    })

    it('should paginate clients correctly', async () => {
      // Create more clients for pagination testing
      for (let i = 3; i <= 55; i += 1) {
        await factories.clientDBFactory(db, { displayName: `client${i}` })
      }

      const res1 = await getRequest('/api/clients?page=1&limit=10')
      expect(res1).to.have.status(200)
      expect(res1.body.data.length).to.equal(10)
      expect(res1.body.pagination.page).to.equal(1)
      expect(res1.body.pagination.total).to.equal(55)
      expect(res1.body.pagination.totalPages).to.equal(6)

      const res2 = await getRequest('/api/clients?page=2&limit=10')
      expect(res2).to.have.status(200)
      expect(res2.body.data.length).to.equal(10)
      expect(res2.body.pagination.page).to.equal(2)
    })

    it('should handle invalid pagination parameters', async () => {
      const res = await getRequest('/api/clients?page=0&limit=200')
      expect(res).to.have.status(200)
      expect(res.body.pagination.page).to.equal(1) // page should default to 1
      expect(res.body.pagination.limit).to.equal(100) // limit should max at 100
    })
  })

  describe('for POST /api/clients', () => {
    beforeEach(async () => {
      this.client1 = await factories.clientDBFactory(db, { displayName: 'client1' })
      this.client2 = await factories.clientDBFactory(db, { displayName: 'client2' })
      this.client3 = await factories.clientDBFactory(db, { displayName: 'client3' })
    })

    it('should return multiple clients by IDs', async () => {
      const res = await chai
        .request(server)
        .post('/api/clients')
        .set('authorization', braveApiKey)
        .send({ ids: [this.client1.id, this.client3.id] })

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(2)
      expect(res.body.data.map(c => c.id)).to.have.members([this.client1.id, this.client3.id])
    })

    it('should handle non-existent IDs gracefully', async () => {
      const res = await chai
        .request(server)
        .post('/api/clients')
        .set('authorization', braveApiKey)
        .send({ ids: [this.client1.id, '00000000-0000-0000-0000-000000000000'] })

      expect(res).to.have.status(200)
      expect(res.body.data.length).to.equal(1)
      expect(res.body.data[0].id).to.equal(this.client1.id)
    })

    it('should return 400 for empty IDs array', async () => {
      const res = await chai.request(server).post('/api/clients').set('authorization', braveApiKey).send({ ids: [] })

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
    })

    it('should return 400 for more than 100 IDs', async () => {
      const ids = Array(101).fill('00000000-0000-0000-0000-000000000000')
      const res = await chai.request(server).post('/api/clients').set('authorization', braveApiKey).send({ ids })

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for GET /api/clients/:clientId', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db, { displayName: 'testClient' })
    })

    it('should return the specified client (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}`)
      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.id).to.equal(this.client.id)
      expect(res.body.data.displayName).to.equal('testClient')
    })

    it('should return 404 for non-existent client', async () => {
      const res = await getRequest('/api/clients/00000000-0000-0000-0000-000000000000')
      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
      expect(res.body.message).to.equal('Not Found')
    })
  })

  describe('for GET /api/clients/:clientId/buttons', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.button1 = await factories.buttonDBFactory(db, { clientId: this.client.id, displayName: 'Button 1', serialNumber: 'SN_BTN_LIST_001' })
      this.button2 = await factories.buttonDBFactory(db, { clientId: this.client.id, displayName: 'Button 2', serialNumber: 'SN_BTN_LIST_002' })
    })

    it('should return all buttons for a client with pagination (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/buttons`)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(2)
      expect(res.body.data[0].displayName).to.equal('Button 1')
      expect(res.body.pagination).to.exist
      expect(res.body.pagination.total).to.equal(2)
    })

    it('should paginate buttons correctly', async () => {
      // Create more buttons
      for (let i = 3; i <= 15; i += 1) {
        await factories.buttonDBFactory(db, { clientId: this.client.id, displayName: `Button ${i}`, serialNumber: `SN_${i}` })
      }

      const res = await getRequest(`/api/clients/${this.client.id}/buttons?page=1&limit=5`)
      expect(res).to.have.status(200)
      expect(res.body.data.length).to.equal(5)
      expect(res.body.pagination.total).to.equal(15)
      expect(res.body.pagination.totalPages).to.equal(3)
    })

    it('should return 404 for non-existent client', async () => {
      const res = await getRequest('/api/clients/00000000-0000-0000-0000-000000000000/buttons')

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for POST /api/clients/:clientId/buttons', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.button1 = await factories.buttonDBFactory(db, { clientId: this.client.id, serialNumber: 'SN_BULK_001' })
      this.button2 = await factories.buttonDBFactory(db, { clientId: this.client.id, serialNumber: 'SN_BULK_002' })
      this.button3 = await factories.buttonDBFactory(db, { clientId: this.client.id, serialNumber: 'SN_BULK_003' })
    })

    it('should return multiple buttons by IDs', async () => {
      const res = await chai
        .request(server)
        .post(`/api/clients/${this.client.id}/buttons`)
        .set('authorization', braveApiKey)
        .send({ ids: [this.button1.id, this.button3.id] })

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(2)
    })

    it('should return 404 for non-existent client', async () => {
      const res = await chai
        .request(server)
        .post('/api/clients/00000000-0000-0000-0000-000000000000/buttons')
        .set('authorization', braveApiKey)
        .send({ ids: [this.button1.id] })

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })

    it('should return 400 for empty IDs array', async () => {
      const res = await chai.request(server).post(`/api/clients/${this.client.id}/buttons`).set('authorization', braveApiKey).send({ ids: [] })

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for GET /api/clients/:clientId/buttons/:buttonId', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, { clientId: this.client.id, serialNumber: 'SN_BTN_GET_001' })
    })

    it('should return the specified button (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/buttons/${this.button.id}`)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.id).to.equal(this.button.id)
    })

    it('should return 404 for non-existent button', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/buttons/00000000-0000-0000-0000-000000000000`)

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })

    it('should return 404 for button belonging to different client', async () => {
      const otherClient = await factories.clientDBFactory(db)

      const res = await getRequest(`/api/clients/${otherClient.id}/buttons/${this.button.id}`)

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for GET /api/clients/:clientId/gateways', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.gateway1 = await factories.gatewayDBFactory(db, {
        clientId: this.client.id,
        displayName: 'Gateway 1',
        id: '11111111-1111-1111-1111-111111111111',
      })
      this.gateway2 = await factories.gatewayDBFactory(db, {
        clientId: this.client.id,
        displayName: 'Gateway 2',
        id: '22222222-2222-2222-2222-222222222222',
      })
    })

    it('should return all gateways for a client with pagination (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/gateways`)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(2)
      expect(res.body.pagination).to.exist
      expect(res.body.pagination.total).to.equal(2)
    })

    it('should return 404 for non-existent client', async () => {
      const res = await getRequest('/api/clients/00000000-0000-0000-0000-000000000000/gateways')

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for POST /api/clients/:clientId/gateways', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.gateway1 = await factories.gatewayDBFactory(db, { clientId: this.client.id, id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })
      this.gateway2 = await factories.gatewayDBFactory(db, { clientId: this.client.id, id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' })
      this.gateway3 = await factories.gatewayDBFactory(db, { clientId: this.client.id, id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' })
    })

    it('should return multiple gateways by IDs', async () => {
      const res = await chai
        .request(server)
        .post(`/api/clients/${this.client.id}/gateways`)
        .set('authorization', braveApiKey)
        .send({ ids: [this.gateway1.id, this.gateway3.id] })

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(2)
    })

    it('should return 404 for non-existent client', async () => {
      const res = await chai
        .request(server)
        .post('/api/clients/00000000-0000-0000-0000-000000000000/gateways')
        .set('authorization', braveApiKey)
        .send({ ids: [this.gateway1.id] })

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })

    it('should return 400 for empty IDs array', async () => {
      const res = await chai.request(server).post(`/api/clients/${this.client.id}/gateways`).set('authorization', braveApiKey).send({ ids: [] })

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for GET /api/clients/:clientId/gateways/:gatewayId', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.gateway = await factories.gatewayDBFactory(db, { clientId: this.client.id, id: '33333333-3333-3333-3333-333333333333' })
    })

    it('should return the specified gateway (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/gateways/${this.gateway.id}`)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.id).to.equal(this.gateway.id)
    })

    it('should return 404 for non-existent gateway', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/gateways/nonexistent`)

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for GET /api/clients/:clientId/sessions', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
    })

    it('should return sessions for a client with pagination (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/sessions`)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
      expect(res.body.pagination).to.exist
    })

    it('should return 404 for non-existent client', async () => {
      const res = await getRequest('/api/clients/00000000-0000-0000-0000-000000000000/sessions')

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for GET /api/clients/:clientId/vitals', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, { clientId: this.client.id, serialNumber: 'SN_VITALS_001' })
      this.gateway = await factories.gatewayDBFactory(db, { clientId: this.client.id, id: '55555555-5555-5555-5555-555555555555' })
    })

    it('should return vitals for a client (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/vitals`)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.have.property('buttonVitals')
      expect(res.body.data).to.have.property('gatewayVitals')
    })

    it('should return 404 for non-existent client', async () => {
      const res = await getRequest('/api/clients/00000000-0000-0000-0000-000000000000/vitals')

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })
  })
})
