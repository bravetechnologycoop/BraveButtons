/* Brave Buttons API - Read-Only REST API
 *
 * CONVENTIONS:
 *  - READ-ONLY API: Only GET and POST methods are supported
 *  - GET for single/paginated reads, POST for bulk reads (no create/update/delete operations)
 *
 * AUTHENTICATION:
 *  - Must authorize using the Authorization header in all requests
 *  - The value of the Authorization header must be the primary/secondary Brave API key
 *
 * RESPONSE FORMAT:
 *  - Must return a JSON object containing the following keys:
 *    - status:   which will be either "success" or "error"
 *    - data:     the desired JSON object, if there is one
 *    - message:  a human-readable explanation of the error, if there was one and this is appropriate
 *
 * PAGINATION:
 *  - Query parameters: page (default: 1, min: 1) and limit (default: 50, min: 1, max: 100)
 *  - Response includes pagination metadata: { page, limit, total, totalPages }
 *
 * BULK OPERATIONS:
 *  - POST to same path as GET with an array of IDs to retrieve multiple resources efficiently
 *  - Example: POST /api/clients with body { ids: ["id1", "id2", "id3"] }
 *
 * API STRUCTURE:
 *  - Global endpoints: /api/clients, /api/devices, /api/gateways, /api/sessions
 *  - Client-scoped: /api/clients/:clientId/devices, /api/clients/:clientId/sessions
 *  - Device-scoped: /api/devices/:deviceId/vitals, /api/devices/:deviceId/sessions
 *  - Gateway-scoped: /api/gateways/:gatewayId/vitals
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

// Common validation
const validatePagination = []
const validateBulkIds = Validator.body(['ids']).isArray({ min: 1, max: 100 })
const validateDateRange = [
  Validator.query('startDate').isISO8601().withMessage('startDate must be a valid ISO8601 date'),
  Validator.query('endDate').isISO8601().withMessage('endDate must be a valid ISO8601 date'),
]
const validateOptionalDateRange = [
  Validator.query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO8601 date'),
  Validator.query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO8601 date'),
]

// Date range helper function
function getDateRangeParams(req, defaultDays = 30) {
  let startDate = req.query.startDate
  let endDate = req.query.endDate

  // If no dates provided, default to last N days
  if (!startDate || !endDate) {
    endDate = new Date().toISOString()
    startDate = new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000).toISOString()
  }

  return { startDate, endDate }
}

// ==================== CLIENT ENDPOINTS ====================

const validateGetClient = Validator.param(['clientId']).notEmpty()

async function handleGetClient(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  res.status(200).send({ status: 'success', data: client })
}

async function handleGetClients(req, res) {
  const { page, limit, offset } = getPaginationParams(req)

  const allClients = await db.getClients()
  const total = allClients.length
  const paginatedClients = allClients.slice(offset, offset + limit)

  res.status(200).send(createPaginatedResponse(paginatedClients, total, page, limit))
}

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

// ==================== DEVICE ENDPOINTS ====================

const validateGetDevice = Validator.param(['deviceId']).notEmpty()

async function handleGetDevice(req, res) {
  const device = await db.getButtonWithDeviceId(req.params.deviceId)

  if (!device) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  res.status(200).send({ status: 'success', data: device })
}

async function handleGetDevices(req, res) {
  const { page, limit, offset } = getPaginationParams(req)

  // Get all devices across all clients
  const allClients = await db.getClients()
  const allDevices = []

  for (const client of allClients) {
    const clientDevices = await db.getButtonsForApi(client.id)
    if (clientDevices) {
      allDevices.push(...clientDevices)
    }
  }

  const total = allDevices.length
  const paginatedDevices = allDevices.slice(offset, offset + limit)

  res.status(200).send(createPaginatedResponse(paginatedDevices, total, page, limit))
}

async function handleBulkGetDevices(req, res) {
  const deviceIds = req.body.ids
  const devices = []

  for (const deviceId of deviceIds) {
    const device = await db.getButtonWithDeviceId(deviceId)
    if (device) {
      devices.push(device)
    }
  }

  res.status(200).send({ status: 'success', data: devices })
}

const validateGetClientDevices = [Validator.param(['clientId']).notEmpty()]

async function handleGetClientDevices(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const { page, limit, offset } = getPaginationParams(req)

  const allDevices = await db.getButtonsForApi(req.params.clientId)
  const total = allDevices ? allDevices.length : 0
  const paginatedDevices = allDevices ? allDevices.slice(offset, offset + limit) : []

  res.status(200).send(createPaginatedResponse(paginatedDevices, total, page, limit))
}

const validateBulkGetClientDevices = [Validator.param(['clientId']).notEmpty(), validateBulkIds]

async function handleBulkGetClientDevices(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const deviceIds = req.body.ids
  const devices = []

  for (const deviceId of deviceIds) {
    const device = await db.getDeviceWithIds(deviceId, req.params.clientId)
    if (device && device.client.id === req.params.clientId) {
      devices.push(device)
    }
  }

  res.status(200).send({ status: 'success', data: devices })
}

const validateGetClientDevice = Validator.param(['clientId', 'deviceId']).notEmpty()

async function handleGetClientDevice(req, res) {
  const device = await db.getDeviceWithIds(req.params.deviceId, req.params.clientId)

  if (!device || device.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  res.status(200).send({ status: 'success', data: device })
}

// ==================== GATEWAY ENDPOINTS ====================

const validateGetGateway = Validator.param(['gatewayId']).notEmpty()

async function handleGetGateway(req, res) {
  const gateway = await db.getGatewayWithGatewayId(req.params.gatewayId)

  if (!gateway) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  res.status(200).send({ status: 'success', data: gateway })
}

async function handleGetGateways(req, res) {
  const { page, limit, offset } = getPaginationParams(req)

  // Get all gateways across all clients
  const allClients = await db.getClients()
  const allGateways = []

  for (const client of allClients) {
    const clientGateways = await db.getGatewaysFromClientId(client.id)
    if (clientGateways) {
      allGateways.push(...clientGateways)
    }
  }

  const total = allGateways.length
  const paginatedGateways = allGateways.slice(offset, offset + limit)

  res.status(200).send(createPaginatedResponse(paginatedGateways, total, page, limit))
}

async function handleBulkGetGateways(req, res) {
  const gatewayIds = req.body.ids
  const gateways = []

  for (const gatewayId of gatewayIds) {
    const gateway = await db.getGatewayWithGatewayId(gatewayId)
    if (gateway) {
      gateways.push(gateway)
    }
  }

  res.status(200).send({ status: 'success', data: gateways })
}

const validateGetClientGateways = [Validator.param(['clientId']).notEmpty()]

async function handleGetClientGateways(req, res) {
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

const validateBulkGetClientGateways = [Validator.param(['clientId']).notEmpty(), validateBulkIds]

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

const validateGetClientGateway = Validator.param(['clientId', 'gatewayId']).notEmpty()

async function handleGetClientGateway(req, res) {
  const gateway = await db.getGatewayWithGatewayId(req.params.gatewayId)

  if (!gateway || gateway.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  res.status(200).send({ status: 'success', data: gateway })
}

// ==================== SESSION ENDPOINTS ====================

const validateGetSessions = validateOptionalDateRange

async function handleGetSessions(req, res) {
  const { page, limit, offset } = getPaginationParams(req)
  const { startDate, endDate } = getDateRangeParams(req, 30)

  const sessions = await db.getSessionsWithDateRange(startDate, endDate, limit, offset)
  const total = await db.getSessionsCountWithDateRange(startDate, endDate)

  res.status(200).send(createPaginatedResponse(sessions, total, page, limit))
}

const validateGetClientSessions = [Validator.param(['clientId']).notEmpty(), ...validateOptionalDateRange]

async function handleGetClientSessions(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const { page, limit, offset } = getPaginationParams(req)
  const { startDate, endDate } = getDateRangeParams(req, 30)

  const sessions = await db.getSessionsWithClientIdAndDateRange(req.params.clientId, startDate, endDate, limit, offset)
  const total = await db.getSessionsCountWithClientIdAndDateRange(req.params.clientId, startDate, endDate)

  res.status(200).send(createPaginatedResponse(sessions, total, page, limit))
}

const validateGetClientSessionStats = [Validator.param(['clientId']).notEmpty(), ...validateDateRange]

async function handleGetClientSessionStats(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const { startDate, endDate } = getDateRangeParams(req)
  const stats = await db.getSessionStatsWithClientIdAndDateRange(req.params.clientId, startDate, endDate)

  if (!stats) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    return
  }

  res.status(200).send({ status: 'success', data: stats })
}

// ==================== VITALS ENDPOINTS ====================

const validateGetClientVitals = [Validator.param(['clientId']).notEmpty(), ...validateOptionalDateRange]

async function handleGetClientVitals(req, res) {
  const client = await db.getClientWithId(req.params.clientId)

  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const deviceVitals = await db.getRecentButtonsVitalsWithClientId(req.params.clientId)
  const gatewayVitals = await db.getRecentGatewaysVitalsWithClientId(req.params.clientId)

  res.status(200).send({ status: 'success', data: { deviceVitals, gatewayVitals } })
}

const validateGetDeviceVitals = [Validator.param(['deviceId']).notEmpty(), ...validateOptionalDateRange]

async function handleGetDeviceVitals(req, res) {
  const device = await db.getButtonWithDeviceId(req.params.deviceId)

  if (!device) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  // Get vitals for this specific device
  const buttonVitals = await db.getRecentButtonsVitalsWithClientId(device.client.id)
  const deviceVitals = buttonVitals ? buttonVitals.filter(v => v.deviceId === req.params.deviceId) : []

  const { page, limit, offset } = getPaginationParams(req)
  const total = deviceVitals.length
  const paginatedVitals = deviceVitals.slice(offset, offset + limit)

  res.status(200).send(createPaginatedResponse(paginatedVitals, total, page, limit))
}

const validateGetGatewayVitals = [Validator.param(['gatewayId']).notEmpty(), ...validateOptionalDateRange]

async function handleGetGatewayVitals(req, res) {
  const gateway = await db.getGatewayWithGatewayId(req.params.gatewayId)

  if (!gateway) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  // Get vitals for this specific gateway
  const gatewayVitals = await db.getRecentGatewaysVitalsWithClientId(gateway.client.id)
  const specificGatewayVitals = gatewayVitals ? gatewayVitals.filter(v => v.gatewayId === req.params.gatewayId) : []

  const { page, limit, offset } = getPaginationParams(req)
  const total = specificGatewayVitals.length
  const paginatedVitals = specificGatewayVitals.slice(offset, offset + limit)

  res.status(200).send(createPaginatedResponse(paginatedVitals, total, page, limit))
}

// ==================== UPDATE ENDPOINTS ====================

const validateUpdateClientDeviceSendingSettings = [
  Validator.param(['clientId', 'deviceId']).notEmpty(),
  Validator.body(['is_sending_alerts']).isBoolean().withMessage('is_sending_alerts must be a boolean'),
  Validator.body(['is_sending_vitals']).isBoolean().withMessage('is_sending_vitals must be a boolean'),
]

async function handleUpdateClientDeviceSendingSettings(req, res) {
  // Verify client exists
  const client = await db.getClientWithId(req.params.clientId)
  if (!client) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  // Verify device exists and belongs to this client
  const device = await db.getDeviceWithIds(req.params.deviceId, req.params.clientId)
  if (!device || device.client.id !== req.params.clientId) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  const updatedDevice = await db.updateDeviceSendingSettings(
    req.params.deviceId,
    req.body.is_sending_alerts,
    req.body.is_sending_vitals,
  )

  if (!updatedDevice) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    return
  }

  res.status(200).send({ status: 'success', data: updatedDevice })
}

module.exports = {
  authorize,
  validatePagination,
  validateBulkIds,
  validateDateRange,
  validateOptionalDateRange,
  // Client endpoints
  validateGetClient,
  handleGetClient,
  handleGetClients,
  handleBulkGetClients,
  // Device endpoints
  validateGetDevice,
  handleGetDevice,
  handleGetDevices,
  handleBulkGetDevices,
  validateGetClientDevices,
  handleGetClientDevices,
  validateBulkGetClientDevices,
  handleBulkGetClientDevices,
  validateGetClientDevice,
  handleGetClientDevice,
  // Gateway endpoints
  validateGetGateway,
  handleGetGateway,
  handleGetGateways,
  handleBulkGetGateways,
  validateGetClientGateways,
  handleGetClientGateways,
  validateBulkGetClientGateways,
  handleBulkGetClientGateways,
  validateGetClientGateway,
  handleGetClientGateway,
  // Session endpoints
  validateGetSessions,
  handleGetSessions,
  validateGetClientSessions,
  handleGetClientSessions,
  validateGetClientSessionStats,
  handleGetClientSessionStats,
  // Vitals endpoints
  validateGetClientVitals,
  handleGetClientVitals,
  validateGetDeviceVitals,
  handleGetDeviceVitals,
  validateGetGatewayVitals,
  handleGetGatewayVitals,
  // Update endpoints
  validateUpdateClientDeviceSendingSettings,
  handleUpdateClientDeviceSendingSettings,
}
