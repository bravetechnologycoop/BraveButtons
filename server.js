let fs = require('fs')
let express = require('express')
let https = require('https')
let moment = require('moment')
let bodyParser = require('body-parser')
let jsonBodyParser = bodyParser.json()

const app = express()

app.use(bodyParser.urlencoded({extended: true}));

function log(logString) {
    console.log(moment().toString() + " - " + logString)
}

app.post('/', jsonBodyParser, (req, res) => {

	
    log('UUID: ' + req.body.UUID.toString() + ' Unit:' + req.body.Unit.toString())
    res.status(200).send()
})

let httpsOptions = {
    key: fs.readFileSync(`/etc/letsencrypt/live/chatbot.brave.coop/privkey.pem`),
    cert: fs.readFileSync(`/etc/letsencrypt/live/chatbot.brave.coop/fullchain.pem`)
}

https.createServer(httpsOptions, app).listen(443)
log('brave server listening on port 443')
