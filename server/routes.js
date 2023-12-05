// In-house dependencies
const { googleHelpers } = require('brave-alert-lib')
const dashboard = require('./dashboard')
const pa = require('./pa')
const rak = require('./rak')

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
  app.post('/pa/aws-device-registration', pa.validateAwsDeviceRegistration, googleHelpers.paAuthorize, pa.handleAwsDeviceRegistration)
  app.post('/pa/buttons-twilio-number', pa.validateButtonsTwilioNumber, googleHelpers.paAuthorize, pa.handleButtonsTwilioNumber)
  app.post('/pa/message-clients', pa.validateMessageClients, googleHelpers.paAuthorize, pa.handleMessageClients)
  app.post('/rak_button_press', rak.validateButtonPress, rak.handleButtonPress)
}

module.exports = {
  configureRoutes,
}
