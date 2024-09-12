// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { server } = require('../../../index')

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dashboard.js integration tests: submitUpdateClient', () => {
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
      ;(await this.agent.post('/login')).setEncoding({
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
      const updateClient = await db.getClientWithId(this.existingClient.id)

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
      ;(await this.agent.post('/login')).setEncoding({
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
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

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
})
