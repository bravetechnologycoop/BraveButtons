/* Conventions for this API:
 *  - READ-ONLY API: Only GET and POST methods are supported
 *  - GET for single/paginated reads, POST for bulk reads (no create/update/delete operations)
 *
 *  - Must authorize using the Authorization header in all requests
 *    - The value of the Authorization header must be the primary/secondary Brave API key
 *
 *  - Must return a JSON object containing the following keys:
 *    - status:   which will be either "success" or "error"
 *    - data:     the desired JSON object, if there is one
 *    - message:  a human-readable explanation of the error, if there was one and this is appropriate. Be careful
 *                to not include anything that will give an attacker extra information
 *
 *  - Pagination support:
 *    - Query parameters: page (default: 1, min: 1) and limit (default: 50, min: 1, max: 100)
 *    - Response includes pagination metadata: { page, limit, total, totalPages }
 *
 *  - Bulk endpoints:
 *    - POST to same path as GET with an array of IDs to retrieve multiple resources efficiently
 *    - Example: POST /api/clients with body { ids: ["id1", "id2", "id3"] }
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

// Pagination helper function
function getPaginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50))
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

function createPaginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit)

  return {
    status: 'success',
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  }
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

const validateGetClients = []

async function handleGetClients(req, res) {
  const { page, limit, offset } = getPaginationParams(req)

  const allClients = await db.getClients()
  const total = allClients.length
  const paginatedClients = allClients.slice(offset, offset + limit)

  res.status(200).send(createPaginatedResponse(paginatedClients, total, page, limit))
}

const validateBulkGetClients = Validator.body(['ids']).isArray({ min: 1, max: 100 })

async function handleBulkGetClients(req, res) {
  const clientIds = req.body.ids
  const clients = []

  for (const clientId of clientIds) {
    const client = await db.getClientWithId(clientId)
    if (client) {
      clients.push(client)
    }
  }

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

const validateGetClientButtons = [Validator.param(['clientId']).notEmpty()]

async function handleGetClientButtons(req, res) {
  // First check if the client exists
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const { page, limit, offset } = getPaginationParams(req)

  const allButtons = await db.getButtonsForApi(req.params.clientId)
  const total = allButtons ? allButtons.length : 0
  const paginatedButtons = allButtons ? allButtons.slice(offset, offset + limit) : []

  res.status(200).send(createPaginatedResponse(paginatedButtons, total, page, limit))
}

const validateBulkGetClientButtons = [Validator.param(['clientId']).notEmpty(), Validator.body(['ids']).isArray({ min: 1, max: 100 })]

async function handleBulkGetClientButtons(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const buttonIds = req.body.ids
  const buttons = []

  for (const buttonId of buttonIds) {
    const button = await db.getDeviceWithIds(buttonId, req.params.clientId)
    if (button && button.client.id === req.params.clientId) {
      buttons.push(button)
    }
  }

  res.status(200).send({ status: 'success', data: buttons })
}

const validateGetClientSessions = [Validator.param(['clientId']).notEmpty()]

async function handleGetClientSessions(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  // TODO: implement sessions retrieval with pagination
  const { page, limit } = getPaginationParams(req)
  res.status(200).send(createPaginatedResponse([], 0, page, limit))
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

const validateGetClientGateways = [Validator.param(['clientId']).notEmpty()]

async function handleGetClientGateways(req, res) {
  // First check if the client exists
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const { page, limit, offset } = getPaginationParams(req)

  const allGateways = await db.getGatewaysFromClientId(req.params.clientId)
  const total = allGateways ? allGateways.length : 0
  const paginatedGateways = allGateways ? allGateways.slice(offset, offset + limit) : []

  res.status(200).send(createPaginatedResponse(paginatedGateways, total, page, limit))
}

const validateBulkGetClientGateways = [Validator.param(['clientId']).notEmpty(), Validator.body(['ids']).isArray({ min: 1, max: 100 })]

async function handleBulkGetClientGateways(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const gatewayIds = req.body.ids
  const gateways = []

  for (const gatewayId of gatewayIds) {
    const gateway = await db.getGatewayWithGatewayId(gatewayId)
    if (gateway && gateway.client.id === req.params.clientId) {
      gateways.push(gateway)
    }
  }

  res.status(200).send({ status: 'success', data: gateways })
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

module.exports = {
  authorize,
  handleBulkGetClientButtons,
  handleBulkGetClientGateways,
  handleBulkGetClients,
  handleGetClient,
  handleGetClientButton,
  handleGetClientButtons,
  handleGetClientGateway,
  handleGetClientGateways,
  handleGetClientSessions,
  handleGetClientVitals,
  handleGetClients,
  validateBulkGetClientButtons,
  validateBulkGetClientGateways,
  validateBulkGetClients,
  validateGetClient,
  validateGetClientButton,
  validateGetClientButtons,
  validateGetClientGateway,
  validateGetClientGateways,
  validateGetClientSessions,
  validateGetClientVitals,
  validateGetClients,
}
