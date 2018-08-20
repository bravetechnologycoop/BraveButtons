let express = require('express')
let moment = require('moment')
let bodyParser = require('body-parser')
let app = express()
let jsonBodyParser = bodyParser.json()

let lastHeartbeatTime = moment()

app.post('/heartbeat', jsonBodyParser, (req, res) => {
    console.log('got a heartbeat, flic_ok is ' + req.body.flic_ok.toString())
    if(req.body.flic_ok) {
        lastHeartbeatTime = moment()
    }
    res.status(200).send()
})

function checkHeartbeat() {
    let currentTime = moment()
    let heartbeatDelayMillis = currentTime.diff(lastHeartbeatTime)
    if(heartbeatDelayMillis > 5000) {
        console.log('lost connection to flic!')
    }
}

setInterval(checkHeartbeat, 1000)

console.log('listening on port 1337')

app.listen(1337)
