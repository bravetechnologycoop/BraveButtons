// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { helpers } = require('brave-alert-lib')

const api = require('../../../api')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

function authorize_next() {
  helpers.log('authorize_next')
}

function mockRequest(_req) {
  const req = _req
  return req
}

function mockResponse() {
  const res = {}
  res.status = sinon.stub().returns(res)
  res.send = sinon.stub().returns(res)
  return res
}

describe('api.js unit tests: authorize', () => {
  beforeEach(() => {
    sandbox.spy(helpers, 'logSentry')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when a request provides the primary PA API key in the query string of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = mockRequest({
        query: { braveKey: helpers.getEnvVar('PA_API_KEY_PRIMARY') },
        body: {}, // empty
        path: 'test_path',
      })
      this.res = mockResponse()

      await api.authorize(req, this.res, authorize_next)
    })

    it('should call the authorize_next function', () => {
      expect(helpers.log).to.have.been.calledWith('authorize_next')
    })
  })

  describe('when a request provides the primary PA API key in the body of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = mockRequest({
        query: {}, // empty
        body: { braveKey: helpers.getEnvVar('PA_API_KEY_PRIMARY') },
        path: 'test_path',
      })
      this.res = mockResponse()

      await api.authorize(req, this.res, authorize_next)
    })

    it('should call the authorize_next function', () => {
      expect(helpers.log).to.have.been.calledWith('authorize_next')
    })
  })

  describe('when a request provides the secondary PA API key in the query string of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = mockRequest({
        query: { braveKey: helpers.getEnvVar('PA_API_KEY_SECONDARY') },
        body: {}, // empty
        path: 'test_path',
      })
      this.res = mockResponse()

      await api.authorize(req, this.res, authorize_next)
    })

    it('should call the authorize_next function', () => {
      expect(helpers.log).to.have.been.calledWith('authorize_next')
    })
  })

  describe('when a request provides the secondary PA API key in the body of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = mockRequest({
        query: {}, // empty
        body: { braveKey: helpers.getEnvVar('PA_API_KEY_SECONDARY') },
        path: 'test_path',
      })
      this.res = mockResponse()

      await api.authorize(req, this.res, authorize_next)
    })

    it('should call the authorize_next function', () => {
      expect(helpers.log).to.have.been.calledWith('authorize_next')
    })
  })

  describe('when a request provides an invalid PA API key in the query string of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = mockRequest({
        query: { braveKey: 'INVALID_API_KEY' },
        body: {}, // empty
        path: 'test_path',
      })
      this.res = mockResponse()

      await api.authorize(req, this.res, authorize_next)
    })

    it('should not call the authorize_next function', () => {
      expect(helpers.log).to.not.have.been.calledWith('authorize_next')
    })

    it('should result in status 401 (Unauthorized)', () => {
      expect(this.res.status).to.have.been.calledWith(401)
    })
  })

  describe('when a request provides an invalid PA API key in the body of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = mockRequest({
        query: {}, // empty
        body: { braveKey: 'INVALID_API_KEY' },
        path: 'test_path',
      })
      this.res = mockResponse()

      await api.authorize(req, this.res, authorize_next)
    })

    it('should not call the authorize_next function', () => {
      expect(helpers.log).to.not.have.been.calledWith('authorize_next')
    })

    it('should result in status 401 (Unauthorized)', () => {
      expect(this.res.status).to.have.been.calledWith(401)
    })
  })

  describe('when a request does not provide a PA API key at all', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = mockRequest({
        query: {}, // empty
        body: {}, // empty
        path: 'test_path',
      })
      this.res = mockResponse()

      await api.authorize(req, this.res, authorize_next)
    })

    it('should not call the authorize_next function', () => {
      expect(helpers.log).to.not.have.been.calledWith('authorize_next')
    })

    it('should result in status 401 (Unauthorized)', () => {
      expect(this.res.status).to.have.been.calledWith(401)
    })
  })

  describe('when a request provides the primary PA API key in both the query and the body', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = mockRequest({
        query: { braveKey: helpers.getEnvVar('PA_API_KEY_PRIMARY') },
        body: { braveKey: helpers.getEnvVar('PA_API_KEY_PRIMARY') },
        path: 'test_path',
      })
      this.res = mockResponse()

      await api.authorize(req, this.res, authorize_next)
    })

    it('should call the authorize_next function', () => {
      expect(helpers.log).to.have.been.calledWith('authorize_next')
    })
  })
})
