/* eslint-disable import/no-extraneous-dependencies */
const chai = require('chai')

const expect = chai.expect
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { helpers } = require('brave-alert-lib')

chai.use(sinonChai)

const db = require('../db/db.js')
const { createTestSessionState } = require('./testingHelpers')

describe('DB', () => {
  describe('getUnrespondedSessionWithButtonId', () => {
    describe('when not given a client', () => {
      describe('if an error is thrown while trying to get a DB client from the pool', () => {
        beforeEach(() => {
          sinon.stub(helpers, 'log')
          this.pool = db.getPool()
          sinon.stub(this.pool, 'connect').rejects
        })

        afterEach(() => {
          helpers.log.restore()
          this.pool.connect.restore()
        })

        it('should log the error', async () => {
          await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(helpers.log).to.be.calledWithMatch('Error running the getUnrespondedSessionWithButtonId query:')
        })

        it('should log that it could not release the client', async () => {
          await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(helpers.log).to.be.calledWithMatch('getUnrespondedSessionWithButtonId: Error releasing client:')
        })

        it('should not do any other logging', async () => {
          await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(helpers.log).to.be.calledTwice
        })

        it('should return null', async () => {
          const returnValue = await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(returnValue).to.be.null
        })
      })

      describe('if an error is thrown during a database query', () => {
        beforeEach(() => {
          sinon.stub(helpers, 'log')
          this.client = {
            query: sinon.stub().rejects,
            release: sinon.stub(),
          }
          this.pool = db.getPool()
          sinon.stub(this.pool, 'connect').returns(this.client)
        })

        afterEach(() => {
          helpers.log.restore()
          this.pool.connect.restore()
        })

        it('should log the error', async () => {
          await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(helpers.log).to.be.calledWithMatch('Error running the getUnrespondedSessionWithButtonId query:')
        })

        it('should not do any other logging', async () => {
          await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(helpers.log).to.be.calledOnce
        })

        it('should release the client', async () => {
          await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(this.client.release).to.be.called
        })

        it('should return null', async () => {
          const returnValue = await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(returnValue).to.be.null
        })
      })

      describe('if there is one unresponded session with the given buttonId', () => {
        beforeEach(() => {
          sinon.stub(helpers, 'log')
          this.client = {
            query: sinon.stub().resolves({
              rows: [
                {
                  id: 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc',
                  installation_id: 'fakeInstallationId',
                  button_id: 'fakeButtonId',
                  unit: 'fakeUnit',
                  phone_number: 'fakePhone',
                  state: 'fakeState',
                  num_presses: 'fakeNumPresses',
                  created_at: 'fakeCreatedAt',
                  updated_at: 'fakeUpdatedAt',
                  incident_type: '1',
                  notes: 'fakeNotes',
                  fallback_alert_twilio_status: 'fakeFallbackTwilioState',
                  button_battery_level: null,
                },
              ],
            }),
            release: sinon.stub(),
          }
          this.pool = db.getPool()
          sinon.stub(this.pool, 'connect').returns(this.client)
        })

        afterEach(() => {
          helpers.log.restore()
          this.pool.connect.restore()
        })

        it('should not log anything', async () => {
          await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(helpers.log).not.to.be.called
        })

        it('should release the client', async () => {
          await db.getUnrespondedSessionWithButtonId('fakeButtonId')
          expect(this.client.release).to.have.been.calledOnce
        })

        it('should return a SessionState with the values returned from the query', async () => {
          const expected = createTestSessionState()
          const actual = await db.getUnrespondedSessionWithButtonId('fakeButtonId')

          expect(actual).to.eql(expected)
        })
      })
    })
  })

  describe('when given a client', () => {
    describe('if an error is thrown during a database query', () => {
      beforeEach(() => {
        sinon.stub(helpers, 'log')

        this.pool = db.getPool()
        sinon.stub(this.pool, 'connect')

        this.client = {
          query: sinon.stub().rejects,
          release: sinon.stub(),
        }
      })

      afterEach(() => {
        helpers.log.restore()
        this.pool.connect.restore()
      })

      it('should log the error', async () => {
        await db.getUnrespondedSessionWithButtonId('fakeButtonId', this.client)
        expect(helpers.log).to.be.calledWithMatch('Error running the getUnrespondedSessionWithButtonId query:')
      })

      it('should not do any other logging', async () => {
        await db.getUnrespondedSessionWithButtonId('fakeButtonId', this.client)
        expect(helpers.log).to.be.calledOnce
      })

      it('should not try to get a client from the pool', async () => {
        await db.getUnrespondedSessionWithButtonId('fakeButtonId', this.client)
        expect(this.pool.connect).not.to.have.been.called
      })

      it('should not try to release the client', async () => {
        await db.getUnrespondedSessionWithButtonId('fakeButtonId', this.client)
        expect(this.client.release).not.to.have.been.called
      })

      it('should return null', async () => {
        const returnValue = await db.getUnrespondedSessionWithButtonId('fakeButtonId', this.client)
        expect(returnValue).to.be.null
      })
    })

    describe('if there is one unresponded session with the given buttonId', () => {
      beforeEach(() => {
        sinon.stub(helpers, 'log')
        this.client = {
          query: sinon.stub().resolves({
            rows: [
              {
                id: 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc',
                installation_id: 'fakeInstallationId',
                button_id: 'fakeButtonId',
                unit: 'fakeUnit',
                phone_number: 'fakePhone',
                state: 'fakeState',
                num_presses: 'fakeNumPresses',
                created_at: 'fakeCreatedAt',
                updated_at: 'fakeUpdatedAt',
                incident_type: '1',
                notes: 'fakeNotes',
                fallback_alert_twilio_status: 'fakeFallbackTwilioState',
                button_battery_level: null,
              },
            ],
          }),
          release: sinon.stub(),
        }
        this.pool = db.getPool()
        sinon.stub(this.pool, 'connect')
      })

      afterEach(() => {
        helpers.log.restore()
        this.pool.connect.restore()
      })

      it('should not log anything', async () => {
        await db.getUnrespondedSessionWithButtonId('fakeButtonId', this.client)
        expect(helpers.log).not.to.be.called
      })

      it('should not try to release the client', async () => {
        await db.getUnrespondedSessionWithButtonId('fakeButtonId', this.client)
        expect(this.client.release).not.to.have.been.calledOnce
      })

      it('should return a SessionState with the values returned from the query', async () => {
        const expected = createTestSessionState()
        const actual = await db.getUnrespondedSessionWithButtonId('fakeButtonId', this.client)

        expect(actual).to.eql(expected)
      })
    })
  })
})
