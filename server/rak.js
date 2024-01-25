// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')
const buttonAlerts = require('./buttonAlerts')

const rakApiKeys = [helpers.getEnvVar('RAK_API_KEY_PRIMARY'), helpers.getEnvVar('RAK_API_KEY_SECONDARY')]

const EVENT_TYPE = {
  BUTTON_PRESS_1: 65, // ASCII for 'A'
  BUTTON_PRESS_2: 66, // ASCII for 'B'
  BUTTON_PRESS_3: 67, // ASCII for 'C'
  BUTTON_PRESS_4: 68, // ASCII for 'D'
  HEARTBEAT: 72, // ASCII for 'H'
}

const validateButtonPress = [Validator.body(['devEui', 'payload']).notEmpty(), Validator.header(['authorization']).notEmpty()]

async function handleButtonPress(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const { devEui, snr, rssi, payload } = req.body
      const { authorization } = req.headers

      const event = Buffer.from(payload, 'base64')

      helpers.log(JSON.stringify(req.body))

      if (!rakApiKeys.includes(authorization)) {
        helpers.logError(`INVALID RAK API key from '${devEui}' for a ${payload} payload (decoded: ${event})`)
        res.status(401).send()
        return
      }

      const button = await db.getButtonWithSerialNumber(devEui)

      if (event[0] === EVENT_TYPE.HEARTBEAT && button !== null) {
        await db.logButtonsVital(button.id, event[1], snr, rssi)
      } else if (event[0] === EVENT_TYPE.BUTTON_PRESS_4 || event[0] === EVENT_TYPE.BUTTON_PRESS_3) {
        if (button === null) {
          const errorMessage = `Bad request to ${req.path}: DevEui is not registered: '${devEui}'`
          helpers.logError(errorMessage)
          res.status(400).send(`Bad request to ${req.path}: DevEui is not registered`)
          return
        }

        await buttonAlerts.handleValidRequest(button)
      }
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      res.status(400).send(errorMessage)
      return
    }
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
    return
  }

  res.status(200).send()
}

module.exports = {
  EVENT_TYPE,
  handleButtonPress,
  validateButtonPress,
}
