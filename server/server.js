/* eslint-disable no-continue */
const fs = require('fs')
const Validator = require('express-validator')
const express = require('express')
const https = require('https')
const moment = require('moment-timezone')
const bodyParser = require('body-parser')

const jsonBodyParser = bodyParser.json()
const cookieParser = require('cookie-parser')
const session = require('express-session')
const Mustache = require('mustache')
const helpers = require('brave-alert-lib').helpers

const BraveAlerterConfigurator = require('./BraveAlerterConfigurator.js')
const db = require('./db/db.js')

const FLIC_THRESHOLD_MILLIS = 210 * 1000
const HEARTBEAT_THRESHOLD_MILLIS = 75 * 1000
const PING_THRESHOLD_MILLIS = 320 * 1000

const app = express()

const unrespondedSessionReminderTimeoutMillis = helpers.getEnvVar('REMINDER_TIMEOUT_MS')
const unrespondedSessionAlertTimeoutMillis = helpers.getEnvVar('FALLBACK_TIMEOUT_MS')

const heartbeatDashboardTemplate = fs.readFileSync(`${__dirname}/heartbeatDashboard.mst`, 'utf-8')
const chatbotDashboardTemplate = fs.readFileSync(`${__dirname}/chatbotDashboard.mst`, 'utf-8')

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname))

// Configure BraveAlerter
const braveAlerter = new BraveAlerterConfigurator().createBraveAlerter()

// Add BraveAlerter's routes ( /alert/* )
app.use(braveAlerter.getRouter())

async function needToSendButtonPressMessageForSession(currentSession) {
  return currentSession.numPresses === 1 || currentSession.numPresses === 2 || currentSession.numPresses % 5 === 0
}

async function sendButtonPressMessageForSession(currentSession, client) {
  const installation = await db.getInstallationWithInstallationId(currentSession.installationId, client)

  if (currentSession.numPresses === 1) {
    const alertInfo = {
      sessionId: currentSession.id,
      toPhoneNumber: installation.responderPhoneNumber,
      fromPhoneNumber: currentSession.phoneNumber,
      message: `There has been a request for help from Unit ${currentSession.unit.toString()} . Please respond "Ok" when you have followed up on the call.`,
      reminderTimeoutMillis: unrespondedSessionReminderTimeoutMillis,
      fallbackTimeoutMillis: unrespondedSessionAlertTimeoutMillis,
      reminderMessage:
        'Please Respond "Ok" if you have followed up on your call. If you do not respond within 2 minutes an emergency alert will be issued to staff.',
      fallbackMessage: `There has been an unresponded request at ${installation.name} unit ${currentSession.unit.toString()}`,
      fallbackToPhoneNumber: installation.fallbackPhoneNumber,
      fallbackFromPhoneNumber: helpers.getEnvVar('TWILIO_FALLBACK_FROM_NUMBER'),
    }
    braveAlerter.startAlertSession(alertInfo)
  } else if (currentSession.numPresses % 5 === 0 || currentSession.numPresses === 2) {
    braveAlerter.sendSingleAlert(
      installation.responderPhoneNumber,
      currentSession.phoneNumber,
      `This in an urgent request. The button has been pressed ${currentSession.numPresses.toString()} times. Please respond "Ok" when you have followed up on the call.`,
    )
  }
}

async function handleValidRequest(button, numPresses, batteryLevel) {
  helpers.log(
    `UUID: ${button.button_id.toString()} SerialNumber: ${
      button.button_serial_number
    } Unit: ${button.unit.toString()} Presses: ${numPresses.toString()} BatteryLevel: ${batteryLevel}`,
  )

  const client = await db.beginTransaction()

  let unrespondedSession = await db.getUnrespondedSessionWithButtonId(button.button_id, client)

  if (batteryLevel !== undefined && batteryLevel >= 0 && batteryLevel <= 100) {
    if (unrespondedSession === null) {
      unrespondedSession = await db.createSession(
        button.installation_id,
        button.button_id,
        button.unit,
        button.phone_number,
        numPresses,
        batteryLevel,
        client,
      )
    } else {
      unrespondedSession.incrementButtonPresses(numPresses)
      unrespondedSession.updateBatteryLevel(batteryLevel)
      await db.saveSession(unrespondedSession, client)
    }
  } else if (unrespondedSession === null) {
    unrespondedSession = await db.createSession(button.installation_id, button.button_id, button.unit, button.phone_number, numPresses, null, client)
  } else {
    unrespondedSession.incrementButtonPresses(numPresses)
    await db.saveSession(unrespondedSession, client)
  }

  if (needToSendButtonPressMessageForSession(unrespondedSession)) {
    sendButtonPressMessageForSession(unrespondedSession, client)
  }

  await db.commitTransaction(client)
}

