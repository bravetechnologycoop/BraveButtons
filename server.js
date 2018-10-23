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

	if (req.body.hasOwnProperty('UUID') && req.body.hasOwnProperty('Unit')) {

	    log('UUID: ' + req.body.UUID.toString() + ' Unit:' + req.body.Unit.toString());
	    res.status(200).send();
	    
	} else {
		log('Bad request: request does not contain button ID or unit');
		res.status(400).send();
	}
})


let server;

if (require.main === module) {   // if called directly, start the real server
	let httpsOptions = {
	    key: fs.readFileSync(`/etc/letsencrypt/live/chatbot.brave.coop/privkey.pem`),
	    cert: fs.readFileSync(`/etc/letsencrypt/live/chatbot.brave.coop/fullchain.pem`)
	}

	server = https.createServer(httpsOptions, app).listen(443)
	log('brave server listening on port 443')
} else {
	server = app.listen(443);

}

module.exports = server;