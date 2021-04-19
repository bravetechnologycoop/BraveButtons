// Third-party dependencies
const { expect } = require('chai')
const { describe, it } = require('mocha')

// In-house dependencies
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

describe('BraveAlerterConfigurator.js unit tests: createBraveAlerter', () => {
  it('returns a BraveAlerter', () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()

    expect(braveAlerter.constructor.name).to.equal('BraveAlerter')
  })
})
