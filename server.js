let fs = require('fs')
let express = require('express')
let https = require('https')
let moment = require('moment')
let bodyParser = require('body-parser')
let jsonBodyParser = bodyParser.json()
let SessionState = require('./SessionState.js')
const STATES = require('./SessionStateEnum.js'); 

require('dotenv').load();

const app = express();
let STATE;

//Set up state storage
const stateFilename = getEnvVar('STATE_FILENAME');

loadState();

//Set up Twilio 
const accountSid = getEnvVar('TWILIO_SID');
const authToken = getEnvVar('TWILIO_TOKEN');

const client = require('twilio')(accountSid, authToken);
const MessagingResponse = require('twilio').twiml.MessagingResponse;

app.use(bodyParser.urlencoded({extended: true}));

function log(logString) {
    console.log(moment().toString() + " - " + logString)
}

function getEnvVar(name) {
	return process.env.NODE_ENV === 'test' ? process.env[name + '_TEST'] : process.env[name];
}

function loadState() {
	let filepath = './' + stateFilename + '.json';
	if (fs.existsSync(filepath)) {
	    let stateData = JSON.parse(fs.readFileSync(filepath)); 
	    if (Object.keys(stateData).length > 0) {
	    	STATE = new SessionState(stateData.uuid, stateData.unit, stateData.state, stateData.numPresses);
	    } else {
	    	STATE = null;
	    }
	} else {
		STATE = null;
	}
}

function updateState(uuid, unit, state) {
	if (STATE == null || Object.keys(STATE).length === 0) {
		STATE = new SessionState(uuid, unit, state);
	} else {
		STATE.update(uuid, unit, state);
	}
}

function saveState() {
    fs.writeFileSync('./' + stateFilename + '.json', JSON.stringify(STATE));
}

/**
Check if a request is valid based on the presence of required body properties
**/
function isValidRequest(req, properties) {

	const hasAllProperties = (hasAllPropertiesSoFar, currentProperty) => hasAllPropertiesSoFar && req.body.hasOwnProperty(currentProperty);
	return properties.reduce(hasAllProperties, true);
}

function handleValidRequest(uuid, unit) {

	 log('UUID: ' + uuid.toString() + ' Unit:' + unit.toString());

	 updateState(uuid, unit, STATES.STARTED);
	 saveState();
	 if (STATE.numPresses === 1) {
		 sendTwilioMessage('Please answer "Ok" to this message when you have responded to the alert.');
		 setTimeout(remindToSendMessage, 300000);
	}
}

function handleErrorRequest(error) {
	log(error);
}

function handleTwilioRequest(req) {

	let phoneNumber = req.body.From;
	let message = req.body.Body;
	log(phoneNumber);
	if (phoneNumber === getEnvVar('RESPONDER_PHONE')) {
		let returnMessage = STATE.advanceSession(message);
		sendTwilioMessage(returnMessage);
		saveState();
		return 200;
	} else {
		handleErrorRequest('Invalid Phone Number');
		return 400;
	}
}

function sendTwilioMessage(msg) {
	client.messages
      .create({from: getEnvVar('BUTTON_PHONE'), body: msg, to: getEnvVar('RESPONDER_PHONE')})
      .then(message => log(message.sid))
      .done();
}

function remindToSendMessage() {
	if (STATE.state === STATES.STARTED) {
		STATE.state = STATES.WAITING_FOR_REPLY;
		sendTwilioMessage('Please Respond "Ok" if you have followed up on your call. If you do not respond within 2 minutes an emergency alert will be issued to staff.');
	}
}

app.post('/', jsonBodyParser, (req, res) => {

	const requiredBodyParams = ['UUID', 'Unit'];

	if (isValidRequest(req, requiredBodyParams)) {

		handleValidRequest(req.body.UUID.toString(), req.body.Unit.toString());
		res.status(200).send();

	} else {
		handleErrorRequest('Bad request: UUID or Unit is missing');
		res.status(400).send();
	}
});

app.post('/message', jsonBodyParser, (req, res) => {

	const requiredBodyParams = ['Body', 'From'];

	if (isValidRequest(req, requiredBodyParams)) {

		let status = handleTwilioRequest(req);
		res.status(status).send();

	} else {
		handleErrorRequest('Bad request: Body or From fields are missing');
		res.status(400).send();
	}

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