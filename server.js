let fs = require('fs')
let express = require('express')
let https = require('https')
let moment = require('moment')
let bodyParser = require('body-parser')
let jsonBodyParser = bodyParser.json()
let SessionState = require('./SessionState.js')
require('dotenv').load();

const app = express();
let STATE;

//Set up state storage
var stateFilename;

if (process.env.NODE_ENV === 'test') {
	stateFilename = "buttonPressesTest";
} else {
	stateFilename = "buttonPresses";
}

loadState();

//Set up Twilio 
const accountSid = process.env.TWILIO_TEST_SID;
const authToken = process.env.TWILIO_TEST_TOKEN;
const client = require('twilio')(accountSid, authToken);
const MessagingResponse = require('twilio').twiml.MessagingResponse;

app.use(bodyParser.urlencoded({extended: true}));

function log(logString) {
    console.log(moment().toString() + " - " + logString)
}

function loadState() {
	let filepath = './' + stateFilename + '.json';
	if (fs.existsSync(filepath)) {
	    let stateData = JSON.parse(fs.readFileSync(filepath)); 
	    if (Object.keys(stateData).length > 0) {
	    	STATE = new SessionState(stateData.uuid, stateData.unit, stateData.completed, stateData.numPresses);
	    } else {
	    	STATE = null;
	    }
	} else {
		STATE = null;
	}
}

function updateState(uuid, unit, completed) {
	if (STATE == null || Object.keys(STATE).length === 0) {
		STATE = new SessionState(uuid, unit, completed);
	} else {
		STATE.update(uuid, unit, completed);
	}
}

function saveState() {
    fs.writeFileSync('./' + stateFilename + '.json', JSON.stringify(STATE));
}

function isValidRequest(req) {
	return req.body.hasOwnProperty('UUID') && req.body.hasOwnProperty('Unit');
}

function handleValidRequest(uuid, unit) {

	 log('UUID: ' + uuid.toString() + ' Unit:' + unit.toString());

	 updateState(uuid, unit, false);
	 saveState();

	 client.messages
      .create({from: '+15017122661', body: 'Please answer "Ok" to this message when you have responded to the alert.', to: '+16047798329'})
      .then(message => log(message.sid))
      .done();
    
}

function handleErrorRequest() {
	log('Bad request: UUID or Unit is missing');
}



app.post('/', jsonBodyParser, (req, res) => {

	if (isValidRequest(req)) {

		handleValidRequest(req.body.UUID.toString(), req.body.Unit.toString());
	    res.status(200).send();


	} else {
		handleErrorRequest();
		res.status(400).send();
	}
})

app.post('/message', jsonBodyParser, (req, res) => {

	res.status(200).send();

});


let server;

if (process.env.NODE_ENV === 'test') {   // local http server for testing
	server = app.listen(443);
} else {
	let httpsOptions = {
	    key: fs.readFileSync(`/etc/letsencrypt/live/chatbot.brave.coop/privkey.pem`),
	    cert: fs.readFileSync(`/etc/letsencrypt/live/chatbot.brave.coop/fullchain.pem`)
	}
	server = https.createServer(httpsOptions, app).listen(443)
	log('brave server listening on port 443')
}

module.exports = server;