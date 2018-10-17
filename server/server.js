let fs = require('fs')
let express = require('express')
let https = require('https')
let moment = require('moment')
let bodyParser = require('body-parser')
let Datastore = require('nedb')

let app = express()
let jsonBodyParser = bodyParser.json()
let config = JSON.parse(fs.readFileSync(`${__dirname}/brave_config.json`, 'utf8'))
let twilioClient = require('twilio')(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
let sentAlerts = false
let db = new Datastore({
    filename: 'server.db',
    autoload: true
})

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
    log('got a heartbeat from ' + req.body.system_id + ', flic_last_seen_secs is ' + req.body.flic_last_seen_secs.toString())
    let flicLastSeenTime = moment().subtract(req.body.flic_last_seen_secs, 'seconds').toISOString()
    db.update({ system_id: req.body.system_id }, { $set: { flic_last_seen_time: flicLastSeenTime } }, { upsert: true }, (err, numChanged) => {
        if(err) {
            log(err.message)
        }
    })
    res.status(200).send()
})

function checkHeartbeat() {
    db.find({}, (err, docs) => {
        if(err) {
            log(err.message)
        }
        docs.forEach((doc) => {
            let flicLastSeenTime = moment(doc.flic_last_seen_time)
            let currentTime = moment()
            let heartbeatDelayMillis = currentTime.diff(flicLastSeenTime)
            
            if(heartbeatDelayMillis > 70000) {
                sendAlerts()
            }
            else {
                sentAlerts = false
            }
        })
    })    
}

setInterval(checkHeartbeat, 1000)

let httpsOptions = {
    key: fs.readFileSync(`/etc/letsencrypt/live/${config.DOMAIN}/privkey.pem`),
    cert: fs.readFileSync(`/etc/letsencrypt/live/${config.DOMAIN}/fullchain.pem`)
}

https.createServer(httpsOptions, app).listen(443)
log('brave server listening on port 443')
