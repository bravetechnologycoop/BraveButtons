// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')

// In-house dependencies
const { helpers, factories } = require('brave-alert-lib')
const buttonAlerts = require('../../../buttonAlerts')
const db = require('../../../db/db')
const { buttonDBFactory } = require('../../testingHelpers')
const { server } = require('../../../server')

chai.use(chaiHttp)
chai.use(sinonChai)

const expect = chai.expect
const sandbox = sinon.createSandbox()

const rakApiKeyPrimary = helpers.getEnvVar('RAK_API_KEY_PRIMARY')
const rakApiKeySecondary = helpers.getEnvVar('RAK_API_KEY_SECONDARY')

describe('rak.js integration tests: handleButtonpress', () => {
  beforeEach(async () => {
    await db.clearTables()

    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    sandbox.stub(buttonAlerts, 'handleValidRequest')
  })

  afterEach(async () => {
    sandbox.restore()
  })

  describe('POST with empty devEui', () => {
    beforeEach(async () => {
      this.response = await chai.request(server).post('/rak_button_press').set('authorization', rakApiKeyPrimary).send({ payload: 'QQ==' })
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly('Bad request to /rak_button_press: devEui (Invalid value)')
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST with empty payload', () => {
    beforeEach(async () => {
      this.response = await chai.request(server).post('/rak_button_press').set('authorization', rakApiKeyPrimary).send({ devEui: 'myDevEui' })
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly('Bad request to /rak_button_press: payload (Invalid value)')
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST with empty authorization', () => {
    beforeEach(async () => {
      this.response = await chai.request(server).post('/rak_button_press').set('authorization', '').send({ devEui: 'myDevEui', payload: 'QQ==' })
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly('Bad request to /rak_button_press: authorization (Invalid value)')
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST with invalid authorization', () => {
    beforeEach(async () => {
      this.response = await chai.request(server).post('/rak_button_press').set('authorization', 'x').send({ devEui: 'myDevEui', payload: 'QQ==' })
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly(`INVALID RAK API key from 'myDevEui' for a QQ== payload`)
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST QQ== with primary API key for non-existent Button', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: 'notMyDevEui', payload: 'QQ==' })
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly(`Bad request to /rak_button_press: DevEui is not registered: 'notMyDevEui'`)
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST QQ== with primary API key for existing Button', () => {
    beforeEach(async () => {
      const buttonSerialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await buttonDBFactory(db, {
        clientId: client.id,
        buttonSerialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: buttonSerialNumber, payload: 'QQ==' })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).not.to.be.called
    })

    it('should handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).to.be.calledWithExactly(this.button, 1)
    })
  })

  describe('POST QQ== with secondary API key for existing Button', () => {
    beforeEach(async () => {
      const buttonSerialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await buttonDBFactory(db, {
        clientId: client.id,
        buttonSerialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeySecondary)
        .send({ devEui: buttonSerialNumber, payload: 'QQ==' })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).not.to.be.called
    })

    it('should handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).to.be.calledWithExactly(this.button, 1)
    })
  })

  describe('POST non-QQ== with primary API key', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: 'myDevEui', payload: 'not_QQ==' })
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).not.to.be.called
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST non-QQ== with secondary API key', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeySecondary)
        .send({ devEui: 'myDevEui', payload: 'not_QQ==' })
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).not.to.be.called
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })
})
