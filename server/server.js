let fs = require('fs')
let express = require('express')
let http = require('http')
let https = require('https')
let moment = require('moment')
let bodyParser = require('body-parser')
let Datastore = require('nedb')
let Mustache = require('mustache')

let app = express()
let jsonBodyParser = bodyParser.json()
let config = JSON.parse(fs.readFileSync(`${__dirname}/brave_config.json`, 'utf8'))
let twilioClient = require('twilio')(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
let db = new Datastore({
    filename: `${__dirname}/server.db`,
    autoload: true
})

let dashboardTemplate = fs.readFileSync(`${__dirname}/dashboard.mst`, 'utf-8')

// compact data file every 5 minutes
db.persistence.setAutocompactionInterval(5*60000)

const HEARTBEAT_DELAY_THRESHOLD_MILLIS = 110*1000

function log(logString) {
    console.log(moment().toString() + " - " + logString)
}

function sendAlerts(systemName) {

    log('sending alerts for system named ' + systemName)

    for(let i=0; i<config.TWILIO_TO_NUMBERS.length; i++) {
        twilioClient.messages.create({
            body: `The Flic connection for ${systemName} has been lost.`,
            from: config.TWILIO_FROM_NUMBER,
            to: config.TWILIO_TO_NUMBERS[i]
        })
        .then(message => log(message.sid))
        .done()
    }
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

app.post('/rename_system', jsonBodyParser, (req, res) => {
    log('got a request to rename system ' + req.body.system_id)
    db.update({ system_id: req.body.system_id }, { $set: { system_name: req.body.system_name } }, {}, (err, numChanged) => {
        if(err) {
            log(err.message)
        }
    })
    res.status(200).send()
})

app.get('/dashboard', (req, res) => {
    db.find({}, (err, docs) => {
        if(err) {
            log(err.message)
        }
        let viewParams = {
            domain: config.DOMAIN,
            dashboard_render_time: moment().toString(),
            systems: []   
        }
        docs.forEach((doc) => {
            let flicLastSeenTime = moment(doc.flic_last_seen_time)
            let flicLastSeenSecs = moment().diff(flicLastSeenTime) / 1000.0
            flicLastSeenSecs = Math.round(flicLastSeenSecs)
            viewParams.systems.push({
                system_name: doc.system_name,
                flic_last_seen: flicLastSeenSecs.toString() + ' seconds ago',
                heartbeat_last_seen: flicLastSeenSecs.toString() + ' seconds ago' // TODO: update once separate thresholds are implemented
            })
        })
        
        let htmlString = Mustache.render(dashboardTemplate, viewParams)
        res.send(htmlString)
    })
})  

function updateSentAlerts(systemId, sentAlerts) {
    db.update({ system_id: systemId }, { $set: { sent_alerts: sentAlerts } }, {}, (err, numChanged) => {
        if(err) {
            log(err.message)
        }
    })
}

function checkHeartbeat() {
    db.find({}, (err, docs) => {
        if(err) {
            log(err.message)
        }
        docs.forEach((doc) => {
            let flicLastSeenTime = moment(doc.flic_last_seen_time)
            let currentTime = moment()
            let heartbeatDelayMillis = currentTime.diff(flicLastSeenTime)
        
            if(heartbeatDelayMillis > HEARTBEAT_DELAY_THRESHOLD_MILLIS && !doc.sent_alerts) {
                sendAlerts(doc.system_name)
                updateSentAlerts(doc.system_id, true)
            }
            else if(heartbeatDelayMillis < HEARTBEAT_DELAY_THRESHOLD_MILLIS) { 
                updateSentAlerts(doc.system_id, false)
            }
        })
    })    
}

setInterval(checkHeartbeat, 1000)

if(process.env.NODE_ENV == "production") {
    let httpsOptions = {
        key: fs.readFileSync(`/etc/letsencrypt/live/${config.DOMAIN}/privkey.pem`),
        cert: fs.readFileSync(`/etc/letsencrypt/live/${config.DOMAIN}/fullchain.pem`)
    }
    https.createServer(httpsOptions, app).listen(443)
    log('brave server listening on port 443')
}
else {
    http.createServer(app).listen(8000)
    log('brave server listening on port 8000')
}
