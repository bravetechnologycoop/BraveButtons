const STATES = require('../SessionStateEnum.js')
const { SessionState, SessionState_Alvis } = require('../SessionState.js')
const { Pool } = require('pg')
const pool = new Pool({
    user: process.env.PG_USER,
    database: process.env.PG_USER,
    password: process.env.PG_PASSWORD
})

pool.on('error', (err) => {
    console.error('unexpected database error:', err)
})

async function createSessionFromRow(client, r) {

    if(!r) {
        return null
    }

    let { rows } = await client.query("SELECT * FROM installations WHERE id = $1", [r.installation_id])
    let className = rows[0].session_state_class_name

    if(className === 'Alvis') {
        return new SessionState_Alvis(r.id, r.installation_id, r.button_id, r.unit, r.phone_number, r.state, r.num_presses, r.created_at, r.updated_at, r.incident_type, r.notes, r.fallback_alert_twilio_status)
    }

    return new SessionState(r.id, r.installation_id, r.button_id, r.unit, r.phone_number, r.state, r.num_presses, r.created_at, r.updated_at, r.incident_type, r.notes, r.fallback_alert_twilio_status)
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
    const values = [buttonId, STATES.WAITING_FOR_CATEGORY, STATES.WAITING_FOR_DETAILS, STATES.COMPLETED]
    const { rows } = await client.query(query, values)

    let session = await createSessionFromRow(client, rows[0])

    if(!transactionMode) {
        client.release()
    }

    if(session) {
        return session
    }

    return null
}

module.exports.getMostRecentIncompleteSessionWithPhoneNumber = async function(phoneNumber, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const query = "SELECT * FROM sessions WHERE phone_number = $1 AND state != $2 ORDER BY created_at DESC LIMIT 1"
    const values = [phoneNumber, STATES.COMPLETED]
    const { rows } = await client.query(query, values)
    
    let session = await createSessionFromRow(client, rows[0])

    if(!transactionMode) {
        client.release()
    }
    
    if(session) {
        return session
    }

    return null
}

module.exports.getAllSessionsWithButtonId = async function(buttonId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM sessions WHERE button_id = $1", [buttonId])
    
    let promises = rows.map(async (row) => {
        return await createSessionFromRow(client, row)
    })

    let sessions = await Promise.all(promises)

    if(!transactionMode) {
        client.release()
    }
    
    if(sessions.length > 0) {
        return sessions
    }

    return []
}

module.exports.getRecentSessionsWithInstallationId = async function(installationId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM sessions WHERE installation_id = $1 ORDER BY created_at DESC LIMIT 40", [installationId])
    
    let promises = rows.map(async (row) => {
        return await createSessionFromRow(client, row)
    })

    let sessions = await Promise.all(promises)

    if(!transactionMode) {
        client.release()
    }
    
    if(sessions.length > 0) {
        return sessions
    }

    return []
}

module.exports.getSessionWithSessionId = async function(sessionId, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM sessions WHERE id = $1", [sessionId])
    
    let session = await createSessionFromRow(client, rows[0])

    if(!transactionMode) {
        client.release()
    }
    
    if(session) {
        return session
    }

    return null
}

module.exports.getAllSessions = async function(client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }

    const { rows } = await client.query("SELECT * FROM sessions")
    
    let promises = rows.map(async (row) => {
        return await createSessionFromRow(client, row)
    })

    let sessions = await Promise.all(promises)

    if(!transactionMode) {
        client.release()
    }
    
    if(sessions.length > 0) {
        return sessions
    }

    return []
}

module.exports.createSession = async function(installationId, buttonId, unit, phoneNumber, numPresses, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const values = [installationId, buttonId, unit, phoneNumber, STATES.STARTED, numPresses]
    const { rows } = await client.query('INSERT INTO sessions (installation_id, button_id, unit, phone_number, state, num_presses) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', values)
   
    let session = await createSessionFromRow(client, rows[0])

    if(!transactionMode) {
        client.release()
    }

    if(session) {
        return session
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

module.exports.clearSessions = async function(client) {
    if(process.env.NODE_ENV !== "test") {
        console.log("warning - tried to clear sessions database outside of a test environment!")
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

module.exports.createButton = async function(buttonId, installationId, unit, phoneNumber, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    await client.query("INSERT INTO registry (button_id, installation_id, unit, phone_number) VALUES ($1, $2, $3, $4)", [buttonId, installationId, unit, phoneNumber])
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.clearButtons = async function(client) {
    if(process.env.NODE_ENV !== "test") {
        console.log("warning - tried to clear registry database outside of a test environment!")
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

module.exports.createInstallation = async function(name, responderPhoneNumber, fallbackPhoneNumber, client) {
    
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    await client.query("INSERT INTO installations (name, responder_phone_number, fall_back_phone_number) VALUES ($1, $2, $3)", [name, responderPhoneNumber, fallbackPhoneNumber])
    
    if(!transactionMode) {
        client.release()
    }
}

module.exports.clearInstallations = async function(client) {
    if(process.env.NODE_ENV !== "test") {
        console.log("warning - tried to clear installations table outside of a test environment!")
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
        return rows
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
        return rows[0]
    }
    return null
}

module.exports.close = async function() {
    await pool.end()
}
