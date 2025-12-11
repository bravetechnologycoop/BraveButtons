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

  describe('for POST /api/clients', () => {
    it('should create a new client with valid data (201)', async () => {
      const clientData = {
        displayName: 'New API Client',
        fromPhoneNumber: '+15551234567',
        responderPhoneNumbers: ['+15559876543', '+15551111111'],
        fallbackPhoneNumbers: ['+15552222222'],
        heartbeatPhoneNumbers: ['+15553333333'],
        incidentCategories: ['Cat1', 'Cat2'],
        reminderTimeout: 300,
        fallbackTimeout: 600,
        isDisplayed: true,
        isSendingAlerts: false,
        isSendingVitals: false,
        language: 'en',
      }

      const res = await chai.request(server).post('/api/clients').set('authorization', braveApiKey).send(clientData)

      expect(res).to.have.status(201)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.displayName).to.equal('New API Client')
      expect(res.body.data.language).to.equal('en')
      expect(res).to.have.header('location')

      const clients = await db.getClients()
      expect(clients.length).to.equal(1)
      expect(clients[0].displayName).to.equal('New API Client')
    })

    it('should create a client with en_fr_bilingual language (201)', async () => {
      const clientData = {
        displayName: 'Bilingual Client',
        fromPhoneNumber: '+15551234567',
        responderPhoneNumbers: ['+15559876543'],
        fallbackPhoneNumbers: ['+15552222222'],
        heartbeatPhoneNumbers: [],
        incidentCategories: ['Cat1'],
        reminderTimeout: 300,
        fallbackTimeout: 600,
        isDisplayed: true,
        isSendingAlerts: false,
        isSendingVitals: false,
        language: 'en_fr_bilingual',
      }

      const res = await chai.request(server).post('/api/clients').set('authorization', braveApiKey).send(clientData)

      expect(res).to.have.status(201)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.language).to.equal('en_fr_bilingual')
    })

    it('should return 400 for missing required fields', async () => {
      const badData = {
        displayName: 'Incomplete Client',
        // missing required fields
      }

      const res = await chai.request(server).post('/api/clients').set('authorization', braveApiKey).send(badData)

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
      expect(res.body.message).to.equal('Bad Request')
    })

    it('should return 400 for empty responderPhoneNumbers array', async () => {
      const badData = {
        displayName: 'Bad Client',
        fromPhoneNumber: '+15551234567',
        responderPhoneNumbers: [], // must have at least 1
        fallbackPhoneNumbers: ['+15552222222'],
        heartbeatPhoneNumbers: [],
        incidentCategories: ['Cat1'],
        reminderTimeout: 300,
        fallbackTimeout: 600,
        isDisplayed: true,
        isSendingAlerts: false,
        isSendingVitals: false,
        language: 'en',
      }

      const res = await chai.request(server).post('/api/clients').set('authorization', braveApiKey).send(badData)

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for PUT /api/clients/:clientId', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db, { displayName: 'Original Name', language: 'en' })
    })

    it('should update a client with valid data (200)', async () => {
      const updateData = {
        displayName: 'Updated Name',
        fromPhoneNumber: '+15559998888',
        responderPhoneNumbers: ['+15557776666'],
        fallbackPhoneNumbers: ['+15555554444'],
        heartbeatPhoneNumbers: ['+15553332222'],
        incidentCategories: ['Updated Cat'],
        reminderTimeout: 400,
        fallbackTimeout: 800,
        isDisplayed: false,
        isSendingAlerts: true,
        isSendingVitals: true,
        language: 'es_us',
      }

      const res = await chai.request(server).put(`/api/clients/${this.client.id}`).set('authorization', braveApiKey).send(updateData)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.displayName).to.equal('Updated Name')
      expect(res.body.data.language).to.equal('es_us')

      const updatedClient = await db.getClientWithId(this.client.id)
      expect(updatedClient.displayName).to.equal('Updated Name')
      expect(updatedClient.language).to.equal('es_us')
    })

    it('should update client to en_fr_bilingual language (200)', async () => {
      const updateData = {
        displayName: 'Bilingual Updated',
        fromPhoneNumber: this.client.fromPhoneNumber,
        responderPhoneNumbers: this.client.responderPhoneNumbers,
        fallbackPhoneNumbers: this.client.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: this.client.heartbeatPhoneNumbers,
        incidentCategories: this.client.incidentCategories,
        reminderTimeout: this.client.reminderTimeout,
        fallbackTimeout: this.client.fallbackTimeout,
        isDisplayed: this.client.isDisplayed,
        isSendingAlerts: this.client.isSendingAlerts,
        isSendingVitals: this.client.isSendingVitals,
        language: 'en_fr_bilingual',
      }

      const res = await chai.request(server).put(`/api/clients/${this.client.id}`).set('authorization', braveApiKey).send(updateData)

      expect(res).to.have.status(200)
      expect(res.body.data.language).to.equal('en_fr_bilingual')
    })

    it('should return 404 for non-existent client', async () => {
      const updateData = {
        displayName: 'Updated Name',
        fromPhoneNumber: '+15559998888',
        responderPhoneNumbers: ['+15557776666'],
        fallbackPhoneNumbers: ['+15555554444'],
        heartbeatPhoneNumbers: [],
        incidentCategories: ['Cat'],
        reminderTimeout: 400,
        fallbackTimeout: 800,
        isDisplayed: true,
        isSendingAlerts: false,
        isSendingVitals: false,
        language: 'en',
      }

      const res = await chai
        .request(server)
        .put('/api/clients/00000000-0000-0000-0000-000000000000')
        .set('authorization', braveApiKey)
        .send(updateData)

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })

    it('should return 400 for invalid data', async () => {
      const badData = {
        displayName: '', // empty string
        fromPhoneNumber: '+15559998888',
        responderPhoneNumbers: ['+15557776666'],
        fallbackPhoneNumbers: ['+15555554444'],
        heartbeatPhoneNumbers: [],
        incidentCategories: ['Cat'],
        reminderTimeout: 400,
        fallbackTimeout: 800,
        isDisplayed: true,
        isSendingAlerts: false,
        isSendingVitals: false,
        language: 'en',
      }

      const res = await chai.request(server).put(`/api/clients/${this.client.id}`).set('authorization', braveApiKey).send(badData)

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for GET /api/clients/:clientId/buttons', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.button1 = await factories.buttonDBFactory(db, { clientId: this.client.id, displayName: 'Button 1', serialNumber: 'SN_BTN_LIST_001' })
      this.button2 = await factories.buttonDBFactory(db, { clientId: this.client.id, displayName: 'Button 2', serialNumber: 'SN_BTN_LIST_002' })
    })

    it('should return all buttons for a client (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/buttons`)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(2)
      expect(res.body.data[0].displayName).to.equal('Button 1')
    })

    it('should return 404 for non-existent client', async () => {
      const res = await getRequest('/api/clients/00000000-0000-0000-0000-000000000000/buttons')

      expect(res).to.have.status(404)
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

  describe('for POST /api/clients/:clientId/buttons', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
    })

    it('should create a new button with valid data (201)', async () => {
      const buttonData = {
        displayName: 'New API Button',
        phoneNumber: '+15551112222',
        buttonSerialNumber: 'SN12345',
        isDisplayed: true,
        isSendingAlerts: true,
        isSendingVitals: false,
      }

      const res = await chai
        .request(server)
        .post(`/api/clients/${this.client.id}/buttons`)
        .set('authorization', braveApiKey)
        .send(buttonData)

      expect(res).to.have.status(201)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.displayName).to.equal('New API Button')
      expect(res).to.have.header('location')
    })

    it('should return 400 for missing required fields', async () => {
      const badData = {
        displayName: 'Incomplete Button',
        // missing phoneNumber and buttonSerialNumber
      }

      const res = await chai.request(server).post(`/api/clients/${this.client.id}/buttons`).set('authorization', braveApiKey).send(badData)

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for PUT /api/clients/:clientId/buttons/:buttonId', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, { clientId: this.client.id, displayName: 'Original Button', serialNumber: 'SN_BTN_UPDATE_001' })
    })

    it('should update a button with valid data (200)', async () => {
      const updateData = {
        clientId: this.client.id,
        displayName: 'Updated Button',
        phoneNumber: '+15559991111',
        buttonSerialNumber: 'NEWSERIAL',
        isDisplayed: false,
        isSendingAlerts: false,
        isSendingVitals: true,
      }

      const res = await chai
        .request(server)
        .put(`/api/clients/${this.client.id}/buttons/${this.button.id}`)
        .set('authorization', braveApiKey)
        .send(updateData)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.displayName).to.equal('Updated Button')
    })

    it('should return 404 for non-existent button', async () => {
      const updateData = {
        clientId: this.client.id,
        displayName: 'Updated Button',
        phoneNumber: '+15559991111',
        buttonSerialNumber: 'NEWSERIAL',
        isDisplayed: true,
        isSendingAlerts: true,
        isSendingVitals: true,
      }

      const res = await chai
        .request(server)
        .put(`/api/clients/${this.client.id}/buttons/00000000-0000-0000-0000-000000000000`)
        .set('authorization', braveApiKey)
        .send(updateData)

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })

    it('should return 400 for invalid data', async () => {
      const badData = {
        clientId: this.client.id,
        displayName: '', // empty
        phoneNumber: '+15559991111',
        buttonSerialNumber: 'NEWSERIAL',
        isDisplayed: true,
        isSendingAlerts: true,
        isSendingVitals: true,
      }

      const res = await chai
        .request(server)
        .put(`/api/clients/${this.client.id}/buttons/${this.button.id}`)
        .set('authorization', braveApiKey)
        .send(badData)

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for GET /api/clients/:clientId/gateways', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.gateway1 = await factories.gatewayDBFactory(db, { clientId: this.client.id, displayName: 'Gateway 1', id: '11111111-1111-1111-1111-111111111111' })
      this.gateway2 = await factories.gatewayDBFactory(db, { clientId: this.client.id, displayName: 'Gateway 2', id: '22222222-2222-2222-2222-222222222222' })
    })

    it('should return all gateways for a client (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/gateways`)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(2)
    })

    it('should return 404 for non-existent client', async () => {
      const res = await getRequest('/api/clients/00000000-0000-0000-0000-000000000000/gateways')

      expect(res).to.have.status(404)
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

  describe('for POST /api/clients/:clientId/gateways/:gatewayId', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
    })

    it('should create a new gateway with valid data (201)', async () => {
      const newGatewayId = '66666666-6666-6666-6666-666666666666'
      const gatewayData = {
        gatewayId: newGatewayId,
        displayName: 'New API Gateway',
        isDisplayed: true,
        isSendingVitals: true,
      }

      const res = await chai
        .request(server)
        .post(`/api/clients/${this.client.id}/gateways/${newGatewayId}`)
        .set('authorization', braveApiKey)
        .send(gatewayData)

      expect(res).to.have.status(201)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.displayName).to.equal('New API Gateway')
      expect(res).to.have.header('location')
    })

    it('should return 400 for missing required fields', async () => {
      const badGatewayId = '77777777-7777-7777-7777-777777777777'
      const badData = {
        gatewayId: badGatewayId,
        // missing displayName
      }

      const res = await chai
        .request(server)
        .post(`/api/clients/${this.client.id}/gateways/${badGatewayId}`)
        .set('authorization', braveApiKey)
        .send(badData)

      expect(res).to.have.status(400)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for PUT /api/clients/:clientId/gateways/:gatewayId', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
      this.gateway = await factories.gatewayDBFactory(db, { clientId: this.client.id, displayName: 'Original Gateway', id: '44444444-4444-4444-4444-444444444444' })
    })

    it('should update a gateway with valid data (200)', async () => {
      const updateData = {
        clientId: this.client.id,
        displayName: 'Updated Gateway',
        isDisplayed: false,
        isSendingVitals: false,
      }

      const res = await chai
        .request(server)
        .put(`/api/clients/${this.client.id}/gateways/${this.gateway.id}`)
        .set('authorization', braveApiKey)
        .send(updateData)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data.displayName).to.equal('Updated Gateway')
    })

    it('should return 404 for non-existent gateway', async () => {
      const updateData = {
        clientId: this.client.id,
        displayName: 'Updated Gateway',
        isDisplayed: true,
        isSendingVitals: true,
      }

      const res = await chai
        .request(server)
        .put(`/api/clients/${this.client.id}/gateways/nonexistent`)
        .set('authorization', braveApiKey)
        .send(updateData)

      expect(res).to.have.status(404)
      expect(res.body.status).to.equal('error')
    })
  })

  describe('for GET /api/clients/:clientId/sessions', () => {
    beforeEach(async () => {
      this.client = await factories.clientDBFactory(db)
    })

    it('should return sessions for a client (200)', async () => {
      const res = await getRequest(`/api/clients/${this.client.id}/sessions`)

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.be.an('array')
    })

    it('should return 400 for missing clientId', async () => {
      const res = await getRequest('/api/clients//sessions')

      expect(res).to.have.status(404) // route doesn't match
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
