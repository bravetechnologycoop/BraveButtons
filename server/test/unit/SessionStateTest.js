const chai = require('chai')

const expect = chai.expect
const beforeEach = require('mocha').beforeEach
const describe = require('mocha').describe
const it = require('mocha').it

const { sessionFactory } = require('../testingHelpers')

describe('Session class', () => {
  let state

  beforeEach(() => {
    state = sessionFactory({
      numPresses: 1,
    })
  })

  it('should start off with 1 button press', () => {
    expect(state).to.have.property('numPresses')
    expect(state.numPresses).to.deep.equal(1)
  })

  it('should increment properly', () => {
    state.incrementButtonPresses(1)
    expect(state.numPresses).to.deep.equal(2)
    state.incrementButtonPresses(2)
    expect(state.numPresses).to.deep.equal(4)
  })
})
