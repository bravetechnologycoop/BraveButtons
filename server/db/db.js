const { ALERT_STATE, helpers } = require('brave-alert-lib')
const { Pool, types } = require('pg')

const Hub = require('../Hub.js')
const Installation = require('../Installation.js')
const SessionState = require('../SessionState.js')

const pool = new Pool({
  host: helpers.getEnvVar('PG_HOST'),
  port: helpers.getEnvVar('PG_PORT'),
  user: helpers.getEnvVar('PG_USER'),
  database: helpers.getEnvVar('PG_USER'),
  password: helpers.getEnvVar('PG_PASSWORD'),
  ssl: true,
})

pool.on('error', err => {
  helpers.logError(`unexpected database error: ${JSON.stringify(err)}`)
})

types.setTypeParser(types.builtins.NUMERIC, value => parseFloat(value))

function createSessionFromRow(r) {
  // prettier-ignore
  return new SessionState(r.id, r.installation_id, r.button_id, r.unit, r.phone_number, r.state, r.num_presses, r.created_at, r.updated_at, r.incident_type, r.notes, r.fallback_alert_twilio_status, r.button_battery_level, r.responded_at)
}

function createInstallationFromRow(r) {
  // prettier-ignore
  return new Installation(r.id, r.name, r.responder_phone_number, r.fall_back_phone_numbers, r.incident_categories, r.is_active, r.created_at, r.alert_api_key)
}

function createHubFromRow(r) {
  // prettier-ignore
  return new Hub(r.system_id, r.flic_last_seen_time, r.flic_last_ping_time, r.heartbeat_last_seen_time, r.system_name, r.hidden, r.sent_alerts, r.muted, r.heartbeat_alert_recipients)
}

async function beginTransaction() {
  let client = null

  try {
    client = await pool.connect()
    await client.query('BEGIN')

    // this fixes a race condition when two button press messages are received in quick succession
    // this means that only one transaction executes at a time, which is not good for performance
    // we should revisit this when / if db performance becomes a concern
    await client.query('LOCK TABLE sessions, buttons, installations, migrations')
  } catch (e) {
    helpers.logError(`Error running the beginTransaction query: ${e}`)
    if (client) {
      try {
        await this.rollbackTransaction(client)
      } catch (err) {
        helpers.logError(`beginTransaction: Error rolling back the errored transaction: ${err}`)
      }
    }
  }

  return client
}

async function commitTransaction(client) {
  try {
    await client.query('COMMIT')
  } catch (e) {
    helpers.logError(`Error running the commitTransaction query: ${e}`)
  } finally {
    try {
      client.release()
    } catch (err) {
      helpers.logError(`commitTransaction: Error releasing client: ${err}`)
    }
  }
}

async function rollbackTransaction(client) {
  try {
    await client.query('ROLLBACK')
  } catch (e) {
    helpers.logError(`Error running the rollbackTransaction query: ${e}`)
  } finally {
    try {
      client.release()
    } catch (err) {
      helpers.logError(`rollbackTransaction: Error releasing client: ${err}`)
    }
  }
}

async function getUnrespondedSessionWithButtonId(buttonId, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const query = 'SELECT * FROM sessions WHERE button_id = $1 AND state != $2 AND state != $3 AND state != $4 ORDER BY created_at DESC LIMIT 1'
    const values = [buttonId, ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.WAITING_FOR_DETAILS, ALERT_STATE.COMPLETED]
    const { rows } = await client.query(query, values)

    if (rows.length > 0) {
      return createSessionFromRow(rows[0])
    }
  } catch (e) {
    helpers.logError(`Error running the getUnrespondedSessionWithButtonId query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getUnrespondedSessionWithButtonId: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function getMostRecentIncompleteSessionWithPhoneNumber(phoneNumber, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const query = 'SELECT * FROM sessions WHERE phone_number = $1 AND state != $2 ORDER BY created_at DESC LIMIT 1'
    const values = [phoneNumber, ALERT_STATE.COMPLETED]
    const { rows } = await client.query(query, values)

    if (rows.length > 0) {
      return createSessionFromRow(rows[0])
    }
  } catch (e) {
    helpers.logError(`Error running the getMostRecentIncompleteSessionWithPhoneNumber query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getMostRecentIncompleteSessionWithPhoneNumber: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function getAllSessionsWithButtonId(buttonId, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM sessions WHERE button_id = $1', [buttonId])

    if (rows.length > 0) {
      return rows.map(createSessionFromRow)
    }
  } catch (e) {
    helpers.logError(`Error running the getAllSessionsWithButtonId query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getAllSessionsWithButtonId: Error releasing client: ${err}`)
      }
    }
  }

  return []
}

