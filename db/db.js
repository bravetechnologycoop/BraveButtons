const STATES = require('../SessionStateEnum.js')
const SessionState = require('../SessionState.js')
const { Pool } = require('pg')
const pool = new Pool({
    user: process.env.PG_USER,
    database: process.env.PG_USER,
    password: process.env.PG_PASSWORD
})

pool.on('error', (err, client) => {
    console.error('unexpected database error:', err)
})

function createSessionFromRow(r) {
    return new SessionState(r.id, r.button_id, r.unit, r.phone_number, r.state, r.num_presses, r.created_at, r.updated_at, r.incident_type, r.notes)
}

module.exports.beginTransaction = async function() {
    let client = await pool.connect()
    await client.query("BEGIN")
    return client
}

module.exports.commitTransaction = async function(client) {
    await client.query("COMMIT")
    client.release()
}

module.exports.getUnrespondedSessionWithPhoneNumber = async function(phoneNumber, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }

    const query = "SELECT * FROM sessions WHERE phone_number = $1 AND state != $2 AND state != $3 AND state != $4"
    const values = [phoneNumber, STATES.WAITING_FOR_CATEGORY, STATES.WAITING_FOR_DETAILS, STATES.COMPLETED]
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
    const values = [phoneNumber, STATES.COMPLETED]
    const { rows } = await client.query(query, values)
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {        
        return createSessionFromRow(rows[0])
    }
    return null
}

module.exports.getAllSessionsWithPhoneNumber = async function(phoneNumber, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    let { rows } = await client.query("SELECT * FROM sessions WHERE phone_number = $1", [phoneNumber])
    
    if(!transactionMode) {
        client.release()
    }
    
    if(rows.length > 0) {
        return rows.map(createSessionFromRow)
    }
    return []
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

module.exports.createSession = async function(buttonId, unit, phoneNumber, numPresses, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    const values = [buttonId, unit, phoneNumber, STATES.STARTED, numPresses]
    const { rows } = await client.query('INSERT INTO sessions (button_id, unit, phone_number, state, num_presses) VALUES ($1, $2, $3, $4, $5) RETURNING *', values)
   
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
    const query = "UPDATE sessions SET button_id = $1, unit = $2, phone_number = $3, state = $4, num_presses = $5, incident_type = $6, notes = $7 WHERE id = $8"
    const values = [session.buttonId, session.unit, session.phoneNumber, session.state, session.numPresses, session.incidentType, session.notes, session.id]
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

module.exports.createButton = async function(buttonId, unit, phoneNumber, client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }
    
    await client.query("INSERT INTO registry (button_id, unit, phone_number) VALUES ($1, $2, $3)", [buttonId, unit, phoneNumber])
    
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

module.exports.close = async function() {
    await pool.end()
}
