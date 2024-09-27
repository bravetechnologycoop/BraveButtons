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

describe('dashboard.js integration tests: submitNewClient', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    await db.clearTables()

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

      this.displayName = 'myNewClient'
      this.fromPhoneNumber = '+19998887777'
      this.responderPhoneNumbers = ['+16665553333']
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.language = 'en'
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        responderPhoneNumbers: this.responderPhoneNumbers.join(','),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        language: this.language,
      }

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a single client in the database with the given values', async () => {
      const clients = await db.getClients()

      expect(
        clients.map(client => {
          return {
            displayName: client.displayName,
            fromPhoneNumber: client.fromPhoneNumber,
            responderPhoneNumbers: client.responderPhoneNumbers,
            fallbackPhoneNumbers: client.fallbackPhoneNumbers,
            heartbeatPhoneNumbers: client.heartbeatPhoneNumbers,
            incidentCategories: client.incidentCategories,
            reminderTimeout: client.reminderTimeout,
            fallbackTimeout: client.fallbackTimeout,
            isDisplayed: client.isDisplayed,
            isSendingAlerts: client.isSendingAlerts,
            isSendingVitals: client.isSendingVitals,
            language: client.language,
          }
        }),
      ).to.eql([
        {
          displayName: this.displayName,
          fromPhoneNumber: this.fromPhoneNumber,
          responderPhoneNumbers: this.responderPhoneNumbers,
          fallbackPhoneNumbers: this.fallbackPhoneNumbers,
          heartbeatPhoneNumbers: this.heartbeatPhoneNumbers,
          incidentCategories: this.incidentCategories,
          reminderTimeout: this.reminderTimeout,
          fallbackTimeout: this.fallbackTimeout,
          isDisplayed: true,
          isSendingAlerts: false,
          isSendingVitals: false,
          language: this.language,
        },
      ])
    })
  })

  describe('for a request that contains all valid non-empty fields with leading and trailing whitespace', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = ' myNewClient  '
      this.fromPhoneNumber = '  +19998887777  '
      this.responderPhoneNumbers = [' +16665553333 ']
      this.fallbackPhoneNumbers = ['  +1  ', ' +2 ', '   +3   ']
      this.heartbeatPhoneNumbers = [' +4 ', '  +5  ']
      this.incidentCategories = ['   Cat1 ', '    Cat2   ']
      this.reminderTimeout = '   5   '
      this.fallbackTimeout = ' 10 '
      this.language = '    en    '
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        responderPhoneNumbers: this.responderPhoneNumbers.join(','),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        language: this.language,
      }

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a single client in the database with the trimmed values', async () => {
      const clients = await db.getClients()

      expect(
        clients.map(client => {
          return {
            displayName: client.displayName,
            fromPhoneNumber: client.fromPhoneNumber,
            responderPhoneNumbers: client.responderPhoneNumbers,
            fallbackPhoneNumbers: client.fallbackPhoneNumbers,
            heartbeatPhoneNumbers: client.heartbeatPhoneNumbers,
            incidentCategories: client.incidentCategories,
            reminderTimeout: client.reminderTimeout,
            fallbackTimeout: client.fallbackTimeout,
            isDisplayed: client.isDisplayed,
            isSendingAlerts: client.isSendingAlerts,
            isSendingVitals: client.isSendingVitals,
            language: client.language,
          }
        }),
      ).to.eql([
        {
          displayName: this.displayName.trim(),
          fromPhoneNumber: this.fromPhoneNumber.trim(),
          responderPhoneNumbers: this.responderPhoneNumbers.map(phone => phone.trim()),
          fallbackPhoneNumbers: this.fallbackPhoneNumbers.map(phone => phone.trim()),
          heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.map(phone => phone.trim()),
          incidentCategories: this.incidentCategories.map(category => category.trim()),
          reminderTimeout: parseInt(this.reminderTimeout.trim(), 10),
          fallbackTimeout: parseInt(this.fallbackTimeout.trim(), 10),
          isDisplayed: true,
          isSendingAlerts: false,
          isSendingVitals: false,
          language: this.language.trim(),
        },
      ])
    })
  })

  describe('for a request with no login session', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createClient')

      const goodRequest = {
        displayName: 'testDisplayName',
        fromPhoneNumber: '+17778889999',
        responderPhoneNumbers: '+12223334444',
        fallbackPhoneNumbers: '+12223334444',
        heartbeatPhoneNumbers: '+17772223333,+19995554444',
        incidentCategories: 'Cat1,Cat2',
        reminderTimeout: 5,
        fallbackTimeout: 10,
      }

      this.response = await chai.request(server).post('/clients').send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not create a new client in the database', () => {
      expect(db.createClient).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Unauthorized')
    })
  })

  describe('for a request that contains valid non-empty fields but with no heartbeatPhoneNumbers', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'myNewClient'
      this.fromPhoneNumber = '+19998887777'
      this.responderPhoneNumbers = ['+16665553333']
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.language = 'en'
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        responderPhoneNumbers: this.responderPhoneNumbers.join(','),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        language: this.language,
      }

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a single client in the database with the given values', async () => {
      const clients = await db.getClients()

      expect(
        clients.map(client => {
          return {
            displayName: client.displayName,
            fromPhoneNumber: client.fromPhoneNumber,
            responderPhoneNumbers: client.responderPhoneNumbers,
            fallbackPhoneNumbers: client.fallbackPhoneNumbers,
            heartbeatPhoneNumbers: client.heartbeatPhoneNumbers,
            incidentCategories: client.incidentCategories,
            reminderTimeout: client.reminderTimeout,
            fallbackTimeout: client.fallbackTimeout,
            isDisplayed: client.isDisplayed,
            isSendingAlerts: client.isSendingAlerts,
            isSendingVitals: client.isSendingVitals,
            language: client.language,
          }
        }),
      ).to.eql([
        {
          displayName: this.displayName,
          fromPhoneNumber: this.fromPhoneNumber,
          responderPhoneNumbers: this.responderPhoneNumbers,
          fallbackPhoneNumbers: this.fallbackPhoneNumbers,
          heartbeatPhoneNumbers: [],
          incidentCategories: this.incidentCategories,
          reminderTimeout: this.reminderTimeout,
          fallbackTimeout: this.fallbackTimeout,
          isDisplayed: true,
          isSendingAlerts: false,
          isSendingVitals: false,
          language: this.language,
        },
      ])
    })
  })

  describe('for a request that contains valid non-empty fields but with no responderPhoneNumbers', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'myNewClient'
      this.fromPhoneNumber = '+19998887777'
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.language = 'en'
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        language: this.language,
      }

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.length).to.equal(0)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith('Bad request to /clients: responderPhoneNumbers (Invalid value)')
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
        language: '',
      }

      this.response = await this.agent.post('/clients').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.length).to.equal(0)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        'Bad request to /clients: displayName (Invalid value),responderPhoneNumbers (Invalid value),fallbackPhoneNumbers (Invalid value),fromPhoneNumber (Invalid value),language (Invalid value),incidentCategories (Invalid value),reminderTimeout (Invalid value),fallbackTimeout (Invalid value)',
      )
    })
  })

  describe('for an empty request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.response = await this.agent.post('/clients').send({})
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.length).to.equal(0)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        'Bad request to /clients: displayName (Invalid value),responderPhoneNumbers (Invalid value),fallbackPhoneNumbers (Invalid value),fromPhoneNumber (Invalid value),language (Invalid value),incidentCategories (Invalid value),reminderTimeout (Invalid value),fallbackTimeout (Invalid value)',
      )
    })
  })

  describe('for an otherwise valid request that contains an already existing displayName', () => {
    beforeEach(async () => {
      this.existingClient = await factories.clientDBFactory(db)

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const duplicateDisplayNameRequest = {
        displayName: this.existingClient.displayName,
        fromPhoneNumber: '+14445556666',
        responderPhoneNumbers: ['+19995552222'],
        fallbackPhoneNumbers: '+1,+2,+3',
        heartbeatPhoneNumbers: '+4,+5',
        incidentCategories: 'Cat1,Cat2',
        reminderTimeout: 5,
        fallbackTimeout: 10,
        language: 'en',
      }

      this.response = await this.agent.post('/clients').send(duplicateDisplayNameRequest)
    })

    it('should return 409', () => {
      expect(this.response).to.have.status(409)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.map(client => client.id)).to.eql([this.existingClient.id])
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(`Client Display Name already exists: ${this.existingClient.displayName}`)
    })
  })

  describe('for an otherwise valid request that contains a negative reminderTimeout and negative fallbackTimout', () => {
    beforeEach(async () => {
      this.existingClient = await factories.clientDBFactory(db)

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const duplicateDisplayNameRequest = {
        displayName: 'myNewclient',
        fromPhoneNumber: '+14445556666',
        responderPhoneNumbers: ['+19995552222'],
        fallbackPhoneNumbers: '+1,+2,+3',
        heartbeatPhoneNumbers: '+4,+5',
        incidentCategories: 'Cat1,Cat2',
        reminderTimeout: -5,
        fallbackTimeout: -10,
        language: 'en',
      }

      this.response = await this.agent.post('/clients').send(duplicateDisplayNameRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.map(client => client.id)).to.eql([this.existingClient.id])
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith('Bad request to /clients: reminderTimeout (Invalid value),fallbackTimeout (Invalid value)')
    })
  })

  describe('for an otherwise valid request that contains a non-integer reminderTimeout and fallbackTimeout', () => {
    beforeEach(async () => {
      this.existingClient = await factories.clientDBFactory(db)

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const duplicateDisplayNameRequest = {
        displayName: 'myNewclient',
        fromPhoneNumber: '+14445556666',
        responderPhoneNumbers: ['+19995552222'],
        fallbackPhoneNumbers: '+1,+2,+3',
        heartbeatPhoneNumbers: '+4,+5',
        incidentCategories: 'Cat1,Cat2',
        reminderTimeout: 'abc',
        fallbackTimeout: 10.5,
        language: 'en',
      }

      this.response = await this.agent.post('/clients').send(duplicateDisplayNameRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.map(client => client.id)).to.eql([this.existingClient.id])
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith('Bad request to /clients: reminderTimeout (Invalid value),fallbackTimeout (Invalid value)')
    })
  })
})