async function getRecentSessionsWithInstallationId(installationId, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM sessions WHERE installation_id = $1 ORDER BY created_at DESC LIMIT 40', [installationId])

    if (rows.length > 0) {
      return rows.map(createSessionFromRow)
    }
  } catch (e) {
    helpers.logError(`Error running the getRecentSessionsWithInstallationId query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getRecentSessionsWithInstallationId: Error releasing client: ${err}`)
      }
    }
  }

  return []
}

async function getSessionWithSessionId(sessionId, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM sessions WHERE id = $1', [sessionId])

    if (rows.length > 0) {
      return createSessionFromRow(rows[0])
    }
  } catch (e) {
    helpers.logError(`Error running the getSessionWithSessionId query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getSessionWithSessionId: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function getAllSessions(clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM sessions')

    return rows.map(createSessionFromRow)
  } catch (e) {
    helpers.logError(`Error running the getAllSessions query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getAllSessions: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function createSession(installationId, buttonId, unit, phoneNumber, numPresses, buttonBatteryLevel, respondedAt, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const values = [installationId, buttonId, unit, phoneNumber, ALERT_STATE.STARTED, numPresses, buttonBatteryLevel, respondedAt]
    const { rows } = await client.query(
      'INSERT INTO sessions (installation_id, button_id, unit, phone_number, state, num_presses, button_battery_level, responded_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      values,
    )

    if (rows.length > 0) {
      return createSessionFromRow(rows[0])
    }
  } catch (e) {
    helpers.logError(`Error running the createSession query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`createSession: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function saveSession(session, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM sessions WHERE id = $1 LIMIT 1', [session.id])
    if (rows.length === 0) {
      throw new Error("Tried to save a session that doesn't exist yet. Use createSession() instead.")
    }

    const values = [
      session.installationId,
      session.buttonId,
      session.unit,
      session.phoneNumber,
      session.state,
      session.numPresses,
      session.incidentType,
      session.notes,
      session.fallBackAlertTwilioStatus,
      session.buttonBatteryLevel,
      session.respondedAt,
      session.id,
    ]
    await client.query(
      'UPDATE sessions SET installation_id = $1, button_id = $2, unit = $3, phone_number = $4, state = $5, num_presses = $6, incident_type = $7, notes = $8, fallback_alert_twilio_status = $9, button_battery_level = $10, responded_at = $11 WHERE id = $12',
      values,
    )
  } catch (e) {
    helpers.logError(`Error running the saveSession query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`saveSession: Error releasing client: ${err}`)
      }
    }
  }
}

function getPool() {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to get pool outside the test environment')
    return
  }

  return pool
}

async function clearSessions(clientParam) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear sessions database outside of a test environment!')
    return
  }

  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    await client.query('DELETE FROM sessions')
  } catch (e) {
    helpers.logError(`Error running the clearSessions query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`clearSessions: Error releasing client: ${err}`)
      }
    }
  }
}

async function getButtonWithSerialNumber(serialNumber, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM buttons WHERE button_serial_number = $1', [serialNumber])

    if (rows.length > 0) {
      return rows[0]
    }
  } catch (e) {
    helpers.logError(`Error running the getButtonWithSerialNumber query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getButtonWithSerialNumber: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function createButton(buttonId, installationId, unit, phoneNumber, button_serial_number, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    await client.query('INSERT INTO buttons (button_id, installation_id, unit, phone_number, button_serial_number) VALUES ($1, $2, $3, $4, $5)', [
      buttonId,
      installationId,
      unit,
      phoneNumber,
      button_serial_number,
    ])
  } catch (e) {
    helpers.logError(`Error running the createButton query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`createButton: Error releasing client: ${err}`)
      }
    }
  }
}

async function clearButtons(clientParam) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear buttons database outside of a test environment!')
    return
  }

  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    await client.query('DELETE FROM buttons')
  } catch (e) {
    helpers.logError(`Error running the clearButtons query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`clearButtons: Error releasing client: ${err}`)
      }
    }
  }
}

async function createInstallation(name, responderPhoneNumber, fallbackPhoneNumbers, incidentCategories, alertApiKey, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    await client.query(
      'INSERT INTO installations (name, responder_phone_number, fall_back_phone_numbers, incident_categories, alert_api_key) VALUES ($1, $2, $3, $4, $5)',
      [name, responderPhoneNumber, fallbackPhoneNumbers, incidentCategories, alertApiKey],
    )
  } catch (e) {
    helpers.logError(`Error running the createInstallation query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`createInstallation: Error releasing client: ${err}`)
      }
    }
  }
}

