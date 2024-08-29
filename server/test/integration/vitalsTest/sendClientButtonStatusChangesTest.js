// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')

// In-house dependencies
const { factories, twilioHelpers } = require('brave-alert-lib')

const vitals = rewire('../../../vitals')

use(sinonChai)

const sandbox = sinon.createSandbox()

// eslint-disable-next-line no-underscore-dangle
const sendClientButtonStatusChanges = vitals.__get__('sendClientButtonStatusChanges')

const fromPhoneNumber = '+12360000000'

describe('vitals.js integration tests: sendClientButtonStatusChanges', () => {
  beforeEach(() => {
    sandbox.stub(twilioHelpers, 'sendTwilioMessage')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('given three English clients with disconnected buttons, reconnected buttons, and disconnected+reconnected buttons', () => {
    beforeEach(() => {
      this.clientA = factories.clientFactory({
        id: 'ClientA',
        displayName: 'Client A',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+16040000000', '+16041111111'],
        responderPhoneNumbers: ['+16042222222'],
        language: 'en',
      })
      this.clientB = factories.clientFactory({
        id: 'ClientB',
        displayName: 'Client B',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+17780000000', '+17781111111'],
        responderPhoneNumbers: ['+17782222222'],
        language: 'en',
      })
      this.clientC = factories.clientFactory({
        id: 'ClientC',
        displayName: 'Client C',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+12500000000', '+12501111111'],
        responderPhoneNumbers: ['+12502222222'],
        language: 'en',
      })

      sendClientButtonStatusChanges({
        ClientA: { client: this.clientA, disconnectedButtons: ['ButtonA', 'ButtonB'], reconnectedButtons: [] },
        ClientB: { client: this.clientB, disconnectedButtons: [], reconnectedButtons: ['ButtonA', 'ButtonB'] },
        ClientC: { client: this.clientC, disconnectedButtons: ['ButtonA'], reconnectedButtons: ['ButtonB'] },
      })
    })

    it("should send the correct message to the first client's heartbeat and responder phone numbers", () => {
      const recipients = [...this.clientA.heartbeatPhoneNumbers, ...this.clientA.responderPhoneNumbers]
      recipients.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          phoneNumber,
          fromPhoneNumber,
          'There were connection changes for the buttons at Client A. The following buttons have disconnected: ButtonA, ButtonB.',
        )
      })
    })

    it("should send the correct message to the second client's heartbeat phone numbers", () => {
      const recipients = [...this.clientB.heartbeatPhoneNumbers, ...this.clientB.responderPhoneNumbers]
      recipients.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          phoneNumber,
          fromPhoneNumber,
          'There were connection changes for the buttons at Client B. The following buttons have reconnected: ButtonA, ButtonB.',
        )
      })
    })

    it("should send the correct message to the third client's heartbeat phone numbers", () => {
      const recipients = [...this.clientC.heartbeatPhoneNumbers, ...this.clientC.responderPhoneNumbers]
      recipients.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          phoneNumber,
          fromPhoneNumber,
          'There were connection changes for the buttons at Client C. The following buttons have disconnected: ButtonA. The following buttons have reconnected: ButtonB.',
        )
      })
    })

    it('should send exactly nine messages', () => {
      expect(twilioHelpers.sendTwilioMessage).to.have.callCount(9)
    })
  })

  describe('given three Spanish clients with disconnected buttons, reconnected buttons, and disconnected+reconnected buttons', () => {
    beforeEach(() => {
      this.clientA = factories.clientFactory({
        id: 'ClientA',
        displayName: 'Client A',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+16040000000', '+16041111111'],
        responderPhoneNumbers: ['+16042222222'],
        language: 'es_us',
      })
      this.clientB = factories.clientFactory({
        id: 'ClientB',
        displayName: 'Client B',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+17780000000', '+17781111111'],
        responderPhoneNumbers: ['+17782222222'],
        language: 'es_us',
      })
      this.clientC = factories.clientFactory({
        id: 'ClientC',
        displayName: 'Client C',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+12500000000', '+12501111111'],
        responderPhoneNumbers: ['+12502222222'],
        language: 'es_us',
      })

      sendClientButtonStatusChanges({
        ClientA: { client: this.clientA, disconnectedButtons: ['ButtonA', 'ButtonB'], reconnectedButtons: [] },
        ClientB: { client: this.clientB, disconnectedButtons: [], reconnectedButtons: ['ButtonA', 'ButtonB'] },
        ClientC: { client: this.clientC, disconnectedButtons: ['ButtonA'], reconnectedButtons: ['ButtonB'] },
      })
    })

    it("should send the correct message to the first client's heartbeat phone numbers", () => {
      const recipients = [...this.clientA.heartbeatPhoneNumbers, ...this.clientA.responderPhoneNumbers]
      recipients.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          phoneNumber,
          fromPhoneNumber,
          'Ha habido cambios de conexión para los Buttons en Client A. Los siguientes Buttons se han desconectado: ButtonA, ButtonB.',
        )
      })
    })

    it("should send the correct message to the second client's heartbeat phone numbers", () => {
      const recipients = [...this.clientB.heartbeatPhoneNumbers, ...this.clientB.responderPhoneNumbers]
      recipients.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          phoneNumber,
          fromPhoneNumber,
          'Ha habido cambios de conexión para los Buttons en Client B. Los siguientes Buttons se han vuelto a conectar: ButtonA, ButtonB.',
        )
      })
    })

    it("should send the correct message to the third client's heartbeat phone numbers", () => {
      const recipients = [...this.clientC.heartbeatPhoneNumbers, ...this.clientC.responderPhoneNumbers]
      recipients.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          phoneNumber,
          fromPhoneNumber,
          'Ha habido cambios de conexión para los Buttons en Client C. Los siguientes Buttons se han desconectado: ButtonA. Los siguientes Buttons se han vuelto a conectar: ButtonB.',
        )
      })
    })

    it('should send exactly nine messages', () => {
      expect(twilioHelpers.sendTwilioMessage).to.have.callCount(9)
    })
  })

  describe('given three French clients with disconnected buttons, reconnected buttons, and disconnected+reconnected buttons', () => {
    beforeEach(() => {
      this.clientA = factories.clientFactory({
        id: 'ClientA',
        displayName: 'Client A',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+16040000000', '+16041111111'],
        responderPhoneNumbers: ['+16042222222'],
        language: 'en_fr_bilingual',
      })
      this.clientB = factories.clientFactory({
        id: 'ClientB',
        displayName: 'Client B',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+17780000000', '+17781111111'],
        responderPhoneNumbers: ['+17782222222'],
        language: 'en_fr_bilingual',
      })
      this.clientC = factories.clientFactory({
        id: 'ClientC',
        displayName: 'Client C',
        fromPhoneNumber,
        heartbeatPhoneNumbers: ['+12500000000', '+12501111111'],
        responderPhoneNumbers: ['+12502222222'],
        language: 'en_fr_bilingual',
      })

      sendClientButtonStatusChanges({
        ClientA: { client: this.clientA, disconnectedButtons: ['ButtonA', 'ButtonB'], reconnectedButtons: [] },
        ClientB: { client: this.clientB, disconnectedButtons: [], reconnectedButtons: ['ButtonA', 'ButtonB'] },
        ClientC: { client: this.clientC, disconnectedButtons: ['ButtonA'], reconnectedButtons: ['ButtonB'] },
      })
    })

    it("should send the correct message to the first client's heartbeat phone numbers", () => {
      const recipients = [...this.clientA.heartbeatPhoneNumbers, ...this.clientA.responderPhoneNumbers]
      recipients.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          phoneNumber,
          fromPhoneNumber,
          'Des modifications de connexion ont été apportées aux Buttons de Client A. Les Buttons suivants ont été déconnectés: ButtonA, ButtonB.\n---\nThere has been connection changes for the buttons at Client A. The following buttons have disconnected: ButtonA, ButtonB.',
        )
      })
    })

    it("should send the correct message to the second client's heartbeat phone numbers", () => {
      const recipients = [...this.clientB.heartbeatPhoneNumbers, ...this.clientB.responderPhoneNumbers]
      recipients.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          phoneNumber,
          fromPhoneNumber,
          'Des modifications de connexion ont été apportées aux Buttons de Client B. Les Buttons suivants ont été reconnectés: ButtonA, ButtonB.\n---\nThere has been connection changes for the buttons at Client B. The following buttons have reconnected: ButtonA, ButtonB.',
        )
      })
    })

    it("should send the correct message to the third client's heartbeat phone numbers", () => {
      const recipients = [...this.clientC.heartbeatPhoneNumbers, ...this.clientC.responderPhoneNumbers]
      recipients.forEach(phoneNumber => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(
          phoneNumber,
          fromPhoneNumber,
          'Des modifications de connexion ont été apportées aux Buttons de Client C. Les Buttons suivants ont été déconnectés: ButtonA. Les Buttons suivants ont été reconnectés: ButtonB.\n---\nThere has been connection changes for the buttons at Client C. The following buttons have disconnected: ButtonA. The following buttons have reconnected: ButtonB.',
        )
      })
    })

    it('should send exactly nine messages', () => {
      expect(twilioHelpers.sendTwilioMessage).to.have.callCount(9)
    })
  })
})
