// In-house dependencies
const { googleHelpers } = require('brave-alert-lib')
const dashboard = require('./dashboard')
const api = require('./api')
const pa = require('./pa')
const rak = require('./rak')

function configureRoutes(app) {
  // to-be-deprecated routes: keep these until the PA dashboard is complete
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderDashboardPage)
  app.get('/clients/:clientId?', dashboard.sessionChecker, dashboard.renderClientDetailsPage)
  app.get('/clients/:clientId/vitals', dashboard.sessionChecker, dashboard.renderClientVitalsPage)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)
  app.get('/vitals', dashboard.sessionChecker, dashboard.renderVitalsPage)
  app.post('/login', dashboard.submitLogin)

  // new to-be-implemented API routes
  app.get('/api/clients', api.authorize, api.handleGetClients)
  app.get('/api/clients/:clientId', api.validateGetClient, api.authorize, api.handleGetClient)
  app.get('/api/clients/:clientId/buttons', api.validateGetClientButtons, api.authorize, api.handleGetClientButtons)
  app.get('/api/clients/:clientId/buttons/:buttonId', api.validateGetClientButton, api.authorize, api.handleGetClientButton)
  app.get('/api/clients/:clientId/buttons/:buttonId/sessions', api.validateGetClientButtonSessions, api.authorize, api.handleGetClientButtonSessions)
  app.get('/api/clients/:clientId/gateways', api.validateGetClientGateways, api.authorize, api.handleGetClientGateways)
  app.get('/api/clients/:clientId/gateways/:gatewayId', api.validateGetClientGateway, api.authorize, api.handleGetClientGateway)
  app.get('/api/clients/:clientId/vitals', api.validateGetClientVitals, api.authorize, api.handleGetClientVitals)
  app.post('/api/clients', api.validateCreateClient, api.authorize, api.handleCreateClient)
  app.post('/api/clients/:clientId/buttons', api.validateCreateClientButton, api.authorize, api.handleCreateClientButton)
  app.post('/api/clients/:clientId/gateways', api.validateCreateClientGateway, api.authorize, api.handleCreateClientGateway)
  app.put('/api/clients/:clientId', api.validateUpdateClient, api.authorize, api.handleUpdateClient)
  app.put('/api/clients/:clientId/buttons/:buttonId', api.validateUpdateClientButton, api.authorize, api.handleUpdateClientButton)
  app.put('/api/clients/:clientId/gateways/:gatewayId', api.validateUpdateClientGateway, api.authorize, api.handleUpdateClientGateway)

  // non-client specific vitals: are these useful?
  // Johnny: haven't really used them. Good to have a glance and see which devices are down?
  // - Would need to filter manually, so filtering tools would be handy; maybe to display only down devices.
  // app.get('/api/vitals', api.validateGetVitals, api.authorize, api.handleGetVitals)

  // misc. PA API routes
  app.post('/pa/aws-device-registration', pa.validateAwsDeviceRegistration, googleHelpers.paAuthorize, pa.handleAwsDeviceRegistration)
  app.post('/pa/buttons-twilio-number', pa.validateButtonsTwilioNumber, googleHelpers.paAuthorize, pa.handleButtonsTwilioNumber)
  app.post('/pa/message-clients', pa.validateMessageClients, googleHelpers.paAuthorize, pa.handleMessageClients)
  app.post('/pa/health', pa.validateCheckDatabaseConnection, googleHelpers.paAuthorize, pa.handleCheckDatabaseConnection)

  // other routes
  app.get('/export-data', dashboard.sessionChecker, dashboard.downloadCsv)
  app.post('/rak_button_press', rak.validateButtonPress, rak.handleButtonPress)
}

module.exports = {
  configureRoutes,
}
