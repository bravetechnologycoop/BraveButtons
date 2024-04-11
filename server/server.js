// Third-party dependencies
const fs = require('fs')
const express = require('express')
const https = require('https')
const cors = require('cors')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('./BraveAlerterConfigurator')
const db = require('./db/db')
const vitals = require('./vitals')
const routes = require('./routes')
const buttonAlerts = require('./buttonAlerts')
const dashboard = require('./dashboard')
const i18nextHelpers = require('./i18nextHelpers')

// Configure internationalization
i18nextHelpers.setup()

// Configure BraveAlerter
const braveAlerter = new BraveAlerterConfigurator().createBraveAlerter()

// Start and configure Express App
const app = express()

app.use(express.json()) // Body Parser Middleware
app.use(express.urlencoded({ extended: true }))
app.use(cors()) // Cors Middleware (Cross Origin Resource Sharing)
dashboard.setupDashboardSessions(app)

// Add routes
routes.configureRoutes(app)

// Add BraveAlerter's routes ( /alert/* )
app.use(braveAlerter.getRouter())

vitals.setup(braveAlerter)

buttonAlerts.setup(braveAlerter)

let server

if (helpers.isTestEnvironment()) {
  // local http server for testing
  server = app.listen(8001)
} else {
  helpers.setupSentry(app, helpers.getEnvVar('SENTRY_DSN'), helpers.getEnvVar('SENTRY_ENVIRONMENT'), helpers.getEnvVar('SENTRY_RELEASE'))
  const httpsOptions = {
    key: fs.readFileSync(`/etc/letsencrypt/live/${helpers.getEnvVar('DOMAIN')}/privkey.pem`),
    cert: fs.readFileSync(`/etc/letsencrypt/live/${helpers.getEnvVar('DOMAIN')}/fullchain.pem`),
  }
  server = https.createServer(httpsOptions, app).listen(443)
  setInterval(vitals.checkGatewayHeartbeat, 5 * 60 * 1000)
  setInterval(vitals.checkButtonBatteries, 5 * 60 * 1000)
  const minutesBetweenHeartbeatChecks = parseInt(helpers.getEnvVar('VITALS_MINUTES_BETWEEN_HEARTBEAT_CHECKS'), 10)
  setInterval(vitals.checkButtonHeartbeat, minutesBetweenHeartbeatChecks * 60 * 1000)
  helpers.log('brave server listening on port 443')
}

module.exports.braveAlerter = braveAlerter // for tests
module.exports.server = server
module.exports.db = db
