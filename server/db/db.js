const { ALERT_STATE, helpers } = require('brave-alert-lib')
const SessionState = require('../SessionState.js')
const Installation = require('../Installation.js')
const Hub = require('../Hub.js')
const { Pool, types } = require('pg')

const pool = new Pool({
    host: helpers.getEnvVar('PG_HOST'),
    port: helpers.getEnvVar('PG_PORT'),
    user: helpers.getEnvVar('PG_USER'),
    database: helpers.getEnvVar('PG_USER'),
    password: helpers.getEnvVar('PG_PASSWORD'),
    ssl: true
})

pool.on('error', (err) => {
    console.error('unexpected database error:', err)
})

types.setTypeParser(types.builtins.NUMERIC, value => {
    return parseFloat(value)
})

function createSessionFromRow(r) {
    return new SessionState(r.id, r.installation_id, r.button_id, r.unit, r.phone_number, r.state, r.num_presses, r.created_at, r.updated_at, r.incident_type, r.notes, r.fallback_alert_twilio_status)
}

function createInstallationFromRow(r) {
    return new Installation(r.id, r.name, r.responder_phone_number, r.fall_back_phone_number, r.incident_categories, r.is_active, r.created_at)
}

function createHubFromRow(r) {
    return new Hub(r.system_id, r.flic_last_seen_time, r.flic_last_ping_time, r.heartbeat_last_seen_time, r.system_name, r.hidden, r.sent_alerts, r.muted, r.heartbeat_alert_recipients)
}

module.exports.beginTransaction = async function() {
    let client = await pool.connect()
    await client.query("BEGIN")
    
    // this fixes a race condition when two button press messages are received in quick succession
    // this means that only one transaction executes at a time, which is not good for performance
    // we should revisit this when / if db performance becomes a concern
    await client.query("LOCK TABLE sessions, registry, installations, migrations")
    
    return client
}

module.exports.commitTransaction = async function(client) {
    await client.query("COMMIT")
    client.release()
}

module.exports.getUnrespondedSessionWithButtonId = async function(buttonId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }

    const query = "SELECT * FROM sessions WHERE button_id = $1 AND state != $2 AND state != $3 AND state != $4"
    const values = [buttonId, ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.WAITING_FOR_DETAILS, ALERT_STATE.COMPLETED]
    const { rows } = await client.query(query, values)
   
    if(!transactionMode) {
        client.release()
    }

    if(rows.length > 0) {        
        return createSessionFromRow(rows[0])
    }
    return null
}

module.exports.getMostRecentIncompleteSessionWithPhoneNumber = async function(phoneNumber, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const query = "SELECT * FROM sessions WHERE phone_number = $1 AND state != $2 ORDER BY created_at DESC LIMIT 1"
    const values = [phoneNumber, ALERT_STATE.COMPLETED]
    const { rows } = await client.query(query, values)
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {        
        return createSessionFromRow(rows[0])
    }
    return null
}

module.exports.getAllSessionsWithButtonId = async function(buttonId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM sessions WHERE button_id = $1", [buttonId])
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {
        return rows.map(createSessionFromRow)
    }
    return []
}

module.exports.getRecentSessionsWithInstallationId = async function(installationId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM sessions WHERE installation_id = $1 ORDER BY created_at DESC LIMIT 40", [installationId])
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {
        return rows.map(createSessionFromRow)
    }
    return []
}

module.exports.getSessionWithSessionId = async function(sessionId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM sessions WHERE id = $1", [sessionId])
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {
        return createSessionFromRow(rows[0])
    }
    return null
}

module.exports.getAllSessions = async function(client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }

    const { rows } = await client.query("SELECT * FROM sessions")
    
    if(!transactionMode) {
        client.release()
    }
    
    return rows.map(createSessionFromRow)
}

