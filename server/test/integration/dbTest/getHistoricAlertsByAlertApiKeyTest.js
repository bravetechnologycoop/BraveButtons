// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE, factories, helpers, ALERT_TYPE } = require('brave-alert-lib')
const db = require('../../../db/db')
const { buttonDBFactory, sessionDBFactory } = require('../../testingHelpers')

describe('db.js integration tests: getHistoricAlertsByAlertApiKey', () => {
  describe('if there are no clients with the given Alert API Key', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single client with a single button that has a single session that doesn't match the Alert API Key that we ask for
      const client = await factories.clientDBFactory(db)
      const button = await buttonDBFactory(db, {
        buttonId: '51b8be5678bf5ade9bf6a5958b2a4a45',
        clientId: client.id,
      })
      await sessionDBFactory(db, {
        buttonId: button.buttonId,
      })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return an empty array', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey('not alertApiKey', 10, 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there are no sessions for the client with the given Alert API Key', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single client with a single button that has a single session that doesn't match the Alert API Key that we ask for
      const client = await factories.clientDBFactory(db, {
        alertApiKey: 'not our API key',
      })
      const button = await buttonDBFactory(db, {
        buttonId: '51b8be5678bf5ade9bf6a5958b2a4a45',
        clientId: client.id,
      })
      await sessionDBFactory(db, {
        buttonId: button.buttonId,
      })

      // Insert a single client with no sessions that matches the Alert API Key that we ask for
      this.alertApiKey = 'alertApiKey'
      await factories.clientDBFactory(db, {
        alertApiKey: this.alertApiKey,
      })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return an empty array', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 10, 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there is one matching session', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single client with a single button
      this.alertApiKey = 'alertApiKey'
      const client = await factories.clientDBFactory(db, {
        alertApiKey: this.alertApiKey,
      })
      this.button = await buttonDBFactory(db, {
        buttonId: '51b8be5678bf5ade9bf6a5958b2a4a45',
        displayName: 'unit1',
        clientId: client.id,
        buttonSerialNumber: 'button1',
      })

      // Insert a single session for that API key
      this.incidentCategory = 'Cat 0'
      this.numButtonPresses = 6
      this.respondedAt = new Date('2021-01-20T06:20:19.000Z')
      this.session = await sessionDBFactory(db, {
        buttonId: this.button.buttonId,
        numButtonPresses: this.numButtonPresses,
        alertType: ALERT_TYPE.BUTTONS_URGENT,
        respondedAt: this.respondedAt,
        chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY,
        incidentCategory: this.incidentCategory,
      })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return an array with one object with the correct values in it', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 1)

      expect(rows).to.eql([
        {
          id: this.session.id,
          display_name: this.button.displayName,
          incident_category: this.incidentCategory,
          num_button_presses: this.numButtonPresses,
          alert_type: ALERT_TYPE.BUTTONS_URGENT,
          created_at: this.session.createdAt,
          responded_at: this.respondedAt,
        },
      ])
    })
  })

  describe('if there are more matching sessions than maxHistoricAlerts', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single client with a two buttons and more than maxHistoricAlerts sessions
      this.alertApiKey = 'alertApiKey'
      const client = await factories.clientDBFactory(db, {
        alertApiKey: this.alertApiKey,
      })
      const button1 = await buttonDBFactory(db, {
        buttonId: '51b8be5678bf5ade9bf6a5958b2a4a45',
        clientId: client.id,
        displayName: 'unit1',
        buttonSerialNumber: 'button1',
      })
      const button2 = await buttonDBFactory(db, {
        buttonId: '1283be5678bf5ade9bf6a5958b2a4a45',
        clientId: client.id,
        displayName: 'unit2',
        buttonSerialNumber: 'button2',
      })
      this.session1 = await sessionDBFactory(db, { buttonId: button1.buttonId })
      this.session2 = await sessionDBFactory(db, { buttonId: button2.buttonId })
      this.session3 = await sessionDBFactory(db, { buttonId: button2.buttonId })
      this.session4 = await sessionDBFactory(db, { buttonId: button1.buttonId })
      this.session5 = await sessionDBFactory(db, { buttonId: button2.buttonId })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return only the most recent maxHistoricAlerts of them', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 3, 1)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session5.id, this.session4.id, this.session3.id])
    })
  })

  describe('if there are fewer matching sessions than maxHistoricAlerts', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single client with a two buttons and maxHistoricAlerts sessions
      this.alertApiKey = 'alertApiKey'
      const client = await factories.clientDBFactory(db, {
        alertApiKey: this.alertApiKey,
      })
      const button1 = await buttonDBFactory(db, {
        buttonId: '51b8be5678bf5ade9bf6a5958b2a4a45',
        clientId: client.id,
        displayName: 'unit1',
        buttonSerialNumber: 'button1',
      })
      const button2 = await buttonDBFactory(db, {
        buttonId: '1283be5678bf5ade9bf6a5958b2a4a45',
        clientId: client.id,
        displayName: 'unit2',
        buttonSerialNumber: 'button2',
      })
      this.session1 = await sessionDBFactory(db, { buttonId: button1.buttonId })
      this.session2 = await sessionDBFactory(db, { buttonId: button2.buttonId })
      await helpers.sleep(2000) // Couldn't get around doing this because there is a trigger on updated_at to keep it correct
      this.session3 = await sessionDBFactory(db, { buttonId: button2.buttonId })
      this.session4 = await sessionDBFactory(db, { buttonId: button1.buttonId })
      this.session5 = await sessionDBFactory(db, { buttonId: button2.buttonId })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return only the matches', async () => {
      // maxTimeAgoInMillis should give me a time during the sleep in the test
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 5, 1000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session2.id, this.session1.id])
    })
  })

  describe('if is a session more recent than maxTimeAgoInMillis', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single client with a one button and one session
      this.alertApiKey = 'alertApiKey'
      const client = await factories.clientDBFactory(db, {
        alertApiKey: this.alertApiKey,
      })
      const button = await buttonDBFactory(db, {
        buttonId: '51b8be5678bf5ade9bf6a5958b2a4a45',
        displayName: 'unit1',
        clientId: client.id,
      })
      this.session = await sessionDBFactory(db, {
        buttonId: button.buttonId,
      })
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('and it is COMPLETED, should return the Completed session', async () => {
      // Update the session to COMPLETED
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.COMPLETED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session.id])
    })

    it('and it is WAITING_FOR_CATEGORY, should not return it', async () => {
      // Update the session to WAITING_FOR_CATEGORY
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is WAITING_FOR_REPLY, should not return it', async () => {
      // Update the session to WAITING_FOR_REPLY
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.WAITING_FOR_REPLY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is STARTED, should not return it', async () => {
      // Update the session to STARTED
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.STARTED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })
  })
})
