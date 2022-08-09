// In-house dependencies
const { factories, CHATBOT_STATE, ALERT_TYPE } = require('brave-alert-lib')
const Session = require('../Session')
const Hub = require('../Hub')
const Button = require('../Button')
const Gateway = require('../Gateway')
const GatewaysVital = require('../GatewaysVital')
const ButtonsVital = require('../ButtonsVital')

function buttonFactory(overrides = {}) {
  return new Button(
    overrides.id !== undefined ? overrides.id : 'fakeId',
    overrides.displayName !== undefined ? overrides.displayName : 'Unit 305',
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+12223334444',
    overrides.createdAt !== undefined ? overrides.createdAt : new Date(),
    overrides.updatedAt !== undefined ? overrides.updatedAt : new Date(),
    overrides.buttonSerialNumber !== undefined ? overrides.buttonSerialNumber : 'AB12-12345',
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : null,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.client !== undefined ? overrides.client : factories.clientFactory(),
  )
}

async function buttonDBFactory(db, overrides = {}) {
  const button = await db.createButton(
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.displayName !== undefined ? overrides.displayName : 'Unit 305',
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+12223334444',
    overrides.buttonSerialNumber !== undefined ? overrides.buttonSerialNumber : 'AB12-12345',
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : null,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
  )

  return button
}

function buttonsVitalFactory(overrides = {}) {
  return new ButtonsVital(
    overrides.id !== undefined ? overrides.id : '',
    overrides.batteryLevel !== undefined ? overrides.batteryLevel : 95,
    overrides.createdAt !== undefined ? overrides.createdAt : new Date(),
    overrides.button !== undefined ? overrides.button : buttonFactory(),
  )
}

function sessionFactory(overrides = {}) {
  return new Session(
    overrides.id !== undefined ? overrides.id : 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc',
    overrides.chatbotState !== undefined ? overrides.chatbotState : CHATBOT_STATE.COMPLETED,
    overrides.alertType !== undefined ? overrides.alertType : ALERT_TYPE.BUTTONS_NOT_URGENT,
    overrides.numButtonPresses !== undefined ? overrides.numButtonPresses : 1,
    overrides.createdAt !== undefined ? overrides.createdAt : 'fakeCreatedAt',
    overrides.updatedAt !== undefined ? overrides.updatedAt : 'fakeUpdatedAt',
    overrides.incidentCategory !== undefined ? overrides.incidentCategory : '1',
    overrides.buttonBatteryLevel !== undefined ? overrides.buttonBatteryLevel : 100,
    overrides.respondedAt !== undefined ? overrides.respondedAt : new Date('2000-06-06T00:53:53.000Z'),
    overrides.respondedByPhoneNumber !== undefined ? overrides.respondedByPhoneNumber : '+19995554444',
    overrides.button !== undefined ? overrides.button : buttonFactory(),
  )
}

async function sessionDBFactory(db, overrides = {}) {
  const session = await db.createSession(
    overrides.buttonId !== undefined ? overrides.buttonId : 'fakeButtonId',
    overrides.chatbotState !== undefined ? overrides.chatbotState : CHATBOT_STATE.STARTED,
    overrides.numButtonPresses !== undefined ? overrides.numButtonPresses : 1,
    overrides.incidentCategory !== undefined ? overrides.incidentCategory : null,
    overrides.buttonBatteryLevel !== undefined ? overrides.buttonBatteryLevel : null,
    overrides.respondedAt !== undefined ? overrides.respondedAt : new Date('2000-06-06T00:53:53.000Z'),
    overrides.respondedByPhoneNumber !== undefined ? overrides.respondedByPhoneNumber : '+14448885555',
  )

  return session
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

function gatewayFactory(overrides = {}) {
  return new Gateway(
    overrides.id !== undefined ? overrides.id : 'f92eab3b-99e1-4abf-8a98-783fc1b18218',
    overrides.displayName !== undefined ? overrides.displayName : 'My Fake Gateway',
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.createdAt !== undefined ? overrides.createdAt : new Date('2022-01-04T22:28:28.0248Z'),
    overrides.updatedAt !== undefined ? overrides.updatedAt : new Date('2022-01-04T22:28:28.0248Z'),
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : new Date('2021-11-04T22:28:28.0248Z'),
    overrides.client !== undefined ? overrides.client : factories.clientFactory(),
  )
}

function gatewaysVitalFactory(overrides = {}) {
  return new GatewaysVital(
    overrides.id !== undefined ? overrides.id : '',
    overrides.lastSeenAt !== undefined ? overrides.lastSeenAt : new Date(),
    overrides.createdAt !== undefined ? overrides.createdAt : new Date(),
    overrides.gateway !== undefined ? overrides.gateway : gatewayFactory(),
  )
}

module.exports = {
  buttonDBFactory,
  buttonFactory,
  buttonsVitalFactory,
  gatewayFactory,
  gatewaysVitalFactory,
  hubFactory,
  sessionDBFactory,
  sessionFactory,
}
