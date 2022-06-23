// In-house dependencies
const { factories, CHATBOT_STATE } = require('brave-alert-lib')
const Session = require('../Session')
const Hub = require('../Hub')

function sessionFactory(overrides = {}) {
  return new Session(
    overrides.id !== undefined ? overrides.id : 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc',
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.buttonId !== undefined ? overrides.buttonId : 'fakeButtonId',
    overrides.unit !== undefined ? overrides.unit : 'fakeUnit',
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '18885554444',
    overrides.state !== undefined ? overrides.state : CHATBOT_STATE.COMPLETED,
    overrides.numPresses !== undefined ? overrides.numPresses : 1,
    overrides.incidentType !== undefined ? overrides.incidentType : '1',
    overrides.buttonBatteryLevel !== undefined ? overrides.buttonBatteryLevel : 100,
    overrides.respondedAt !== undefined ? overrides.respondedAt : new Date('2000-06-06T00:53:53.000Z'),
    overrides.createdAt !== undefined ? overrides.createdAt : 'fakeCreatedAt',
    overrides.updatedAt !== undefined ? overrides.updatedAt : 'fakeUpdatedAt',
  )
}

async function sessionDBFactory(db, overrides = {}) {
  const session = await db.createSession(
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.buttonId !== undefined ? overrides.buttonId : 'fakeButtonId',
    overrides.unit !== undefined ? overrides.unit : 'fakeUnit',
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+18885554444',
    overrides.state !== undefined ? overrides.state : CHATBOT_STATE.STARTED,
    overrides.numPresses !== undefined ? overrides.numPresses : 1,
    overrides.incidentType !== undefined ? overrides.incidentType : null,
    overrides.buttonBatteryLevel !== undefined ? overrides.buttonBatteryLevel : null,
    overrides.respondedAt !== undefined ? overrides.respondedAt : new Date('2000-06-06T00:53:53.000Z'),
  )

  return session
}

async function buttonDBFactory(db, overrides = {}) {
  const button = await db.createButton(
    overrides.buttonId !== undefined ? overrides.buttonId : 'fakeButtonId',
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.displayName !== undefined ? overrides.displayName : 'Unit 305',
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
  buttonDBFactory,
  hubFactory,
  sessionDBFactory,
  sessionFactory,
}
