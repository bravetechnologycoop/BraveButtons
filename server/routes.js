// In-house dependencies
const { googleHelpers } = require('brave-alert-lib')
const dashboard = require('./dashboard')
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
  /* get all clients */
  app.get('/api/clients', pa.validateGetClients, googleHelpers.paAuthorize, pa.handleGetClients)
  /* create new client */
  app.post('/api/clients', pa.validateRegisterClient, googleHelpers.paAuthorize, pa.handleRegisterClient)
  /* get client information */
  app.get('/api/clients/:clientId', pa.validateGetClient, googleHelpers.paAuthorize, pa.handleGetClient)
  /* update client information */
  app.put('/api/clients/:clientId', pa.validateUpdateClient, googleHelpers.paAuthorize, pa.handleUpdateClient)
  /* get all client's buttons */
  app.get('/api/clients/:clientId/buttons', pa.validateGetClientButtons, googleHelpers.paAuthorize, pa.handleGetClientButtons)
  /* register button */
  app.post('/api/clients/:clientId/buttons', pa.validateRegisterClientButton, googleHelpers.paAuthorize, pa.handleRegisterClientButton)
  /* get specific button */
  app.get('/api/clients/:clientId/buttons/:buttonId', pa.validateGetClientButton, googleHelpers.paAuthorize, pa.handleGetClientButton)
  /* update specific button */
  app.put('/api/clients/:clientId/buttons/:buttonId', pa.validateUpdateClientButton, googleHelpers.paAuthorize, pa.handleUpdateClientButton)
  /* array of button sessions; consider paging: limit & offset */
  app.get('/api/clients/:clientId/buttons/:buttonId/sessions', pa.validateGetClientButtons, googleHelpers.paAuthorize, pa.handleGetClientButtons)
  /* get all client's gateways */
  app.get('/api/clients/:clientId/gateways', pa.validateGetClientGateways, googleHelpers.paAuthorize, pa.handleGetClientGateways)
  /* register gateway */
  app.post('/api/clients/:clientId/gateways', pa.validateRegisterClientGateway, googleHelpers.paAuthorize, pa.handleRegisterClientGateway)
  /* get specific gateway */
  app.get('/api/clients/:clientId/gateways/:gatewayId', pa.validateGetClientGateway, googleHelpers.paAuthorize, pa.handleGetClientGateway)
  /* update specific gateway */
  app.put('/api/clients/:clientId/gateways/:gatewayId', pa.validateUpdateClientGateway, googleHelpers.paAuthorize, pa.handleUpdateClientGateway)
  /* array of gateways and buttons vitals */
  app.get('/api/clients/:clientId/vitals', pa.validateGetClientVitals, googleHelpers.paAuthorize, pa.handleGetClientVitals)

  // non-client specific vitals: are these useful?
  // Johnny: haven't really used them. Good to have a glance and see which devices are down?
  // - Would need to filter manually, so filtering tools would be handy; maybe to display only down devices.
  // app.get('/api/vitals', pa.validateGetVitals, googleHelpers.paAuthorize, pa.handleGetVitals)

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
