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
    it.only('should accept an authorized request (200)', async () => {
      const res = await getRequest('/api/clients')
      expect(res).to.have.status(200)
      expect(helpers.logError).not.to.be.called
    })

    it.only('should reject an unauthorized request (401)', async () => {
      const res = await chai.request(server).get('/api/clients').set('authorization', 'badApiKey')
      expect(res).to.have.status(401)
      expect(helpers.logError).to.be.calledWith('Unauthorized request to /api/clients.')
    })

    it.only('should reject a bad request (401)', async () => {
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

    it.only('should return an array of clients', async () => {
      const res = await getRequest('/api/clients')
      expect(JSON.stringify(res.body)).to.equal(
        JSON.stringify({
          status: 'success',
          data: [this.client1, this.client2],
        }),
      )
    })
  })
})
