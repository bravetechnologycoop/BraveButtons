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
const crypto = require('crypto')
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')

// brave API key (currently the PA API key) for accessing the buttons API
const braveApiKey = helpers.getEnvVar('PA_API_KEY_PRIMARY')
const portalHmacToleranceSeconds = 5 * 60
const portalAlertRecipientFields = ['responder_phone_numbers', 'fallback_phone_numbers', 'heartbeat_phone_numbers']
const portalAlertRecipientPutFields = ['acting_email'].concat(portalAlertRecipientFields)
const portalMaxPhoneNumbersByField = {
  responder_phone_numbers: 5,
  fallback_phone_numbers: 5,
}
const portalRateLimitWindowMs = 5 * 60 * 1000
const portalRateLimitMaxRequests = {
  badAuth: 10,
  GET: 120,
  PUT: 30,
}
const portalRateLimitBuckets = new Map()
const e164PhoneRegex = /^\+[1-9]\d{6,14}$/

class PortalValidationError extends Error {
  constructor(code, field, message) {
    super(message)
    this.code = code
    this.field = field
  }
}

function portalRateLimitKey(req, bucketName) {
  return `${bucketName}:${req.ip || req.connection.remoteAddress || 'unknown'}`
}

function isPortalRateLimited(req, bucketName) {
  const key = portalRateLimitKey(req, bucketName)
  const now = Date.now()
  const recentTimestamps = (portalRateLimitBuckets.get(key) || []).filter(timestamp => now - timestamp < portalRateLimitWindowMs)
  const limit = portalRateLimitMaxRequests[bucketName]

  if (recentTimestamps.length >= limit) {
    portalRateLimitBuckets.set(key, recentTimestamps)
    return true
  }

  recentTimestamps.push(now)
  portalRateLimitBuckets.set(key, recentTimestamps)
  return false
}

function resetPortalRateLimits() {
  portalRateLimitBuckets.clear()
}

function portalRateLimit(req, res, next) {
  const bucketName = portalRateLimitMaxRequests[req.method] === undefined ? 'GET' : req.method

  if (isPortalRateLimited(req, bucketName)) {
    res.status(429).send({ status: 'error', code: 'RATE_LIMITED', message: 'Too Many Requests' })
    helpers.logError(`Rate limited portal config request to ${req.path}.`)
    return
  }

  next()
}

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

function getPortalHmacSecret() {
  return helpers.getEnvVar('BUTTONS_CONFIG_HMAC_SECRET')
}

function isValidHexSha256(signature) {
  return typeof signature === 'string' && /^[a-fA-F0-9]{64}$/.test(signature)
}

function getRawBody(req) {
  if (!req.rawBody) {
    return Buffer.from('')
  }

  return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody)
}

function hasValidPortalSignature(secret, timestamp, signature, rawBody) {
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  const signatureBuffer = Buffer.from(signature, 'hex')

  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}

