// Third-party dependencies
const fs = require('fs')
const express = require('express')
const https = require('https')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('./BraveAlerterConfigurator')
const db = require('./db/db')
const vitals = require('./vitals')
const routes = require('./routes')
const buttonAlerts = require('./buttonAlerts')
const dashboard = require('./dashboard')

// Configure BraveAlerter
const braveAlerter = new BraveAlerterConfigurator().createBraveAlerter()

// Start and configure Express App
const app = express()
app.use(express.urlencoded({ extended: true }))
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
