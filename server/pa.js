// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers, twilioHelpers } = require('brave-alert-lib')
const aws = require('./aws')

const paApiKeys = [helpers.getEnvVar('PA_API_KEY_PRIMARY'), helpers.getEnvVar('PA_API_KEY_SECONDARY')]

const validateButtonsTwilioNumber = Validator.body(['braveKey', 'areaCode', 'locationID', 'clickupToken']).trim().notEmpty()

async function handleButtonsTwilioNumber(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  if (validationErrors.isEmpty()) {
    const areaCode = req.body.areaCode
    const locationID = req.body.locationID
    const braveAPIKey = req.body.braveKey

    if (paApiKeys.includes(braveAPIKey)) {
      const response = await twilioHelpers.buyAndConfigureTwilioPhoneNumber(areaCode, locationID)
      if (response.message === 'success') {
        res.status(200).send(response)
      } else {
        res.status(500).send(response)
      }
    } else {
      res.status(401).send({ message: 'Incorrect API Key' })
    }
  } else {
    const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
    helpers.log(errorMessage)
    res.status(400).send(errorMessage)
  }
}

const validateAwsDeviceRegistration = Validator.body(['deviceEUI', 'targetName', 'clickupToken', 'braveKey']).trim().notEmpty()

async function handleAwsDeviceRegistration(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  if (validationErrors.isEmpty()) {
    const deviceEUI = req.body.deviceEUI
    const targetName = req.body.targetName
    const braveAPIKey = req.body.braveKey

    if (paApiKeys.includes(braveAPIKey)) {
      let awsThing

      try {
        awsThing = await aws.createThing()

        try {
          const deviceID = await aws.createDevice(targetName, deviceEUI)

          try {
            await aws.associateDeviceWithThing(deviceID, awsThing.thingArn)

            res.status(200).send('Successfully registered to AWS')
          } catch (err) {
            try {
              await aws.deleteDevice(deviceID)
            } catch (e) {
              // Do nothing
            }

            try {
              await aws.deleteThing(awsThing.thingName)
            } catch (e) {
              // Do nothing
            }

            helpers.logError(`Error in thing association: ${err}`)
            res.status(500).send(`Error in thing association: ${err}`)
          }
        } catch (err) {
          try {
            await aws.deleteThing(awsThing.thingName)
          } catch (e) {
            // Do nothing
          }

          helpers.logError(`Error in device creation: ${err}`)
          res.status(500).send(`Error in device creation: ${err}`)
        }
      } catch (err) {
        helpers.logError(`Error in thing creation: ${err}`)
        res.status(500).send(`Error in thing creation: ${err}`)
      }
    } else {
      res.status(401).send('Not Authenticated')
    }
  } else {
    const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
    helpers.log(errorMessage)
    res.status(400).send(errorMessage)
  }
}

module.exports = {
  handleAwsDeviceRegistration,
  handleButtonsTwilioNumber,
  validateAwsDeviceRegistration,
  validateButtonsTwilioNumber,
}
