let fs = require('fs')
let express = require('express')
let https = require('https')
let moment = require('moment')
let bodyParser = require('body-parser')
let jsonBodyParser = bodyParser.json()
var cookieParser = require('cookie-parser');
var session = require('express-session');
const chalk = require('chalk')
const Mustache = require('mustache')

let SessionState = require('./SessionState.js')
const STATES = require('./SessionStateEnum.js');
require('dotenv').load();
const db = require('./db/db.js')

const app = express();

const unrespondedSessionReminderTimeoutMillis = process.env.NODE_ENV === 'test' ? 1000 : 300000;
const unrespondedSessionAlertTimeoutMillis = process.env.NODE_ENV === 'test' ? 2000 : 420000;

//Set up Twilio
const accountSid = getEnvVar('TWILIO_SID');
const authToken = getEnvVar('TWILIO_TOKEN');

const client = require('twilio')(accountSid, authToken);
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const dashboardTemplate = fs.readFileSync(`${__dirname}/dashboard.mst`, 'utf-8')

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname));

function log(logString) {
    if(process.env.NODE_ENV === 'test') {
        console.log(chalk.dim.cyan('\t' + logString))
    }
    else {
        console.log(moment().toISOString() + " - " + logString)
    }
}

function getEnvVar(name) {
	return process.env.NODE_ENV === 'test' ? process.env[name + '_TEST'] : process.env[name];
}

/**
Check if a request is valid based on the presence of required body properties
**/
function isValidRequest(req, properties) {

	const hasAllProperties = (hasAllPropertiesSoFar, currentProperty) => hasAllPropertiesSoFar && req.body.hasOwnProperty(currentProperty);
	return properties.reduce(hasAllProperties, true);
}

async function handleValidRequest(buttonId, unit, phoneNumber, numPresses) {

    log('UUID: ' + buttonId.toString() + ' Unit: ' + unit.toString() + ' Presses: ' + numPresses.toString());

    let client = await db.beginTransaction()

        let session = await db.getUnrespondedSessionWithPhoneNumber(phoneNumber, client)
        
        if(session === null) {
            session = await db.createSession(buttonId, unit, phoneNumber, numPresses, client)
        }
        else {
            session.incrementButtonPresses(numPresses)
            await db.saveSession(session, client)
        }

        if(needToSendButtonPressMessageForSession(session)) {
            sendButtonPressMessageForSession(session)
        }

    await db.commitTransaction(client)
}

async function handleTwilioRequest(req) {

	let phoneNumber = req.body.From;
	let buttonPhone = req.body.To;
	let message = req.body.Body;

    let session = await db.getMostRecentIncompleteSessionWithPhoneNumber(buttonPhone)

    if (phoneNumber === getEnvVar('RESPONDER_PHONE')) {
        let returnMessage = session.advanceSession(message);
        await sendTwilioMessage(buttonPhone, returnMessage);
        await db.saveSession(session)
        return 200;
    } 
    else {
        log('Invalid Phone Number');
        return 400;
    }
}

async function needToSendButtonPressMessageForSession(session) {
    return (session.numPresses === 1 || session.numPresses === 3 || session.numPresses % 5 === 0)
}

async function sendButtonPressMessageForSession(session) {
    if (session.numPresses === 1) {
        await sendTwilioMessage(session.phoneNumber, 'There has been a request for help from Unit ' + session.unit.toString() + ' . Please respond "Ok" when you have followed up on the call.');
        setTimeout(remindToSendMessage, unrespondedSessionReminderTimeoutMillis, session.phoneNumber);
        setTimeout(sendStaffAlert, unrespondedSessionAlertTimeoutMillis, session.phoneNumber, session.unit.toString());
    } 
    else if (session.numPresses % 5 === 0 || session.numPresses === 3) {
        await sendTwilioMessage(session.phoneNumber, 'This in an urgent request. The button has been pressed ' + session.numPresses.toString() + ' times. Please respond "Ok" when you have followed up on the call.');
    }
}

async function sendTwilioMessage(phone, msg) {
    try {
        await client.messages.create({from: phone, body: msg, to: getEnvVar('RESPONDER_PHONE')})
                             .then(message => log(message.sid))
    }
    catch(err) {
        log(err)
    }
}

async function remindToSendMessage(phoneNumber) {

    let session = await db.getUnrespondedSessionWithPhoneNumber(phoneNumber)
    
    if(session === null) {
        log('No open Session with phone number' + phoneNumber.toString())
    }
    else {
        if (session.state === STATES.STARTED) {
            session.state = STATES.WAITING_FOR_REPLY
            await db.saveSession(session)
            await sendTwilioMessage(phoneNumber, 'Please Respond "Ok" if you have followed up on your call. If you do not respond within 2 minutes an emergency alert will be issued to staff.');
        }
    }
}

