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

const radiobridgeApiKeyPrimary = helpers.getEnvVar('RADIO_BRIDGE_API_KEY_PRIMARY')
const radiobridgeApiKeySecondary = helpers.getEnvVar('RADIO_BRIDGE_API_KEY_SECONDARY')

describe('radiobridge.js integration tests: handleButtonpress', () => {
  beforeEach(async () => {
    await db.clearTables()

    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    sandbox.stub(buttonAlerts, 'handleValidRequest')
  })

  afterEach(async () => {
    sandbox.restore()
  })

  describe('POST with empty deviceId', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/radiobridge_button_press')
        .set('authorization', radiobridgeApiKeyPrimary)
        .send({ eventType: 'PUSH_BUTTON' })
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly('Bad request to /radiobridge_button_press: deviceId (Invalid value)')
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST with empty eventType', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/radiobridge_button_press')
        .set('authorization', radiobridgeApiKeyPrimary)
        .send({ deviceId: 'myDeviceId' })
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly('Bad request to /radiobridge_button_press: eventType (Invalid value)')
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST with empty authorization', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/radiobridge_button_press')
        .set('authorization', '')
        .send({ deviceId: 'myDeviceId', eventType: 'PUSH_BUTTON' })
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly('Bad request to /radiobridge_button_press: authorization (Invalid value)')
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST with invalid authorization', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/radiobridge_button_press')
        .set('authorization', 'x')
        .send({ deviceId: 'myDeviceId', eventType: 'PUSH_BUTTON' })
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly(`INVALID Radio Bridge API key from 'myDeviceId' for a PUSH_BUTTON event`)
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST BUTTON_PRESS with primary API key for non-existent Button', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/radiobridge_button_press')
        .set('authorization', radiobridgeApiKeyPrimary)
        .send({ deviceId: 'notMyDeviceId', eventType: 'PUSH_BUTTON' })
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly(`Bad request to /radiobridge_button_press: Device ID is not registered: 'notMyDeviceId'`)
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST BUTTON_PRESS with primary API key for existing Button', () => {
    beforeEach(async () => {
      const buttonSerialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await buttonDBFactory(db, {
        clientId: client.id,
        buttonSerialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/radiobridge_button_press')
        .set('authorization', radiobridgeApiKeyPrimary)
        .send({ deviceId: buttonSerialNumber, eventType: 'PUSH_BUTTON' })
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

  describe('POST BUTTON_PRESS with secondary API key for existing Button', () => {
    beforeEach(async () => {
      const buttonSerialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await buttonDBFactory(db, {
        clientId: client.id,
        buttonSerialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/radiobridge_button_press')
        .set('authorization', radiobridgeApiKeySecondary)
        .send({ deviceId: buttonSerialNumber, eventType: 'PUSH_BUTTON' })
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

  describe('POST non-BUTTON_PRESS with primary API key', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/radiobridge_button_press')
        .set('authorization', radiobridgeApiKeyPrimary)
        .send({ deviceId: 'myDeviceId', eventType: 'not_PUSH_BUTTON' })
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

  describe('POST non-BUTTON_PRESS with secondary API key', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/radiobridge_button_press')
        .set('authorization', radiobridgeApiKeySecondary)
        .send({ deviceId: 'myDeviceId', eventType: 'not_PUSH_BUTTON' })
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
