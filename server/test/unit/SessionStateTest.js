const chai = require('chai')

const expect = chai.expect
const beforeEach = require('mocha').beforeEach
const describe = require('mocha').describe
const it = require('mocha').it

const { sessionFactory } = require('../testingHelpers')

describe('Session class', () => {
  let session

  beforeEach(() => {
    session = sessionFactory({
      numButtonPresses: 1,
    })
  })

  it('should start off with 1 button press', () => {
    expect(session).to.have.property('numButtonPresses')
    expect(session.numButtonPresses).to.deep.equal(1)
  })

  it('should increment properly', () => {
    session.incrementButtonPresses(1)
    expect(session.numButtonPresses).to.deep.equal(2)
    session.incrementButtonPresses(2)
    expect(session.numButtonPresses).to.deep.equal(4)
  })
})
