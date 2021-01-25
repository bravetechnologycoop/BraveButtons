/* eslint-disable no-console */
const flicLib = require('fliclib-linux-hci')
const fs = require('fs')
const CsvWriter = require('csv-write-stream')
const { prompt } = require('enquirer')

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
        const unitQuestion = {
          type: 'input',
          name: 'unit',
          message: 'What is the unit for this new button?',
        }

        const phoneNumberQuestion = {
          type: 'input',
          name: 'phoneNumber',
          message: 'What is the phone number for this new button?',
        }

        const confirmQuestion = {
          type: 'confirm',
          name: 'confirmation',
          message: 'Create a button with the info above?',
        }

        const response = await prompt([unitQuestion, phoneNumberQuestion, confirmQuestion])

        if (response.confirmation) {
          // eslint-disable-next-line no-unused-vars -- these vars may be useful soon
          client.getButtonInfo(bdAddr, (uuid, color, serialNumber) => {
            csvWriter.write([uuid, response.unit, response.phoneNumber, serialNumber])
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
