let fs = require('fs')
let express = require('express')
let https = require('https')
let moment = require('moment-timezone')
let bodyParser = require('body-parser')
let jsonBodyParser = bodyParser.json()
var cookieParser = require('cookie-parser');
var session = require('express-session');
const chalk = require('chalk')
const Mustache = require('mustache')

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

async function handleValidRequest(button, numPresses) {

    log('UUID: ' + button.button_id.toString() + ' Unit: ' + button.unit.toString() + ' Presses: ' + numPresses.toString());

    let client = await db.beginTransaction()

    let session = await db.getUnrespondedSessionWithButtonId(button.button_id, client)
        
    if(session === null) {
        session = await db.createSession(button.installation_id, button.button_id, button.unit, button.phone_number, numPresses, client)
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

    if (session === null) {
        log(`received twilio message with no corresponding open session: ${message}`)
        return 200
    }

    let installation = await db.getInstallationWithInstallationId(session.installationId)

    if (phoneNumber === installation.responder_phone_number) {
        let returnMessage = session.advanceSession(message);
        await sendTwilioMessage(installation.responder_phone_number, session.phoneNumber, returnMessage);
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

    let installation = await db.getInstallationWithInstallationId(session.installationId)

    if (session.numPresses === 1) {
        await sendTwilioMessage(installation.responder_phone_number, session.phoneNumber, 'There has been a request for help from Unit ' + session.unit.toString() + ' . Please respond "Ok" when you have followed up on the call.')
        setTimeout(sendReminderMessageForSession, unrespondedSessionReminderTimeoutMillis, session.id)
        setTimeout(sendStaffAlertForSession, unrespondedSessionAlertTimeoutMillis, session.id)
    } 
    else if (session.numPresses % 5 === 0 || session.numPresses === 3) {
        await sendTwilioMessage(installation.responder_phone_number, session.phoneNumber, 'This in an urgent request. The button has been pressed ' + session.numPresses.toString() + ' times. Please respond "Ok" when you have followed up on the call.')
    }
}

async function sendTwilioMessage(toPhoneNumber, fromPhoneNumber, message) {
    try {
        await client.messages.create({from: fromPhoneNumber, body: message, to: toPhoneNumber})
            .then(message => log(message.sid))
    }
    catch(err) {
        log(err)
    }
}

async function sendReminderMessageForSession(sessionId) {

    let session = await db.getSessionWithSessionId(sessionId)


    if (session === null) {
        log("couldn't find session when sending reminder message")
        return
    }
    
    if (session.state === STATES.STARTED) {

        let installation = await db.getInstallationWithInstallationId(session.installationId)

        session.state = STATES.WAITING_FOR_REPLY
        await db.saveSession(session)
        await sendTwilioMessage(installation.responder_phone_number, session.phoneNumber, 'Please Respond "Ok" if you have followed up on your call. If you do not respond within 2 minutes an emergency alert will be issued to staff.');
    }
}

async function sendStaffAlertForSession(sessionId) {

    let session = await db.getSessionWithSessionId(sessionId)

    if (session === null) {         
        return
    }

    if (session.state === STATES.WAITING_FOR_REPLY) {

        let installation = await db.getInstallationWithInstallationId(session.installationId)

        await client.messages
            .create({from: session.phoneNumber, body: 'There has been an unresponded request at unit ' + session.unit.toString(), to: installation.fall_back_phone_number})
            .then(message => {
                session.fallBackAlertTwilioStatus = message.status;
            })
        await db.saveSession(session)

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
        expires: 24*60*60*1000
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

app.get('/dashboard/:installationId?', async (req, res) => {

    if (!req.session.user || !req.cookies.user_sid) {
        res.redirect('/login')
        return
    }
    else if(typeof req.params.installationId !== "string") {
        let installations = await db.getInstallations()
        res.redirect('/dashboard/' + installations[0].id)
        return
    }

    try {
        let recentSessions = await db.getRecentSessionsWithInstallationId(req.params.installationId)
        let currentInstallation = await db.getInstallationWithInstallationId(req.params.installationId)
        let allInstallations = await db.getInstallations()
        
        let viewParams = {
            recentSessions: [],
            currentInstallationName: currentInstallation.name,
            installations: allInstallations.map(installation => { return { name: installation.name, id: installation.id }})
        }

        for(const recentSession of recentSessions) {
            let createdAt = moment(recentSession.createdAt, moment.ISO_8601)
            let updatedAt = moment(recentSession.updatedAt, moment.ISO_8601)
            viewParams.recentSessions.push({
                unit: recentSession.unit,
                createdAt: createdAt.tz('America/Vancouver').format('DD MMM Y, hh:mm:ss A'),
                updatedAt: updatedAt.tz('America/Vancouver').format('DD MMM Y, hh:mm:ss A'),
                state: recentSession.state,
                numPresses: recentSession.numPresses.toString(),
                incidentType: recentSession.incidentType,
                notes: recentSession.notes
            })
        }
        
        for(let i=0; i<viewParams.recentSessions.length; i++) {
            viewParams.recentSessions[i].class = i % 2 === 0 ? "even-row" : "odd-row"
        }

        res.send(Mustache.render(dashboardTemplate, viewParams))
    }
    catch(err) {
        log(err)
        res.status(500).send()
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
                await handleValidRequest(button, numPresses)
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
    server = app.listen(8000);
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
