let fs = require('fs')
let express = require('express')
let https = require('https')
let moment = require('moment')
let bodyParser = require('body-parser')
let app = express()
let jsonBodyParser = bodyParser.json()
let config = JSON.parse(fs.readFileSync(`${__dirname}/brave_config.json`, 'utf8'))
let twilioClient = require('twilio')(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
let lastHeartbeatTime = moment()
let sentAlerts = false

function log(logString) {
    console.log(moment().toString() + " - " + logString)
}

function sendAlerts() {

    // only send alerts once per disconnection event
    if(sentAlerts) {
        return
    }

    log('sending alerts')

    for(let i=0; i<config.TWILIO_TO_NUMBERS.length; i++) {
        twilioClient.messages.create({
            body: 'The Flic connection has been lost.',
            from: config.TWILIO_FROM_NUMBER,
            to: config.TWILIO_TO_NUMBERS[i]
        })
        .then(message => log(message.sid))
        .done()
    }

    sentAlerts = true
}

app.post('/heartbeat', jsonBodyParser, (req, res) => {
    log('got a heartbeat, flic_ok is ' + req.body.flic_ok.toString())
    if(req.body.flic_ok) {
        lastHeartbeatTime = moment()
        sentAlerts = false
    }
    res.status(200).send()
})

function checkHeartbeat() {
    let currentTime = moment()
    let heartbeatDelayMillis = currentTime.diff(lastHeartbeatTime)
    if(heartbeatDelayMillis > 70000) {
        sendAlerts()
    }
}

setInterval(checkHeartbeat, 1000)

let httpsOptions = {
    key: fs.readFileSync(`/etc/letsencrypt/live/${config.DOMAIN}/privkey.pem`),
    cert: fs.readFileSync(`/etc/letsencrypt/live/${config.DOMAIN}/fullchain.pem`)
}

https.createServer(httpsOptions, app).listen(443)
log('brave server listening on port 443')
