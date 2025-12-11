/* Conventions for this API:
 *  - GET method for read actions
 *  - POST method for create actions (think POSTing a new item to a directory)
 *  - PUT method for update actions (think PUTting an item over an existing item)
 *  - DELETE method for delete actions
 *
 *  - Must authorize using the Authorization header in all requests
 *    - The value of the Authorization header must be the primary/secondary Brave API key
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
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')

// brave API key (currently the PA API key) for accessing the buttons API
const braveApiKey = helpers.getEnvVar('PA_API_KEY_PRIMARY')

// authorize function - using Brave API keys
// NOTE: a route's validation should PRECEED the authorize function, and a route's handler should PROCEED the authorize function;
//   e.g.: app.method('/api/thing', api.validateThing, api.authorize, api.handleThing)
async function authorize(req, res, next) {
  try {
    // get Authorization header of request
    const { authorization } = req.headers

    if (authorization === braveApiKey) {
      // check for validation errors
      const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

      if (validationErrors.isEmpty()) {
        next() // proceed to route implementation
      } else {
        res.status(400).send({ status: 'error', message: 'Bad Request' })
        helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
      }
    } else {
      res.status(401).send({ status: 'error', message: 'Unauthorized' })
      helpers.logError(`Unauthorized request to ${req.path}.`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
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

  if (!client) {
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
  if (!button) {
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
  // verify that the client exists
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  const gateway = await db.createGateway(
    req.params.gatewayId,
    req.params.clientId,
    req.body.displayName,
    null,
    req.body.isDisplayed,
    req.body.isSendingVitals,
  )

  // Should the database query fail, db.createGateway should internally handle thrown errors and return either null or undefined.
  // The status code 400 is used here as the failure was probably caused by invalid data or a duplicate gateway ID.
  if (!gateway) {
    res.status(400).send({ status: 'error', message: 'Bad Request' })

    return
  }

  res.set('Location', `${req.path}/${gateway.id}`) // location of newly created gateway
  res.status(201).send({ status: 'success', data: gateway })
}

const validateGetClient = Validator.param(['clientId']).notEmpty()

async function handleGetClient(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  // Couldn't get the client; Not found.
  if (!client) {
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
  const button = await db.getDeviceWithIds(req.params.buttonId, req.params.clientId)

  // Couldn't get the button; Not found.
  if (!button || button.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  res.status(200).send({ status: 'success', data: button })
}

const validateGetClientButtons = Validator.param(['clientId']).notEmpty()

async function handleGetClientButtons(req, res) {
  // First check if the client exists
  const client = await db.getClientWithId(req.params.clientId)
  
  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const buttons = await db.getButtonsFromClientId(req.params.clientId)

  // Return the buttons (empty array if none exist for this client)
  res.status(200).send({ status: 'success', data: buttons || [] })
}

const validateGetClientSessions = Validator.param(['clientId']).notEmpty()

async function handleGetClientSessions(req, res) {
  // TODO
  res.status(200).send({ status: 'success', data: [] })
}

const validateGetClientGateway = Validator.param(['clientId', 'gatewayId']).notEmpty()

async function handleGetClientGateway(req, res) {
  const gateway = await db.getGatewayWithGatewayId(req.params.gatewayId)

  // check that this gateway exists and is owned by the specified client
  // NOTE: if clientId is invalid, then the query will fail and return null
  if (!gateway || gateway.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  res.status(200).send({ status: 'success', data: gateway })
}

const validateGetClientGateways = Validator.param(['clientId']).notEmpty()

async function handleGetClientGateways(req, res) {
  // First check if the client exists
  const client = await db.getClientWithId(req.params.clientId)
  
  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const gateways = await db.getGatewaysFromClientId(req.params.clientId)

  // Return the gateways (empty array if none exist for this client)
  res.status(200).send({ status: 'success', data: gateways || [] })
}

const validateGetClientVitals = Validator.param(['clientId']).notEmpty()

async function handleGetClientVitals(req, res) {
  // First check if the client exists
  const client = await db.getClientWithId(req.params.clientId)
  
  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const buttonVitals = await db.getRecentButtonsVitalsWithClientId(req.params.clientId)
  const gatewayVitals = await db.getRecentGatewaysVitalsWithClientId(req.params.clientId)

  res.status(200).send({ status: 'success', data: { buttonVitals, gatewayVitals } })
}

const validateUpdateClient = [
  Validator.param(['clientId']).notEmpty(),
  Validator.body(['displayName', 'fromPhoneNumber', 'language']).trim().isString().notEmpty(),
  Validator.body(['heartbeatPhoneNumbers']).isArray({ min: 0 }),
  Validator.body(['responderPhoneNumbers', 'fallbackPhoneNumbers', 'incidentCategories']).isArray({ min: 1 }),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.body(['isDisplayed', 'isSendingAlerts', 'isSendingVitals']).trim().isBoolean(),
  Validator.body(['status']).optional().trim().isString(),
  Validator.body(['firstDeviceLiveAt']).optional(),
]

async function handleUpdateClient(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  // check that the client exists
  if (!client) {
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
    req.body.status || client.status,
    req.body.firstDeviceLiveAt || client.firstDeviceLiveAt,
    req.params.clientId,
  )

  // something bad happened and the client wasn't updated; blame it on the request
  if (!updatedClient) {
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
  const button = await db.getButtonWithDeviceId(req.params.buttonId)

  // check that this button exists and is owned by the specified client
  // NOTE: if clientId is invalid, then the query will fail and return null
  if (!button || button.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  // attempt to update the button
  const updatedButton = await db.updateButton(
    req.body.displayName,
    req.body.buttonSerialNumber,
    req.body.phoneNumber,
    req.body.isDisplayed,
    req.body.isSendingAlerts,
    req.body.isSendingVitals,
    req.body.clientId,
    req.params.buttonId,
  )

  // something bad happened and the button wasn't updated; blame it on the request
  if (!updatedButton) {
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
  const gateway = await db.getGatewayWithGatewayId(req.params.gatewayId)

  // check that this gateway exists and is owned by the specified client
  // NOTE: if clientId is invalid, then the query will fail and return null
  if (!gateway || gateway.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  // attempt to update the gateway
  const updatedGateway = await db.updateGateway(
    req.body.clientId,
    req.body.isSendingVitals,
    req.body.isDisplayed,
    req.params.gatewayId,
    req.body.displayName,
  )

  // something bad happened and the gateway wasn't updated; blame it on the request
  if (!updatedGateway) {
    res.status(400).send({ status: 'error', message: 'Bad Request' })

    return
  }

  res.status(200).send({ status: 'success', data: updatedGateway })
}

module.exports = {
  authorize,
  handleCreateClient,
  handleCreateClientButton,
  handleCreateClientGateway,
  handleGetClient,
  handleGetClientButton,
  handleGetClientButtons,
  handleGetClientGateway,
  handleGetClientGateways,
  handleGetClientSessions,
  handleGetClientVitals,
  handleGetClients,
  handleUpdateClient,
  handleUpdateClientButton,
  handleUpdateClientGateway,
  validateCreateClient,
  validateCreateClientButton,
  validateCreateClientGateway,
  validateGetClient,
  validateGetClientButton,
  validateGetClientButtons,
  validateGetClientGateway,
  validateGetClientGateways,
  validateGetClientSessions,
  validateGetClientVitals,
  validateUpdateClient,
  validateUpdateClientButton,
  validateUpdateClientGateway,
}
