// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const db = require('../../../db/db.js')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

describe('BraveAlerterConfigurator.js integration tests: getNewNotificationsCountByAlertApiKey', () => {
  beforeEach(async () => {
    await db.clearSessions()
    await db.clearNotifications()
    await db.clearInstallations()

    this.alertApiKey = '00000000-000000000000001'
    await db.createInstallation('', '', '{}', '{}', this.alertApiKey)
    const installations = await db.getInstallations()
    this.installationId = installations[0].id

    // 3 new notifications and 1 acknowledged notification
    await db.createNotification(this.installationId, 'subject', 'body', false)
    await db.createNotification(this.installationId, 'subject', 'body', false)
    await db.createNotification(this.installationId, 'subject', 'body', false)
    await db.createNotification(this.installationId, 'subject', 'body', true)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    this.braveAlerter = braveAlerterConfigurator.createBraveAlerter()
  })

  afterEach(async () => {
    await db.clearSessions()
    await db.clearNotifications()
    await db.clearInstallations()
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
