// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { beforeEach, afterEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { server } = require('../../../server')
const { isSendingVitals, isDisplayed } = require('./submitUpdateClientTest')

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

// Global variables for stubbing and mocking
const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dashboard.js Integration Tests: submitUpdateGateway', () => {
    beforeEach(async () => {
        sandbox.spy(helpers, 'log')
        sandbox.spy(helpers, 'logError')
        sandbox.spy(db, 'updateGateway')

        this.testGatewayIdForEdit = 'test1'

        await db.clearTables()

        this.client = await factories.clientDBFactory(db)
        this.test1 = await factories.gatewayDBFactory(db, {
            id: this.testGatewayIdForEdit,
            clientId: this.client.id,
        })

        this.agent = chai.request.agent(server)
    })

    afterEach(async () => {
        sandbox.restore()
        await db.clearTables
        this.agent.close()
    })

    describe('for a request that contains all valid non-empty fields', () => {
        beforeEach(async () => {
            await this.agent.post('/login').send({
                username: helpers.getEnvVar('WEB_USERNAME'),
                password: helpers.getEnvVar('PASSWORD'),
            })

            this.goodRequest = {
                displayName: 'New Name',
                isDisplayed: 'true',
                isSendingVitals: 'false',
                clientId: this.client.id,
            }

            this.response = await this.agent.post(`/gatewyays/${this.test1.id}`).send(this.goodRequest)
        })

        it('should return 200', () => {
            expect(this.response).to.have.status(200)
        })

        it('should update the gateway in the database', async () => {
            const updatedGateway = await db.getGatewayWithGatewayId(this.test1.id)

            expect(updatedGateway.displayName).to.equal(this.goodRequest.displayName)
            expect(updatedGateway.isDisplayed).to.equal(this.goodRequest.isDisplayed)
            expect(updatedGateway.isSendingVitals).to.be.false
            expect(updatedGateway.clientId).to.equal(this.goodRequest.clientId)
        })
    })
})