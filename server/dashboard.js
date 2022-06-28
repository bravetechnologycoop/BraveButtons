// Third-party dependencies
const fs = require('fs')
const Mustache = require('mustache')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const { Parser } = require('json2csv')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')

const clientPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/clientPage.mst`, 'utf-8')
const clientVitalsTemplate = fs.readFileSync(`${__dirname}/mustache-templates/clientVitals.mst`, 'utf-8')
const landingCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/landingCSSPartial.mst`, 'utf-8')
const landingPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/landingPage.mst`, 'utf-8')
const navPartial = fs.readFileSync(`${__dirname}/mustache-templates/navPartial.mst`, 'utf-8')
const vitalsTemplate = fs.readFileSync(`${__dirname}/mustache-templates/vitals.mst`, 'utf-8')

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

    res.send(Mustache.render(landingPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
}

async function renderClientDetailsPage(req, res) {
  try {
    const allClients = await db.getClients()

    if (typeof req.params.clientId !== 'string') {
      res.redirect(`/clients/${allClients[0].id}`)
      return
    }

    const recentSessions = await db.getRecentSessionsWithClientId(req.params.clientId)
    const currentClient = await db.getClientWithId(req.params.clientId)
    const viewParams = {
      recentSessions: [],
      clients: allClients.filter(client => client.isActive).map(client => ({ name: client.displayName, id: client.id })),
    }

    if (currentClient !== null) {
      viewParams.currentClientId = currentClient.id
      viewParams.currentClientName = currentClient.displayName

      for (const recentSession of recentSessions) {
        const createdAt = helpers.formatDateTimeForDashboard(recentSession.createdAt)
        const updatedAt = helpers.formatDateTimeForDashboard(recentSession.updatedAt)
        const respondedAt = recentSession.respondedAt !== null ? helpers.formatDateTimeForDashboard(recentSession.respondedAt) : ''
        viewParams.recentSessions.push({
          unit: recentSession.button.displayName,
          createdAt,
          updatedAt,
          chatbotState: recentSession.chatbotState,
          numButtonPresses: recentSession.numButtonPresses.toString(),
          incidentCategory: recentSession.incidentCategory,
          buttonBatteryLevel: recentSession.buttonBatteryLevel,
          respondedAt,
          respondedByPhoneNumber: recentSession.respondedByPhoneNumber,
        })
      }
    } else {
      viewParams.viewMessage = 'No client to display'
    }

    res.send(Mustache.render(clientPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
}

async function renderClientVitalsPage(req, res) {
  try {
    const allClients = await db.getClients()

    if (typeof req.params.clientId !== 'string') {
      res.redirect(`/clients/${allClients[0].id}/vitals`)
      return
    }

    const currentClient = await db.getClientWithId(req.params.clientId)
    const viewParams = {
      buttons: [],
      gateways: [],
      hubs: [],
      clients: allClients.filter(client => client.isActive).map(client => ({ name: client.displayName, id: client.id })),
      currentDateTime: helpers.formatDateTimeForDashboard(await db.getCurrentTime()),
    }

    if (currentClient !== null) {
      viewParams.currentClientName = currentClient.displayName
      viewParams.currentClientId = currentClient.id

      const hubsVitals = await db.getHubsWithClientId(req.params.clientId)
      for (const hubsVital of hubsVitals) {
        viewParams.hubs.push({
          name: hubsVital.systemName,
          locationDescription: hubsVital.locationDescription,
          flicLastSeenTime: helpers.formatDateTimeForDashboard(hubsVital.flicLastSeenTime),
          flicLastSeenAgo: await helpers.generateCalculatedTimeDifferenceString(hubsVital.flicLastSeenTime, db),
          flicLastPingTime: helpers.formatDateTimeForDashboard(hubsVital.flicLastPingTime),
          flicLastPingAgo: await helpers.generateCalculatedTimeDifferenceString(hubsVital.flicLastPingTime, db),
          heartbeatLastSeenTime: helpers.formatDateTimeForDashboard(hubsVital.heartbeatLastSeenTime),
          heartbeatLastSeenAgo: await helpers.generateCalculatedTimeDifferenceString(hubsVital.heartbeatLastSeenTime, db),
          isActive: !hubsVital.muted,
        })
      }

      const buttonsVitals = await db.getRecentButtonsVitalsWithClientId(req.params.clientId)
      for (const buttonsVital of buttonsVitals) {
        viewParams.buttons.push({
          unit: buttonsVital.button.displayName,
          batteryLevel: buttonsVital.batteryLevel,
          lastSeenAt: helpers.formatDateTimeForDashboard(buttonsVital.createdAt),
          lastSeenAgo: await helpers.generateCalculatedTimeDifferenceString(buttonsVital.createdAt, db),
        })
      }

      const gatewaysVitals = await db.getRecentGatewaysVitalsWithClientId(currentClient.id)
      for (const gatewaysVital of gatewaysVitals) {
        viewParams.gateways.push({
          id: gatewaysVital.gateway.id,
          name: gatewaysVital.gateway.displayName,
          lastSeenAt: helpers.formatDateTimeForDashboard(gatewaysVital.lastSeenAt),
          lastSeenAgo: await helpers.generateCalculatedTimeDifferenceString(gatewaysVital.lastSeenAt, db),
          isActive: gatewaysVital.gateway.isActive,
        })
      }
    } else {
      viewParams.viewMessage = 'No client to display'
    }

    res.send(Mustache.render(clientVitalsTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
}

async function renderVitalsPage(req, res) {
  try {
    const allClients = await db.getClients()

    const viewParams = {
      buttons: [],
      gateways: [],
      hubs: [],
      clients: allClients.filter(client => client.isActive).map(client => ({ name: client.displayName, id: client.id })),
      currentDateTime: helpers.formatDateTimeForDashboard(await db.getCurrentTime()),
    }

    const hubsVitals = await db.getHubs()
    for (const hubsVital of hubsVitals) {
      viewParams.hubs.push({
        name: hubsVital.systemName,
        locationDescription: hubsVital.locationDescription,
        flicLastSeenTime: helpers.formatDateTimeForDashboard(hubsVital.flicLastSeenTime),
        flicLastSeenAgo: await helpers.generateCalculatedTimeDifferenceString(hubsVital.flicLastSeenTime, db),
        flicLastPingTime: helpers.formatDateTimeForDashboard(hubsVital.flicLastPingTime),
        flicLastPingAgo: await helpers.generateCalculatedTimeDifferenceString(hubsVital.flicLastPingTime, db),
        heartbeatLastSeenTime: helpers.formatDateTimeForDashboard(hubsVital.heartbeatLastSeenTime),
        heartbeatLastSeenAgo: await helpers.generateCalculatedTimeDifferenceString(hubsVital.heartbeatLastSeenTime, db),
        isActive: !hubsVital.muted,
      })
    }

    const buttonsVitals = await db.getRecentButtonsVitals()
    for (const buttonsVital of buttonsVitals) {
      viewParams.buttons.push({
        clientName: buttonsVital.button.client.displayName,
        unit: buttonsVital.button.displayName,
        batteryLevel: buttonsVital.batteryLevel,
        lastSeenAt: helpers.formatDateTimeForDashboard(buttonsVital.createdAt),
        lastSeenAgo: await helpers.generateCalculatedTimeDifferenceString(buttonsVital.createdAt, db),
      })
    }

    const gatewaysVitals = await db.getRecentGatewaysVitals()
    for (const gatewaysVital of gatewaysVitals) {
      viewParams.gateways.push({
        clientName: gatewaysVital.gateway.client.displayName,
        id: gatewaysVital.gateway.id,
        name: gatewaysVital.gateway.displayName,
        lastSeenAt: helpers.formatDateTimeForDashboard(gatewaysVital.lastSeenAt),
        lastSeenAgo: await helpers.generateCalculatedTimeDifferenceString(gatewaysVital.lastSeenAt, db),
        isActive: gatewaysVital.gateway.isActive,
      })
    }

    res.send(Mustache.render(vitalsTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
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
    'Session Responded At',
    'Session Responded By',
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
  redirectToHomePage,
  renderClientDetailsPage,
  renderClientVitalsPage,
  renderDashboardPage,
  renderLoginPage,
  renderVitalsPage,
  sessionChecker,
  setupDashboardSessions,
  submitLogin,
  submitLogout,
}
