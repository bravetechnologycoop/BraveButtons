// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { server } = require('../../../server')

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dashboard.js integration tests: submitUpdateGateway', () => {
    beforeEach(async () => {
        sandbox.spy(helpers, 'log')
        sandbox.spy(helpers, 'logError')
        sandbox.spy(db, 'updateGateway')

        // TODO: figure out how to test gateways without a factories
        this.testGatewayIdForEdit = 'test1'

        await db.clearTables()

        this.client = await factories.clientDBFactory(db)
        this.test1 = await factories.gatewayDBFactory(db, {
            gatewayid: this.testGatewayIdForEdit,
            clientId: this.client.id,
        })

        this.agent = chai.request.agent(server)
    })

    afterEach(async () => {
        sandbox.restore()
        await db.clearTables
        this.agent.close()
    })

    describe
})