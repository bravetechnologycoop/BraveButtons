// In-house dependencies
const { googleHelpers } = require('brave-alert-lib')
const dashboard = require('./dashboard')
const pa = require('./pa')
const rak = require('./rak')

function configureRoutes(app) {
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/clients/new', dashboard.sessionChecker, dashboard.renderNewClientPage) // Must be configured before /clients/:id
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderDashboardPage)
  app.get('/clients/:id', dashboard.sessionChecker, dashboard.renderClientDetailsPage)
  app.get('/clients/:clientId/vitals', dashboard.sessionChecker, dashboard.renderClientVitalsPage)
  app.get('/export-data', dashboard.sessionChecker, dashboard.downloadCsv)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)
  app.get('/vitals', dashboard.sessionChecker, dashboard.renderVitalsPage)
  app.get('/buttons/:id', dashboard.sessionChecker, dashboard.renderButtonDetailsPage)
  app.get('/clients/:id/edit', dashboard.sessionChecker, dashboard.renderUpdateClientPage)
  app.get('/gateways/new', dashboard.sessionChecker, dashboard.renderNewGatewayPage)
  app.get('/gateways/:id/edit', dashboard.sessionChecker, dashboard.renderUpdateGatewayPage)

  app.post('/clients', dashboard.validateNewClient, dashboard.submitNewClient)
  app.post('/login', dashboard.submitLogin)
  app.post('/pa/aws-device-registration', pa.validateAwsDeviceRegistration, googleHelpers.paAuthorize, pa.handleAwsDeviceRegistration)
  app.post('/pa/buttons-twilio-number', pa.validateButtonsTwilioNumber, googleHelpers.paAuthorize, pa.handleButtonsTwilioNumber)
  app.post('/pa/message-clients', pa.validateMessageClients, googleHelpers.paAuthorize, pa.handleMessageClients)
  app.post('/pa/health', pa.validateCheckDatabaseConnection, googleHelpers.paAuthorize, pa.handleCheckDatabaseConnection)
  app.post('/rak_button_press', rak.validateButtonPress, rak.handleButtonPress)
  app.post('/clients/:id', dashboard.validateUpdateClient, dashboard.submitUpdateClient)
  app.post('/gateways', dashboard.validateNewGateway, dashboard.submitNewGateway)
  app.post('/gateways/:id', dashboard.validateUpdateGateway, dashboard.submitUpdateGateway)
}

module.exports = {
  configureRoutes,
}
