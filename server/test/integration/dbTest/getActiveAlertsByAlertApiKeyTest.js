// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const { CHATBOT_STATE, ALERT_TYPE } = require('brave-alert-lib')

// In-house dependencies
const db = require('../../../db/db.js')
const SessionState = require('../../../SessionState.js')

describe('db.js integration tests: getActiveAlertsByAlertApiKey', () => {
  describe('if there are no installations with the given Alert API Key', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single installation with a single button that has a single session that doesn't match the Alert API Key that we ask for
      await db.createInstallation('name', 'responderNumber', '{"fallbackNumber"}', '{"cat1","cat2"}', 'alertApiKey', 'pushId')
      const installationId = (await db.getInstallations())[0].id
      const buttonId = '51b8be5678bf5ade9bf6a5958b2a4a45'
      await db.createButton(buttonId, installationId, 'unit', 'phoneNumber', 'serialNumber')
      await db.createSession(installationId, buttonId, 'unit', 'phoneNumber', 5, 95, new Date())
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return an empty array', async () => {
      const rows = await db.getActiveAlertsByAlertApiKey('not alertApiKey', 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there are no sessions for the installation with the given Alert API Key', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single installation with a single button that has a single session that doesn't match the Alert API Key that we ask for
      await db.createInstallation('name', 'responderNumber', '{"fallbackNumber"}', '{"cat1"}', 'not our API key', 'pushId')
      const installationId = (await db.getInstallations())[0].id
      const buttonId = '51b8be5678bf5ade9bf6a5958b2a4a45'
      await db.createButton(buttonId, installationId, 'unit', 'phoneNumber', 'serialNumber')
      await db.createSession(installationId, buttonId, 'unit', 'phoneNumber', 5, 95, new Date())

      // Insert a single installation with no sessions that matches the Alert API Key that we ask for
      this.alertApiKey = 'alertApiKey'
      await db.createInstallation('name', 'responderNumber', '{"fallbackNumber"}', '{"cat1"}', this.alertApiKey)
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return an empty array', async () => {
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there is one matching session', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single installation with a single button
      this.alertApiKey = 'alertApiKey'
      await db.createInstallation('name', 'responderNumber', '{"fallbackNumber"}', '{"cat1","cat2"}', this.alertApiKey, 'pushId')
      this.installationId = (await db.getInstallations())[0].id
      this.buttonId = '51b8be5678bf5ade9bf6a5958b2a4a45'
      this.unit = 'unit1'
      await db.createButton(this.buttonId, this.installationId, this.unit, 'phoneNumber1', 'serialNumber1')

      // Insert a single session for that API key
      this.incidentType = ALERT_TYPE.BUTTONS_URGENT
      this.numPresses = 6
      this.respondedAt = new Date('2021-01-20T06:20:19.000Z')
      this.session = await db.createSession(this.installationId, this.buttonId, this.unit, 'phoneNumber', this.numPresses, 95, this.respondedAt)
      await db.saveSession(
        new SessionState(
          this.session.id,
          this.session.installationId,
          this.session.buttonId,
          this.session.unit,
          this.session.phoneNumber,
          CHATBOT_STATE.WAITING_FOR_CATEGORY,
          this.numPresses,
          this.session.createdAt,
          new Date(),
          null,
          '',
          '',
          this.session.buttonBatteryLevel,
          this.respondedAt,
        ),
      )
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('should return an array with one object with the correct values in it', async () => {
      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      expect(rows).to.eql([
        {
          id: this.session.id,
          state: CHATBOT_STATE.WAITING_FOR_CATEGORY,
          unit: this.unit,
          num_presses: this.numPresses,
          incident_categories: ['cat1', 'cat2'],
          created_at: this.session.createdAt,
        },
      ])
    })
  })

  describe('if the session was more recent than maxTimeAgoInMillis', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single installation with a one button and one session
      this.alertApiKey = 'alertApiKey'
      await db.createInstallation('name', 'responderNumber', '{"fallbackNumber"}', '{"cat1"}', this.alertApiKey, 'pushId')
      const installationId = (await db.getInstallations())[0].id
      const buttonId = '51b8be5678bf5ade9bf6a5958b2a4a45'
      const unit = 'unit1'
      await db.createButton(buttonId, installationId, unit, 'phoneNumber1', 'serialNumber1')
      this.session = await db.createSession(installationId, buttonId, unit, 'phoneNumber', '1', 95, new Date('2021-01-20T06:20:19.000Z'))
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('and it is COMPLETED, should not return it', async () => {
      // Update the session to COMPLETED
      const updatedSession = { ...this.session }
      updatedSession.state = CHATBOT_STATE.COMPLETED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is WAITING_FOR_CATEGORY, should return the session', async () => {
      // Update the session to WAITING_FOR_CATEGORY
      const updatedSession = { ...this.session }
      updatedSession.state = CHATBOT_STATE.WAITING_FOR_CATEGORY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session.id])
    })

    it('and it is WAITING_FOR_REPLY, should return the session', async () => {
      // Update the session to WAITING_FOR_REPLY
      const updatedSession = { ...this.session }
      updatedSession.state = CHATBOT_STATE.WAITING_FOR_REPLY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session.id])
    })

    it('and it is STARTED, should return the session', async () => {
      // Update the session to STARTED
      const updatedSession = { ...this.session }
      updatedSession.state = CHATBOT_STATE.STARTED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session.id])
    })
  })

  describe('if the session was longer ago than maxTimeAgoInMillis', () => {
    beforeEach(async () => {
      await db.clearTables()

      // Insert a single installation with a one button and one session
      this.alertApiKey = 'alertApiKey'
      await db.createInstallation('name', 'responderNumber', '{"fallbackNumber"}', '{"cat1"}', this.alertApiKey, 'pushId')
      const installationId = (await db.getInstallations())[0].id
      const buttonId = '51b8be5678bf5ade9bf6a5958b2a4a45'
      const unit = 'unit1'
      await db.createButton(buttonId, installationId, unit, 'phoneNumber1', 'serialNumber1')
      this.session = await db.createSession(installationId, buttonId, unit, 'phoneNumber', '1', 95, new Date('2021-01-20T06:20:19.000Z'))
    })

    afterEach(async () => {
      await db.clearTables()
    })

    it('and it is COMPLETED, should not return it', async () => {
      // Update the session to COMPLETED
      const updatedSession = { ...this.session }
      updatedSession.state = CHATBOT_STATE.COMPLETED
      await db.saveSession(updatedSession)

      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 1)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is WAITING_FOR_CATEGORY, should not return it', async () => {
      // Update the session to WAITING_FOR_CATEGORY
      const updatedSession = { ...this.session }
      updatedSession.state = CHATBOT_STATE.WAITING_FOR_CATEGORY
      await db.saveSession(updatedSession)

      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 1)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is WAITING_FOR_REPLY, should not return it', async () => {
      // Update the session to WAITING_FOR_REPLY
      const updatedSession = { ...this.session }
      updatedSession.state = CHATBOT_STATE.WAITING_FOR_REPLY
      await db.saveSession(updatedSession)

      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 1)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is STARTED, should not return it', async () => {
      // Update the session to STARTED
      const updatedSession = { ...this.session }
      updatedSession.state = CHATBOT_STATE.STARTED
      await db.saveSession(updatedSession)

      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 1)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })
  })
})
