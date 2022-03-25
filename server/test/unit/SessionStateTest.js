const chai = require('chai')

const expect = chai.expect
const describe = require('mocha').describe
const it = require('mocha').it

const { sessionFactory } = require('../testingHelpers.js')

describe('SessionState.js unit tests: ', () => {
  describe('incrementButtonPresses', () => {
    it('should increment the number of button presses by 1', () => {
      const session = sessionFactory({
        numPresses: 4,
      })

      session.incrementButtonPresses(1)

      expect(session.numPresses).to.equal(4 + 1)
    })

    it('should increment the number of button presses by more than 1', () => {
      const session = sessionFactory({
        numPresses: 4,
      })

      session.incrementButtonPresses(3)

      expect(session.numPresses).to.equal(4 + 3)
    })
  })

  describe('updateBatteryLevel', () => {
    it('should update the button battery level', () => {
      const session = sessionFactory({
        buttonBatteryLevel: 20,
      })

      session.updateBatteryLevel(45)

      expect(session.buttonBatteryLevel).to.equal(45)
    })
  })
})