function portalAuthorize(req, res, next) {
  try {
    const secret = getPortalHmacSecret()

    if (!secret) {
      res.status(503).send({ status: 'error', message: 'Service Unavailable' })
      helpers.logError(`Portal config request to ${req.path} rejected because BUTTONS_CONFIG_HMAC_SECRET is not configured.`)
      return
    }

    const timestamp = req.get('X-Portal-Timestamp')
    const signature = req.get('X-Portal-Signature')
    const timestampNumber = Number(timestamp)

    if (
      !timestamp ||
      !Number.isInteger(timestampNumber) ||
      Math.abs(Date.now() / 1000 - timestampNumber) > portalHmacToleranceSeconds ||
      !isValidHexSha256(signature)
    ) {
      if (isPortalRateLimited(req, 'badAuth')) {
        res.status(429).send({ status: 'error', code: 'RATE_LIMITED', message: 'Too Many Requests' })
        return
      }

      res.status(401).send({ status: 'error', message: 'Unauthorized' })
      helpers.logError(`Unauthorized portal config request to ${req.path}.`)
      return
    }

    if (!hasValidPortalSignature(secret, timestamp, signature, getRawBody(req))) {
      if (isPortalRateLimited(req, 'badAuth')) {
        res.status(429).send({ status: 'error', code: 'RATE_LIMITED', message: 'Too Many Requests' })
        return
      }

      res.status(401).send({ status: 'error', message: 'Unauthorized' })
      helpers.logError(`Unauthorized portal config request to ${req.path}.`)
      return
    }

    next()
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

function formatPortalAlertRecipients(alertRecipients) {
  return {
    client_id: alertRecipients.client_id,
    display_name: alertRecipients.display_name,
    responder_phone_numbers: alertRecipients.responder_phone_numbers,
    fallback_phone_numbers: alertRecipients.fallback_phone_numbers,
    heartbeat_phone_numbers: alertRecipients.heartbeat_phone_numbers,
  }
}

function normalizePortalPhoneArray(fieldName, value) {
  if (!Array.isArray(value)) {
    throw new PortalValidationError('INVALID_FIELD_TYPE', fieldName, `${fieldName} must be an array`)
  }

  if (portalMaxPhoneNumbersByField[fieldName] !== undefined && value.length > portalMaxPhoneNumbersByField[fieldName]) {
    throw new PortalValidationError(
      'TOO_MANY_PHONE_NUMBERS',
      fieldName,
      `${fieldName} must contain no more than ${portalMaxPhoneNumbersByField[fieldName]} phone numbers`,
    )
  }

  return value.map(phoneNumber => {
    if (typeof phoneNumber !== 'string') {
      throw new PortalValidationError('INVALID_PHONE_NUMBER_TYPE', fieldName, `${fieldName} must contain only strings`)
    }

    const trimmedPhoneNumber = phoneNumber.trim()

    if (trimmedPhoneNumber === '') {
      throw new PortalValidationError('BLANK_PHONE_NUMBER', fieldName, `${fieldName} must not contain blank strings`)
    }

    if (!e164PhoneRegex.test(trimmedPhoneNumber)) {
      throw new PortalValidationError('INVALID_PHONE_NUMBER', fieldName, `${fieldName} contains an invalid phone number`)
    }

    return trimmedPhoneNumber
  })
}

function getPortalAlertRecipientUpdates(body) {
  const bodyFields = Object.keys(body)
  const unknownField = bodyFields.find(field => !portalAlertRecipientPutFields.includes(field))

  if (unknownField) {
    throw new PortalValidationError('UNKNOWN_FIELD', unknownField, `Unknown field: ${unknownField}`)
  }

  if (typeof body.acting_email !== 'string' || body.acting_email.trim() === '') {
    throw new PortalValidationError('ACTING_EMAIL_REQUIRED', 'acting_email', 'acting_email is required')
  }

  return portalAlertRecipientFields.reduce((updates, field) => {
    if (body[field] !== undefined) {
      return {
        ...updates,
        [field]: normalizePortalPhoneArray(field, body[field]),
      }
    }

    return updates
  }, {})
}

async function handleGetPortalAlertRecipients(req, res) {
  const alertRecipients = await db.getPortalAlertRecipients(req.params.clientId)

  if (!alertRecipients) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  res.status(200).send({ status: 'success', data: formatPortalAlertRecipients(alertRecipients) })
}

async function handleUpdatePortalAlertRecipients(req, res) {
  let updates

  try {
    updates = getPortalAlertRecipientUpdates(req.body)
  } catch (error) {
    res.status(422).send({
      status: 'error',
      code: error.code || 'VALIDATION_ERROR',
      field: error.field,
      detail: error.message,
      message: error.message,
    })
    helpers.logError(`Bad portal config request to ${req.path}: ${error.message}`)
    return
  }

  const updatedAlertRecipients = await db.updatePortalAlertRecipients(req.params.clientId, updates)

  if (!updatedAlertRecipients) {
    res.status(404).send({ status: 'error', message: 'Not Found' })
    return
  }

  helpers.log(
    `Portal alert recipients updated by ${req.body.acting_email.trim()} for client ${req.params.clientId}; fields: ${Object.keys(updates).join(
      ', ',
    )}`,
  )
  res.status(200).send({ status: 'success', data: formatPortalAlertRecipients(updatedAlertRecipients) })
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
  if (!gateway) {
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
  const buttons = await db.getButtonsWithClientId(req.params.clientId)

  // if the query failed and returned null, the clientId is probably wrong
  if (!buttons) {
    res.status(404).send({ status: 'error', message: 'Not Found' })

    return
  }

  // something like this: buttons = buttons.map(button => { button.sdfs ... })
  // (remove single field)

  res.status(200).send({ status: 'success', data: buttons })
}

const validateGetClientSessions = Validator.param(['clientId']).notEmpty()

async function handleGetClientSessions(req, res) {
  // TODO
  res.status(200).send({ status: 'success', data: [] })
}

const validateGetClientGateway = Validator.param(['clientId', 'gatewayId']).notEmpty()

async function handleGetClientGateway(req, res) {
  const gateway = await db.getGatewayWithId(req.params.gatewayId)

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
  const gateways = await db.getGatewaysWithClientId(req.params.clientId)

  // if the query failed and returned null, the clientId is probably wrong
  if (!gateways) {
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
  if (!buttonVitals || !gatewayVitals) {
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
  const button = await db.getButtonWithId(req.params.buttonId)

  // check that this button exists and is owned by the specified client
  // NOTE: if clientId is invalid, then the query will fail and return null
  if (!button || button.client.id !== req.params.clientId) {
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
  const gateway = await db.getGatewayWithId(req.params.gatewayId)

  // check that this gateway exists and is owned by the specified client
  // NOTE: if clientId is invalid, then the query will fail and return null
  if (!gateway || gateway.client.id !== req.params.clientId) {
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
  if (!updatedGateway) {
    res.status(400).send({ status: 'error', message: 'Bad Request' })

    return
  }

  res.status(200).send({ status: 'success', data: updatedGateway })
}

module.exports = {
  authorize,
  handleGetPortalAlertRecipients,
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
  handleUpdatePortalAlertRecipients,
  portalAuthorize,
  portalRateLimit,
  resetPortalRateLimits,
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
