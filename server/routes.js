// Third-party dependencies
const express = require('express')

// In-house dependencies
const { clickUpHelpers } = require('brave-alert-lib')
const dashboard = require('./dashboard')
const flic = require('./flic')
const pa = require('./pa')
const radiobridge = require('./radiobridge')
const rak = require('./rak.js')
const vitals = require('./vitals')

const jsonBodyParser = express.json()

function configureRoutes(app) {
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderDashboardPage)
  app.get('/clients/:clientId?', dashboard.sessionChecker, dashboard.renderClientDetailsPage)
  app.get('/clients/:clientId/vitals', dashboard.sessionChecker, dashboard.renderClientVitalsPage)
  app.get('/export-data', dashboard.sessionChecker, dashboard.downloadCsv)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)
  app.get('/vitals', dashboard.sessionChecker, dashboard.renderVitalsPage)

  app.post('/flic_button_press', flic.validateButtonPress, flic.handleButtonPress)
  app.post('/heartbeat', jsonBodyParser, vitals.handleHeartbeat)
  app.post('/login', dashboard.submitLogin)
  app.post('/pa/buttons-twilio-number', pa.validateButtonsTwilioNumber, clickUpHelpers.clickUpChecker, pa.handleButtonsTwilioNumber)
  app.post('/radiobridge_button_press', jsonBodyParser, radiobridge.validateButtonPress, radiobridge.handleButtonPress)
  app.post('/rak_button_press', jsonBodyParser, rak.validateButtonPress, rak.handleButtonPress)
}

module.exports = {
  configureRoutes,
}
