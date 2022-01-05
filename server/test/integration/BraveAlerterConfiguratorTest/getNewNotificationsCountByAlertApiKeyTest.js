// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const { clientDBFactory } = require('../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getNewNotificationsCountByAlertApiKey', () => {
  beforeEach(async () => {
    await db.clearTables()

    this.alertApiKey = '00000000-000000000000001'
    const client = await clientDBFactory(db, {
      displayName: '',
      responderPhoneNumber: '',
      fallbackPhoneNumbers: '{}',
      incidentCategories: '{}',
      alertApiKey: this.alertApiKey,
    })

    // 3 new notifications and 1 acknowledged notification
    await db.createNotification(client.id, 'subject', 'body', false)
    await db.createNotification(client.id, 'subject', 'body', false)
    await db.createNotification(client.id, 'subject', 'body', false)
    await db.createNotification(client.id, 'subject', 'body', true)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    this.braveAlerter = braveAlerterConfigurator.createBraveAlerter()
  })

  afterEach(async () => {
    await db.clearTables()
  })

  it('should properly count notifications that match the api key ', async () => {
    const count = await this.braveAlerter.getNewNotificationsCountByAlertApiKey(this.alertApiKey)
    expect(count).to.eql(3)
  })

  it('should not count notifications that do not match the api key', async () => {
    const count = await this.braveAlerter.getNewNotificationsCountByAlertApiKey('00000000-000000000000000')
    expect(count).to.eql(0)
  })
})
