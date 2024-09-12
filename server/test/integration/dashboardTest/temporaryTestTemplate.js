// Third-party dependencies
const chai = require('chai');
const sinon = require('sinon');
const { beforeEach, afterEach, describe, it } = require('mocha');

// In-house dependencies
const { factories, helpers } = require('../../../factories/factories');
const db = require('../../../db/db');
const { submitUpdateClient } = require('../../../controllers/clientController');

// Setup chai
const expect = chai.expect;

// Global variables for stubbing/mocking
const sandbox = sinon.createSandbox();

describe('Integration Tests: submitUpdateClient', () => {
  let req, res, existingClient;

  beforeEach(async () => {
    // Spy on helper methods
    sandbox.spy(helpers, 'log');
    sandbox.spy(helpers, 'logError');

    // Clear database tables
    await db.clearTables();

    // Create an existing client using the factory
    existingClient = await factories.clientDBFactory(db);

    // Setup request and response mocks
    req = {
      session: { user: { id: 'user123' } },
      cookies: { user_sid: 'someSessionId' },
      body: {
        displayName: 'New Display Name',
        fromPhoneNumber: '+17549553216',
        responderPhoneNumbers: '+18885554444',
        fallbackPhoneNumbers: '+12223334444',
        heartbeatPhoneNumbers: '+14445556666',
        incidentCategories: 'Category1,Category2',
        reminderTimeout: 5,
        fallbackTimeout: 10,
        isDisplayed: true,
        isSendingAlerts: true,
        isSendingVitals: true,
        language: 'en',
      },
      params: { id: existingClient.id },
    };

    res = {
      status: sandbox.stub().returnsThis(),
      send: sandbox.stub(),
      redirect: sandbox.stub(),
    };
  });

  afterEach(() => {
    sandbox.restore();
    return db.clearTables();
  });

  describe('Valid Request', () => {
    beforeEach(async () => {
      // Call the submitUpdateClient function
      await submitUpdateClient(req, res);
    });

    it('should return status 200 and update the client', async () => {
      expect(res.redirect).to.have.been.calledWith(`/clients/${existingClient.id}`);
      const updatedClient = await db.getClientWithClientId(existingClient.id);
      expect(updatedClient.displayName).to.equal('New Display Name');
      expect(updatedClient.responderPhoneNumbers).to.deep.equal(['+18885554444']);
    });

    it('should log success message', () => {
      expect(helpers.log).to.have.been.calledWith(`Client 'New Display Name' successfully updated`);
    });
  });

  describe('Duplicate Client Display Name', () => {
    beforeEach(async () => {
      // Insert another client with the same display name
      await factories.clientDBFactory(db, { displayName: 'New Display Name' });

      // Call the submitUpdateClient function
      await submitUpdateClient(req, res);
    });

    it('should return status 409', () => {
      expect(res.status).to.have.been.calledWith(409);
      expect(res.send).to.have.been.calledWith('Client Display Name already exists: New Display Name');
    });

    it('should log the conflict error', () => {
      expect(helpers.log).to.have.been.calledWith('Client Display Name already exists: New Display Name');
    });
  });

  describe('Unauthorized Access', () => {
    beforeEach(async () => {
      // Simulate unauthorized user
      req.session.user = null;
      req.cookies.user_sid = null;

      await submitUpdateClient(req, res);
    });

    it('should return status 401', () => {
      expect(res.status).to.have.been.calledWith(401);
      expect(res.send).to.have.been.called;
    });

    it('should log an unauthorized access error', () => {
      expect(helpers.logError).to.have.been.calledWith('Unauthorized');
    });
  });

  describe('Validation Errors', () => {
    beforeEach(async () => {
      // Modify request to have invalid fields
      req.body.displayName = '';  // Invalid empty field

      await submitUpdateClient(req, res);
    });

    it('should return status 400 for validation errors', () => {
      expect(res.status).to.have.been.calledWith(400);
      expect(res.send).to.have.been.called;
    });

    it('should log validation error', () => {
      expect(helpers.log).to.have.been.calledWith(`Bad request to /clients/${existingClient.id}: displayName (Invalid value)`);
    });
  });

  describe('Server Error Handling', () => {
    beforeEach(async () => {
      // Stub a database error
      sandbox.stub(db, 'updateClient').throws(new Error('Database error'));

      await submitUpdateClient(req, res);
    });

    it('should return status 500 for server errors', () => {
      expect(res.status).to.have.been.calledWith(500);
    });

    it('should log the server error', () => {
      expect(helpers.logError).to.have.been.calledWith(`Error calling /clients/${existingClient.id}: Error: Database error`);
    });
  });
});
