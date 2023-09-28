// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { CHATBOT_STATE, factories, helpers } = require('brave-alert-lib')
const buttonAlerts = require('../../../buttonAlerts')
const db = require('../../../db/db')
const { buttonFactory, sessionFactory } = require('../../testingHelpers')

use(sinonChai)

const sandbox = sinon.createSandbox()

describe('buttonAlerts.js unit tests: handleValidRequest', () => {
  /* eslint-disable no-underscore-dangle */
  beforeEach(() => {
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')

    sandbox.stub(db, 'beginTransaction')
    sandbox.stub(db, 'getCurrentTime')
    sandbox.stub(db, 'saveSession')
    sandbox.stub(db, 'commitTransaction')
    sandbox.stub(db, 'rollbackTransaction')

    this.startAlertSessionStub = sandbox.stub()
    this.sendAlertSessionUpdateStub = sandbox.stub()
    buttonAlerts.setup({
      startAlertSession: this.startAlertSessionStub,
      sendAlertSessionUpdate: this.sendAlertSessionUpdateStub,
    })
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('given a button that is sending alerts and whose client is sending alerts', () => {
    beforeEach(async () => {
      this.button = buttonFactory({
        sentLowBatteryAlertAt: null,
        isSendingAlerts: true,
        client: factories.clientFactory({ isSendingAlerts: true }),
      })

      sandbox.stub(db, 'createSession').returns(sessionFactory({ numButtonPresses: 1, button: this.button }))
    })

    describe('when the button is pressed for the first time', async () => {
      beforeEach(async () => {
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(null)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: true`,
        )
      })

      it('should start a session', async () => {
        expect(db.createSession).to.be.calledWith(this.button.id, CHATBOT_STATE.STARTED, 1, null, null, null)
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should start an alert session', async () => {
        expect(this.startAlertSessionStub).to.be.called // TODO add exact argument
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the the second time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 1, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: true`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should update the session', async () => {
        this.session.numButtonPresses = 2
        this.session.buttonBatteryLevel = 75
        expect(db.saveSession).to.be.calledWith(this.session)
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).to.be.called // TODO add exact parameters
      })
    })

    describe('when the button is pressed for the the third time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 2, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: true`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should update the session', async () => {
        this.session.numButtonPresses = 3
        this.session.buttonBatteryLevel = 90
        expect(db.saveSession).to.be.calledWith(this.session)
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the multiple of 5 time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 14, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: true`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should update the session', async () => {
        this.session.numButtonPresses = 15
        this.session.buttonBatteryLevel = 95
        expect(db.saveSession).to.be.calledWith(this.session)
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).to.be.called // TODO add exact parameters
      })
    })
  })

  describe('given a button that is not sending alerts and whose client is sending alerts', () => {
    beforeEach(async () => {
      this.button = buttonFactory({
        sentLowBatteryAlertAt: null,
        isSendingAlerts: false,
        client: factories.clientFactory({ isSendingAlerts: true }),
      })

      sandbox.stub(db, 'createSession').returns(sessionFactory({ numButtonPresses: 1, button: this.button }))
    })

    describe('when the button is pressed for the first time', async () => {
      beforeEach(async () => {
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(null)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the the second time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 1, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the the third time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 2, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the multiple of 5 time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 14, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })
  })

  describe('given a button that is sending alerts but whose client is not sending alerts', () => {
    beforeEach(async () => {
      this.button = buttonFactory({
        sentLowBatteryAlertAt: null,
        isSendingAlerts: true,
        client: factories.clientFactory({ isSendingAlerts: false }),
      })

      sandbox.stub(db, 'createSession').returns(sessionFactory({ numButtonPresses: 1, button: this.button }))
    })

    describe('when the button is pressed for the first time', async () => {
      beforeEach(async () => {
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(null)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the the second time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 1, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the the third time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 2, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the multiple of 5 time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 14, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })
  })

  describe('given a button that is not sending alerts and whose client is also not sending alerts', () => {
    beforeEach(async () => {
      this.button = buttonFactory({
        sentLowBatteryAlertAt: null,
        isSendingAlerts: false,
        client: factories.clientFactory({ isSendingAlerts: true }),
      })

      sandbox.stub(db, 'createSession').returns(sessionFactory({ numButtonPresses: 1, button: this.button }))
    })

    describe('when the button is pressed for the first time', async () => {
      beforeEach(async () => {
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(null)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the the second time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 1, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the the third time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 2, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })

    describe('when the button is pressed for the multiple of 5 time', async () => {
      beforeEach(async () => {
        this.session = sessionFactory({ numButtonPresses: 14, button: this.button })
        sandbox.stub(db, 'getUnrespondedSessionWithButtonId').returns(this.session)

        await buttonAlerts.handleValidRequest(this.button, 1)
      })

      it('should log the button press', async () => {
        expect(helpers.log).to.be.calledWithExactly(
          `id: ${this.button.id.toString()} SerialNumber: ${
            this.button.buttonSerialNumber
          } Unit: ${this.button.displayName.toString()} Presses: 1 Is Sending Alerts?: false`,
        )
      })

      it('should not start a session', async () => {
        expect(db.createSession).not.to.be.called
      })

      it('should not update the session', async () => {
        expect(db.saveSession).not.to.be.called
      })

      it('should not start an alert session', async () => {
        expect(this.startAlertSessionStub).not.to.be.called
      })

      it('should not send an alert session update', async () => {
        expect(this.sendAlertSessionUpdateStub).not.to.be.called
      })
    })
  })
})