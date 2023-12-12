// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const { mockResponse } = require('../../testingHelpers')
const pa = require('../../../pa')
const db = require('../../../db/db')

const testGoogleIdToken = 'google-id-token'
const braveKey = helpers.getEnvVar('PA_API_KEY_PRIMARY')

use(sinonChai)
const sandbox = sinon.createSandbox()

describe('pa.js unit tests: handleCheckDatabaseConnection', () => {
  beforeEach(() => {
    this.res = mockResponse(sandbox)
    sandbox.spy(helpers, 'logError')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('for a valid request where the database function successfully returns a client', () => {
    beforeEach(async () => {
      sandbox.stub(db, 'getCurrentTimeForHealthCheck').returns('2023-12-11 12:34:56.789+00')
      await pa.handleCheckDatabaseConnection(
        {
          body: { braveKey, googleIdToken: testGoogleIdToken },
        },
        this.res,
      )
    })
    it('should respond with status 200', () => {
      expect(this.res.status).to.be.calledWith(200)
    })
  })

  describe('for an request with an invalid braveKey', () => {
    beforeEach(async () => {
      sandbox.stub(db, 'getCurrentTimeForHealthCheck')
      await pa.handleCheckDatabaseConnection(
        {
          body: { braveKey: 'invalidKey', googleIdToken: testGoogleIdToken },
        },
        this.res,
      )
    })
    it('should respond with status 401', () => {
      expect(this.res.status).to.be.calledWith(401)
    })
  })

  describe('for a valid request where an error occurs during database access', () => {
    beforeEach(async () => {
      sandbox.stub(db, 'getCurrentTimeForHealthCheck').rejects(new Error('fake error'))
      await pa.handleCheckDatabaseConnection(
        {
          body: { braveKey, googleIdToken: testGoogleIdToken },
        },
        this.res,
      )
    })
    it('should log the error', () => {
      expect(helpers.logError).to.be.called
    })
    it('should respond with status 503', () => {
      expect(this.res.status).to.be.calledWith(503)
    })
  })
})
