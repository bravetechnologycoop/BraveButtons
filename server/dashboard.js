// Third-party dependencies
const fs = require('fs')
const Mustache = require('mustache')
const Validator = require('express-validator')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const { Parser } = require('json2csv')
const { t } = require('i18next')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const { getAlertTypeDisplayName } = require('brave-alert-lib/lib/helpers')
const db = require('./db/db')

const clientPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/clientPage.mst`, 'utf-8')
const clientVitalsTemplate = fs.readFileSync(`${__dirname}/mustache-templates/clientVitals.mst`, 'utf-8')
const landingCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/landingCSSPartial.mst`, 'utf-8')
const landingPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/landingPage.mst`, 'utf-8')
const navPartial = fs.readFileSync(`${__dirname}/mustache-templates/navPartial.mst`, 'utf-8')
const vitalsTemplate = fs.readFileSync(`${__dirname}/mustache-templates/vitals.mst`, 'utf-8')
const locationsDashboardTemplate = fs.readFileSync(`${__dirname}/mustache-templates/locationsDashboard.mst`, 'utf-8')
const locationsCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/locationsCSSPartial.mst`, 'utf-8')
const updateClientTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateClient.mst`, 'utf-8')
const buttonFormCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/buttonFormCSSPartial.mst`, 'utf-8')
const newClientTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newClient.mst`, 'utf-8')
const newGatewayTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newGateway.mst`, 'utf-8')
const updateGatewayTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateGateway.mst`, 'utf-8')
const updateButtonTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateButton.mst`, 'utf-8')

