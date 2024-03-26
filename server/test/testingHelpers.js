// In-house dependencies
const { factories } = require('brave-alert-lib')
const ButtonsVital = require('../ButtonsVital')
const Gateway = require('../Gateway')
const GatewaysVital = require('../GatewaysVital')

function buttonsVitalFactory(overrides = {}) {
  return new ButtonsVital(
    overrides.id !== undefined ? overrides.id : '',
    overrides.batteryLevel !== undefined ? overrides.batteryLevel : 95,
    overrides.createdAt !== undefined ? overrides.createdAt : new Date(),
    overrides.snr !== undefined ? overrides.snr : 14.5,
    overrides.rssi !== undefined ? overrides.rssi : -60,
    overrides.device !== undefined ? overrides.device : factories.buttonFactory(),
  )
}

function gatewayFactory(overrides = {}) {
  return new Gateway(
    overrides.id !== undefined ? overrides.id : 'f92eab3b-99e1-4abf-8a98-783fc1b18218',
    overrides.displayName !== undefined ? overrides.displayName : 'My Fake Gateway',
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
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

function mockResponse(sandbox) {
  const res = {}

  res.writeHead = sandbox.stub().returns(res)
  res.status = sandbox.stub().returns(res)

  // for more rigorous testing, res.body will be
  // set to the arguments to res.json and res.send
  res.body = {}

  res.json = sandbox.stub().callsFake(json => {
    res.body = json

    return res
  })

  res.send = sandbox.stub().callsFake(data => {
    res.body = data

    return res
  })

  return res
}

module.exports = {
  buttonsVitalFactory,
  gatewayFactory,
  gatewaysVitalFactory,
  mockResponse,
}
