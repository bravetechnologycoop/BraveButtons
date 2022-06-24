// Third-party dependencies
/* eslint-disable no-continue */
const { DateTime } = require('luxon')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')
const aws = require('./aws')

let braveAlerter

function setup(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

// Expects a JS Date object and an integer and returns a JS Date object
function subtractSeconds(date, seconds) {
  const dateTime = DateTime.fromJSDate(date)
  return dateTime.minus({ seconds }).toJSDate()
}

// Expects JS Date objects and returns an int
function differenceInSeconds(date1, date2) {
  const dateTime1 = DateTime.fromJSDate(date1)
  const dateTime2 = DateTime.fromJSDate(date2)
  return dateTime1.diff(dateTime2, 'seconds').seconds
}

function sendDisconnectionMessage(locationDescription, heartbeatAlertRecipients, responderPhoneNumbers, fromPhoneNumber) {
  const message = `The connection for ${locationDescription} Button Hub has been lost. \nPlease unplug the hub and plug it back in to reset it. If you do not receive a reconnection message shortly after doing this, contact your network administrator. \nYou can also email clientsupport@brave.coop for further support.`

  heartbeatAlertRecipients.forEach(heartbeatAlertRecipient => {
    braveAlerter.sendSingleAlert(heartbeatAlertRecipient, fromPhoneNumber, message)
  })
  responderPhoneNumbers.forEach(responderPhoneNumber => {
    braveAlerter.sendSingleAlert(responderPhoneNumber, fromPhoneNumber, message)
  })
}

function sendDisconnectionReminder(locationDescription, heartbeatAlertRecipients, responderPhoneNumbers, fromPhoneNumber) {
  const message = `${locationDescription} Button Hub is still disconnected. \nPlease unplug the hub and plug it back in to reset it. If you do not receive a reconnection message shortly after doing this, contact your network administrator. \nYou can also email clientsupport@brave.coop for further support.`

  heartbeatAlertRecipients.forEach(heartbeatAlertRecipient => {
    braveAlerter.sendSingleAlert(heartbeatAlertRecipient, fromPhoneNumber, message)
  })
  responderPhoneNumbers.forEach(responderPhoneNumber => {
    braveAlerter.sendSingleAlert(responderPhoneNumber, fromPhoneNumber, message)
  })
}

function sendReconnectionMessage(locationDescription, heartbeatAlertRecipients, responderPhoneNumbers, fromPhoneNumber) {
  const message = `${locationDescription} Button Hub has reconnected.`

  heartbeatAlertRecipients.forEach(heartbeatAlertRecipient => {
    braveAlerter.sendSingleAlert(heartbeatAlertRecipient, fromPhoneNumber, message)
  })
  responderPhoneNumbers.forEach(responderPhoneNumber => {
    braveAlerter.sendSingleAlert(responderPhoneNumber, fromPhoneNumber, message)
  })
}

async function checkHeartbeat() {
  try {
    const hubs = await db.getHubs()
    for (const hub of hubs) {
      if (hub.muted) {
        continue
      }

      const client = hub.client
      const responderPhoneNumbers = client.responderPhoneNumbers
      const currentTime = await db.getCurrentTime()
      const flicDelayinSeconds = differenceInSeconds(currentTime, hub.flicLastSeenTime)
      const piDelayinSeconds = differenceInSeconds(currentTime, hub.heartbeatLastSeenTime)
      const pingDelayinSeconds = differenceInSeconds(currentTime, hub.flicLastPingTime)
      const externalThreshold = helpers.getEnvVar('VITALS_ALERT_THRESHOLD')

      const flicInternalHeartbeatExceeded = flicDelayinSeconds > helpers.getEnvVar('LAST_SEEN_FLIC_THRESHOLD')
      const pingInternalHeartbeatExceeded = pingDelayinSeconds > helpers.getEnvVar('LAST_SEEN_PING_THRESHOLD')
      const piInternalHeartbeatExceeded = piDelayinSeconds > helpers.getEnvVar('LAST_SEEN_HEARTBEAT_THRESHOLD')

      if (flicInternalHeartbeatExceeded && !hub.sentInternalFlicAlert) {
        hub.sentInternalFlicAlert = true
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Disconnection: flic threshold exceeded for ${hub.systemName}; flic delay is ${flicDelayinSeconds} s.`)
      } else if (!flicInternalHeartbeatExceeded && hub.sentInternalFlicAlert) {
        hub.sentInternalFlicAlert = false
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Reconnection: flic back to normal for ${hub.systemName}`)
      }

      if (pingInternalHeartbeatExceeded && !hub.sentInternalPingAlert) {
        hub.sentInternalPingAlert = true
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Disconnection: ping threshold exceeded for ${hub.systemName}; ping delay is ${pingDelayinSeconds} ms.`)
      } else if (!pingInternalHeartbeatExceeded && hub.sentInternalPingAlert) {
        hub.sentInternalPingAlert = false
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Reconnection: ping back to normal for ${hub.systemName}`)
      }

      if (piInternalHeartbeatExceeded && !hub.sentInternalPiAlert) {
        helpers.logSentry(`Disconnection: heartbeat threshold exceeded for ${hub.systemName}; heartbeat delay is ${piDelayinSeconds} ms.`)
        hub.sentInternalPiAlert = true
        await db.updateSentInternalAlerts(hub)
      } else if (!piInternalHeartbeatExceeded && hub.sentInternalPiAlert) {
        hub.sentInternalPiAlert = false
        await db.updateSentInternalAlerts(hub)
        helpers.logSentry(`Reconnection: heartbeat back to normal for ${hub.systemName}`)
      }

      const externalHeartbeatExceeded =
        flicDelayinSeconds > externalThreshold || pingDelayinSeconds > externalThreshold || piDelayinSeconds > externalThreshold

      if (externalHeartbeatExceeded) {
        if (hub.sentVitalsAlertAt === null) {
          await db.updateSentAlerts(hub.systemId, true)
          sendDisconnectionMessage(hub.locationDescription, client.heartbeatPhoneNumbers, responderPhoneNumbers, client.fromPhoneNumber)
        } else if (differenceInSeconds(currentTime, hub.sentVitalsAlertAt) > helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD')) {
          await db.updateSentAlerts(hub.systemId, true)
          sendDisconnectionReminder(hub.locationDescription, client.heartbeatPhoneNumbers, responderPhoneNumbers, client.fromPhoneNumber)
        }
      } else if (hub.sentVitalsAlertAt !== null) {
        await db.updateSentAlerts(hub.systemId, false)
        sendReconnectionMessage(hub.locationDescription, client.heartbeatPhoneNumbers, responderPhoneNumbers, client.fromPhoneNumber)
      }
    }
  } catch (e) {
    helpers.logError(`Failed to check heartbeat: ${e}`)
  }
}

async function checkGatewayHeartbeat() {
  try {
    const gateways = await db.getGateways()
    for (const gateway of gateways) {
      const gatewayStats = await aws.getGatewayStats(gateway.id)
      if (gatewayStats !== null) {
        await db.logGatewaysVital(gateway.id, gatewayStats)
      }
    }
  } catch (e) {
    helpers.logError(`Failed to check gateway heartbeat: ${e}`)
  }
}

async function handleHeartbeat(req, res) {
  try {
    const currentTime = new Date(await db.getCurrentTime())
    const flicLastSeenTime = subtractSeconds(currentTime, req.body.flic_last_seen_secs)
    const flicLastPingTime = subtractSeconds(currentTime, req.body.flic_last_ping_secs)
    const heartbeatLastSeenTime = currentTime
    await db.saveHeartbeat(req.body.system_id, flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime)
    res.status(200).send()
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
}

module.exports = {
  checkGatewayHeartbeat,
  checkHeartbeat,
  handleHeartbeat,
  setup,
}
