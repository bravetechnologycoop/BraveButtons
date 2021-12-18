/* eslint-disable no-console */
const flicLib = require('fliclib-linux-hci')
const fs = require('fs')
const CsvWriter = require('csv-write-stream')
const { prompt } = require('enquirer')
const dotenv = require('dotenv')
const twilio = require('twilio')

// Setup environment variables
dotenv.config()
const DOMAIN = process.env.DOMAIN
const TWILIO_MESSAGING_SERVICE_ID = process.env.TWILIO_MESSAGING_SERVICE_ID

// Setup Twilio
const TWILIO_SID = process.env.TWILIO_SID
const TWILIO_TOKEN = process.env.TWILIO_TOKEN
const twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN)

// Setup Flic
const FlicClient = flicLib.FlicClient
const FlicScanWizard = flicLib.FlicScanWizard

const client = new FlicClient('localhost', 5551)

const outputFile = `./pairing-tool-output-${Math.random().toString(36).slice(-5)}.csv`
const csvWriter = CsvWriter({ headers: ['button_id', 'unit', 'phone_number', 'button_serial_number'] })
csvWriter.pipe(fs.createWriteStream(outputFile))

async function scanAndPairOneButton() {
  // eslint-disable-next-line no-unused-vars -- the reject var is included for clarity
  const promise = new Promise((resolve, reject) => {
    const wizard = new FlicScanWizard()
    // wizard.on('foundPublicButton', (bdAddr, name) => console.log(`Found a public button with UUID ${bdAddr}, keep holding it down...`))
    // wizard.on('buttonConnected', (bdAddr, name) => console.log(`Connected to a button with UUID ${bdAddr}, keep holding it down...`))

    // eslint-disable-next-line no-unused-vars -- these vars may be useful soon
    wizard.on('completed', async (result, bdAddr, name) => {
      console.log(`Completed pairing for button ${bdAddr} with result: ${result}`)
      if (result !== 'WizardSuccess') {
        resolve()
      } else {
        const clientQuestion = {
          type: 'input',
          name: 'clientName',
          message: `What is this new button's client's name?`,
        }

        const unitQuestion = {
          type: 'input',
          name: 'unit',
          message: 'What is the unit for this new button?',
        }

        const phoneNumberQuestion = {
          type: 'input',
          name: 'phoneNumberOrAreaCode',
          message: 'What is the phone number for this new button (or enter an area code to buy a new phone number)?',
        }

        const confirmQuestion = {
          type: 'confirm',
          name: 'confirmation',
          message: 'Create a button with the info above?',
        }

        const response = await prompt([clientQuestion, unitQuestion, phoneNumberQuestion, confirmQuestion])

        if (response.confirmation) {
          // eslint-disable-next-line no-unused-vars -- these vars may be useful soon
          client.getButtonInfo(bdAddr, async (_bdAddr, uuid, color, serialNumber) => {
            const phoneNumberOrAreaCode = response.phoneNumberOrAreaCode.trim()
            let phoneNumber
            let phoneNumberSid
            if (phoneNumberOrAreaCode.length === 3) {
              try {
                // Buy Twilio number
                const incomingPhoneNumber = await twilioClient.incomingPhoneNumbers.create({
                  areaCode: phoneNumberOrAreaCode,
                  smsUrl: `https://${DOMAIN}/alert/sms`,
                  voiceUrl: 'https://demo.twilio.com/welcome/voice/',
                  friendlyName: `${response.clientName.trim()} ${response.unit.trim()}`,
                })
                phoneNumber = incomingPhoneNumber.phoneNumber
                phoneNumberSid = incomingPhoneNumber.sid
                console.log(`  ... Bought phone number: ${phoneNumber}`)
              } catch (e) {
                console.error(
                  '  ... ERROR buying new Twilio phone number, check for Twilio errors and then try this Button again. This Button WILL NOT appear in the CSV.',
                  e,
                )
                resolve()
              }

              try {
                // Add Twilio number to the Messaging Service
                await twilioClient.messaging.services(TWILIO_MESSAGING_SERVICE_ID).phoneNumbers.create({ phoneNumberSid })
                console.log(`  ... Added ${phoneNumber} to messaging service`)
              } catch (e) {
                console.error(
                  '  ... ERROR adding the new Twilio phone number the messaging service, ***MUST*** do this manually in the Twilio UI. This Button WILL appear in the CSV.',
                  e,
                )
              }
            } else {
              phoneNumber = phoneNumberOrAreaCode
            }

            // Write to CSV
            csvWriter.write([uuid, response.unit, phoneNumber, serialNumber])

            resolve()
          })
        } else {
          resolve()
        }
      }
    })

    client.addScanWizard(wizard)
  })

  await promise
}

async function runPairingTool() {
  console.log('Welcome to the Brave Button pairing tool.')

  // eslint-disable-next-line no-constant-condition -- we want to implement a run loop here
  while (true) {
    const continuePairingQuestion = {
      type: 'confirm',
      name: 'continuePairing',
      message: 'Do you want to pair a button?',
    }

    const response = await prompt(continuePairingQuestion)

    if (response.continuePairing) {
      console.log('Hold down the button you want to pair...')
      await scanAndPairOneButton()
    } else {
      console.log('Pairing tool finished. Bye!')
      csvWriter.end()

      // put in a newline since the import script requires it
      try {
        fs.appendFileSync(outputFile, '\n')
      } catch (e) {
        console.log(`Error appending a newline to the output file: ${e}`)
      }

      client.close()
      break
    }
  }
}

client.on('ready', runPairingTool)
client.on('error', error => console.log(error))
