// In-house dependencies
const { clickUpHelpers } = require('brave-alert-lib')
const dashboard = require('./dashboard')
const pa = require('./pa')
const rak = require('./rak')
const api = require('./api')

function configureRoutes(app) {
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderDashboardPage)
  app.get('/clients/:clientId?', dashboard.sessionChecker, dashboard.renderClientDetailsPage)
  app.get('/clients/:clientId/vitals', dashboard.sessionChecker, dashboard.renderClientVitalsPage)
  app.get('/export-data', dashboard.sessionChecker, dashboard.downloadCsv)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)
  app.get('/vitals', dashboard.sessionChecker, dashboard.renderVitalsPage)

  app.post('/login', dashboard.submitLogin)
  app.post('/pa/aws-device-registration', pa.validateAwsDeviceRegistration, clickUpHelpers.clickUpChecker, pa.handleAwsDeviceRegistration)
  app.post('/pa/buttons-twilio-number', pa.validateButtonsTwilioNumber, clickUpHelpers.clickUpChecker, pa.handleButtonsTwilioNumber)
  app.post('/rak_button_press', rak.validateButtonPress, rak.handleButtonPress)

  app.post('/api/message-clients', api.validateMessageClients, api.authorize, api.messageClients)
}

module.exports = {
  configureRoutes,
}
