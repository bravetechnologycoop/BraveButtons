// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const { Location, SYSTEM } = require('brave-alert-lib')
const db = require('../../../db/db.js')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')
const Installation = require('../../../Installation.js')

// Configure Chai
use(sinonChai)

describe('BraveAlerterConfigurator.js unit tests: getLocationByApiKey', () => {
  beforeEach(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    this.braveAlerter = braveAlerterConfigurator.createBraveAlerter()
  })

  afterEach(() => {
    db.getInstallationsWithApiKey.restore()
  })

  it('if there is single installation with the given API key, returns a location with its display name and the Buttons system', async () => {
    const apiKey = 'fakeApiKey'
    const displayName = 'fakeDisplayName'

    const installationToReturn = new Installation()
    installationToReturn.apiKey = apiKey
    installationToReturn.name = displayName
    sinon.stub(db, 'getInstallationsWithApiKey').returns([installationToReturn])

    const expectedLocation = new Location(displayName, SYSTEM.BUTTONS)

    const actualLocation = await this.braveAlerter.getLocationByApiKey(apiKey)

    expect(actualLocation).to.eql(expectedLocation)
  })

  it("if there are multiple installations with the given API key, returns a location with the first installation's display name and the Buttons system", async () => {
    const apiKey = 'fakeApiKey'
    const displayName = 'fakeDisplayName'

    const installation1 = new Installation()
    installation1.apiKey = apiKey
    installation1.name = displayName

    const installation2 = new Installation()
    installation2.apiKey = apiKey
    installation2.name = 'aDifferentDisplayName'
    sinon.stub(db, 'getInstallationsWithApiKey').returns([installation1, installation2])

    const expectedLocation = new Location(displayName, SYSTEM.BUTTONS)

    const actualLocation = await this.braveAlerter.getLocationByApiKey(apiKey)

    expect(actualLocation).to.eql(expectedLocation)
  })

  it('if there no installations with the given API key, returns null', async () => {
    sinon.stub(db, 'getInstallationsWithApiKey').returns([])

    const actualLocation = await this.braveAlerter.getLocationByApiKey('apiKey')

    expect(actualLocation).to.be.null
  })

  it('if db.getLocationByApiKey returns a non-array, returns null', async () => {
    sinon.stub(db, 'getInstallationsWithApiKey').returns()

    const actualLocation = await this.braveAlerter.getLocationByApiKey('apiKey')

    expect(actualLocation).to.be.null
  })
})
