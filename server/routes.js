// In-house dependencies
const { googleHelpers } = require('brave-alert-lib')
const dashboard = require('./dashboard')
const api = require('./api')
const pa = require('./pa')
const rak = require('./rak')

function configureRoutes(app) {
  // to-be-deprecated mustache routes
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/clients/new', dashboard.sessionChecker, dashboard.renderNewClientPage) // Must be configured before /clients/:id
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderDashboardPage)
  app.get('/clients/:id', dashboard.sessionChecker, dashboard.renderClientDetailsPage)
  app.get('/clients/:clientId/vitals', dashboard.sessionChecker, dashboard.renderClientVitalsPage)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)
  app.get('/vitals', dashboard.sessionChecker, dashboard.renderVitalsPage)
  app.get('/buttons/new', dashboard.sessionChecker, dashboard.renderNewButtonPage)
  app.get('/buttons/:id', dashboard.sessionChecker, dashboard.renderButtonDetailsPage)
  app.get('/buttons/:id/edit', dashboard.sessionChecker, dashboard.renderUpdateButtonPage)
  app.get('/clients/:id/edit', dashboard.sessionChecker, dashboard.renderUpdateClientPage)
  app.get('/gateways/new', dashboard.sessionChecker, dashboard.renderNewGatewayPage)
  app.get('/gateways/:id/edit', dashboard.sessionChecker, dashboard.renderUpdateGatewayPage)
  app.get('/export-data', dashboard.sessionChecker, dashboard.downloadCsv)

  app.post('/clients', dashboard.validateNewClient, dashboard.submitNewClient)
  app.post('/login', dashboard.submitLogin)
  app.post('/rak_button_press', rak.validateButtonPress, rak.handleButtonPress)
  app.post('/clients/:id', dashboard.validateUpdateClient, dashboard.submitUpdateClient)
  app.post('/gateways', dashboard.validateNewGateway, dashboard.submitNewGateway)
  app.post('/gateways/:id', dashboard.validateUpdateGateway, dashboard.submitUpdateGateway)
  app.post('/buttons/:id', dashboard.validateUpdateButton, dashboard.submitUpdateButton)
  app.post('/buttons', dashboard.validateNewButton, dashboard.submitNewButton)

  // Brave Buttons API endpoints (read-only, matching Brave Sensor API structure)

  // Client endpoints
  app.get('/api/clients', api.validatePagination, api.authorize, api.handleGetClients)
  app.post('/api/clients', api.validateBulkIds, api.authorize, api.handleBulkGetClients)
  app.get('/api/clients/:clientId', api.validateGetClient, api.authorize, api.handleGetClient)

  // Device endpoints (global)
  app.get('/api/devices', api.validatePagination, api.authorize, api.handleGetDevices)
  app.post('/api/devices', api.validateBulkIds, api.authorize, api.handleBulkGetDevices)
  app.get('/api/devices/:deviceId', api.validateGetDevice, api.authorize, api.handleGetDevice)

  // Device endpoints (client-scoped)
  app.get('/api/clients/:clientId/devices', api.validateGetClientDevices, api.authorize, api.handleGetClientDevices)
  app.post('/api/clients/:clientId/devices', api.validateBulkGetClientDevices, api.authorize, api.handleBulkGetClientDevices)
  app.get('/api/clients/:clientId/devices/:deviceId', api.validateGetClientDevice, api.authorize, api.handleGetClientDevice)

  // Gateway endpoints (global)
  app.get('/api/gateways', api.validatePagination, api.authorize, api.handleGetGateways)
  app.post('/api/gateways', api.validateBulkIds, api.authorize, api.handleBulkGetGateways)
  app.get('/api/gateways/:gatewayId', api.validateGetGateway, api.authorize, api.handleGetGateway)

  // Gateway endpoints (client-scoped)
  app.get('/api/clients/:clientId/gateways', api.validateGetClientGateways, api.authorize, api.handleGetClientGateways)
  app.post('/api/clients/:clientId/gateways', api.validateBulkGetClientGateways, api.authorize, api.handleBulkGetClientGateways)
  app.get('/api/clients/:clientId/gateways/:gatewayId', api.validateGetClientGateway, api.authorize, api.handleGetClientGateway)

  // Session endpoints (global)
  app.get('/api/sessions', api.validatePagination, api.validateGetSessions, api.authorize, api.handleGetSessions)

  // Session endpoints (client-scoped)
  app.get('/api/clients/:clientId/sessions', api.validatePagination, api.validateGetClientSessions, api.authorize, api.handleGetClientSessions)
  app.get('/api/clients/:clientId/sessions/stats', api.validateGetClientSessionStats, api.authorize, api.handleGetClientSessionStats)

  // Vitals endpoints
  app.get('/api/clients/:clientId/vitals', api.validateGetClientVitals, api.authorize, api.handleGetClientVitals)
  app.get('/api/devices/:deviceId/vitals', api.validatePagination, api.validateGetDeviceVitals, api.authorize, api.handleGetDeviceVitals)
  app.get('/api/gateways/:gatewayId/vitals', api.validatePagination, api.validateGetGatewayVitals, api.authorize, api.handleGetGatewayVitals)

  // Update endpoints
  app.post('/api/clients/:clientId/devices/:deviceId/settings', api.validateUpdateClientDeviceSendingSettings, api.authorize, api.handleUpdateClientDeviceSendingSettings)

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
}

module.exports = {
  configureRoutes,
}
