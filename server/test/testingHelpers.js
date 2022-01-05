const SessionState = require('../SessionState')
const Installation = require('../Installation')
const Hub = require('../Hub')

function createTestSessionState() {
  return new SessionState(
    'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc',
    'fakeInstallationId',
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
    overrides.installationId !== undefined ? overrides.installationId : 'fakeInstallationId',
    overrides.unit !== undefined ? overrides.unit : '305',
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+12223334444',
    overrides.buttonSerialNumber !== undefined ? overrides.buttonSerialNumber : 'AB12-12345',
  )

  return button
}

function installationFactory(overrides = {}) {
  return new Installation(
    overrides.id !== undefined ? overrides.locationid : 'fakeLocationid',
    overrides.name !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.responderPhoneNumber !== undefined ? overrides.durationTimer : '+17781234567',
    overrides.fallbackPhoneNumbers !== undefined ? overrides.fallbackNumbers : ['+13336669999'],
    overrides.incidentCategories !== undefined ? overrides.incidentCategories : ['Accidental', 'Safer Use', 'Unsafe Guest', 'Overdose', 'Other'],
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.createdAt !== undefined ? overrides.createdAt : '2021-11-04T22:28:28.0248Z',
    overrides.alertApiKey !== undefined ? overrides.alertApiKey : 'alertApiKey',
    overrides.responderPushId !== undefined ? overrides.responderPushId : 'myPushId',
  )
}

function hubFactory(overrides = {}) {
  return new Hub(
    overrides.systemId !== undefined ? overrides.locationid : 'fakeHubId',
    overrides.flicLastSeenTime !== undefined ? overrides.flicLastSeenTime : '2021-11-04T22:28:28.0248Z',
    overrides.flicLastPingTime !== undefined ? overrides.flicLastPingTime : '2021-11-04T22:28:28.0248Z',
    overrides.heartbeatLastSeenTime !== undefined ? overrides.heartbeatLastSeenTime : '2021-11-04T22:28:28.0248Z',
    overrides.systemName !== undefined ? overrides.systemName : 'fakeHubName',
    overrides.hidden !== undefined ? overrides.hidden : false,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.muted !== undefined ? overrides.muted : false,
    overrides.heartbeatAlertRecipients !== undefined ? overrides.heartbeatAlertRecipients : ['+16665552222'],
    overrides.sentInternalFlicAlert !== undefined ? overrides.sentInternalFlicAlert : false,
    overrides.sentInternalPingAlert !== undefined ? overrides.sentInternalPingAlert : false,
    overrides.sentInternalPiAlert !== undefined ? overrides.sentInternalPiAlert : false,
    overrides.locationDescription !== undefined ? overrides.locationDescription : 'fakeHubLocationDescription',
    overrides.installation !== undefined ? overrides.installation : installationFactory(),
  )
}

module.exports = {
  createTestSessionState,
  buttonDBFactory,
  hubFactory,
  installationFactory,
}
