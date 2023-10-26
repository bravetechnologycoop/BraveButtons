/* Conventions for this API:
 * (inherited from BraveSensor/server/api.js)
 *  - GET method for read actions
 *  - POST method for update actions
 *  - PUT method for create actions
 *  - DELETE method for delete actions
 *
 *  - Must contain the `braveKey` API key in the query string (for GET only) or the body (for all other methods)
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
const { helpers, twilioHelpers } = require('brave-alert-lib')
const db = require('./db/db')

const paApiKeys = [helpers.getEnvVar('PA_API_KEY_PRIMARY'), helpers.getEnvVar('PA_API_KEY_SECONDARY')]

async function authorize(req, res, next) {
  if (paApiKeys.indexOf(req.query.braveKey) < 0 && paApiKeys.indexOf(req.body.braveKey) < 0) {
    helpers.log(`Unauthorized request to: ${req.path}`)
    res.status(401).send({ status: 'error', message: 'Unauthorized' })
  } else {
    return next()
  }
}

const validateMessageClients = Validator.body(['braveKey', 'message']).exists()

async function messageClients(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const clients = await db.getActiveClients()
      const message = req.body.message
      const response = {
        status: 'success',
        data: {
          message,
          contacted: [],
          failed: [],
        },
        message: '',
      }

      for (const client of clients) {
        // define phoneNumbers as a Set to prevent duplicate numbers
        const phoneNumbers = new Set()

        // add responder, fallback, and heartbeat numbers to phoneNumbers
        client.responderPhoneNumbers.forEach(phoneNumber => {
          phoneNumbers.add(phoneNumber)
        })
        client.fallbackPhoneNumbers.forEach(phoneNumber => {
          phoneNumbers.add(phoneNumber)
        })
        client.heartbeatPhoneNumbers.forEach(phoneNumber => {
          phoneNumbers.add(phoneNumber)
        })

        // for each phone number of this client
        for (const phoneNumber of phoneNumbers) {
          // send SMS text message
          const twilioResponse = await twilioHelpers.sendTwilioMessage(phoneNumber, client.fromPhoneNumber, message)
          // Twilio trace object: information about the sent message
          const twilioTraceObject = {
            to: phoneNumber,
            from: client.fromPhoneNumber,
            clientId: client.id,
            clientDisplayName: client.displayName,
          }

          // keep track of which clients were contacted and not contacted
          if (twilioResponse === undefined || twilioResponse.status === undefined || twilioResponse.status !== 'queued') {
            response.data.failed.push(twilioTraceObject)
            // log entire Twilio trace object
            helpers.log(`Failed to send Twilio message: ${JSON.stringify(twilioTraceObject)}.`)
          } else {
            response.data.contacted.push(twilioTraceObject)
          }
        }
      }

      res.status(200).send(response)
    } else {
      res.status(400).send({ status: 'error' })
    }
  } catch (e) {
    res.status(500).send({ status: 'error' })
  }
}

module.exports = {
  authorize,
  validateMessageClients,
  messageClients,
}
