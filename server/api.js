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
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')

const validateGetClient = [Validator.header(['Authorization']).notEmpty(), Validator.param(['clientId']).notEmpty()]

async function handleGetClient(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const client = await db.getClientWithId(req.params.clientId)

      // check that the client exists
      if (client == null) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.status(200).send({ status: 'success', data: client })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateGetClients = Validator.header(['Authorization']).notEmpty()

async function handleGetClients(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const clients = await db.getClients()

      res.status(200).send({ status: 'success', data: clients })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateGetClientButton = [Validator.header(['Authorization']).notEmpty(), Validator.param(['clientId', 'buttonId']).notEmpty()]

async function handleGetClientButton(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const button = await db.getButtonWithId(req.params.buttonId)

      // check that this button exists and is owned by the specified client
      // NOTE: if clientId is invalid, then the query will fail and return null
      if (button == null || button.client.id !== req.params.clientId) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.status(200).send({ status: 'success', data: button })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateGetClientButtons = [Validator.header(['Authorization']).notEmpty(), Validator.param(['clientId']).notEmpty()]

async function handleGetClientButtons(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const buttons = await db.getButtonsWithClientId(req.params.clientId)

      // if the query failed and returned null, the clientId is probably wrong
      if (buttons == null) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.status(200).send({ status: 'success', data: buttons })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateGetClientButtonSessions = [Validator.header(['Authorization']).notEmpty(), Validator.param(['clientId', 'buttonid']).notEmpty()]

async function handleGetClientButtonSessions(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const button = await db.getButtonWithId(req.params.buttonId)

      // check that this button exists and is owned by the specified client
      // NOTE: if clientId is invalid, then the query will fail and return null
      if (button == null || button.client.id !== req.params.clientId) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      const sessions = await db.getRecentSessionsWithButtonId(req.params.buttonId)

      res.status(200).send({ status: 'success', data: sessions })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateGetClientGateway = [Validator.header(['Authorization']).notEmpty(), Validator.param(['clientId', 'gatewayId']).notEmpty()]

async function handleGetClientGateway(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const gateway = await db.getGatewayWithId(req.params.gatewayId)

      // check that this gateway exists and is owned by the specified client
      // NOTE: if clientId is invalid, then the query will fail and return null
      if (gateway == null || gateway.client.id !== req.params.clientId) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.status(200).send({ status: 'success', data: gateway })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateGetClientGateways = [Validator.header(['Authorization']).notEmpty(), Validator.param(['clientId']).notEmpty()]

async function handleGetClientGateways(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const gateways = await db.getGatewaysWithClientId(req.params.clientId)

      // if the query failed and returned null, the clientId is probably wrong
      if (gateways == null) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.status(200).send({ status: 'success', data: gateways })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateGetClientVitals = [Validator.header(['Authorization']).notEmpty(), Validator.param(['clientId']).notEmpty()]

async function handleGetClientVitals(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const buttonVitals = await db.getRecentButtonsVitalsWithClientId(req.params.clientId)
      const gatewayVitals = await db.getRecentGatewaysVitalsWithClientId(req.params.clientId)

      // if either of the query failed and returned null, the clientId is probably wrong
      if (buttonVitals == null || gatewayVitals == null) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.status(200).send({ status: 'success', data: { buttonVitals, gatewayVitals } })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateRegisterClient = [
  Validator.header(['Authorization']).notEmpty(),
  Validator.body(['displayName', 'fromPhoneNumber', 'language']).trim().isString().notEmpty(),
  Validator.body(['responderPhoneNumbers', 'fallbackPhoneNumbers', 'heartbeatPhoneNumbers', 'incidentCategories']).isArray(),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).isInt({ min: 0 }),
  Validator.body(['isDisplayed', 'isSendingAlerts', 'isSendingVitals']).isBoolean(),
]

async function handleRegisterClient(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const client = await db.createClient(
        req.body.displayName,
        req.body.responderPhoneNumbers,
        req.body.reminderTimeout,
        req.body.fallbackPhoneNumbers,
        req.body.fromPhoneNumber,
        req.body.fallbackTimeout,
        req.body.heartbeatPhoneNumbers,
        req.body.incidentCategories,
        req.body.isDisplayed,
        req.body.isSendingAlerts,
        req.body.isSendingVitals,
        req.body.language,
      )

      // Should the database query fail, db.createClient should internally handle thrown errors and return either null or undefined.
      // The status code 400 is used here as the failure was probably caused by invalid fields.
      if (client == null) {
        res.status(400).send({ status: 'error', message: 'Bad Request' })
      }

      res.set('Location', `${req.path}/${client.id}`) // location of newly created client
      res.status(201).send({ status: 'success', data: client })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateRegisterClientButton = [
  Validator.header(['Authorization']).notEmpty(),
  Validator.param(['clientId']).notEmpty(),
  Validator.body(['displayName', 'phoneNumber', 'buttonSerialNumber']).trim().isString().notEmpty(),
  Validator.body(['isDisplayed', 'isSendingAlerts', 'isSendingVitals']).isBoolean(),
]

async function handleRegisterClientButton(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const button = await db.createButton(
        req.body.clientId,
        req.body.displayName,
        req.body.phoneNumber,
        req.body.buttonSerialNumber,
        req.body.isDisplayed,
        req.body.isSendingAlerts,
        req.body.isSendingVitals,
        null,
        null,
      )

      // Should the database query fail, db.createButton should internally handle thrown errors and return either null or undefined.
      // The status code 404 is used here as the failure was probably caused by the client not existing.
      if (button == null) {
        req.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.set('Location', `${req.path}/${button.id}`) // location of newly created button
      res.status(201).send({ status: 'success', data: button })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateRegisterClientGateway = [
  Validator.header(['Authorization']).notEmpty(),
  Validator.param(['clientId']).notEmpty(),
  Validator.body(['displayName']).trim().isString().notEmpty(),
  Validator.body(['isDisplayed', 'isSendingVitals']).isBoolean(),
]

async function handleRegisterClientGateway(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const gateway = await db.createGateway(req.params.clientId, req.body.displayName, null, req.body.isDisplayed, req.body.isSendingVitals)

      // Should the database query fail, db.createGateway should internally handle thrown errors and return either null or undefined.
      // The status code 404 is used here as the failure was probably caused by the client not existing.
      if (gateway == null) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.set('Location', `${req.path}/${gateway.id}`) // location of newly created gateway
      res.status(201).send({ status: 'success', data: gateway })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateUpdateClient = [
  Validator.header(['Authorization']).notEmpty(),
  Validator.param(['clientId']).notEmpty(),
  Validator.body(['displayName', 'fromPhoneNumber', 'language']).trim().isString().notEmpty(),
  Validator.body(['responderPhoneNumbers', 'fallbackPhoneNumbers', 'heartbeatPhoneNumbers', 'incidentCategories']).isArray(),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).isInt({ min: 0 }),
  Validator.body(['isDisplayed', 'isSendingAlerts', 'isSendingVitals']).isBoolean(),
]

async function handleUpdateClient(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
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
        req.body.responderPhoneNumbers,
        req.body.reminderTimeout,
        req.body.fallbackPhoneNumbers,
        req.body.fallbackTimeout,
        req.body.heartbeatPhoneNumbers,
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
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateUpdateClientButton = [
  Validator.header(['Authorization']).notEmpty(),
  Validator.param(['clientId', 'buttonId']).notEmpty(),
  Validator.body(['displayName', 'phoneNumber', 'buttonSerialNumber']).trim().isString().notEmpty(),
  Validator.body(['isDisplayed', 'isSendingAlerts', 'isSendingVitals']).isBoolean(),
]

async function handleUpdateClientButton(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const button = await db.getButtonWithId(req.params.buttonId)

      // check that this button exists and is owned by the specified client
      // NOTE: if clientId is invalid, then the query will fail and return null
      if (button == null || button.client.id !== req.params.clientId) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      // attempt to update the button
      const updatedButton = await db.updateButton(
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
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

const validateUpdateClientGateway = [
  Validator.header(['Authorization']).notEmpty(),
  Validator.param(['clientId', 'gatewayId']).notEmpty(),
  Validator.body(['displayName']).trim().isString().notEmpty(),
  Validator.body(['isDisplayed', 'isSendingVitals']).isBoolean(),
]

async function handleUpdateClientGateway(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const gateway = await db.getGatewayWithId(req.params.gatewayId)

      // check that this gateway exists and is owned by the specified client
      // NOTE: if clientId is invalid, then the query will fail and return null
      if (gateway == null || gateway.client.id !== req.params.clientId) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      // attempt to update the gateway
      const updatedGateway = await db.updateGateway(req.body.displayName, req.body.isDisplayed, req.body.isSendingVitals, req.params.gatewayId)

      // something bad happened and the gateway wasn't updated; blame it on the request
      if (updatedGateway == null) {
        res.status(400).send({ status: 'error', message: 'Bad Request' })

        return
      }

      res.status(200).send({ status: 'success', data: updatedGateway })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

module.exports = {
  handleGetClient,
  handleGetClients,
  handleGetClientButton,
  handleGetClientButtons,
  handleGetClientButtonSessions,
  handleGetClientGateway,
  handleGetClientGateways,
  handleGetClientVitals,
  handleRegisterClient,
  handleRegisterClientButton,
  handleRegisterClientGateway,
  handleUpdateClient,
  handleUpdateClientButton,
  handleUpdateClientGateway,
  validateGetClient,
  validateGetClients,
  validateGetClientButton,
  validateGetClientButtons,
  validateGetClientButtonSessions,
  validateGetClientGateway,
  validateGetClientGateways,
  validateGetClientVitals,
  validateRegisterClient,
  validateRegisterClientButton,
  validateRegisterClientGateway,
  validateUpdateClient,
  validateUpdateClientButton,
  validateUpdateClientGateway,
}