async function clearInstallations(clientParam) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear installations table outside of a test environment!')
    return
  }

  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    await client.query('DELETE FROM installations')
  } catch (e) {
    helpers.logError(`Error running the clearInstallations query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`clearInstallations: Error releasing client: ${err}`)
      }
    }
  }
}

async function getInstallations(clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM installations')

    if (rows.length > 0) {
      return rows.map(createInstallationFromRow)
    }
  } catch (e) {
    helpers.logError(`Error running the getInstallations query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getInstallations: Error releasing client: ${err}`)
      }
    }
  }

  return []
}

async function getInstallationsWithAlertApiKey(alertApiKey, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM installations WHERE alert_api_key = $1', [alertApiKey])

    if (rows.length > 0) {
      return rows.map(createInstallationFromRow)
    }
  } catch (e) {
    helpers.log(`Error running the getInstallationsWithApiKey query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.log(`getInstallationsWithApiKey: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function getInstallationWithInstallationId(installationId, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM installations WHERE id = $1', [installationId])

    if (rows.length > 0) {
      return createInstallationFromRow(rows[0])
    }
  } catch (e) {
    helpers.logError(`Error running the getInstallationWithInstallationId query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getInstallationWithInstallationId: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function getInstallationWithSessionId(sessionId, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT i.* FROM sessions s LEFT JOIN installations i ON s.installation_id = i.id WHERE s.id = $1', [
      sessionId,
    ])

    if (rows.length > 0) {
      return createInstallationFromRow(rows[0])
    }
  } catch (e) {
    helpers.logError(`Error running the getInstallationWithSessionId query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getInstallationWithSessionId: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts, maxTimeAgoInMillis, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    // Historic Alerts are those with status "Completed" or that were last updated longer ago than the SESSION_RESET_TIMEOUT
    const { rows } = await client.query(
      `
      SELECT s.id, b.unit, s.incident_type, s.num_presses, s.created_at, s.responded_at
      FROM sessions AS s
      LEFT JOIN buttons AS b ON s.button_id = b.button_id
      LEFT JOIN installations AS i ON s.installation_id = i.id
      WHERE i.alert_api_key = $1
      AND (
        s.state = $2
        OR s.updated_at < now() - $3 * INTERVAL '1 millisecond'
      )
      ORDER BY s.created_at DESC
      LIMIT $4
      `,
      [alertApiKey, ALERT_STATE.COMPLETED, maxTimeAgoInMillis, maxHistoricAlerts],
    )

    return rows
  } catch (e) {
    helpers.log(`Error running the getHistoricAlertsByAlertApiKey query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.log(`getHistoricAlertsByAlertApiKey: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function getHubs(clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM hubs order by system_name')

    if (rows.length > 0) {
      return rows.map(createHubFromRow)
    }
  } catch (e) {
    helpers.logError(`Error running the getHubs query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getHubs: Error releasing client: ${err}`)
      }
    }
  }

  return []
}

async function getHubWithSystemId(systemId, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM hubs WHERE system_id = $1', [systemId])

    if (rows.length > 0) {
      return createHubFromRow(rows[0])
    }
  } catch (e) {
    helpers.logError(`Error running the getHubWithSystemId query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getHubWithSystemId: Error releasing client: ${err}`)
      }
    }
  }

  return null
}

async function saveHeartbeat(systemId, flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM hubs WHERE system_id = $1 LIMIT 1', [systemId])
    if (rows.length === 0) {
      throw new Error("Tried to save a heartbeat for a hub that doesn't exist yet.")
    }

    const values = [flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime, systemId]
    await client.query(
      'UPDATE hubs SET flic_last_seen_time = $1, flic_last_ping_time = $2, heartbeat_last_seen_time = $3 WHERE system_id = $4',
      values,
    )
  } catch (e) {
    helpers.logError(`Error running the saveHeartbeat query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`saveHeartbeat: Error releasing client: ${err}`)
      }
    }
  }
}

async function saveHubRename(systemId, systemName, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM hubs WHERE system_id = $1 LIMIT 1', [systemId])
    if (rows.length === 0) {
      throw new Error("Tried to rename a hub that doesn't exist yet.")
    }

    const values = [systemName, systemId]
    await client.query('UPDATE hubs SET system_name = $1 WHERE system_id = $2', values)
  } catch (e) {
    helpers.logError(`Error running the saveHubRename query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`saveHubRename: Error releasing client: ${err}`)
      }
    }
  }
}

async function saveHubMuteStatus(systemId, muted, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM hubs WHERE system_id = $1 LIMIT 1', [systemId])
    if (rows.length === 0) {
      throw new Error("Tried to save mute status in a hub that doesn't exist yet.")
    }
    const query = 'UPDATE hubs SET muted = $1 WHERE system_id = $2'
    const values = [muted, systemId]
    await client.query(query, values)
  } catch (e) {
    helpers.logError(`Error running the saveHubMuteStatus query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`saveHubMuteStatus: Error releasing client: ${err}`)
      }
    }
  }
}

