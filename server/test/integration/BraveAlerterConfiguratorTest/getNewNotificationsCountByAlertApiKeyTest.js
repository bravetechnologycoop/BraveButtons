// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

describe('BraveAlerterConfigurator.js integration tests: getNewNotificationsCountByAlertApiKey', () => {
  beforeEach(async () => {
    await db.clearTables()

    this.alertApiKey = '00000000-000000000000001'
    const client = await factories.clientDBFactory(db, {
      displayName: '',
      responderPhoneNumbers: '{}',
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