async function sendStaffAlert(phoneNumber, unit) {

    let session = await db.getUnrespondedSessionWithPhoneNumber(phoneNumber)

    if(session === null) {
        return
    }

    if (session.state === STATES.WAITING_FOR_REPLY) {
        await client.messages
            .create({from: phoneNumber, body: 'There has been an unresponded request at unit ' + unit.toString(), to: getEnvVar('STAFF_PHONE')})
            .then(message => log(message.sid))
    }
}

app.use(cookieParser());

// initialize express-session to allow us track the logged-in user across sessions.
app.use(session({
    key: 'user_sid',
    secret: getEnvVar('SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000
    }
}));

// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');
    }
    next();
});


// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
        res.redirect('/dashboard');
    } else {
        next();
    }
};


app.get('/', sessionChecker, (req, res) => {
    res.redirect('/login');
});


app.route('/login')
    .get(sessionChecker, (req, res) => {
        res.sendFile(__dirname + '/login.html');
    })
    .post((req, res) => {
        var username = req.body.username,
            password = req.body.password;

        if ((username === getEnvVar('WEB_USERNAME')) && (password === getEnvVar('PASSWORD'))) {
        	req.session.user = username;
        	res.redirect('/dashboard');
        } 
        else {
        	res.redirect('/login');
        }
    });

app.get('/dashboard', async (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        try {
            let allSessions = await db.getAllSessions()
            let recentSessions = new Map() 
            
            // TODO: consider optimizing this
            allSessions.forEach((sessionState) => {
                if(recentSessions.has(sessionState.unit)) {
                    let moment1 = moment(recentSessions.get(sessionState.unit).createdAt, moment.ISO_8601)
                    let moment2 = moment(sessionState.createdAt, moment.ISO_8601)
                    if(moment2.isAfter(moment1)) {
                        recentSessions.set(sessionState.unit, sessionState)
                    }
                }
                else {
                    recentSessions.set(sessionState.unit, sessionState)
                }
            })
            
            let viewParams = {
                recentSessions: []
            }

            for(const [key, recentSession] of recentSessions) {
                let createdAt = moment(recentSession.createdAt, moment.ISO_8601)
                let updatedAt = moment(recentSession.updatedAt, moment.ISO_8601)
                viewParams.recentSessions.push({
                    unit: recentSession.unit,
                    createdAt: createdAt.format('DD MMM Y   hh:mm:ss A'),
                    updatedAt: updatedAt.format('DD MMM Y   hh:mm:ss A'),
                    state: recentSession.state,
                    numPresses: recentSession.numPresses.toString(),
                    incidentType: recentSession.incidentType,
                    notes: recentSession.notes
                })
            }
            
            res.send(Mustache.render(dashboardTemplate, viewParams))
        }
        catch(err) {
            log(err)
            res.status(500).send()
        }
    } 
    else {
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.clearCookie('user_sid');
        res.redirect('/');
    } 
    else {
        res.redirect('/login');
    }
});

app.post('/', jsonBodyParser, async (req, res) => {

    try {
        const requiredBodyParams = ['UUID','Type'];

        if (isValidRequest(req, requiredBodyParams)) {
            let button = await db.getButtonWithButtonId(req.body.UUID)
            if(button === null) {
                log(`Bad request: UUID is not registered. UUID is ${req.body.UUID}`);
                res.status(400).send();
            }
            else {
                if(req.body.Type == 'double_click') {
                    numPresses = 2;
                }
                else {
                    numPresses = 1
                }
                await handleValidRequest(button.button_id.toString(), button.unit.toString(), button.phone_number.toString(), numPresses)
                res.status(200).send();
            }
        }
        else {
            log('Bad request: UUID is missing');
            res.status(400).send();
        }
    }
    catch(err) {
        log(err)
        res.status(500).send()
    }
});

app.post('/message', jsonBodyParser, async (req, res) => {

    try {
        const requiredBodyParams = ['Body', 'From', 'To'];

        if (isValidRequest(req, requiredBodyParams)) {
            let status = await handleTwilioRequest(req);
            res.writeHead(200, {'Content-Type': 'text/xml'});
            res.status(status).send();
        } 
        else {
            log('Bad request: Body or From fields are missing');
            res.status(400).send();
        }
    }
    catch(err) {
        log(err)
        res.status(500).send()
    }
});

let server;

if (process.env.NODE_ENV === 'test') { // local http server for testing
	server = app.listen(443);
}
else {
	let httpsOptions = {
	    key: fs.readFileSync(`/etc/letsencrypt/live/${getEnvVar('DOMAIN')}/privkey.pem`),
	    cert: fs.readFileSync(`/etc/letsencrypt/live/${getEnvVar('DOMAIN')}/fullchain.pem`)
	}
	server = https.createServer(httpsOptions, app).listen(443)
	log('brave server listening on port 443')
}

module.exports.server = server
module.exports.db = db
