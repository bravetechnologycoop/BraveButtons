/* eslint-disable no-continue */
const fs = require('fs')
const Validator = require('express-validator')
const express = require('express')
const https = require('https')
const moment = require('moment-timezone')
const bodyParser = require('body-parser')
const { Parser } = require('json2csv')

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
const SESSION_RESET_TIMEOUT = 2 * 60 * 60 * 1000
const SUBSEQUENT_URGENT_MESSAGE_THRESHOLD = 2 * 60 * 1000

const app = express()

const unrespondedSessionReminderTimeoutMillis = helpers.getEnvVar('REMINDER_TIMEOUT_MS')
const unrespondedSessionAlertTimeoutMillis = helpers.getEnvVar('FALLBACK_TIMEOUT_MS')

const heartbeatDashboardTemplate = fs.readFileSync(`${__dirname}/heartbeatDashboard.mst`, 'utf-8')
const chatbotDashboardTemplate = fs.readFileSync(`${__dirname}/chatbotDashboard.mst`, 'utf-8')

app.use(bodyParser.urlencoded({ extended: true }))

// Configure BraveAlerter
const braveAlerter = new BraveAlerterConfigurator().createBraveAlerter()

// Add BraveAlerter's routes ( /alert/* )
app.use(braveAlerter.getRouter())

async function handleValidRequest(button, numPresses, batteryLevel) {
  helpers.log(
    `UUID: ${button.button_id.toString()} SerialNumber: ${
      button.button_serial_number
    } Unit: ${button.unit.toString()} Presses: ${numPresses.toString()} BatteryLevel: ${batteryLevel}`,
  )

  let client

  try {
    client = await db.beginTransaction()
    if (client === null) {
      helpers.log(`handleValidRequest: Error starting transaction`)
      return
    }

    let currentSession = await db.getUnrespondedSessionWithButtonId(button.button_id, client)
    const currentTime = await db.getCurrentTime(client)

    if (batteryLevel !== undefined && batteryLevel >= 0 && batteryLevel <= 100) {
      if (currentSession === null || currentTime - currentSession.updatedAt >= SESSION_RESET_TIMEOUT) {
        currentSession = await db.createSession(
          button.installation_id,
          button.button_id,
          button.unit,
          button.phone_number,
          numPresses,
          batteryLevel,
          client,
        )
      } else {
        currentSession.incrementButtonPresses(numPresses)
        currentSession.updateBatteryLevel(batteryLevel)
        await db.saveSession(currentSession, client)
      }
    } else if (currentSession === null || currentTime - currentSession.updatedAt >= SESSION_RESET_TIMEOUT) {
      currentSession = await db.createSession(button.installation_id, button.button_id, button.unit, button.phone_number, numPresses, null, client)
    } else {
      currentSession.incrementButtonPresses(numPresses)
      await db.saveSession(currentSession, client)
    }

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
        fallbackToPhoneNumbers: installation.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: helpers.getEnvVar('TWILIO_FALLBACK_FROM_NUMBER'),
      }
      braveAlerter.startAlertSession(alertInfo)
    } else if (
      currentSession.numPresses % 5 === 0 ||
      currentSession.numPresses === 2 ||
      currentTime - currentSession.updatedAt >= SUBSEQUENT_URGENT_MESSAGE_THRESHOLD
    ) {
      braveAlerter.sendSingleAlert(
        installation.responderPhoneNumber,
        currentSession.phoneNumber,
        `This in an urgent request. The button has been pressed ${currentSession.numPresses.toString()} times. Please respond "Ok" when you have followed up on the call.`,
      )
    } else {
      // no alert to be sent
    }

    await db.commitTransaction(client)
  } catch (e) {
    try {
      await db.rollbackTransaction(client)
      helpers.log(`handleValidRequest: Rolled back transaction because of error: ${e}`)
    } catch (error) {
      // Do nothing
      helpers.log(`handleValidRequest: Error rolling back transaction: ${error} Rollback attempted because of error: ${e}`)
    }
  }
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
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
  } else {
    next()
  }
}

app.get('/', sessionChecker, (req, res) => {
  res.redirect('/dashboard')
})

app
  .route('/login')
  .get((req, res) => {
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

app.get('/dashboard', sessionChecker, async (req, res) => {
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

app.get('/dashboard/:installationId?', sessionChecker, async (req, res) => {
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
    return
  }

  try {
    const allInstallations = await db.getInstallations()

    if (typeof req.params.installationId !== 'string') {
      res.redirect(`/dashboard/${allInstallations[0].id}`)
      return
    }

    const recentSessions = await db.getRecentSessionsWithInstallationId(req.params.installationId)
    const currentInstallation = await db.getInstallationWithInstallationId(req.params.installationId)

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

app.get('/buttons-data', sessionChecker, async (req, res) => {
  const data = await db.getDataForExport()
  const fields = [
    'Installation Name',
    'Responder Phone',
    'Fallback Phones',
    'Date Installation Created',
    'Incident Categories',
    'Active?',
    'Unit',
    'Button Phone',
    'Session State',
    'Number of Presses',
    'Session Start',
    'Last Session Activity',
    'Session Incident Type',
    'Session Notes',
    'Fallback Alert Status (Twilio)',
    'Button Battery Level',
    'Date Button Created',
    'Button Last Updated',
    'Button Serial Number',
  ]

  const csvParser = new Parser({ fields })
  const csv = csvParser.parse(data)

  const millis = Date.now()
  const timestamp = new Date(millis).toISOString().slice(0, -5).replace(/T|:/g, '_')

  res.set('Content-Type', 'text/csv').attachment(`buttons-data(${timestamp}).csv`).send(csv)
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
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

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
        const errorMessage = `Bad request to ${req.path}: Serial Number is not registered. Serial Number for '${buttonName}' is ${serialNumber}`
        helpers.log(errorMessage)
        res.status(400).send(`Bad request to ${req.path}: Serial Number is not registered`)
      } else {
        await handleValidRequest(button, 1, batteryLevel)

        // eslint-disable-next-line eqeqeq
        if (req.query.presses == 2) {
          await handleValidRequest(button, 1, batteryLevel)
        }

        res.status(200).send()
      }
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
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
        helpers.log(`Bad request to /: UUID is not registered. UUID is ${req.body.UUID}`)
        res.status(400).send('Bad request to /: UUID is not registered')
      } else {
        await handleValidRequest(button, 0.5)

        if (req.body.Type.startsWith('double')) {
          await handleValidRequest(button, 0.5)
        }

        res.status(200).send()
      }
    } else {
      const errorMessage = 'Bad request to /: UUID or Type is missing'
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
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
  let hubs = []
  try {
    hubs = await db.getHubs()
  } catch (e) {
    helpers.log(`Failed to get hubs in /heartbeatDashboard: ${JSON.stringify(e)}`)
  }

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

async function updateSentAlerts(hubParam, sentAlerts) {
  const hub = hubParam
  try {
    hub.sentAlerts = sentAlerts
    await db.saveHubAlertStatus(hub)
  } catch (e) {
    helpers.log(`updateSentAlerts: failed to save hub alert status: ${JSON.stringify(e)}`)
  }
}

async function checkHeartbeat() {
  try {
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
  } catch (e) {
    helpers.log(`Failed to check heartbeat: ${JSON.stringify(e)}`)
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
