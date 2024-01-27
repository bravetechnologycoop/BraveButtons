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

const validateGetClient = Validator.header(['Authorization']).notEmpty()

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
      res.status(400).send({ status: 'error', message: 'Bad request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
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
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientButton = Validator.header(['Authorization']).notEmpty()

async function handleGetClientButton(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const button = await db.getButtonWithId(req.params.buttonId)

      // check that this button exists and is owned by the specified client
      // NOTE: if clientId is invalid, then the query will fail and return null
      if (button == null || button.clientId !== req.params.clientId) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.status(200).send({ status: 'success', data: button })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientButtons = Validator.header(['Authorization']).notEmpty()

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
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientButtonSessions = Validator.header(['Authorization']).notEmpty()

async function handleGetClientButtonSessions(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const button = await db.getButtonWithId(req.params.buttonId)

      // check that this button exists and is owned by the specified client
      // NOTE: if clientId is invalid, then the query will fail and return null
      if (button == null || button.clientId !== req.params.clientId) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      const sessions = await db.getRecentSessionsWithButtonId(req.params.buttonId)

      res.status(200).send({ status: 'success', data: sessions })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientGateway = Validator.header(['Authorization']).notEmpty()

async function handleGetClientGateway(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const gateway = await db.getGatewayWithId(req.params.gatewayId)

      // check that this gateway exists and is owned by the specified client
      // NOTE: if clientId is invalid, then the query will fail and return null
      if (gateway == null || gateway.clientId !== req.params.clientId) {
        res.status(404).send({ status: 'error', message: 'Not Found' })

        return
      }

      res.status(200).send({ status: 'success', data: gateway })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientGateways = Validator.header(['Authorization']).notEmpty()

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
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientVitals = Validator.header(['Authorization']).notEmpty()

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
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateRegisterClient = Validator.header(['Authorization']).notEmpty()

async function handleRegisterClient(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // db.createClient
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateRegisterClientButton = Validator.header(['Authorization']).notEmpty()

async function handleRegisterClientButton(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // db.createButton
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateRegisterClientGateway = Validator.header(['Authorization']).notEmpty()

async function handleRegisterClientGateway(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // db.createGateway
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateUpdateClient = Validator.header(['Authorization']).notEmpty()

async function handleUpdateClient(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // db.updateClient
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateUpdateClientButton = Validator.header(['Authorization']).notEmpty()

async function handleUpdateClientButton(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // db.updateButton
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateUpdateClientGateway = Validator.header(['Authorization']).notEmpty()

async function handleUpdateClientGateway(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // db.updateGateway
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error', message: 'Bad Request' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
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
