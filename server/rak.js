// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')
const buttonAlerts = require('./buttonAlerts')

const rakApiKeys = [helpers.getEnvVar('RAK_API_KEY_PRIMARY'), helpers.getEnvVar('RAK_API_KEY_SECONDARY')]

const EVENT_TYPE = {
  BUTTON_PRESS: 'QQ==',
}

const validateButtonPress = [Validator.body(['devEui', 'payload']).notEmpty(), Validator.header(['authorization']).notEmpty()]

async function handleButtonPress(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const { devEui, payload } = req.body
      const { authorization } = req.headers

      // TODO Remove this after we are done testing the RAK buttons
      helpers.log(JSON.stringify(req.body))

      if (!rakApiKeys.includes(authorization)) {
        helpers.logError(`INVALID RAK API key from '${devEui}' for a ${payload} payload`)
        res.status(401).send()
        return
      }

      if (payload === EVENT_TYPE.BUTTON_PRESS) {
        const button = await db.getButtonWithSerialNumber(devEui)
        if (button === null) {
          const errorMessage = `Bad request to ${req.path}: DevEui is not registered: '${devEui}'`
          helpers.logError(errorMessage)
          res.status(400).send(`Bad request to ${req.path}: DevEui is not registered`)
        } else {
          await buttonAlerts.handleValidRequest(button, 1)

          res.status(200).send()
        }
        // TODO } else if (eventType === EVENT_TYPE.HEARTBEAT) {
      } else {
        res.status(200).send()
      }
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
}

module.exports = {
  EVENT_TYPE,
  handleButtonPress,
  validateButtonPress,
}
