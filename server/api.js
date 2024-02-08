/* Conventions for this API:
 *  - GET method for read actions
 *  - POST method for create actions (think POSTing a new item to a directory)
 *  - PUT method for update actions (think PUTting an item over an existing item)
 *  - DELETE method for delete actions
 *
 *  - Must authorize using the Authorization header in all requests
 *    - Presently, this is done as "Bearer (Google ID Token)" as requests should originate from PA
 *
 *  - Must return a JSON object containing the following keys:
 *    - status:   which will be either "success" or "error"
 *    - data:     the desired JSON object, if there is one
 *    - message:  a human-readable explanation of the error, if there was one and this is appropriate. Be careful
 *                to not include anything that will give an attacker extra information
 */

// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers, googleHelpers } = require('brave-alert-lib')
const db = require('./db/db')

// authorize function - using Google ID Tokens
// this should be significantly reworked if providing a limited API to clients
// NOTE: a route's validation should PRECEED the authorize function, and a route's handler should PROCEED the authorize function;
//   e.g.: app.method('/api/thing', api.validateThing, api.authorize, api.handleThing)
async function authorize(req, res, next) {
  // the Google ID Token should be given in the Authorization header of the request
  googleHelpers.paAuthorize(req, res, () => {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    try {
      if (validationErrors.isEmpty()) {
        next() // run handler function
      } else {
        res.status(400).send({ status: 'error', message: 'Bad Request' })
        helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
      }
    } catch (error) {
      res.status(500).send({ status: 'error', message: 'Internal Server Error' })
      helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
    }
  })
}

const validateCreateClient = [
  Validator.body(['displayName', 'fromPhoneNumber', 'language']).trim().isString().notEmpty(),
  Validator.body(['heartbeatPhoneNumbers']).isArray({ min: 0 }),
  Validator.body(['responderPhoneNumbers', 'fallbackPhoneNumbers', 'incidentCategories']).isArray({ min: 1 }),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.body(['isDisplayed', 'isSendingAlerts', 'isSendingVitals']).trim().isBoolean(),
]

async function handleCreateClient(req, res) {
  const client = await db.createClient(
    req.body.displayName,
    req.body.responderPhoneNumbers.map(phoneNumber => phoneNumber.trim()),
    req.body.reminderTimeout,
    req.body.fallbackPhoneNumbers.map(phoneNumber => phoneNumber.trim()),
    req.body.fromPhoneNumber,
    req.body.fallbackTimeout,
    req.body.heartbeatPhoneNumbers.map(phoneNumber => phoneNumber.trim()),
    req.body.incidentCategories,
    req.body.isDisplayed,
    req.body.isSendingAlerts,
    req.body.isSendingVitals,
    req.body.language,
  )

  if (client == null) {
    // will result in a status 500
    throw new Error('Failed to create client')
  }

  res.set('Location', `${req.path}/${client.id}`) // location of newly created client
  res.status(201).send({ status: 'success', data: client })
}

const validateCreateClientButton = [
  Validator.param(['clientId']).notEmpty(),
  Validator.body(['displayName', 'phoneNumber', 'buttonSerialNumber']).trim().isString().notEmpty(),
  Validator.body(['isDisplayed', 'isSendingAlerts', 'isSendingVitals']).trim().isBoolean(),
]

async function handleCreateClientButton(req, res) {
  const button = await db.createButton(
    req.params.clientId,
    req.body.displayName,
    req.body.phoneNumber,
    req.body.buttonSerialNumber,
    req.body.isDisplayed,
    req.body.isSendingAlerts,
    req.body.isSendingVitals,
    null,
    null,
  )

  // Couldn't create button; Internal server error.
  if (button == null) {
    throw new Error(`Couldn't create button for client ${req.params.clientId}.`)
  }

  res.set('Location', `${req.path}/${button.id}`) // location of newly created button
  res.status(201).send({ status: 'success', data: button })
}

const validateCreateClientGateway = [
  Validator.param(['gatewayId', 'clientId']).notEmpty(),
  Validator.body(['displayName']).trim().isString().notEmpty(),
  Validator.body(['isDisplayed', 'isSendingVitals']).trim().isBoolean(),
]

