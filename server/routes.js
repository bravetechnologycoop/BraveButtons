// In-house dependencies
const { googleHelpers } = require('brave-alert-lib')
const dashboard = require('./dashboard')
const api = require('./api')
const pa = require('./pa')
const rak = require('./rak')

function configureRoutes(app) {
  // to-be-deprecated mustache routes
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderDashboardPage)
  app.get('/clients/:clientId?', dashboard.sessionChecker, dashboard.renderClientDetailsPage)
  app.get('/clients/:clientId/vitals', dashboard.sessionChecker, dashboard.renderClientVitalsPage)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)
  app.get('/vitals', dashboard.sessionChecker, dashboard.renderVitalsPage)
  app.post('/login', dashboard.submitLogin)

  // to-be-used API routes
  app.get('/api/clients', api.authorize, api.handleGetClients)
  app.post('/api/clients', api.validateCreateClient, api.authorize, api.handleCreateClient)
  app.get('/api/clients/:clientId', api.validateGetClient, api.authorize, api.handleGetClient)
  app.put('/api/clients/:clientId', api.validateUpdateClient, api.authorize, api.handleUpdateClient)
  app.get('/api/clients/:clientId/buttons', api.validateGetClientButtons, api.authorize, api.handleGetClientButtons)
  app.post('/api/clients/:clientId/buttons', api.validateCreateClientButton, api.authorize, api.handleCreateClientButton)
  app.get('/api/clients/:clientId/buttons/:buttonId', api.validateGetClientButton, api.authorize, api.handleGetClientButton)
  app.put('/api/clients/:clientId/buttons/:buttonId', api.validateUpdateClientButton, api.authorize, api.handleUpdateClientButton)
  app.get('/api/clients/:clientId/sessions', api.validateGetClientSessions, api.authorize, api.handleGetClientSessions)
  app.get('/api/clients/:clientId/gateways', api.validateGetClientGateways, api.authorize, api.handleGetClientGateways)
  app.post('/api/clients/:clientId/gateways', api.validateCreateClientGateway, api.authorize, api.handleCreateClientGateway)
  app.get('/api/clients/:clientId/gateways/:gatewayId', api.validateGetClientGateway, api.authorize, api.handleGetClientGateway)
  app.put('/api/clients/:clientId/gateways/:gatewayId', api.validateUpdateClientGateway, api.authorize, api.handleUpdateClientGateway)
  app.get('/api/clients/:clientId/vitals', api.validateGetClientVitals, api.authorize, api.handleGetClientVitals)

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