const rssiBadThreshold = helpers.getEnvVar('RSSI_BAD_THRESHOLD')
const rssiGoodThreshold = helpers.getEnvVar('RSSI_GOOD_THRESHOLD')
const snrBadThreshold = helpers.getEnvVar('SNR_BAD_THRESHOLD')
const snrGoodThreshold = helpers.getEnvVar('SNR_GOOD_THRESHOLD')

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
    const displayedClients = (await db.getClients()).filter(client => client.isDisplayed)
    const organizations = []

    for (let i = 0; i < displayedClients.length; i++) {
      displayedClients[i].organization = (db.getClientExtensionWithClientId(displayedClients[i].clientId)).organization
    }

    const viewParams = { 
      clients: displayedClients,}

    res.send(Mustache.render(landingPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderButtonDetailsPage(req, res) {
  try {
    // Needed for the navigation bar
    const clients = await db.getClients()
    const button = await db.getButtonWithDeviceId(req.params.id)
    const recentSessions = await db.getHistoryOfSessions(req.params.id)

    const viewParams = {
      clients: clients.filter(client => client.isDisplayed),
      recentSessions: [],
      currentButton: button,
      clientid: button.client.id,
    }

    for (const recentSession of recentSessions) {
      const createdAt = recentSession.createdAt
      const updatedAt = recentSession.updatedAt

      viewParams.recentSessions.push({
        createdAt,
        updatedAt,
        incidentCategory: recentSession.incidentCategory,
        id: recentSession.id,
        chatbotState: recentSession.chatbotState,
        numberOfAlerts: recentSession.numberOfAlerts,
        alertType: getAlertTypeDisplayName(recentSession.alertType, button.client.language, t),
        respondedAt: recentSession.respondedAt,
        respondedByPhoneNumber: recentSession.respondedByPhoneNumber,
      })
    }

    res.send(Mustache.render(locationsDashboardTemplate, viewParams, { nav: navPartial, css: locationsCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderUpdateButtonPage(req, res) {
  try {
    const clients = await db.getClients()
    const button = await db.getButtonWithDeviceId(req.params.id)

    const viewParams = {
      currentButton: button,
      clients: clients
        .filter(client => client.isDisplayed)
        .map(client => {
          return {
            ...client,
            selected: client.id === button.client.id,
          }
        }),
    }

    res.send(Mustache.render(updateButtonTemplate, viewParams, { nav: navPartial, css: buttonFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateUpdateButton = Validator.body([
  'displayName',
  'serialNumber',
  'phoneNumber',
  'isDisplayed',
  'isSendingAlerts',
  'isSendingVitals',
  'clientId',
])
  .trim()
  .notEmpty()

async function submitUpdateButton(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const data = req.body
      data.deviceId = req.params.id

      const client = await db.getClientWithId(data.clientId)
      if (client === null) {
        const errorMessage = `Client ID '${data.clientId}' does not exist`
        helpers.log(errorMessage)
        return res.status(400).send(errorMessage)
      }

      await db.updateButton(
        data.displayName,
        data.serialNumber,
        data.phoneNumber,
        data.isDisplayed === 'true',
        data.isSendingAlerts === 'true',
        data.isSendingVitals === 'true',
        data.clientId,
        data.deviceId,
      )

      res.redirect(`/buttons/${data.deviceId}`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderNewGatewayPage(req, res) {
  try {
    const clients = await db.getClients()
    const viewParams = { clients: clients.filter(client => client.isDisplayed) }

    res.send(Mustache.render(newGatewayTemplate, viewParams, { nav: navPartial, css: buttonFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateNewGateway = Validator.body(['gatewayId', 'displayName', 'clientId']).trim().notEmpty()

async function submitNewGateway(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const allGateways = await db.getGateways()
      const data = req.body

      for (const gateway of allGateways) {
        if (gateway.id === data.gatewayId) {
          helpers.log('Gateway ID already exists')
          return res.status(400).send('Gateway ID already exists')
        }
      }

      const client = await db.getClientWithId(data.clientId)
      if (client === null) {
        const errorMessage = `Client ID '${data.clientId} does not exist`
        helpers.log(errorMessage)
        return res.status(400).send(errorMessage)
      }

      const newGateway = await db.createGatewayFromBrowserForm(data.gatewayId, data.clientId, data.displayName)

      res.redirect(`/clients/${newGateway.client.id}/vitals`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderUpdateGatewayPage(req, res) {
  try {
    const clients = await db.getClients()
    const gateway = await db.getGatewayWithGatewayId(req.params.id)

    const viewParams = {
      currentGateway: gateway,
      clients: clients
        .filter(client => client.isDisplayed)
        .map(client => {
          return {
            ...client,
            selected: client.id === gateway.client.id,
          }
        }),
    }

    res.send(Mustache.render(updateGatewayTemplate, viewParams, { nav: navPartial, css: buttonFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateUpdateGateway = Validator.body(['displayName', 'clientId', 'isSendingVitals', 'isDisplayed']).notEmpty()

async function submitUpdateGateway(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const data = req.body
      data.gatewayId = req.params.id

      const client = await db.getClientWithId(data.clientId)
      if (client === null) {
        const errorMessage = `Client ID '${data.clientId}' does not exist`
        return res.status(400).send(errorMessage)
      }

      await db.updateGateway(data.clientId, data.isSendingVitals === 'true', data.isDisplayed === 'true', data.gatewayId, data.displayName)

      res.redirect(`/clients/${data.clientId}/vitals`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderNewClientPage(req, res) {
  try {
    // Needed for navigation bar
    const clients = await db.getClients()
    const viewParams = { clients: clients.filter(client => client.isDisplayed) }

    res.send(Mustache.render(newClientTemplate, viewParams, { nav: navPartial, css: buttonFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderUpdateClientPage(req, res) {
  try {
    const clients = await db.getClients()
    const currentClient = clients.find(client => client.id === req.params.id)
    const clientExtension = await db.getClientExtensionWithClientId(req.params.id)

    const viewParams = {
      clients: clients.filter(client => client.isDisplayed),
      currentClient: {
        ...currentClient,
        country: clientExtension.country || '',
        countrySubdivision: clientExtension.countrySubdivision || '',
        buildingType: clientExtension.buildingType || '',
        organization: clientExtension.organization || '',
        funder: clientExtension.funder || '',
        postalCode: clientExtension.postalCode || '',
        city: clientExtension.city || '',
        project: clientExtension.project || '',
      },
    }

    res.send(Mustache.render(updateClientTemplate, viewParams, { nav: navPartial, css: buttonFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateNewClient = [
  Validator.body(['displayName', 'responderPhoneNumbers', 'fallbackPhoneNumbers', 'fromPhoneNumber', 'language', 'incidentCategories'])
    .trim()
    .notEmpty(),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.body(['country', 'countrySubdivision', 'buildingType', 'organization', 'funder', 'postalCode', 'city', 'project'])
    .trim()
    .optional({ nullable: true }),
]

async function submitNewClient(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const clients = await db.getClients()
      const data = req.body

      for (const client of clients) {
        if (client.displayName === data.displayName) {
          const errorMessage = `Client Display Name already exists: ${data.displayName}`
          helpers.log(errorMessage)
          return res.status(409).send(errorMessage)
        }
      }

      const newResponderPhoneNumbers =
        data.responderPhoneNumbers && data.responderPhoneNumbers.trim() !== ''
          ? data.responderPhoneNumbers.split(',').map(phone => phone.trim())
          : null
      const newHeartbeatPhoneNumbers =
        data.heartbeatPhoneNumbers !== undefined && data.heartbeatPhoneNumbers.trim() !== ''
          ? data.heartbeatPhoneNumbers.split(',').map(phone => phone.trim())
          : []

      const newClient = await db.createClient(
        data.displayName,
        newResponderPhoneNumbers,
        data.reminderTimeout,
        data.fallbackPhoneNumbers.split(',').map(phone => phone.trim()),
        data.fromPhoneNumber,
        data.fallbackTimeout,
        newHeartbeatPhoneNumbers,
        data.incidentCategories.split(',').map(category => category.trim()),
        true,
        false,
        false,
        data.language,
      )

      // create a client extension row for the newly created client
      await db.updateClientExtension(
        newClient.id,
        data.country || null,
        data.countrySubdivision || null,
        data.buildingType || null,
        data.organization || null,
        data.funder || null,
        data.postalCode || null,
        data.city || null,
        data.project || null,
      )

      res.redirect(`/clients/${newClient.id}`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateUpdateClient = [
  Validator.body([
    'displayName',
    'responderPhoneNumbers',
    'fallbackPhoneNumbers',
    'fromPhoneNumber',
    'incidentCategories',
    'isDisplayed',
    'isSendingAlerts',
    'isSendingVitals',
    'language',
  ])
    .trim()
    .notEmpty(),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.body(['country', 'countrySubdivision', 'buildingType', 'organization', 'funder', 'postalCode', 'city', 'project'])
    .trim()
    .optional({ nullable: true }),
]

async function submitUpdateClient(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const clients = await db.getClients()
      const data = req.body

      for (const client of clients) {
        if (client.displayName === data.displayName && client.id !== req.params.id) {
          const errorMessage = `Client Display Name already exists: ${data.displayName}`
          helpers.log(errorMessage)
          return res.status(409).send(errorMessage)
        }
      }

      const newResponderPhoneNumbers =
        data.responderPhoneNumbers && data.responderPhoneNumbers.trim() !== ''
          ? data.responderPhoneNumbers.split(',').map(phone => phone.trim())
          : null
      const newHeartbeatPhoneNumbers =
        data.heartbeatPhoneNumbers !== undefined && data.heartbeatPhoneNumbers.trim() !== ''
          ? data.heartbeatPhoneNumbers.split(',').map(phone => phone.trim())
          : []

      await db.updateClient(
        data.displayName,
        data.fromPhoneNumber,
        newResponderPhoneNumbers,
        data.reminderTimeout,
        data.fallbackPhoneNumbers.split(',').map(phone => phone.trim()),
        data.fallbackTimeout,
        newHeartbeatPhoneNumbers,
        data.incidentCategories.split(',').map(category => category.trim()),
        data.isDisplayed,
        data.isSendingAlerts,
        data.isSendingVitals,
        data.language,
        req.params.id,
      )

      await db.updateClientExtension(
        req.params.id,
        data.country || null,
        data.countrySubdivision || null,
        data.buildingType || null,
        data.organization || null,
        data.funder || null,
        data.postalCode || null,
        data.city || null,
        data.project || null,
      )

      res.redirect(`/clients/${req.params.id}`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderClientDetailsPage(req, res) {
  try {
    const clients = await db.getClients()

    const currentClient = clients.find(client => client.id === req.params.id)

    const buttons = await db.getButtonsFromClientId(currentClient.id)

    for (const button of buttons) {
      const recentSession = await db.getMostRecentSessionWithDevice(button)
      if (recentSession !== null) {
        const sessionCreatedAt = Date.parse(recentSession.createdAt)
        const timeSinceLastSession = await helpers.generateCalculatedTimeDifferenceString(sessionCreatedAt, db)
        button.sessionStart = timeSinceLastSession
      }
    }

    const viewParams = {
      clients: clients.filter(client => client.isDisplayed),
      currentClient,
      buttons: buttons
        .filter(button => button.isDisplayed)
        .map(button => {
          return {
            name: button.displayName,
            id: button.id,
            sessionStart: button.sessionStart,
            isSendingAlerts: button.isSendingAlerts && button.client.isSendingAlerts,
            isSendingVitals: button.isSendingVitals && button.client.isSendingVitals,
          }
        }),
    }

    res.send(Mustache.render(clientPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderClientVitalsPage(req, res) {
  try {
    const clients = await db.getClients()

    if (typeof req.params.clientId !== 'string') {
      res.redirect(`/clients/${clients[0].id}/vitals`)
      return
    }

    const currentClient = await db.getClientWithId(req.params.clientId)
    const viewParams = {
      buttons: [],
      gateways: [],
      clients: clients.filter(client => client.isDisplayed),
      currentDateTime: helpers.formatDateTimeForDashboard(await db.getCurrentTime()),
    }

    if (currentClient !== null) {
      viewParams.currentClientName = currentClient.displayName
      viewParams.currentClientId = currentClient.id

      const buttonsVitals = await db.getRecentButtonsVitalsWithClientId(req.params.clientId)
      for (const buttonsVital of buttonsVitals) {
        if (buttonsVital.device.isDisplayed) {
          let rssiClass = 'text-warning'
          if (buttonsVital.rssi < rssiBadThreshold || buttonsVital.snr === null) {
            rssiClass = 'text-danger'
          } else if (buttonsVital.rssi > rssiGoodThreshold) {
            rssiClass = 'text-success'
          }

          let snrClass = 'text-warning'
          if (buttonsVital.snr < snrBadThreshold || buttonsVital.snr === null) {
            snrClass = 'text-danger'
          } else if (buttonsVital.snr > snrGoodThreshold) {
            snrClass = 'text-success'
          }

          let signalStrength = 'Ok'
          if (buttonsVital.snr === null || buttonsVital.rssi === null) {
            signalStrength = 'Unknown'
          } else if (rssiClass === 'text-danger' || snrClass === 'text-danger') {
            signalStrength = 'Bad'
          } else if (rssiClass === 'text-success' && snrClass === 'text-success') {
            signalStrength = 'Good'
          }

          viewParams.buttons.push({
            unit: buttonsVital.device.displayName,
            batteryLevel: buttonsVital.batteryLevel !== null ? buttonsVital.batteryLevel : 'unknown',
            rssi: buttonsVital.rssi !== null ? buttonsVital.rssi : 'unknown',
            snr: buttonsVital.snr !== null ? buttonsVital.snr : 'unknown',
            rssiClass,
            snrClass,
            signalStrength,
            lastSeenAt: buttonsVital.createdAt !== null ? helpers.formatDateTimeForDashboard(buttonsVital.createdAt) : 'Never',
            lastSeenAgo: buttonsVital.createdAt !== null ? await helpers.generateCalculatedTimeDifferenceString(buttonsVital.createdAt, db) : 'Never',
            isSendingAlerts: buttonsVital.device.isSendingAlerts && buttonsVital.device.client.isSendingAlerts,
            isSendingVitals: buttonsVital.device.isSendingVitals && buttonsVital.device.client.isSendingVitals,
          })
        }
      }

      const gatewaysVitals = await db.getRecentGatewaysVitalsWithClientId(currentClient.id)
      for (const gatewaysVital of gatewaysVitals) {
        if (gatewaysVital.gateway.isDisplayed) {
          viewParams.gateways.push({
            id: gatewaysVital.gateway.id,
            name: gatewaysVital.gateway.displayName,
            lastSeenAt: gatewaysVital.lastSeenAt !== null ? helpers.formatDateTimeForDashboard(gatewaysVital.lastSeenAt) : 'Never',
            lastSeenAgo:
              gatewaysVital.lastSeenAt !== null ? await helpers.generateCalculatedTimeDifferenceString(gatewaysVital.lastSeenAt, db) : 'Never',
            isSendingVitals: gatewaysVital.gateway.isSendingVitals && gatewaysVital.gateway.client.isSendingVitals,
          })
        }
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
    const clients = await db.getClients()

    const viewParams = {
      buttons: [],
      gateways: [],
      clients: clients.filter(client => client.isDisplayed),
      currentDateTime: helpers.formatDateTimeForDashboard(await db.getCurrentTime()),
    }

    const buttonsVitals = await db.getRecentButtonsVitals()
    for (const buttonsVital of buttonsVitals) {
      if (buttonsVital.device.isDisplayed) {
        let rssiClass = 'text-warning'
        if (buttonsVital.rssi < rssiBadThreshold || buttonsVital.snr === null) {
          rssiClass = 'text-danger'
        } else if (buttonsVital.rssi > rssiGoodThreshold) {
          rssiClass = 'text-success'
        }

        let snrClass = 'text-warning'
        if (buttonsVital.snr < snrBadThreshold || buttonsVital.snr === null) {
          snrClass = 'text-danger'
        } else if (buttonsVital.snr > snrGoodThreshold) {
          snrClass = 'text-success'
        }

        let signalStrength = 'Ok'
        if (buttonsVital.snr === null || buttonsVital.rssi === null) {
          signalStrength = 'Unknown'
        } else if (rssiClass === 'text-danger' || snrClass === 'text-danger') {
          signalStrength = 'Bad'
        } else if (rssiClass === 'text-success' && snrClass === 'text-success') {
          signalStrength = 'Good'
        }

        viewParams.buttons.push({
          clientName: buttonsVital.device.client.displayName,
          clientId: buttonsVital.device.client.id,
          unit: buttonsVital.device.displayName,
          batteryLevel: buttonsVital.batteryLevel !== null ? buttonsVital.batteryLevel : 'unknown',
          rssi: buttonsVital.rssi !== null ? buttonsVital.rssi : 'unknown',
          snr: buttonsVital.snr !== null ? buttonsVital.snr : 'unknown',
          rssiClass,
          snrClass,
          signalStrength,
          lastSeenAt: buttonsVital.createdAt !== null ? helpers.formatDateTimeForDashboard(buttonsVital.createdAt) : 'Never',
          lastSeenAgo: buttonsVital.createdAt !== null ? await helpers.generateCalculatedTimeDifferenceString(buttonsVital.createdAt, db) : 'Never',
          isSendingAlerts: buttonsVital.device.isSendingAlerts && buttonsVital.device.client.isSendingAlerts,
          isSendingVitals: buttonsVital.device.isSendingVitals && buttonsVital.device.client.isSendingVitals,
        })
      }
    }

    const gatewaysVitals = await db.getRecentGatewaysVitals()
    for (const gatewaysVital of gatewaysVitals) {
      if (gatewaysVital.gateway.isDisplayed) {
        viewParams.gateways.push({
          clientName: gatewaysVital.gateway.client.displayName,
          clientId: gatewaysVital.gateway.client.id,
          id: gatewaysVital.gateway.id,
          name: gatewaysVital.gateway.displayName,
          lastSeenAt: gatewaysVital.lastSeenAt !== null ? helpers.formatDateTimeForDashboard(gatewaysVital.lastSeenAt) : 'Never',
          lastSeenAgo:
            gatewaysVital.lastSeenAt !== null ? await helpers.generateCalculatedTimeDifferenceString(gatewaysVital.lastSeenAt, db) : 'Never',
          isSendingVitals: gatewaysVital.gateway.isSendingVitals && gatewaysVital.gateway.client.isSendingVitals,
        })
      }
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
    'Country',
    'Country Subdivision',
    'Building Type',
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
  renderNewGatewayPage,
  renderUpdateGatewayPage,
  renderNewClientPage,
  renderUpdateClientPage,
  renderClientDetailsPage,
  renderClientVitalsPage,
  renderDashboardPage,
  renderButtonDetailsPage,
  renderLoginPage,
  renderVitalsPage,
  renderUpdateButtonPage,
  sessionChecker,
  setupDashboardSessions,
  submitLogin,
  submitLogout,
  submitNewClient,
  submitUpdateClient,
  submitNewGateway,
  submitUpdateGateway,
  submitUpdateButton,
  validateNewClient,
  validateUpdateClient,
  validateNewGateway,
  validateUpdateGateway,
  validateUpdateButton,
}
