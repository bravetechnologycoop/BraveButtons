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

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

// Global variables for stubbing and mocking
const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dashboard.js Integration Tests: submitUpdateClient', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    await db.clearTables()

    this.existingClient = await factories.clientDBFactory(db)

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    this.agent.close()
    await db.clearTables()
    sandbox.restore()
  })

  describe('for a request that contains all valid non-empty fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPhoneNumbers = ['+18885554444']
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isDisplayed = true
      this.isSendingAlerts = true
      this.isSendingVitals = true
      this.language = 'en'
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: this.newResponderPhoneNumbers.join(','),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        language: this.language,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the client in the database', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect({
        displayName: updatedClient.displayName,
        fromPhoneNumber: updatedClient.fromPhoneNumber,
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isDisplayed: updatedClient.isDisplayed,
        isSendingAlerts: updatedClient.isSendingAlerts,
        isSendingVitals: updatedClient.isSendingVitals,
        language: updatedClient.language,
      }).to.eql({
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: this.newResponderPhoneNumbers,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers,
        incidentCategories: this.incidentCategories,
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        language: this.language,
      })
    })
  })

  describe('for a request that contains all valid non-empty fields with leading and trailing whitespace', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = ' New Display Name '
      this.newFromPhoneNumber = '   +17549553216    '
      this.newResponderPhoneNumbers = ['   +18885554444      ']
      this.fallbackPhoneNumbers = ['  +1  ', ' +2 ', '  +3  ']
      this.heartbeatPhoneNumbers = ['   +4  ', '  +5 ']
      this.incidentCategories = ['   Cat1  ', ' Cat2   ']
      this.reminderTimeout = '   5   '
      this.fallbackTimeout = '   10  '
      this.isDisplayed = '    true    '
      this.isSendingAlerts = '    true    '
      this.isSendingVitals = '    true    '
      this.language = '    en    '
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: this.newResponderPhoneNumbers.join(','),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        language: this.language,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the client in the database with the trimmed values', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect({
        displayName: updatedClient.displayName,
        fromPhoneNumber: updatedClient.fromPhoneNumber,
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isDisplayed: updatedClient.isDisplayed,
        isSendingAlerts: updatedClient.isSendingAlerts,
        isSendingVitals: updatedClient.isSendingVitals,
        language: updatedClient.language,
      }).to.eql({
        displayName: this.newDisplayname.trim(),
        fromPhoneNumber: this.newFromPhoneNumber.trim(),
        responderPhoneNumbers: this.newResponderPhoneNumbers.map(phone => phone.trim()),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.map(number => number.trim()),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.map(phone => phone.trim()),
        incidentCategories: this.incidentCategories.map(category => category.trim()),
        reminderTimeout: parseInt(this.reminderTimeout.trim(), 10),
        fallbackTimeout: parseInt(this.fallbackTimeout.trim(), 10),
        isDisplayed: this.isDisplayed.trim() === 'true',
        isSendingAlerts: this.isSendingAlerts.trim() === 'true',
        isSendingVitals: this.isSendingVitals.trim() === 'true',
        language: this.language.trim(),
      })
    })
  })

  describe('for a request with no login session', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'updateClient')

      const goodRequest = {
        displayName: 'testDisplayName',
        fromPhoneNumber: '+17778889999',
        responderPhoneNumbers: '+12223334444',
        fallbackPhoneNumbers: '+4,+5',
        heartbeatPhoneNumbers: '+1,+2,+3',
        incidentCategories: 'Cat1,Cat2',
        reminderTimeout: 5,
        fallbackTimeout: 10,
        isDisplayed: 'true',
        isSendingAlerts: 'true',
        isSendingVitals: 'true',
        language: 'en',
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not create a new client in the database', () => {
      expect(db.updateClient).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Unauthorized')
    })
  })

  describe('for a request that does not make any changes to the values', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.goodRequest = {
        displayName: this.existingClient.displayName,
        fromPhoneNumber: this.existingClient.fromPhoneNumber,
        responderPhoneNumbers: this.existingClient.responderPhoneNumbers.join(','),
        fallbackPhoneNumbers: this.existingClient.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.existingClient.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.existingClient.incidentCategories.join(','),
        reminderTimeout: this.existingClient.reminderTimeout,
        fallbackTimeout: this.existingClient.fallbackTimeout,
        isDisplayed: this.existingClient.isDisplayed,
        isSendingAlerts: this.existingClient.isSendingAlerts,
        isSendingVitals: this.existingClient.isSendingVitals,
        language: this.existingClient.language,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the client in the database', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect({
        displayName: updatedClient.displayName,
        fromPhoneNumber: updatedClient.fromPhoneNumber,
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isDisplayed: updatedClient.isDisplayed,
        isSendingAlerts: updatedClient.isSendingAlerts,
        isSendingVitals: updatedClient.isSendingVitals,
        language: updatedClient.language,
      }).to.eql({
        displayName: this.existingClient.displayName,
        fromPhoneNumber: this.existingClient.fromPhoneNumber,
        responderPhoneNumbers: this.existingClient.responderPhoneNumbers,
        fallbackPhoneNumbers: this.existingClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: this.existingClient.heartbeatPhoneNumbers,
        incidentCategories: this.existingClient.incidentCategories,
        reminderTimeout: this.existingClient.reminderTimeout,
        fallbackTimeout: this.existingClient.fallbackTimeout,
        isDisplayed: this.existingClient.isDisplayed,
        isSendingAlerts: this.existingClient.isSendingAlerts,
        isSendingVitals: this.existingClient.isSendingVitals,
        language: this.existingClient.language,
      })
    })
  })

  describe('for a request that contains valid non-empty fields but with no heartbeatPhoneNumbers', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPhoneNumbers = ['+18885554444']
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isDisplayed = true
      this.isSendingAlerts = true
      this.isSendingVitals = true
      this.language = 'en'
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: this.newResponderPhoneNumbers.join(','),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        language: this.language,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the client in the database', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect({
        displayName: updatedClient.displayName,
        fromPhoneNumber: updatedClient.fromPhoneNumber,
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isDisplayed: updatedClient.isDisplayed,
        isSendingAlerts: updatedClient.isSendingAlerts,
        isSendingVitals: updatedClient.isSendingVitals,
        language: updatedClient.language,
      }).to.eql({
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: this.newResponderPhoneNumbers,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: [],
        incidentCategories: this.incidentCategories,
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        language: this.language,
      })
    })
  })

  describe('for a request that contains valid non-empty fields but with no responderPhoneNumbers', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isDisplayed = true
      this.isSendingAlerts = true
      this.isSendingVitals = true
      this.language = 'en'
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        language: this.language,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(`Bad request to /clients/${this.existingClient.id}: responderPhoneNumbers (Invalid value)`)
    })
  })

  describe('for a request that contains all valid fields, but empty', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const badRequest = {
        displayName: '',
        fromPhoneNumber: '',
        responderPhoneNumbers: '',
        fallbackPhoneNumbers: '',
        heartbeatPhoneNumbers: '',
        incidentCategories: '',
        reminderTimeout: '',
        fallbackTimeout: '',
        isDisplayed: '',
        isSendingAlerts: '',
        isSendingVitals: '',
        language: '',
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: displayName (Invalid value),responderPhoneNumbers (Invalid value),fallbackPhoneNumbers (Invalid value),fromPhoneNumber (Invalid value),incidentCategories (Invalid value),isDisplayed (Invalid value),isSendingAlerts (Invalid value),isSendingVitals (Invalid value),language (Invalid value),reminderTimeout (Invalid value),fallbackTimeout (Invalid value)`,
      )
    })
  })

  describe('for an empty request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send({})
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: displayName (Invalid value),responderPhoneNumbers (Invalid value),fallbackPhoneNumbers (Invalid value),fromPhoneNumber (Invalid value),incidentCategories (Invalid value),isDisplayed (Invalid value),isSendingAlerts (Invalid value),isSendingVitals (Invalid value),language (Invalid value),reminderTimeout (Invalid value),fallbackTimeout (Invalid value)`,
      )
    })
  })

  describe('for an otherwise valid request that contains an already existing displayName', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.otherClientName = 'otherClientName'
      this.otherExistingClient = await factories.clientDBFactory(db, {
        displayName: this.otherClientName,
      })

      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isDisplayed = true
      this.isSendingAlerts = true
      this.isSendingVitals = true
      this.language = 'en'
      const duplicateDisplayNameRequest = {
        displayName: this.otherClientName,
        fromPhoneNumber: '+17549553216',
        responderPhoneNumbers: '+18885554444',
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        language: this.language,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(duplicateDisplayNameRequest)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(`Client Display Name already exists: ${this.otherClientName}`)
    })
  })

  describe('for an otherwise valid request that contains a negative reminderTimeout and fallbackTimeout', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPhoneNumbers = ['+18885554444']
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = -5
      this.fallbackTimeout = -10
      this.isDisplayed = true
      this.isSendingAlerts = true
      this.isSendingVitals = true
      this.language = 'en'
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: this.newResponderPhoneNumbers.join(','),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        language: this.language,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: reminderTimeout (Invalid value),fallbackTimeout (Invalid value)`,
      )
    })
  })

  describe('for an otherwise valid request that contains a non-integer reminderTimeout and fallbackTimeout', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPhoneNumbers = ['+18885554444']
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 'abc'
      this.fallbackTimeout = 10.6
      this.isDisplayed = true
      this.isSendingAlerts = true
      this.isSendingVitals = true
      this.language = 'en'
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: this.newResponderPhoneNumbers.join(','),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        language: this.language,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: reminderTimeout (Invalid value),fallbackTimeout (Invalid value)`,
      )
    })
  })
})
