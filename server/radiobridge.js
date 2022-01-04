// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db.js')
const buttons = require('./buttons.js')

const radioBridgeApiKeys = [helpers.getEnvVar('RADIO_BRIDGE_API_KEY_PRIMARY'), helpers.getEnvVar('RADIO_BRIDGE_API_KEY_SECONDARY')]

const EVENT_TYPE = {
  BUTTON_PRESS: 'PUSH_BUTTON',
  HEARTBEAT: 'SUPERVISORY',
}

const validateButtonPress = [Validator.body(['deviceId', 'eventType']).notEmpty(), Validator.header(['authorization']).notEmpty()]

async function handleButtonPress(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const { deviceId, eventType } = req.body
      const { authorization } = req.headers

      if (!radioBridgeApiKeys.includes(authorization)) {
        helpers.logError(`INVALID Radio Bridge API key from '${deviceId}' for a ${eventType} event`)
        res.status(401).send()
        return
      }

      if (eventType === EVENT_TYPE.BUTTON_PRESS) {
        const button = await db.getButtonWithSerialNumber(deviceId)
        if (button === null) {
          const errorMessage = `Bad request to ${req.path}: Device ID is not registered: '${deviceId}'`
          helpers.logError(errorMessage)
          res.status(400).send(`Bad request to ${req.path}: Device ID is not registered`)
        } else {
          await buttons.handleValidRequest(button, 1)

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
