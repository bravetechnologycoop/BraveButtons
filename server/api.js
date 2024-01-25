// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')

const validateGetClients = Validator.header(['Authorization']).notEmpty()

async function handleGetClients(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateRegisterClient = Validator.header(['Authorization']).notEmpty()

async function handleRegisterClient(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateGetClient = Validator.header(['Authorization']).notEmpty()

async function handleGetClient(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateUpdateClient = Validator.header(['Authorization']).notEmpty()

async function handleUpdateClient(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateGetClientGateways = Validator.header(['Authorization']).notEmpty()

async function handleGetClientGateways(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateGetClientButtons = Validator.header(['Authorization']).notEmpty()

async function handleGetClientButtons(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateRegisterClientButton = Validator.header(['Authorization']).notEmpty()

async function handleRegisterClientButton(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateGetClientButton = Validator.header(['Authorization']).notEmpty()

async function handleGetClientButton(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateUpdateClientButton = Validator.header(['Authorization']).notEmpty()

async function handleUpdateClientButton(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateGetClientButtonSessions = Validator.header(['Authorization']).notEmpty()

async function handleGetClientButtonSessions(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateRegisterClientGateway = Validator.header(['Authorization']).notEmpty()

async function handleRegisterClientGateway(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateGetClientGateway = Validator.header(['Authorization']).notEmpty()

async function handleGetClientGateway(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateUpdateClientGateway = Validator.header(['Authorization']).notEmpty()

async function handleUpdateClientGateway(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

const validateGetClientVitals = Validator.header(['Authorization']).notEmpty()

async function handleGetClientVitals(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      // logic here
      // ...
      res.status(200).send({ status: 'success' })
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (error) {
    res.status(500).send({ status: 'error' })
  }
}

module.exports = {
  validateGetClients,
  handleGetClients,
  validateRegisterClient,
  handleRegisterClient,
  validateGetClient,
  handleGetClient,
  validateUpdateClient,
  handleUpdateClient,
  validateGetClientButtons,
  handleGetClientButtons,
  validateRegisterClientButton,
  handleRegisterClientButton,
  validateGetClientButton,
  handleGetClientButton,
  validateUpdateClientButton,
  handleUpdateClientButton,
  validateGetClientButtonSessions,
  handleGetClientButtonSessions,
  validateGetClientGateways,
  handleGetClientGateways,
  validateRegisterClientGateway,
  handleRegisterClientGateway,
  validateGetClientGateway,
  handleGetClientGateway,
  validateUpdateClientGateway,
  handleUpdateClientGateway,
  validateGetClientVitals,
  handleGetClientVitals,
}
