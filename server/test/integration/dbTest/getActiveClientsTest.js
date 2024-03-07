// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories } = require('brave-alert-lib')
const db = require('../../../db/db')

// arbitrary number of active clients to generate
const nActiveClients = 10

// returns an array of client objects that are deemed active
async function dbInsertActiveClients() {
  const clients = []

  for (let index = 0; index < nActiveClients; index += 1) {
    const client = await factories.clientDBFactory(db, {
      displayName: `Active Client ${index}`,
      isSendingAlerts: true,
      isSendingVitals: true,
    })

    // create a button for this client that is sending alerts and vitals
    await factories.buttonDBFactory(db, {
      clientId: client.id,
      displayName: `Active Client Button ${index}`,
      serialNumber: `active-client-button-${index}`,
      isSendingAlerts: true,
      isSendingVitals: true,
    })

    clients.push(client)
  }

  return clients
}

// returns an array of client objects that are deemed inactive
async function dbInsertInactiveClients() {
  const inactiveClientsOptions = [
    // a client is inactive if it has no buttons, regardless of whether the client is sending alerts or vitals
    { clientIsSendingAlerts: false, clientIsSendingVitals: false, clientHasButton: false },
    { clientIsSendingAlerts: false, clientIsSendingVitals: true, clientHasButton: false },
    { clientIsSendingAlerts: true, clientIsSendingVitals: false, clientHasButton: false },
    { clientIsSendingAlerts: true, clientIsSendingVitals: true, clientHasButton: false },

    // a client is inactive if it isn't sending alerts or vitals and has a button,
    // regardless of whether the button is sending alerts or vitals
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: false,
      clientHasButton: true,
      buttonIsSendingAlerts: false,
      buttonIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: false,
      clientHasButton: true,
      buttonIsSendingAlerts: false,
      buttonIsSendingVitals: true,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: false,
      clientHasButton: true,
      buttonIsSendingAlerts: true,
      buttonIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: false,
      clientHasButton: true,
      buttonIsSendingAlerts: true,
      buttonIsSendingVitals: true,
    },

    // a client is inactive if it isn't sending alerts, is sending vitals, and has a button,
    // regardless of whether the button is sending alerts or vitals
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: true,
      clientHasButton: true,
      buttonIsSendingAlerts: false,
      buttonIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: true,
      clientHasButton: true,
      buttonIsSendingAlerts: false,
      buttonIsSendingVitals: true,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: true,
      clientHasButton: true,
      buttonIsSendingAlerts: true,
      buttonIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: true,
      clientHasButton: true,
      buttonIsSendingAlerts: true,
      buttonIsSendingVitals: true,
    },

    // a client is inactive if it is sending alerts, isn't sending vitals, and has a button,
    // regardless of whether the button is sending alerts or vitals
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: false,
      clientHasButton: true,
      buttonIsSendingAlerts: false,
      buttonIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: false,
      clientHasButton: true,
      buttonIsSendingAlerts: false,
      buttonIsSendingVitals: true,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: false,
      clientHasButton: true,
      buttonIsSendingAlerts: true,
      buttonIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: false,
      clientHasButton: true,
      buttonIsSendingAlerts: true,
      buttonIsSendingVitals: true,
    },

    // a client is inactive if it is sending alerts and vitals
    // and has a button that isn't sending alerts and vitals
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: true,
      clientHasButton: true,
      buttonIsSendingAlerts: false,
      buttonIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: true,
      clientHasButton: true,
      buttonIsSendingAlerts: false,
      buttonIsSendingVitals: true,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: true,
      clientHasButton: true,
      buttonIsSendingAlerts: true,
      buttonIsSendingVitals: false,
    },
  ]

  const clients = []

  for (let index = 0; index < inactiveClientsOptions.length; index += 1) {
    const options = inactiveClientsOptions[index]

    const client = await factories.clientDBFactory(db, {
      displayName: `Inactive Client ${index}`,
      isSendingAlerts: options.clientIsSendingAlerts,
      isSendingVitals: options.clientIsSendingVitals,
    })

    if (options.clientHasButton) {
      // create a button for this client that is sending alerts and vitals
      await factories.buttonDBFactory(db, {
        clientId: client.id,
        displayName: `Inactive Client Button ${index}`,
        serialNumber: `inactive-client-button-${index}`,
        isSendingAlerts: options.buttonIsSendingAlerts,
        isSendingVitals: options.buttonIsSendingVitals,
      })
    }

    clients.push(client)
  }

  return clients
}

describe('db.js integration tests: getActiveClients', () => {
  beforeEach(async () => {
    // ensure database is empty before starting each case
    await db.clearTables()
  })

  afterEach(async () => {
    await db.clearTables()
  })

  describe('if there are no clients', () => {
    beforeEach(async () => {
      this.clients = await db.getActiveClients()
    })

    it('should return an empty array', async () => {
      expect(this.clients).to.deep.equal([])
    })
  })

  describe('if there are only active clients', () => {
    beforeEach(async () => {
      this.activeClients = await dbInsertActiveClients()
      this.clients = await db.getActiveClients()
    })

    it('should return all of and only the active clients', async () => {
      expect(this.clients).to.deep.equal(this.activeClients)
    })
  })

  describe('if there are only inactive clients', () => {
    beforeEach(async () => {
      this.inactiveClients = await dbInsertInactiveClients()
      this.clients = await db.getActiveClients()
    })

    it('should return an empty array', async () => {
      expect(this.clients).to.deep.equal([])
    })

    it('should not return any of the inactive clients', async () => {
      expect(this.clients).to.not.have.members(this.inactiveClients)
    })
  })

  describe('if there are active and inactive clients', () => {
    beforeEach(async () => {
      this.activeClients = await dbInsertActiveClients()
      this.inactiveClients = await dbInsertInactiveClients()
      this.clients = await db.getActiveClients()
    })

    it('should return all of and only the active clients', async () => {
      expect(this.clients).to.deep.equal(this.activeClients)
    })

    it('should not return any of the inactive clients', async () => {
      expect(this.clients).to.not.have.members(this.inactiveClients)
    })
  })
})
