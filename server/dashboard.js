// Third-party dependencies
const fs = require('fs')
const Mustache = require('mustache')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const { DateTime } = require('luxon')
const { Parser } = require('json2csv')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')

const DASHBOARD_TIMEZONE = 'America/Vancouver'
const DASHBOARD_FORMAT = 'y MMM d, TTT'

const chatbotDashboardTemplate = fs.readFileSync(`${__dirname}/chatbotDashboard.mst`, 'utf-8')

function formatDateTimeForDashboard(date) {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(DASHBOARD_TIMEZONE).toFormat(DASHBOARD_FORMAT)
}

function setupDashboardSessions(app) {
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
        expires: 8 * 60 * 60 * 1000,
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
}

// middleware function to check for logged-in users
function sessionChecker(req, res, next) {
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
  } else {
    next()
  }
}

async function redirectToHomePage(req, res) {
  res.redirect('/dashboard')
}

async function renderLoginPage(req, res) {
  res.sendFile(`${__dirname}/login.html`)
}

async function submitLogout(req, res) {
  if (req.session.user && req.cookies.user_sid) {
    req.session.destroy()
    res.clearCookie('user_sid')
    res.redirect('/')
  } else {
    res.redirect('/login')
  }
}

async function renderDashboardPage(req, res) {
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
}

async function renderClientDetailsPage(req, res) {
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
}

async function downloadCsv(req, res) {
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
}

async function submitLogin(req, res) {
  const username = req.body.username
  const password = req.body.password

  if (username === helpers.getEnvVar('WEB_USERNAME') && password === helpers.getEnvVar('PASSWORD')) {
    req.session.user = username
    res.redirect('/dashboard')
  } else {
    res.redirect('/login')
  }
}

module.exports = {
  downloadCsv,
  formatDateTimeForDashboard,
  redirectToHomePage,
  renderClientDetailsPage,
  renderDashboardPage,
  renderLoginPage,
  sessionChecker,
  setupDashboardSessions,
  submitLogin,
  submitLogout,
}
