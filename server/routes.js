// In-house dependencies
const { googleHelpers } = require('brave-alert-lib')
const dashboard = require('./dashboard')
const pa = require('./pa')
const rak = require('./rak')

function configureRoutes(app) {
  // clients PA API routes
  app.get('/pa/clients', pa.validateGetClients, googleHelpers.paAuthorize, pa.handleGetClients)
  app.post('/pa/clients', pa.validateRegisterClient, googleHelpers.paAuthorize, pa.handleRegisterClient)
  app.get('/pa/clients/:clientId', pa.validateGetClient, googleHelpers.paAuthorize, pa.handleGetClient)
  app.put('/pa/clients/:clientId', pa.validatePutClient, googleHelpers.paAuthorize, pa.handlePutClient)
  app.get('/pa/clients/:clientId/buttons', pa.validateGetClientButtons, googleHelpers.paAuthorize, pa.handleGetClientButtons)
  // app.get('/pa/clients/:clientId/sessions', pa.validateGetClientSessions, googleHelpers.paAuthorize, pa.handleGetClientSessions)
  app.get('/pa/clients/:clientId/gateways', pa.validateGetClientGateways, googleHelpers.paAuthorize, pa.handleGetClientGateways)

  // buttons PA API routes
  app.post('/pa/buttons', pa.validateRegisterButton, googleHelpers.paAuthorize, pa.handleRegisterButton)
  app.get('/pa/buttons/:buttonId', pa.validateGetButton, googleHelpers.paAuthorize, pa.handleGetButton)
  app.put('/pa/buttons/:buttonId', pa.validatePutButton, googleHelpers.paAuthorize, pa.handlePutButton)
  app.get('/pa/buttons/:buttonId/vitals', pa.validateGetButtonVitals, googleHelpers.paAuthorize, pa.handleGetButtonVitals)

  // sessions PA API routes
  app.get('/pa/sessions/:buttonId?', pa.validateGetSessions, googleHelpers.paAuthorize, pa.handleGetSessions)

  // gateways PA API routes
  app.post('/pa/gateways', pa.validateRegisterGateway, googleHelpers.paAuthorize, pa.handleRegisterGateway)
  app.get('/pa/gateways/:gatewayId', pa.validateGetGateway, googleHelpers.paAuthorize, pa.handleGetGateway)
  app.put('/pa/gateways/:gatewayId', pa.validatePutGateway, googleHelpers.paAuthorize, pa.handlePutGateway)
  app.get('/pa/gateways/:gatewayId/vitals', pa.validateGetGatewayVitals, googleHelpers.paAuthorize, pa.handleGetGatewayVitals)

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
