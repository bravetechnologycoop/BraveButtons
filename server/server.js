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

const FLIC_THRESHOLD_MILLIS = 180*1000
const HEARTBEAT_THRESHOLD_MILLIS = 60*1000

const STATES = require('./SessionStateEnum.js');
require('dotenv').load();
const db = require('./db/db.js')
const helpers = require('./helpers.js')
const StateMachine = require('./StateMachine.js')

const app = express();

const unrespondedSessionReminderTimeoutMillis = process.env.NODE_ENV === 'test' ? 1000 : 300000;
const unrespondedSessionAlertTimeoutMillis = process.env.NODE_ENV === 'test' ? 2000 : 420000;

//Set up Twilio
const accountSid = helpers.getEnvVar('TWILIO_SID');
const authToken = helpers.getEnvVar('TWILIO_TOKEN');

const client = require('twilio')(accountSid, authToken);

const heartbeatDashboardTemplate = fs.readFileSync(`${__dirname}/heartbeatDashboard.mst`, 'utf-8')
const chatbotDashboardTemplate = fs.readFileSync(`${__dirname}/chatbotDashboard.mst`, 'utf-8')

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

/**
Check if a request is valid based on the presence of required body properties
**/
function isValidRequest(req, properties) {

    const hasAllProperties = (hasAllPropertiesSoFar, currentProperty) => hasAllPropertiesSoFar && Object.prototype.hasOwnProperty.call(req.body, currentProperty);
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

    if (phoneNumber === installation.responderPhoneNumber) {

        let stateMachine = new StateMachine(installation)
        let {newSessionState, returnMessage} = stateMachine.processStateTransitionWithMessage(session, message)
        await sendTwilioMessage(installation.responderPhoneNumber, session.phoneNumber, returnMessage);
        await db.saveSession(newSessionState)
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
        await sendTwilioMessage(installation.responderPhoneNumber, session.phoneNumber, 'There has been a request for help from Unit ' + session.unit.toString() + ' . Please respond "Ok" when you have followed up on the call.')
        setTimeout(sendReminderMessageForSession, unrespondedSessionReminderTimeoutMillis, session.id)
        setTimeout(sendStaffAlertForSession, unrespondedSessionAlertTimeoutMillis, session.id)
    } 
    else if (session.numPresses % 5 === 0 || session.numPresses === 3) {
        await sendTwilioMessage(installation.responderPhoneNumber, session.phoneNumber, 'This in an urgent request. The button has been pressed ' + session.numPresses.toString() + ' times. Please respond "Ok" when you have followed up on the call.')
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
        await sendTwilioMessage(installation.responderPhoneNumber, session.phoneNumber, 'Please Respond "Ok" if you have followed up on your call. If you do not respond within 2 minutes an emergency alert will be issued to staff.');
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
            .create({
                from: helpers.getEnvVar('TWILIO_FALLBACK_FROM_NUMBER'), 
                body: 'There has been an unresponded request at ' + installation.name + ' unit ' + session.unit.toString(), to: installation.fallbackPhoneNumber
            })
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
    secret: helpers.getEnvVar('SECRET'),
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

        if ((username === helpers.getEnvVar('WEB_USERNAME')) && (password === helpers.getEnvVar('PASSWORD'))) {
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

        res.send(Mustache.render(chatbotDashboardTemplate, viewParams))
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
                let numPresses = 1

                if(req.body.Type == 'double_click') {
                    numPresses = 2;
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

app.post('/heartbeat', jsonBodyParser, async (req, res) => {
   
    try {
        log(`got a heartbeat from ${req.body.system_id}, flic_last_seen_secs is ${req.body.flic_last_seen_secs}, flic_last_ping_secs is ${req.body.flic_last_ping_secs}`)    
        flicLastSeenTime = moment().subtract(req.body.flic_last_seen_secs, 'seconds').toISOString()
        flicLastPingTime = moment().subtract(req.body.flic_last_ping_secs, 'seconds').toISOString()
        heartbeatLastSeenTime = moment().toISOString()
        await db.saveHeartbeat(req.body.system_id, flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime)
        res.status(200).send()
    }
    catch(err) {
        log(err)
        res.status(500).send()
    }
})

app.post('/heartbeat/rename_system', jsonBodyParser, async (req, res) => {

    try {
        log('got a request to rename system ' + req.body.system_id)
        await db.saveHubRename(req.body.system_id, req.body.system_name)
        res.status(200).send()
    }
    catch(err) {
        log(err)
        res.status(500).send()
    }
})

app.post('/heartbeat/hide_system', jsonBodyParser, async (req, res) => {

    try {
        log('got a request to hide system ' + req.body.system_id)
        await db.saveHubMuteStatus(req.body.system_id, true)
        res.status(200).send()
    }
    catch(err) {
        log(err)
        res.status(500).send()
    }
})

app.post('/heartbeat/unhide_system', jsonBodyParser, async (req, res) => {

    try {
        log('got a request to show system ' + req.body.system_id)
        await db.saveHubMuteStatus(req.body.system_id, false)
        res.status(200).send()
    }
    catch(err) {
        log(err)
        res.status(500).send()
    }
})


app.post('/heartbeat/mute_system', jsonBodyParser, async (req, res) => {

    try {
        log('got a request to unmute system ' + req.body.system_id)
        await db.saveHubMuteStatus(req.body.system_id, true)
        res.status(200).send()
    }
    catch(err) {
        log(err)
        res.status(500).send()
    }
})

app.post('/heartbeat/unmute_system', jsonBodyParser, async (req, res) => {

    try {
        log('got a request to unmute system ' + req.body.system_id)
        await db.saveHubMuteStatus(req.body.system_id, false)
        res.status(200).send()
    }
    catch(err) {
        log(err)
        res.status(500).send()
    }
})

app.get('/heartbeatDashboard', async (req, res) => {
    let hubs = await db.getHubs()
    let viewParams = {
        domain: helpers.getEnvVar('DOMAIN'),
        dashboard_render_time: moment().toString(),
        systems: []   
    }

    for(const hub of hubs){

        if(hub.hidden) {
            continue
        }

        let flicLastSeenTime = moment(hub.flicLastSeenTime)
        let flicLastSeenSecs = moment().diff(flicLastSeenTime) / 1000.0
        flicLastSeenSecs = Math.round(flicLastSeenSecs)

        let heartbeatLastSeenTime = moment(hub.heartbeatLastSeenTime)
        let heartbeatLastSeenSecs = moment().diff(heartbeatLastSeenTime) / 1000.0
        heartbeatLastSeenSecs = Math.round(heartbeatLastSeenSecs)

        let flicLastPingTime = moment(hub.flicLastPingTime)
        let flicLastPingSecs = moment().diff(flicLastPingTime) / 1000.0
        flicLastPingSecs = Math.round(flicLastPingSecs)

        viewParams.systems.push({
            system_name: hub.systemName,
            flic_last_seen: flicLastSeenSecs.toString() + ' seconds ago',
            flic_last_ping: flicLastPingSecs.toString() + ' seconds ago',
            heartbeat_last_seen: heartbeatLastSeenSecs.toString() + ' seconds ago',
            muted: hub.muted ? 'Y' : 'N'
        })
    }
        
    let htmlString = Mustache.render(heartbeatDashboardTemplate, viewParams)
    res.send(htmlString)
})  


async function checkHeartbeat() {
    let hubs = await db.getHubs()
    for (const hub of hubs) {
        let currentTime = moment()
        let flicLastSeenTime = moment(hub.flicLastSeenTime)
        let flicDelayMillis = currentTime.diff(flicLastSeenTime)
        let heartbeatLastSeenTime = moment(hub.heartbeatLastSeenTime)
        let heartbeatDelayMillis = currentTime.diff(heartbeatLastSeenTime)
        
        if(flicDelayMillis > FLIC_THRESHOLD_MILLIS && !hub.sentAlerts) {
            log(`flic threshold exceeded; flic delay is ${flicDelayMillis} ms. sending alerts for ${hub.systemName}`)
            await updateSentAlerts(hub, 'true')
            if(hub.muted) {
                continue
            }
            sendAlerts(hub.systemName, helpers.getEnvVar('TWILIO_HEARTBEAT_FROM_NUMBER'), hub.heartbeatAlertRecipients)
        }
        else if(heartbeatDelayMillis > HEARTBEAT_THRESHOLD_MILLIS && !hub.sentAlerts) {
            log(`heartbeat threshold exceeded; heartbeat delay is ${heartbeatDelayMillis} ms. sending alerts for ${hub.systemName}`)
            await updateSentAlerts(hub, 'true')
            if(hub.muted) {
                continue
            }
            sendAlerts(hub.systemName, helpers.getEnvVar('TWILIO_HEARTBEAT_FROM_NUMBER'), hub.heartbeatAlertRecipients)
        }
        else if((flicDelayMillis < FLIC_THRESHOLD_MILLIS) && (heartbeatDelayMillis < HEARTBEAT_THRESHOLD_MILLIS) && hub.sentAlerts) { 
            log(`${hub.systemName} has reconnected.`)
            await updateSentAlerts(hub, 'false')
            if (hub.muted) {
                continue
            }
            sendReconnectionMessage(hub.systemName, helpers.getEnvVar('TWILIO_HEARTBEAT_FROM_NUMBER'), hub.heartbeatAlertRecipients)
        }
    }
}

function sendAlerts(systemName, twilioAlertNumber, heartbeatAlertRecipients) {
    for(let i = 0; i < heartbeatAlertRecipients.length; i++) {
        sendTwilioMessage(heartbeatAlertRecipients[i], twilioAlertNumber, `The Flic connection for ${systemName} has been lost.`)
    }
}

function sendReconnectionMessage(systemName, twilioAlertNumber, heartbeatAlertRecipients) {
    for(let i = 0; i < heartbeatAlertRecipients.length; i++) {
        sendTwilioMessage(heartbeatAlertRecipients[i], twilioAlertNumber, `${systemName} has reconnected.`)
    }
}

async function updateSentAlerts(hub, sentAlerts) {
    hub.sentAlerts = sentAlerts;
    await db.saveHubAlertStatus(hub);
}

let server;

if (process.env.NODE_ENV === 'test') { // local http server for testing
    server = app.listen(8000);
}
else {
    let httpsOptions = {
        key: fs.readFileSync(`/etc/letsencrypt/live/${helpers.getEnvVar('DOMAIN')}/privkey.pem`),
        cert: fs.readFileSync(`/etc/letsencrypt/live/${helpers.getEnvVar('DOMAIN')}/fullchain.pem`)
    }
    server = https.createServer(httpsOptions, app).listen(443)
    setInterval(checkHeartbeat, 1000)
    log('brave server listening on port 443')
}

module.exports.server = server
module.exports.db = db
