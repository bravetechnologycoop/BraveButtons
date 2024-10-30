// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, helpers, DEVICE_TYPE } = require('brave-alert-lib')
const db = require('../../../db/db')
const { server } = require('../../../server')

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dasboard.js integration tests: submitNewButton', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    await db.clearTables()

    this.client = await factories.clientDBFactory(db)

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearTables()
    this.agent.close()
  })

  describe('for a request that contains all valid non-empty fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.locationid = 'unusedID'
      this.displayName = 'displayName'
      this.serialNumber = 'serialNumber'
      this.phoneNumber = '+15005550006'
      const goodRequest = {
        clientId: this.client.id,
        buttons: [
          {
            serialNumber: this.serialNumber,
            displayName: this.displayName,
            phoneNumber: this.phoneNumber,
            locationid: this.locationid,
          },
        ],
      }

      this.response = await this.agent.post('/buttons').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a new button in the database with the given values', async () => {
      const newButton = await db.getButtonWithLocationid(this.locationid)

      expect({
        locationid: newButton.locationid,
        displayName: newButton.displayName,
        phoneNumber: newButton.phoneNumber,
        serialNumber: newButton.serialNumber,
        clientId: newButton.client.id,
      }).to.eql({
        locationid: this.locationid,
        displayName: this.displayName,
        phoneNumber: this.phoneNumber,
        serialNumber: this.serialNumber,
        clientId: this.client.id,
      })
    })
  })

  describe('for a request that contains all valid non-empty fields with leading and trailing whitespace', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.locationid = ' unusedID '
      this.displayName = ' displayName '
      this.serialNumber = ' serialNumber '
      this.phoneNumber = ' +15005550006 '
      const goodRequest = {
        clientId: ` ${this.client.id} `,
        buttons: [
          {
            serialNumber: this.serialNumber,
            displayName: this.displayName,
            phoneNumber: this.phoneNumber,
            locationid: this.locationid,
          },
        ],
      }

      this.response = await this.agent.post('/buttons').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a button in the database with the trimmed values', async () => {
      const newButton = await db.getButtonWithLocationid(this.locationid.trim())

      expect({
        locationid: newButton.locationid,
        displayName: newButton.displayName,
        phoneNumber: newButton.phoneNumber,
        serialNumber: newButton.serialNumber,
        clientId: newButton.client.id,
      }).to.eql({
        locationid: this.locationid.trim(),
        displayName: this.displayName.trim(),
        phoneNumber: this.phoneNumber.trim(),
        serialNumber: this.serialNumber.trim(),
        clientId: this.client.id.trim(),
      })
    })
  })

  describe('for a request with a nonexistent client ID', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createButtonFromBrowserForm')

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.clientId = 'fbb3e19d-5884-46d6-a0e5-ed5c7c406274'
      const goodRequest = {
        clientId: this.clientId,
        buttons: [
          {
            locationid: 'unusedID',
            displayName: 'displayName',
            serialNumber: 'radar_coreID',
            phoneNumber: '+15005550006',
          },
        ],
      }

      this.response = await this.agent.post('/buttons').send(goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new button in the database', () => {
      expect(db.createButtonFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(`Client ID '${this.clientId}' does not exist`)
    })
  })

  describe('for a request with no login session', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createButtonFromBrowserForm')

      const goodRequest = {
        clientId: '91ddc8f7-c2e7-490e-bfe9-3d2880a76108',
        buttons: [
          {
            locationid: 'unusedID',
            displayName: 'displayName',
            serialNumber: 'radar_coreID',
            phoneNumber: '+15005550006',
          },
        ],
      }

      this.response = await chai.request(server).post('/buttons').send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not create a new button in the database', () => {
      expect(db.createButtonFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Unauthorized')
    })
  })

  describe('for a request that contains all valid fields, but empty', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createButtonFromBrowserForm')

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const badRequest = {
        clientId: '',
        buttons: [
          {
            locationid: '',
            displayName: '',
            serialNumber: '',
            phoneNumber: '',
          },
        ],
      }

      this.response = await this.agent.post('/buttons').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new button in the database', () => {
      expect(db.createButtonFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /buttons: clientId (Client ID must not be empty),buttons[0].locationid (Location ID must not be empty),buttons[0].displayName (Display Name must not be empty),buttons[0].serialNumber (Serial Number must not be empty),buttons[0].phoneNumber (Phone Number must not be empty)`,
      )
    })
  })

  describe('for an empty request', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createButtonFromBrowserForm')

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.response = await this.agent.post('/buttons').send({})
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new button in the database', () => {
      expect(db.createButtonFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /buttons: clientId (Client ID must not be empty),buttons (Buttons must be an array and contain at least one entry)`,
      )
    })
  })

  describe('for an otherwise valid request that contains an already existing locationid', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createButtonFromBrowserForm')

      this.locationid = 'existingLocationId'
      await factories.deviceDBFactory(db, {
        deviceType: DEVICE_TYPE.DEVICE_BUTTON,
        locationid: this.locationid,
        clientId: this.client.id,
      })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const duplicateButtonRequest = {
        clientId: this.client.id,
        buttons: [
          {
            locationid: this.locationid,
            displayName: 'displayName',
            serialNumber: 'serialNumber',
            phoneNumber: '+15005550006',
          },
        ],
      }

      this.response = await this.agent.post('/buttons').send(duplicateButtonRequest)
    })

    it('should return 409', () => {
      expect(this.response).to.have.status(409)
    })

    it('should not create a new button in the database', () => {
      expect(db.createButtonFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith('Location ID already exists')
    })
  })
})
