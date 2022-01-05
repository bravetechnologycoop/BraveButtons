// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const { Location, SYSTEM } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const Client = require('../../../Client')
const { clientFactory } = require('../../testingHelpers')

// Configure Chai
use(sinonChai)

describe('BraveAlerterConfigurator.js unit tests: getLocationByAlertApiKey', () => {
  beforeEach(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    this.braveAlerter = braveAlerterConfigurator.createBraveAlerter()
  })

  afterEach(() => {
    db.getClientsWithAlertApiKey.restore()
  })

  it('if there is single client with the given API key, returns a location with its display name and the Buttons system', async () => {
    const alertApiKey = 'fakeApiKey'
    const displayName = 'fakeDisplayName'

    const clientToReturn = new Client()
    clientToReturn.alertApiKey = alertApiKey
    clientToReturn.displayName = displayName
    sinon.stub(db, 'getClientsWithAlertApiKey').returns([clientToReturn])

    const expectedLocation = new Location(displayName, SYSTEM.BUTTONS)

    const actualLocation = await this.braveAlerter.getLocationByAlertApiKey(alertApiKey)

    expect(actualLocation).to.eql(expectedLocation)
  })

  it("if there are multiple clients with the given API key, returns a location with the first client's display name and the Buttons system", async () => {
    const alertApiKey = 'fakeApiKey'
    const displayName = 'fakeDisplayName'

    const client1 = clientFactory({
      alertApiKey,
      displayName,
    })

    const client2 = clientFactory({
      alertApiKey,
      displayName: 'aDifferentDisplayName',
    })
    sinon.stub(db, 'getClientsWithAlertApiKey').returns([client1, client2])

    const expectedLocation = new Location(displayName, SYSTEM.BUTTONS)

    const actualLocation = await this.braveAlerter.getLocationByAlertApiKey(alertApiKey)

    expect(actualLocation).to.eql(expectedLocation)
  })

  it('if there no clients with the given API key, returns null', async () => {
    sinon.stub(db, 'getClientsWithAlertApiKey').returns([])

    const actualLocation = await this.braveAlerter.getLocationByAlertApiKey('alertApiKey')

    expect(actualLocation).to.be.null
  })

  it('if db.getLocationByAlertApiKey returns a non-array, returns null', async () => {
    sinon.stub(db, 'getClientsWithAlertApiKey').returns()

    const actualLocation = await this.braveAlerter.getLocationByAlertApiKey('alertApiKey')

    expect(actualLocation).to.be.null
  })
})
