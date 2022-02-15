// In-house dependencies
const { factories } = require('brave-alert-lib')
const SessionState = require('../SessionState')
const Hub = require('../Hub')

function createTestSessionState() {
  return new SessionState(
    'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc',
    'fakeClientId',
    'fakeButtonId',
    'fakeUnit',
    'fakePhone',
    'fakeState',
    'fakeNumPresses',
    'fakeCreatedAt',
    'fakeUpdatedAt',
    '1',
    'fakeNotes',
    'fakeFallbackTwilioState',
    null,
    new Date('2000-06-06T00:53:53.000Z'),
  )
}

async function buttonDBFactory(db, overrides = {}) {
  const button = await db.createButton(
    overrides.buttonId !== undefined ? overrides.buttonId : 'fakeButtonId',
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.unit !== undefined ? overrides.unit : '305',
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+12223334444',
    overrides.buttonSerialNumber !== undefined ? overrides.buttonSerialNumber : 'AB12-12345',
  )

  return button
}

function hubFactory(overrides = {}) {
  return new Hub(
    overrides.systemId !== undefined ? overrides.systemId : 'fakeHubId',
    overrides.flicLastSeenTime !== undefined ? overrides.flicLastSeenTime : new Date('2021-11-04T22:28:28.0248Z'),
    overrides.flicLastPingTime !== undefined ? overrides.flicLastPingTime : new Date('2021-11-04T22:28:28.0248Z'),
    overrides.heartbeatLastSeenTime !== undefined ? overrides.heartbeatLastSeenTime : new Date('2021-11-04T22:28:28.0248Z'),
    overrides.systemName !== undefined ? overrides.systemName : 'fakeHubName',
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.muted !== undefined ? overrides.muted : false,
    overrides.sentInternalFlicAlert !== undefined ? overrides.sentInternalFlicAlert : false,
    overrides.sentInternalPingAlert !== undefined ? overrides.sentInternalPingAlert : false,
    overrides.sentInternalPiAlert !== undefined ? overrides.sentInternalPiAlert : false,
    overrides.locationDescription !== undefined ? overrides.locationDescription : 'fakeHubLocationDescription',
    overrides.client !== undefined ? overrides.client : factories.clientFactory(),
  )
}

module.exports = {
  createTestSessionState,
  buttonDBFactory,
  hubFactory,
}
