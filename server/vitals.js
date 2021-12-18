/* eslint-disable no-continue */
const Mustache = require('mustache')
const { differenceInSeconds, sub } = require('date-fns')
const { helpers } = require('brave-alert-lib')
const db = require('./db/db.js')

let braveAlerter
let heartbeatDashboardTemplate

function setupVitals(braveAlerterObj, heartbeatDashboardTemplateObj) {
  braveAlerter = braveAlerterObj
  heartbeatDashboardTemplate = heartbeatDashboardTemplateObj
}

function sendDisconnectionMessage(locationDescription, heartbeatAlertRecipients, responderPhoneNumber) {
  const message = `The connection for ${locationDescription} Button Hub has been lost. \nPlease unplug the hub and plug it back in to reset it. If you do not receive a reconnection message shortly after doing this, contact your network administrator. \nYou can also email contact@brave.coop for further support.`
  const fromPhoneNumber = helpers.getEnvVar('TWILIO_HEARTBEAT_FROM_NUMBER')

  heartbeatAlertRecipients.forEach(heartbeatAlertRecipient => {
    braveAlerter.sendSingleAlert(heartbeatAlertRecipient, fromPhoneNumber, message)
  })
  braveAlerter.sendSingleAlert(responderPhoneNumber, fromPhoneNumber, message)
}

function sendDisconnectionReminder(locationDescription, heartbeatAlertRecipients, responderPhoneNumber) {
  const message = `${locationDescription} Button Hub is still disconnected. \nPlease unplug the hub and plug it back in to reset it. If you do not receive a reconnection message shortly after doing this, contact your network administrator. \nYou can also email contact@brave.coop for further support.`
  const fromPhoneNumber = helpers.getEnvVar('TWILIO_HEARTBEAT_FROM_NUMBER')

  heartbeatAlertRecipients.forEach(heartbeatAlertRecipient => {
    braveAlerter.sendSingleAlert(heartbeatAlertRecipient, fromPhoneNumber, message)
  })
  braveAlerter.sendSingleAlert(responderPhoneNumber, fromPhoneNumber, message)
}

function sendReconnectionMessage(locationDescription, heartbeatAlertRecipients, responderPhoneNumber) {
  const message = `${locationDescription} Button Hub has reconnected.`
  const fromPhoneNumber = helpers.getEnvVar('TWILIO_HEARTBEAT_FROM_NUMBER')

  heartbeatAlertRecipients.forEach(heartbeatAlertRecipient => {
    braveAlerter.sendSingleAlert(heartbeatAlertRecipient, fromPhoneNumber, message)
  })
  braveAlerter.sendSingleAlert(responderPhoneNumber, fromPhoneNumber, message)
}

async function checkHeartbeat() {
  try {
    const hubs = await db.getHubs()
    for (const hub of hubs) {
      if (hub.muted) {
        continue
      }

      const installation = hub.installation
      const responderPhoneNumber = installation.responderPhoneNumber
      const currentTime = await db.getCurrentTime()
      const flicDelayinSeconds = differenceInSeconds(currentTime, new Date(hub.flicLastSeenTime))
      const piDelayinSeconds = differenceInSeconds(currentTime, new Date(hub.heartbeatLastSeenTime))
      const pingDelayinSeconds = differenceInSeconds(currentTime, new Date(hub.flicLastPingTime))
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
          sendDisconnectionMessage(hub.locationDescription, hub.heartbeatAlertRecipients, responderPhoneNumber)
        } else if (differenceInSeconds(currentTime, hub.sentVitalsAlertAt) > helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD')) {
          await db.updateSentAlerts(hub.systemId, true)
          sendDisconnectionReminder(hub.locationDescription, hub.heartbeatAlertRecipients, responderPhoneNumber)
        }
      } else if (hub.sentVitalsAlertAt !== null) {
        await db.updateSentAlerts(hub.systemId, false)
        sendReconnectionMessage(hub.locationDescription, hub.heartbeatAlertRecipients, responderPhoneNumber)
      }
    }
  } catch (e) {
    helpers.logError(`Failed to check heartbeat: ${e}`)
  }
}

async function handleHeartbeatDashboard(req, res) {
  let hubs = []
  try {
    hubs = await db.getHubs()
  } catch (e) {
    helpers.logError(`Failed to get hubs in /heartbeatDashboard: ${JSON.stringify(e)}`)
  }

  const viewParams = {
    domain: helpers.getEnvVar('DOMAIN'),
    dashboard_render_time: await db.getCurrentTime(),
    systems: [],
  }
  const currentTime = await db.getCurrentTime()

  for (const hub of hubs) {
    if (hub.hidden) {
      continue
    }

    const flicLastSeenTime = hub.flicLastSeenTime
    let flicLastSeenSecs = (currentTime - flicLastSeenTime) / 1000.0
    flicLastSeenSecs = Math.round(flicLastSeenSecs)

    const heartbeatLastSeenTime = hub.heartbeatLastSeenTime
    let heartbeatLastSeenSecs = (currentTime - heartbeatLastSeenTime) / 1000.0
    heartbeatLastSeenSecs = Math.round(heartbeatLastSeenSecs)

    const flicLastPingTime = hub.flicLastPingTime
    let flicLastPingSecs = (currentTime - flicLastPingTime) / 1000.0
    flicLastPingSecs = Math.round(flicLastPingSecs)

    viewParams.systems.push({
      system_name: hub.systemName,
      location_description: hub.locationDescription,
      flic_last_seen: `${flicLastSeenSecs.toString()} seconds ago`,
      flic_last_ping: `${flicLastPingSecs.toString()} seconds ago`,
      heartbeat_last_seen: `${heartbeatLastSeenSecs.toString()} seconds ago`,
      muted: hub.muted ? 'Y' : 'N',
    })
  }

  const htmlString = Mustache.render(heartbeatDashboardTemplate, viewParams)
  res.send(htmlString)
}

async function handleHeartbeat(req, res) {
  try {
    const currentTime = new Date(await db.getCurrentTime())
    const flicLastSeenTime = sub(currentTime, { seconds: req.body.flic_last_seen_secs })
    const flicLastPingTime = sub(currentTime, { seconds: req.body.flic_last_ping_secs })
    const heartbeatLastSeenTime = currentTime
    await db.saveHeartbeat(req.body.system_id, flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime)
    res.status(200).send()
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
}

module.exports = {
  checkHeartbeat,
  setupVitals,
  handleHeartbeat,
  handleHeartbeatDashboard,
}