async function saveHubHideStatus(systemId, hidden, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM hubs WHERE system_id = $1 LIMIT 1', [systemId])
    if (rows.length === 0) {
      throw new Error("Tried to save hide status for a hub that doesn't exist yet.")
    }

    const query = 'UPDATE hubs SET hidden = $1 WHERE system_id = $2'
    const values = [hidden, systemId]
    await client.query(query, values)
  } catch (e) {
    helpers.logError(`Error running the saveHubHideStatus query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`saveHubHideStatus: Error releasing client: ${err}`)
      }
    }
  }
}

async function saveHubAlertStatus(hub, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM hubs WHERE system_id = $1 LIMIT 1', [hub.systemId])
    if (rows.length === 0) {
      throw new Error("Tried to save alert sent status for a hub that doesn't exist yet.")
    }

    const query = 'UPDATE hubs SET sent_alerts = $1 WHERE system_id = $2'
    const values = [hub.sentAlerts, hub.systemId]
    await client.query(query, values)
  } catch (e) {
    helpers.logError(`Error running the saveHubAlertStatus query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`saveHubAlertStatus: Error releasing client: ${err}`)
      }
    }
  }
}

async function getDataForExport(clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query(
      `SELECT i.name AS "Installation Name", i.responder_phone_number AS "Responder Phone", i.fall_back_phone_numbers AS "Fallback Phones", TO_CHAR(i.created_at, 'yyyy-MM-dd HH:mm:ss') AS "Date Installation Created", i.incident_categories AS "Incident Categories", i.is_active AS "Active?", s.unit AS "Unit", s.phone_number AS "Button Phone", s.state AS "Session State", s.num_presses AS "Number of Presses", TO_CHAR(s.created_at, 'yyyy-MM-dd HH:mm:ss') AS "Session Start", TO_CHAR(s.updated_at, 'yyyy-MM-dd HH:mm:ss') AS "Last Session Activity", s.incident_type AS "Session Incident Type", s.notes as "Session Notes", s.fallback_alert_twilio_status AS "Fallback Alert Status (Twilio)", s.button_battery_level AS "Button Battery Level", TO_CHAR(r.created_at, 'yyyy-MM-dd HH:mm:ss') AS "Date Button Created", TO_CHAR(r.updated_at, 'yyyy-MM-dd HH:mm:ss') AS "Button Last Updated", r.button_serial_number AS "Button Serial Number" FROM sessions s JOIN buttons r ON s.button_id = r.button_id JOIN installations i ON i.id = s.installation_id`,
    )

    return rows
  } catch (e) {
    helpers.logError(`Error running the getDataForExport query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getDataForExport: Error releasing client: ${err}`)
      }
    }
  }
}

async function getCurrentTime(clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT NOW()')
    const time = rows[0].now

    return time
  } catch (e) {
    helpers.logError(`Error running the getCurrentTime query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getCurrentTime: Error releasing client: ${err}`)
      }
    }
  }
}

async function close() {
  try {
    await pool.end()
  } catch (e) {
    helpers.logError(`Error running the close query: ${e}`)
  }
}

module.exports = {
  beginTransaction,
  clearButtons,
  clearInstallations,
  clearSessions,
  close,
  commitTransaction,
  createButton,
  createInstallation,
  createSession,
  getAllSessions,
  getAllSessionsWithButtonId,
  getButtonWithSerialNumber,
  getCurrentTime,
  getDataForExport,
  getHistoricAlertsByAlertApiKey,
  getHubs,
  getHubWithSystemId,
  getInstallations,
  getInstallationsWithApiKey: getInstallationsWithAlertApiKey,
  getInstallationWithInstallationId,
  getInstallationWithSessionId,
  getMostRecentIncompleteSessionWithPhoneNumber,
  getPool,
  getRecentSessionsWithInstallationId,
  getSessionWithSessionId,
  getUnrespondedSessionWithButtonId,
  rollbackTransaction,
  saveHeartbeat,
  saveHubAlertStatus,
  saveHubHideStatus,
  saveHubMuteStatus,
  saveHubRename,
  saveSession,
}