module.exports.createSession = async function(installationId, buttonId, unit, phoneNumber, numPresses, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const values = [installationId, buttonId, unit, phoneNumber, ALERT_STATE.STARTED, numPresses]
    const { rows } = await client.query('INSERT INTO sessions (installation_id, button_id, unit, phone_number, state, num_presses) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', values)
   
    if(!transactionMode) {
        client.release()
    }

    if(rows.length > 0) {
        return createSessionFromRow(rows[0])
    }
    return null
}

module.exports.saveSession = async function(session, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM sessions WHERE id = $1 LIMIT 1", [session.id])
    if(rows.length === 0) {
        if(!transactionMode) {
            client.release()
        }
        throw new Error("Tried to save a session that doesn't exist yet. Use createSession() instead.")
    }
    const query = "UPDATE sessions SET installation_id = $1, button_id = $2, unit = $3, phone_number = $4, state = $5, num_presses = $6, incident_type = $7, notes = $8, fallback_alert_twilio_status =$9 WHERE id = $10"
    const values = [session.installationId, session.buttonId, session.unit, session.phoneNumber, session.state, session.numPresses, session.incidentType, session.notes, session.fallBackAlertTwilioStatus, session.id]
    await client.query(query, values) 
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.updateSessionState = async function(id, state, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const query = 'UPDATE sessions SET state = $1 WHERE id = $2'
    const values = [state, id]
    await client.query(query, values)

    if(!transactionMode) {
        client.release()
    }

    return null
}

module.exports.updateSessionIncidentCategory = async function(id, incidentCategory, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const query = 'UPDATE sessions SET incident_type = $1 WHERE id = $2'
    const values = [incidentCategory, id]
    await client.query(query, values)
    
    if(!transactionMode) {
        client.release()
    }

    return null
}

module.exports.updateSessionNotes = async function(id, notes, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const query = 'UPDATE sessions SET notes = $1 WHERE id = $2'
    const values = [notes, id]
    await client.query(query, values)
    
    if(!transactionMode) {
        client.release()
    }

    return null
}

module.exports.updateFallbackReturnMessage = async function(id, fallbackReturnMessage, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const query = 'UPDATE sessions SET fallback_alert_twilio_status = $1 WHERE id = $2'
    const values = [fallbackReturnMessage, id]
    await client.query(query, values)
    
    if(!transactionMode) {
        client.release()
    }

    return null
}

module.exports.clearSessions = async function(client) {
    if(!helpers.isTestEnvironment()) {
        helpers.log("warning - tried to clear sessions database outside of a test environment!")
        return
    }
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    await client.query("DELETE FROM sessions")
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.getButtonWithButtonId = async function(buttonId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM registry WHERE button_id = $1", [buttonId])
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {
        return rows[0]
    }
    return null
}

module.exports.getButtonWithSerialNumber = async function(serialNumber, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM registry WHERE button_serial_number = $1", [serialNumber])
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {
        return rows[0]
    }
    return null
}

module.exports.createButton = async function(buttonId, installationId, unit, phoneNumber, button_serial_number, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    await client.query("INSERT INTO registry (button_id, installation_id, unit, phone_number, button_serial_number) VALUES ($1, $2, $3, $4, $5)", [buttonId, installationId, unit, phoneNumber, button_serial_number])
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.clearButtons = async function(client) {
    if(!helpers.isTestEnvironment()) {
        helpers.log("warning - tried to clear registry database outside of a test environment!")
        return
    }
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    await client.query("DELETE FROM registry")
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.createInstallation = async function(name, responderPhoneNumber, fallbackPhoneNumber, incidentCategories, client) {
    
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }

    await client.query("INSERT INTO installations (name, responder_phone_number, fall_back_phone_number, incident_categories) VALUES ($1, $2, $3, $4)", [name, responderPhoneNumber, fallbackPhoneNumber, incidentCategories])
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.clearInstallations = async function(client) {
    if(!helpers.isTestEnvironment()) {
        helpers.log("warning - tried to clear installations table outside of a test environment!")
        return
    }
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    await client.query("DELETE FROM installations")
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.getInstallations = async function(client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const { rows } = await client.query("SELECT * FROM installations")
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {        
        return rows.map(createInstallationFromRow)
    }
    return []
}

module.exports.getInstallationWithInstallationId = async function(installationId, client) { 
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM installations WHERE id = $1", [installationId])
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {
        return createInstallationFromRow(rows[0])
    }
    return null
}

module.exports.getInstallationWithSessionId = async function(sessionId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }

    let { rows } = await client.query("SELECT i.* FROM sessions s LEFT JOIN installations i ON s.installation_id = i.id WHERE s.id = $1", [sessionId])

    if(!transactionMode) {
        client.release()
    }

    if(rows.length > 0) {
        return createInstallationFromRow(rows[0])
    }

    return null
}

module.exports.getHubs = async function(client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const { rows } = await client.query("SELECT * FROM hubs order by system_name")
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {        
        return rows.map(createHubFromRow)
    }
    return []
}

module.exports.getHubWithSystemId = async function(systemId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM hubs WHERE system_id = $1", [systemId])
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {
        return createHubFromRow(rows[0])
    }
    return null
}

module.exports.saveHeartbeat = async function(systemId, flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM hubs WHERE system_id = $1 LIMIT 1", [systemId])
    if(rows.length === 0) {
        if(!transactionMode) {
            client.release()
        }
        throw new Error("Tried to save a heartbeat for a hub that doesn't exist yet.")
    }
    const query = "UPDATE hubs SET flic_last_seen_time = $1, flic_last_ping_time = $2, heartbeat_last_seen_time = $3 WHERE system_id = $4"
    const values = [flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime, systemId]
    await client.query(query, values) 
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.saveHubRename = async function(systemId, systemName, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM hubs WHERE system_id = $1 LIMIT 1", [systemId])
    if(rows.length === 0) {
        if(!transactionMode) {
            client.release()
        }
        throw new Error("Tried to rename a hub that doesn't exist yet.")
    }
    const query = "UPDATE hubs SET system_name = $1 WHERE system_id = $2"
    const values = [systemName, systemId]
    await client.query(query, values) 
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.saveHubMuteStatus = async function(systemId, muted, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM hubs WHERE system_id = $1 LIMIT 1", [systemId])
    if(rows.length === 0) {
        if(!transactionMode) {
            client.release()
        }
        throw new Error("Tried to save mute status in a hub that doesn't exist yet.")
    }
    const query = "UPDATE hubs SET muted = $1 WHERE system_id = $2"
    const values = [muted, systemId]
    await client.query(query, values) 
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.saveHubHideStatus = async function(systemId, hidden, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM hubs WHERE system_id = $1 LIMIT 1", [systemId])
    if(rows.length === 0) {
        if(!transactionMode) {
            client.release()
        }
        throw new Error("Tried to save hide status for a hub that doesn't exist yet.")
    }
    const query = "UPDATE hubs SET hidden = $1 WHERE system_id = $2"
    const values = [hidden, systemId]
    await client.query(query, values) 
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.saveHubAlertStatus = async function(hub, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM hubs WHERE system_id = $1 LIMIT 1", [hub.systemId])
    if(rows.length === 0) {
        if(!transactionMode) {
            client.release()
        }
        throw new Error("Tried to save alert sent status for a hub that doesn't exist yet.")
    }
    const query = "UPDATE hubs SET sent_alerts = $1 WHERE system_id = $2"
    const values = [hub.sentAlerts, hub.systemId]
    await client.query(query, values) 
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.saveButtonBatteryLevel = async function(serialNumber, batteryLevel, client){
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM registry WHERE button_serial_number = $1 LIMIT 1", [serialNumber])
    if(rows.length === 0) {
        if(!transactionMode) {
            client.release()
        }
        throw new Error("Tried to save battery level for a button that isn't registered yet.")
    }
    const query = "UPDATE registry SET button_battery_level = $1 WHERE button_serial_number = $2"
    const values = [batteryLevel, serialNumber]
    await client.query(query, values) 
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.close = async function() {
    await pool.end()
}
