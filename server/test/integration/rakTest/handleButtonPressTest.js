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
const { server } = require('../../../server')

chai.use(chaiHttp)
chai.use(sinonChai)

const expect = chai.expect
const sandbox = sinon.createSandbox()

const rakApiKeyPrimary = helpers.getEnvVar('RAK_API_KEY_PRIMARY')
const rakApiKeySecondary = helpers.getEnvVar('RAK_API_KEY_SECONDARY')

describe('rak.js integration tests: handleButtonPress', () => {
  beforeEach(async () => {
    await db.clearTables()

    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    sandbox.stub(buttonAlerts, 'handleValidRequest')
  })

  afterEach(async () => {
    await db.clearTables()

    sandbox.restore()
  })

  describe('POST with empty devEui', () => {
    beforeEach(async () => {
      this.response = await chai.request(server).post('/rak_button_press').set('authorization', rakApiKeyPrimary).send({ payload: 'Qw==' })
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
      this.response = await chai.request(server).post('/rak_button_press').set('authorization', '').send({ devEui: 'myDevEui', payload: 'Qw==' })
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
      this.response = await chai.request(server).post('/rak_button_press').set('authorization', 'x').send({ devEui: 'myDevEui', payload: 'Qw==' })
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly(`INVALID RAK API key from 'myDevEui' for a Qw== payload (decoded: C)`)
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST QQ== (Button 1) with primary API key for non-existent Button', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: 'notMyDevEui', payload: 'QQ==' })
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should not log an error', () => {
      expect(helpers.logError).not.to.be.called
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST QQ== (Button 1) with primary API key for existing Button', () => {
    beforeEach(async () => {
      const serialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, {
        clientId: client.id,
        serialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: serialNumber, payload: 'QQ==' })
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

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST Qg== (Button 2) with primary API key for existing Button', () => {
    beforeEach(async () => {
      const serialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, {
        clientId: client.id,
        serialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: serialNumber, payload: 'Qg==' })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should not log an error', () => {
      expect(helpers.logError).not.to.be.called
    })

    it('should not handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).not.to.be.called
    })
  })

  describe('POST Qw== (Button 3) with primary API key for existing Button', () => {
    beforeEach(async () => {
      const serialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, {
        clientId: client.id,
        serialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: serialNumber, payload: 'Qw==' })
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
      expect(buttonAlerts.handleValidRequest).to.be.calledWithExactly(this.button)
    })
  })

  describe('POST RA== (Button 4) with primary API key for existing Button', () => {
    beforeEach(async () => {
      const serialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, {
        clientId: client.id,
        serialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: serialNumber, payload: 'RA==' })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should not log an error', () => {
      expect(helpers.logError).not.to.be.called
    })

    it('should handle the button press', () => {
      expect(buttonAlerts.handleValidRequest).to.be.calledWithExactly(this.button)
    })
  })

  describe('POST Qw== (Button 3) with secondary API key for existing Button', () => {
    beforeEach(async () => {
      const serialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, {
        clientId: client.id,
        serialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeySecondary)
        .send({ devEui: serialNumber, payload: 'Qw==' })
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
      expect(buttonAlerts.handleValidRequest).to.be.calledWithExactly(this.button)
    })
  })

  describe('POST SFA= (Heartbeat with 80% battery) with primary API key for existing Button', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'logButtonsVital')

      const serialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, {
        clientId: client.id,
        serialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: serialNumber, snr: 22.25, rssi: -70, payload: 'SFA=' })
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

    it('should log the heartbeat including its battery level, RSSI, and SNR', () => {
      expect(db.logButtonsVital).to.be.calledWithExactly(this.button.id, 80, 22.25, -70)
    })
  })

  describe('POST SFA= (Heartbeat with 80% battery) with primary API key for non-existent Button', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'logButtonsVital')

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: 'notMyDevEui', payload: 'SFA=' })
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should not log the error', () => {
      expect(helpers.logError).not.to.be.called
    })

    it('should not log the heartbeat', () => {
      expect(db.logButtonsVital).not.to.be.called
    })
  })

  describe('POST an unrecognize payload with primary API key', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeyPrimary)
        .send({ devEui: 'myDevEui', payload: 'not_Qw==' })
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

  describe('POST an unrecognized payload with secondary API key', () => {
    beforeEach(async () => {
      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeySecondary)
        .send({ devEui: 'myDevEui', payload: 'not_Qw==' })
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

  describe('POST Aw== (Button 3 V2) with secondary API key for existing Button', () => {
    beforeEach(async () => {
      const serialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, {
        clientId: client.id,
        serialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeySecondary)
        .send({ devEui: serialNumber, payload: 'Aw==' })
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
      expect(buttonAlerts.handleValidRequest).to.be.calledWithExactly(this.button)
    })
  })

  describe('POST BA== (Button 4 V2) with secondary API key for existing Button', () => {
    beforeEach(async () => {
      const serialNumber = '7bj2n3f7dsf23fad'
      const client = await factories.clientDBFactory(db)
      this.button = await factories.buttonDBFactory(db, {
        clientId: client.id,
        serialNumber,
      })

      this.response = await chai
        .request(server)
        .post('/rak_button_press')
        .set('authorization', rakApiKeySecondary)
        .send({ devEui: serialNumber, payload: 'BA==' })
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
      expect(buttonAlerts.handleValidRequest).to.be.calledWithExactly(this.button)
    })
  })
})
