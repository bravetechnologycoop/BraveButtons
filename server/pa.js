// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers, twilioHelpers } = require('brave-alert-lib')
const aws = require('./aws')
const db = require('./db/db')

const paApiKeys = [helpers.getEnvVar('PA_API_KEY_PRIMARY'), helpers.getEnvVar('PA_API_KEY_SECONDARY')]

const validateButtonsTwilioNumber = Validator.body(['braveKey', 'areaCode', 'locationID', 'googleIdToken']).trim().notEmpty()

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

const validateAwsDeviceRegistration = Validator.body(['deviceEUI', 'targetName', 'googleIdToken', 'braveKey']).trim().notEmpty()

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

const validateMessageClients = Validator.body(['twilioMessage', 'googleIdToken']).exists()

async function handleMessageClients(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const clients = await db.getActiveClients()
      const twilioMessage = req.body.twilioMessage
      const responseObject = {
        status: 'success',
        twilioMessage,
        successfullyMessaged: [],
        failedToMessage: [],
      }

      for (const client of clients) {
        // create array of all phone numbers for this client
        const phoneNumbers = []
        phoneNumbers.push(...client.responderPhoneNumbers, ...client.fallbackPhoneNumbers, ...client.heartbeatPhoneNumbers)

        // create set of all unique phone numbers for this client
        const uniquePhoneNumbers = new Set()
        phoneNumbers.forEach(phoneNumber => {
          uniquePhoneNumbers.add(phoneNumber)
        })

        // for each unique phone number of this client
        for (const phoneNumber of uniquePhoneNumbers) {
          // attempt to send Twilio SMS message from client's from phone number
          const twilioResponse = await twilioHelpers.sendTwilioMessage(phoneNumber, client.fromPhoneNumber, twilioMessage)

          // Twilio trace object: information about the sent message
          const twilioTraceObject = {
            to: phoneNumber,
            from: client.fromPhoneNumber,
            clientId: client.id,
            clientDisplayName: client.displayName,
          }

          // check if the Twilio SMS message wasn't sent successfully
          if (twilioResponse === undefined || twilioResponse.status === undefined || twilioResponse.status !== 'queued') {
            responseObject.failedToMessage.push(twilioTraceObject)

            // log the entire Twilio trace object
            helpers.log(`Failed to send Twilio SMS message to specific client: ${JSON.stringify(twilioTraceObject)}`)
          } else {
            // Twilio SMS message was sent successfully
            responseObject.successfullyMessaged.push(twilioTraceObject)
          }
        }
      }

      res.status(200).json(responseObject)
    } else {
      res.status(401).send({ message: 'Bad request' })
    }
  } catch (error) {
    helpers.log(`Failed to send Twilio SMS message to clients: ${error.message}`)
    res.status(500).send({ message: 'Internal server error' })
  }
}

module.exports = {
  handleAwsDeviceRegistration,
  handleButtonsTwilioNumber,
  handleMessageClients,
  validateAwsDeviceRegistration,
  validateButtonsTwilioNumber,
  validateMessageClients,
}
