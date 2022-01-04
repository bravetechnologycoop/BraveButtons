// Third-party dependencies
const express = require('express')

// In-house dependencies
const flic = require('./flic')
const radiobridge = require('./radiobridge')
const vitals = require('./vitals')

const jsonBodyParser = express.json()

function configureRoutes(app) {
  app.get('/heartbeatDashboard', vitals.handleHeartbeatDashboard)

  app.post('/flic_button_press', flic.validateButtonPress, flic.handleButtonPress)
  app.post('/heartbeat', jsonBodyParser, vitals.handleHeartbeat)
  app.post('/radiobridge_button_press', jsonBodyParser, radiobridge.validateButtonPress, radiobridge.handleButtonPress)

  // TODO add the other routes
}

module.exports = {
  configureRoutes,
}
