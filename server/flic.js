// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')
const buttonAlerts = require('./buttonAlerts')

const flicApiKey = helpers.getEnvVar('FLIC_BUTTON_PRESS_API_KEY')

const validateButtonPress = Validator.header(['button-serial-number']).exists()

async function handleButtonPress(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const serialNumber = req.get('button-serial-number')
      const batteryLevel = req.get('button-battery-level')
      const buttonName = req.get('button-name')
      const apiKey = req.query.apikey

      // Log the vaiditiy of the API key
      if (apiKey !== flicApiKey) {
        helpers.logError(`INVALID api key from '${buttonName}' (${serialNumber})`)
        res.status(401).send()
        return
      }

      const button = await db.getButtonWithSerialNumber(serialNumber)
      if (button === null) {
        const errorMessage = `Bad request to ${req.path}: Serial Number is not registered. Serial Number for '${buttonName}' is ${serialNumber}`
        helpers.logError(errorMessage)
        res.status(400).send(`Bad request to ${req.path}: Serial Number is not registered`)
      } else {
        await buttonAlerts.handleValidRequest(button, 1, batteryLevel)

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
  handleButtonPress,
  validateButtonPress,
}
