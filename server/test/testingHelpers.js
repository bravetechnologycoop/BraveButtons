const SessionState = require('../SessionState')
const Client = require('../Client')
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

async function clientDBFactory(db, overrides = {}) {
  const client = await db.createClient(
    overrides.displayName !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.responderPhoneNumber !== undefined ? overrides.responderPhoneNumber : '+17781234567',
    overrides.fallbackPhoneNumbers !== undefined ? overrides.fallbackPhoneNumbers : ['+13336669999'],
    overrides.incidentCategories !== undefined ? overrides.incidentCategories : ['Accidental', 'Safer Use', 'Unsafe Guest', 'Overdose', 'Other'],
    overrides.alertApiKey !== undefined ? overrides.alertApiKey : 'alertApiKey',
    overrides.responderPushId !== undefined ? overrides.responderPushId : 'myPushId',
  )

  return client
}

function clientFactory(overrides = {}) {
  return new Client(
    overrides.id !== undefined ? overrides.id : 'fakeLocationid',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.responderPhoneNumber !== undefined ? overrides.responderPhoneNumber : '+17781234567',
    overrides.fallbackPhoneNumbers !== undefined ? overrides.fallbackPhoneNumbers : ['+13336669999'],
    overrides.incidentCategories !== undefined ? overrides.incidentCategories : ['Accidental', 'Safer Use', 'Unsafe Guest', 'Overdose', 'Other'],
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.createdAt !== undefined ? overrides.createdAt : new Date('2021-11-04T22:28:28.0248Z'),
    overrides.alertApiKey !== undefined ? overrides.alertApiKey : 'alertApiKey',
    overrides.responderPushId !== undefined ? overrides.responderPushId : 'myPushId',
    overrides.updatedAt !== undefined ? overrides.updatedAt : new Date('2021-11-05T02:02:22.234Z'),
  )
}

function hubFactory(overrides = {}) {
  return new Hub(
    overrides.systemId !== undefined ? overrides.systemId : 'fakeHubId',
    overrides.flicLastSeenTime !== undefined ? overrides.flicLastSeenTime : new Date('2021-11-04T22:28:28.0248Z'),
    overrides.flicLastPingTime !== undefined ? overrides.flicLastPingTime : new Date('2021-11-04T22:28:28.0248Z'),
    overrides.heartbeatLastSeenTime !== undefined ? overrides.heartbeatLastSeenTime : new Date('2021-11-04T22:28:28.0248Z'),
    overrides.systemName !== undefined ? overrides.systemName : 'fakeHubName',
    overrides.hidden !== undefined ? overrides.hidden : false,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.muted !== undefined ? overrides.muted : false,
    overrides.heartbeatAlertRecipients !== undefined ? overrides.heartbeatAlertRecipients : ['+16665552222'],
    overrides.sentInternalFlicAlert !== undefined ? overrides.sentInternalFlicAlert : false,
    overrides.sentInternalPingAlert !== undefined ? overrides.sentInternalPingAlert : false,
    overrides.sentInternalPiAlert !== undefined ? overrides.sentInternalPiAlert : false,
    overrides.locationDescription !== undefined ? overrides.locationDescription : 'fakeHubLocationDescription',
    overrides.client !== undefined ? overrides.client : clientFactory(),
  )
}

module.exports = {
  createTestSessionState,
  buttonDBFactory,
  clientDBFactory,
  clientFactory,
  hubFactory,
}