async function handleCreateClientGateway(req, res) {
  const gateway = await db.createGateway(
    req.body.gatewayId,
    req.params.clientId,
    req.body.displayName,
    null,
    req.body.isDisplayed,
    req.body.isSendingVitals,
  )

  // Should the database query fail, db.createGateway should internally handle thrown errors and return either null or undefined.
  // The status code 404 is used here as the failure was probably caused by the client not existing.
  if (gateway == null) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  res.set('Location', `${req.path}/${gateway.id}`) // location of newly created gateway
  res.status(201).send({ status: 'success', data: gateway })
}

const validateGetClient = Validator.param(['clientId']).notEmpty()

async function handleGetClient(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  // Couldn't get the client; Not found.
  if (client == null) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  res.status(200).send({ status: 'success', data: client })
}

async function handleGetClients(req, res) {
  const clients = await db.getClients()

  res.status(200).send({ status: 'success', data: clients })
}

const validateGetClientButton = Validator.param(['clientId', 'buttonId']).notEmpty()

async function handleGetClientButton(req, res) {
  const button = await db.getButtonWithId(req.params.buttonId)

  // Couldn't get the button; Not found.
  if (button == null || button.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  res.status(200).send({ status: 'success', data: button })
}

const validateGetClientButtons = Validator.param(['clientId']).notEmpty()

async function handleGetClientButtons(req, res) {
  const buttons = await db.getButtonsWithClientId(req.params.clientId)

  // if the query failed and returned null, the clientId is probably wrong
  if (buttons == null) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  // something like this: buttons = buttons.map(button => { button.sdfs ... })
  // (remove single field)

  res.status(200).send({ status: 'success', data: buttons })
}

const validateGetClientButtonSessions = Validator.param(['clientId', 'buttonId']).notEmpty()

async function handleGetClientButtonSessions(req, res) {
  const button = await db.getButtonWithId(req.params.buttonId)

  // check that this button exists and is owned by the specified client
  // NOTE: if clientId is invalid, then the query will fail and return null
  if (button == null || button.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  const sessions = await db.getRecentSessionsWithButtonId(req.params.buttonId)

  res.status(200).send({ status: 'success', data: sessions })
}

const validateGetClientGateway = Validator.param(['clientId', 'gatewayId']).notEmpty()

async function handleGetClientGateway(req, res) {
  const gateway = await db.getGatewayWithId(req.params.gatewayId)

  // check that this gateway exists and is owned by the specified client
  // NOTE: if clientId is invalid, then the query will fail and return null
  if (gateway == null || gateway.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  res.status(200).send({ status: 'success', data: gateway })
}

const validateGetClientGateways = Validator.param(['clientId']).notEmpty()

async function handleGetClientGateways(req, res) {
  const gateways = await db.getGatewaysWithClientId(req.params.clientId)

  // if the query failed and returned null, the clientId is probably wrong
  if (gateways == null) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  res.status(200).send({ status: 'success', data: gateways })
}

const validateGetClientVitals = Validator.param(['clientId']).notEmpty()

async function handleGetClientVitals(req, res) {
  const buttonVitals = await db.getRecentButtonsVitalsWithClientId(req.params.clientId)
  const gatewayVitals = await db.getRecentGatewaysVitalsWithClientId(req.params.clientId)

  // if either of the query failed and returned null, the clientId is probably wrong
  if (buttonVitals == null || gatewayVitals == null) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  res.status(200).send({ status: 'success', data: { buttonVitals, gatewayVitals } })
}

const validateUpdateClient = [
  Validator.param(['clientId']).notEmpty(),
  Validator.body(['displayName', 'fromPhoneNumber', 'language']).trim().isString().notEmpty(),
  Validator.body(['heartbeatPhoneNumbers']).isArray({ min: 0 }),
  Validator.body(['responderPhoneNumbers', 'fallbackPhoneNumbers', 'incidentCategories']).isArray({ min: 1 }),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.body(['isDisplayed', 'isSendingAlerts', 'isSendingVitals']).trim().isBoolean(),
]

async function handleUpdateClient(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  // check that the client exists
  if (client == null) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  // attempt to update the client
  const updatedClient = await db.updateClient(
    req.body.displayName,
    req.body.fromPhoneNumber,
    req.body.responderPhoneNumbers.map(phoneNumber => phoneNumber.trim()),
    req.body.reminderTimeout,
    req.body.fallbackPhoneNumbers.map(phoneNumber => phoneNumber.trim()),
    req.body.fallbackTimeout,
    req.body.heartbeatPhoneNumbers.map(phoneNumber => phoneNumber.trim()),
    req.body.incidentCategories,
    req.body.isDisplayed,
    req.body.isSendingAlerts,
    req.body.isSendingVitals,
    req.body.language,
    req.params.clientId,
  )

  // something bad happened and the client wasn't updated; blame it on the request
  if (updatedClient == null) {
    res.status(400).send({ status: 'error', message: 'Bad Request' })

    return
  }

  res.status(200).send({ status: 'success', data: updatedClient })
}

// NOTE: clientId is submitted in the param and body of the request.
// This is to let a button be moved from one client to another; think of the param clientId as 'from' and the body clientId as 'to'.
const validateUpdateClientButton = [
  Validator.param(['clientId', 'buttonId']).notEmpty(),
  Validator.body(['clientId', 'displayName', 'phoneNumber', 'buttonSerialNumber']).trim().isString().notEmpty(),
  Validator.body(['isDisplayed', 'isSendingAlerts', 'isSendingVitals']).trim().isBoolean(),
]

async function handleUpdateClientButton(req, res) {
  const button = await db.getButtonWithId(req.params.buttonId)

  // check that this button exists and is owned by the specified client
  // NOTE: if clientId is invalid, then the query will fail and return null
  if (button == null || button.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  // attempt to update the button
  const updatedButton = await db.updateButton(
    req.body.clientId,
    req.body.displayName,
    req.body.phoneNumber,
    req.body.buttonSerialNumber,
    req.body.isDisplayed,
    req.body.isSendingAlerts,
    req.body.isSendingVitals,
    req.params.buttonId,
  )

  // something bad happened and the button wasn't updated; blame it on the request
  if (updatedButton == null) {
    res.status(400).send({ status: 'error', message: 'Bad Request' })

    return
  }

  res.status(200).send({ status: 'success', data: updatedButton })
}

// NOTE: clientId is submitted in the param and body of the request.
// This is to let a gateway be moved from one client to another; think of the param clientId as 'from' and the body clientId as 'to'.
const validateUpdateClientGateway = [
  Validator.param(['clientId', 'gatewayId']).notEmpty(),
  Validator.body(['clientId', 'displayName']).trim().isString().notEmpty(),
  Validator.body(['isDisplayed', 'isSendingVitals']).trim().isBoolean(),
]

async function handleUpdateClientGateway(req, res) {
  const gateway = await db.getGatewayWithId(req.params.gatewayId)

  // check that this gateway exists and is owned by the specified client
  // NOTE: if clientId is invalid, then the query will fail and return null
  if (gateway == null || gateway.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  // attempt to update the gateway
  const updatedGateway = await db.updateGateway(
    req.body.clientId,
    req.body.displayName,
    req.body.isDisplayed,
    req.body.isSendingVitals,
    req.params.gatewayId,
  )

  // something bad happened and the gateway wasn't updated; blame it on the request
  if (updatedGateway == null) {
    res.status(400).send({ status: 'error', message: 'Bad Request' })

    return
  }

  res.status(200).send({ status: 'success', data: updatedGateway })
}

module.exports = {
  handleCreateClient,
  handleCreateClientButton,
  handleCreateClientGateway,
  handleGetClient,
  handleGetClients,
  handleGetClientButton,
  handleGetClientButtons,
  handleGetClientButtonSessions,
  handleGetClientGateway,
  handleGetClientGateways,
  handleGetClientVitals,
  handleUpdateClient,
  handleUpdateClientButton,
  handleUpdateClientGateway,
  validateCreateClient,
  validateCreateClientButton,
  validateCreateClientGateway,
  validateGetClient,
  validateGetClientButton,
  validateGetClientButtons,
  validateGetClientButtonSessions,
  validateGetClientGateway,
  validateGetClientGateways,
  validateGetClientVitals,
  validateUpdateClient,
  validateUpdateClientButton,
  validateUpdateClientGateway,
  authorize,
}
