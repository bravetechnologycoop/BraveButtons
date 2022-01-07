/* eslint-disable no-continue */
const fs = require('fs')
const express = require('express')
const https = require('https')
const { Parser } = require('json2csv')
const { format, utcToZonedTime } = require('date-fns-tz')

const cookieParser = require('cookie-parser')
const session = require('express-session')
const Mustache = require('mustache')
const { helpers } = require('brave-alert-lib')

const BraveAlerterConfigurator = require('./BraveAlerterConfigurator')
const db = require('./db/db')
const vitals = require('./vitals')
const routes = require('./routes')
const buttonAlerts = require('./buttonAlerts')

const DASHBOARD_TIMEZONE = 'America/Vancouver'
const DASHBOARD_FORMAT = 'dd MMM Y, hh:mm:ss aaa zzz'

const app = express()

const heartbeatDashboardTemplate = fs.readFileSync(`${__dirname}/heartbeatDashboard.mst`, 'utf-8')
const chatbotDashboardTemplate = fs.readFileSync(`${__dirname}/chatbotDashboard.mst`, 'utf-8')

app.use(express.urlencoded({ extended: true }))

// Configure BraveAlerter
const braveAlerter = new BraveAlerterConfigurator().createBraveAlerter()

vitals.setup(braveAlerter, heartbeatDashboardTemplate)

buttonAlerts.setup(braveAlerter)

// Add routes
routes.configureRoutes(app)

// Add BraveAlerter's routes ( /alert/* )
app.use(braveAlerter.getRouter())

app.use(cookieParser())

// initialize express-session to allow us track the logged-in user across sessions.
app.use(
  session({
    key: 'user_sid',
    secret: helpers.getEnvVar('SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: !helpers.isTestEnvironment(),
      httpOnly: true,
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
    const allClients = await db.getClients()

    const viewParams = {
      clients: allClients.filter(client => client.isActive).map(client => ({ name: client.displayName, id: client.id })),
    }
    viewParams.viewMessage = allClients.length >= 1 ? 'Please select a client' : 'No clients to display'

    res.send(Mustache.render(chatbotDashboardTemplate, viewParams))
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
})

function formatDateTimeForDashboard(date) {
  return format(utcToZonedTime(date, DASHBOARD_TIMEZONE), DASHBOARD_FORMAT, { timeZone: DASHBOARD_TIMEZONE })
}

app.get('/dashboard/:clientId?', sessionChecker, async (req, res) => {
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
    return
  }

  try {
    const allClients = await db.getClients()

    if (typeof req.params.clientId !== 'string') {
      res.redirect(`/dashboard/${allClients[0].id}`)
      return
    }

    const recentSessions = await db.getRecentSessionsWithClientId(req.params.clientId)
    const currentClient = await db.getClientWithId(req.params.clientId)

    const viewParams = {
      recentSessions: [],
      currentClientName: currentClient.displayName,
      clients: allClients.filter(client => client.isActive).map(client => ({ name: client.displayName, id: client.id })),
    }

    for (const recentSession of recentSessions) {
      const createdAt = formatDateTimeForDashboard(recentSession.createdAt)
      const updatedAt = formatDateTimeForDashboard(recentSession.updatedAt)
      const respondedAt = recentSession.respondedAt !== null ? formatDateTimeForDashboard(recentSession.respondedAt) : ''
      viewParams.recentSessions.push({
        unit: recentSession.unit,
        createdAt,
        updatedAt,
        state: recentSession.state,
        numPresses: recentSession.numPresses.toString(),
        incidentType: recentSession.incidentType,
        notes: recentSession.notes,
        buttonBatteryLevel: recentSession.buttonBatteryLevel,
        respondedAt,
      })
    }

    res.send(Mustache.render(chatbotDashboardTemplate, viewParams))
  } catch (err) {
    helpers.logError(err)
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
    req.session.destroy()
    res.clearCookie('user_sid')
    res.redirect('/')
  } else {
    res.redirect('/login')
  }
})

let server

if (helpers.isTestEnvironment()) {
  // local http server for testing
  server = app.listen(8000)
} else {
  helpers.setupSentry(app, helpers.getEnvVar('SENTRY_DSN'), helpers.getEnvVar('SENTRY_ENVIRONMENT'), helpers.getEnvVar('SENTRY_RELEASE'))
  const httpsOptions = {
    key: fs.readFileSync(`/etc/letsencrypt/live/${helpers.getEnvVar('DOMAIN')}/privkey.pem`),
    cert: fs.readFileSync(`/etc/letsencrypt/live/${helpers.getEnvVar('DOMAIN')}/fullchain.pem`),
  }
  server = https.createServer(httpsOptions, app).listen(443)
  setInterval(vitals.checkHeartbeat, 1000)
  helpers.log('brave server listening on port 443')
}

module.exports.braveAlerter = braveAlerter // for tests
module.exports.server = server
module.exports.db = db