app.use(cookieParser())

// initialize express-session to allow us track the logged-in user across sessions.
app.use(
  session({
    key: 'user_sid',
    secret: helpers.getEnvVar('SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: 24 * 60 * 60 * 1000,
    },
  }),
)

// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
  if (req.cookies.user_sid && !req.session.user) {
    res.clearCookie('user_sid')
  }
  next()
})

// middleware function to check for logged-in users
function sessionChecker(req, res, next) {
  if (req.session.user && req.cookies.user_sid) {
    res.redirect('/dashboard')
  } else {
    next()
  }
}

app.get('/', sessionChecker, (req, res) => {
  res.redirect('/login')
})

app
  .route('/login')
  .get(sessionChecker, (req, res) => {
    res.sendFile(`${__dirname}/login.html`)
  })
  .post((req, res) => {
    const username = req.body.username
    const password = req.body.password

    if (username === helpers.getEnvVar('WEB_USERNAME') && password === helpers.getEnvVar('PASSWORD')) {
      req.session.user = username
      res.redirect('/dashboard')
    } else {
      res.redirect('/login')
    }
  })

app.get('/dashboard', async (req, res) => {
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
    return
  }

  try {
    const allInstallations = await db.getInstallations()

    const viewParams = {
      installations: allInstallations
        .filter(installation => installation.isActive)
        .map(installation => ({ name: installation.name, id: installation.id })),
    }
    viewParams.viewMessage = allInstallations.length >= 1 ? 'Please select an installation' : 'No installations to display'

    res.send(Mustache.render(chatbotDashboardTemplate, viewParams))
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.get('/dashboard/:installationId?', async (req, res) => {
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
    return
  }
  if (typeof req.params.installationId !== 'string') {
    const installations = await db.getInstallations()
    res.redirect(`/dashboard/${installations[0].id}`)
    return
  }

  try {
    const recentSessions = await db.getRecentSessionsWithInstallationId(req.params.installationId)
    const currentInstallation = await db.getInstallationWithInstallationId(req.params.installationId)
    const allInstallations = await db.getInstallations()

    const viewParams = {
      recentSessions: [],
      currentInstallationName: currentInstallation.name,
      installations: allInstallations
        .filter(installation => installation.isActive)
        .map(installation => ({ name: installation.name, id: installation.id })),
    }

    for (const recentSession of recentSessions) {
      const createdAt = moment(recentSession.createdAt, moment.ISO_8601)
      const updatedAt = moment(recentSession.updatedAt, moment.ISO_8601)
      viewParams.recentSessions.push({
        unit: recentSession.unit,
        createdAt: createdAt.tz('America/Vancouver').format('DD MMM Y, hh:mm:ss A'),
        updatedAt: updatedAt.tz('America/Vancouver').format('DD MMM Y, hh:mm:ss A'),
        state: recentSession.state,
        numPresses: recentSession.numPresses.toString(),
        incidentType: recentSession.incidentType,
        notes: recentSession.notes,
        buttonBatteryLevel: recentSession.buttonBatteryLevel,
      })
    }

    res.send(Mustache.render(chatbotDashboardTemplate, viewParams))
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.get('/logout', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    res.clearCookie('user_sid')
    res.redirect('/')
  } else {
    res.redirect('/login')
  }
})

app.post('/flic_button_press', Validator.header(['button-serial-number']).exists(), async (req, res) => {
  try {
    const validationErrors = Validator.validationResult(req)

    if (validationErrors.isEmpty()) {
      const serialNumber = req.get('button-serial-number')
      const batteryLevel = req.get('button-battery-level')
      const buttonName = req.get('button-name')
      const apiKey = req.query.apikey

      // Log the vaiditiy of the API key
      // TODO (CU-gwxnde) Replace this with a 401 unauthorized if invalid
      if (apiKey !== helpers.getEnvVar('FLIC_BUTTON_PRESS_API_KEY')) {
        helpers.log(`INVALID api key from '${buttonName}' (${serialNumber})`)
      } else {
        helpers.log(`VALID api key from '${buttonName}' (${serialNumber})`)
      }

      const button = await db.getButtonWithSerialNumber(serialNumber)
      if (button === null) {
        helpers.log(`Bad request: Serial Number is not registered. Serial Number for '${buttonName}' is ${serialNumber}`)
        res.status(400).send()
      } else {
        await handleValidRequest(button, 1, batteryLevel)

        // eslint-disable-next-line eqeqeq
        if (req.query.presses == 2) {
          await handleValidRequest(button, 1, batteryLevel)
        }

        res.status(200).send()
      }
    } else {
      helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
      res.status(400).send()
    }
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.post('/', jsonBodyParser, async (req, res) => {
  try {
    const requiredBodyParams = ['UUID', 'Type']

    if (helpers.isValidRequest(req, requiredBodyParams)) {
      const button = await db.getButtonWithButtonId(req.body.UUID)
      if (button === null) {
        helpers.log(`Bad request: UUID is not registered. UUID is ${req.body.UUID}`)
        res.status(400).send()
      } else {
        await handleValidRequest(button, 0.5)

        if (req.body.Type.startsWith('double')) {
          await handleValidRequest(button, 0.5)
        }

        res.status(200).send()
      }
    } else {
      helpers.log('Bad request: UUID is missing')
      res.status(400).send()
    }
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.post('/heartbeat', jsonBodyParser, async (req, res) => {
  try {
    helpers.log(
      `got a heartbeat from ${req.body.system_id}, flic_last_seen_secs is ${req.body.flic_last_seen_secs}, flic_last_ping_secs is ${req.body.flic_last_ping_secs}`,
    )
    const flicLastSeenTime = moment().subtract(req.body.flic_last_seen_secs, 'seconds').toISOString()
    const flicLastPingTime = moment().subtract(req.body.flic_last_ping_secs, 'seconds').toISOString()
    const heartbeatLastSeenTime = moment().toISOString()
    await db.saveHeartbeat(req.body.system_id, flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime)
    res.status(200).send()
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.post('/heartbeat/rename_system', jsonBodyParser, async (req, res) => {
  try {
    helpers.log(`got a request to rename system ${req.body.system_id}`)
    await db.saveHubRename(req.body.system_id, req.body.system_name)
    res.status(200).send()
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.post('/heartbeat/hide_system', jsonBodyParser, async (req, res) => {
  try {
    helpers.log(`got a request to hide system ${req.body.system_id}`)
    await db.saveHubHideStatus(req.body.system_id, true)
    res.status(200).send()
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.post('/heartbeat/unhide_system', jsonBodyParser, async (req, res) => {
  try {
    helpers.log(`got a request to show system ${req.body.system_id}`)
    await db.saveHubHideStatus(req.body.system_id, false)
    res.status(200).send()
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.post('/heartbeat/mute_system', jsonBodyParser, async (req, res) => {
  try {
    helpers.log(`got a request to unmute system ${req.body.system_id}`)
    await db.saveHubMuteStatus(req.body.system_id, true)
    res.status(200).send()
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.post('/heartbeat/unmute_system', jsonBodyParser, async (req, res) => {
  try {
    helpers.log(`got a request to unmute system ${req.body.system_id}`)
    await db.saveHubMuteStatus(req.body.system_id, false)
    res.status(200).send()
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.get('/heartbeatDashboard', async (req, res) => {
  const hubs = await db.getHubs()
  const viewParams = {
    domain: helpers.getEnvVar('DOMAIN'),
    dashboard_render_time: moment().toString(),
    systems: [],
  }

  for (const hub of hubs) {
    if (hub.hidden) {
      continue
    }

    const flicLastSeenTime = moment(hub.flicLastSeenTime)
    let flicLastSeenSecs = moment().diff(flicLastSeenTime) / 1000.0
    flicLastSeenSecs = Math.round(flicLastSeenSecs)

    const heartbeatLastSeenTime = moment(hub.heartbeatLastSeenTime)
    let heartbeatLastSeenSecs = moment().diff(heartbeatLastSeenTime) / 1000.0
    heartbeatLastSeenSecs = Math.round(heartbeatLastSeenSecs)

    const flicLastPingTime = moment(hub.flicLastPingTime)
    let flicLastPingSecs = moment().diff(flicLastPingTime) / 1000.0
    flicLastPingSecs = Math.round(flicLastPingSecs)

    viewParams.systems.push({
      system_name: hub.systemName,
      flic_last_seen: `${flicLastSeenSecs.toString()} seconds ago`,
      flic_last_ping: `${flicLastPingSecs.toString()} seconds ago`,
      heartbeat_last_seen: `${heartbeatLastSeenSecs.toString()} seconds ago`,
      muted: hub.muted ? 'Y' : 'N',
    })
  }

  const htmlString = Mustache.render(heartbeatDashboardTemplate, viewParams)
  res.send(htmlString)
})

function sendAlerts(alertMessage, systemName, heartbeatAlertRecipients) {
  for (let i = 0; i < heartbeatAlertRecipients.length; i += 1) {
    braveAlerter.sendSingleAlert(
      heartbeatAlertRecipients[i],
      helpers.getEnvVar('TWILIO_HEARTBEAT_FROM_NUMBER'),
      `${alertMessage}, indicating the connection for ${systemName} has been lost.`,
    )
  }
}

function sendReconnectionMessage(systemName, heartbeatAlertRecipients) {
  for (let i = 0; i < heartbeatAlertRecipients.length; i += 1) {
    braveAlerter.sendSingleAlert(heartbeatAlertRecipients[i], helpers.getEnvVar('TWILIO_HEARTBEAT_FROM_NUMBER'), `${systemName} has reconnected.`)
  }
}

async function updateSentAlerts(currentHub, sentAlerts) {
  const hub = currentHub
  hub.sentAlerts = sentAlerts
  await db.saveHubAlertStatus(hub)
}

async function checkHeartbeat() {
  const hubs = await db.getHubs()
  for (const hub of hubs) {
    const currentTime = moment()
    const flicLastSeenTime = moment(hub.flicLastSeenTime)
    const flicDelayMillis = currentTime.diff(flicLastSeenTime)
    const heartbeatLastSeenTime = moment(hub.heartbeatLastSeenTime)
    const heartbeatDelayMillis = currentTime.diff(heartbeatLastSeenTime)
    const pingLastSeenTime = moment(hub.flicLastPingTime)
    const pingDelayMillis = currentTime.diff(pingLastSeenTime)

    if (flicDelayMillis > FLIC_THRESHOLD_MILLIS && !hub.sentAlerts) {
      helpers.log(`flic threshold exceeded; flic delay is ${flicDelayMillis} ms. sending alerts for ${hub.systemName}`)
      await updateSentAlerts(hub, 'true')
      if (hub.muted) {
        continue
      }
      sendAlerts('Darkstat has lost visibility of the Hub', hub.systemName, hub.heartbeatAlertRecipients)
    } else if (pingDelayMillis > PING_THRESHOLD_MILLIS && !hub.sentAlerts) {
      helpers.log(`ping threshold exceeded; ping delay is ${pingDelayMillis} ms. sending alerts for ${hub.systemName}`)
      await updateSentAlerts(hub, 'true')
      if (hub.muted) {
        continue
      }
      sendAlerts('Ping is unable to reach the Hub', hub.systemName, hub.heartbeatAlertRecipients)
    } else if (heartbeatDelayMillis > HEARTBEAT_THRESHOLD_MILLIS && !hub.sentAlerts) {
      helpers.log(`heartbeat threshold exceeded; heartbeat delay is ${heartbeatDelayMillis} ms. sending alerts for ${hub.systemName}`)
      await updateSentAlerts(hub, 'true')
      if (hub.muted) {
        continue
      }
      sendAlerts('Heartbeat messages have stopped', hub.systemName, hub.heartbeatAlertRecipients)
    } else if (
      flicDelayMillis < FLIC_THRESHOLD_MILLIS &&
      heartbeatDelayMillis < HEARTBEAT_THRESHOLD_MILLIS &&
      pingDelayMillis < PING_THRESHOLD_MILLIS &&
      hub.sentAlerts
    ) {
      helpers.log(`${hub.systemName} has reconnected.`)
      await updateSentAlerts(hub, 'false')
      if (hub.muted) {
        continue
      }
      sendReconnectionMessage(hub.systemName, hub.heartbeatAlertRecipients)
    }
  }
}

let server

if (helpers.isTestEnvironment()) {
  // local http server for testing
  server = app.listen(8000)
} else {
  const httpsOptions = {
    key: fs.readFileSync(`/etc/letsencrypt/live/${helpers.getEnvVar('DOMAIN')}/privkey.pem`),
    cert: fs.readFileSync(`/etc/letsencrypt/live/${helpers.getEnvVar('DOMAIN')}/fullchain.pem`),
  }
  server = https.createServer(httpsOptions, app).listen(443)
  setInterval(checkHeartbeat, 1000)
  helpers.log('brave server listening on port 443')
}

module.exports.braveAlerter = braveAlerter // for tests
module.exports.server = server
module.exports.db = db
