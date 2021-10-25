const { CHATBOT_STATE, helpers } = require('brave-alert-lib')
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
  return new Installation(r.id, r.name, r.responder_phone_number, r.fall_back_phone_numbers, r.incident_categories, r.is_active, r.created_at, r.alert_api_key, r.responder_push_id)
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
    const values = [buttonId, CHATBOT_STATE.WAITING_FOR_CATEGORY, CHATBOT_STATE.WAITING_FOR_DETAILS, CHATBOT_STATE.COMPLETED]
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
  try {
    const results = await helpers.runQuery(
      'getMostRecentIncompleteSessionWithPhoneNumber',
      `
      SELECT *
      FROM sessions
      WHERE phone_number = $1
      AND state != $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [phoneNumber, CHATBOT_STATE.COMPLETED],
      pool,
      clientParam,
    )

    if (results.rows.length > 0) {
      return createSessionFromRow(results.rows[0])
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function createHubFromRow(r, clientParam) {
  try {
    const results = await helpers.runQuery(
      'createHubFromRow',
      `
      SELECT *
      FROM installations
      WHERE id = $1
      LIMIT 1
      `,
      [r.installation_id],
      pool,
      clientParam,
    )
    const installation = createInstallationFromRow(results.rows[0])

    // prettier-ignore
    return new Hub(r.system_id, r.flic_last_seen_time, r.flic_last_ping_time, r.heartbeat_last_seen_time, r.system_name, r.hidden, r.sent_vitals_alert_at, r.muted, r.heartbeat_alert_recipients, r.sent_internal_flic_alert, r.sent_internal_ping_alert, r.sent_internal_pi_alert, r.location_description, installation)
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getSessionWithSessionIdAndAlertApiKey(sessionId, alertApiKey, clientParam) {
  try {
    const results = await helpers.runQuery(
      'getSessionWithSessionIdAndAlertApiKey',
      `
      SELECT s.*
      FROM sessions AS s
      LEFT JOIN installations AS i ON s.installation_id = i.id
      WHERE s.id = $1
      AND i.alert_api_key = $2
      `,
      [sessionId, alertApiKey],
      pool,
      clientParam,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getAllSessionsWithButtonId(buttonId, clientParam) {
  try {
    const results = await helpers.runQuery(
      'getAllSessionsWithButtonId',
      `
      SELECT *
      FROM sessions
      WHERE button_id = $1
      `,
      [buttonId],
      pool,
      clientParam,
    )

    if (results.rows.length > 0) {
      return results.rows.map(createSessionFromRow)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getRecentSessionsWithInstallationId(installationId, clientParam) {
  try {
    const results = await helpers.runQuery(
      'getRecentSessionsWithInstallationId',
      `
      SELECT *
      FROM sessions
      WHERE installation_id = $1
      ORDER BY created_at DESC
      LIMIT 40
      `,
      [installationId],
      pool,
      clientParam,
    )

    if (results.rows.length > 0) {
      return results.rows.map(createSessionFromRow)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getSessionWithSessionId(sessionId, clientParam) {
  try {
    const results = await helpers.runQuery(
      'getSessionWithSessionId',
      `
      SELECT *
      FROM sessions
      WHERE id = $1
      `,
      [sessionId],
      pool,
      clientParam,
    )

    if (results.rows.length > 0) {
      return createSessionFromRow(results.rows[0])
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function createSession(installationId, buttonId, unit, phoneNumber, numPresses, buttonBatteryLevel, respondedAt, clientParam) {
  try {
    const results = await helpers.runQuery(
      'createSession',
      `
      INSERT INTO sessions (installation_id, button_id, unit, phone_number, state, num_presses, button_battery_level, responded_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [installationId, buttonId, unit, phoneNumber, CHATBOT_STATE.STARTED, numPresses, buttonBatteryLevel, respondedAt],
      pool,
      clientParam,
    )

    if (results.rows.length > 0) {
      return createSessionFromRow(results.rows[0])
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function saveSession(session, clientParam) {
  try {
    const results = await helpers.runQuery(
      'saveSessionSelect',
      `
      SELECT *
      FROM sessions
      WHERE id = $1
      LIMIT 1
      `,
      [session.id],
      pool,
      clientParam,
    )
    if (results.rows.length === 0) {
      throw new Error("Tried to save a session that doesn't exist yet. Use createSession() instead.")
    }

    await helpers.runQuery(
      'saveSessionUpdate',
      `
      UPDATE sessions
      SET installation_id = $1, button_id = $2, unit = $3, phone_number = $4, state = $5, num_presses = $6, incident_type = $7, notes = $8, fallback_alert_twilio_status = $9, button_battery_level = $10, responded_at = $11
      WHERE id = $12
      `,
      [
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
      ],
      pool,
      clientParam,
    )
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function updateSentInternalAlerts(hub, clientParam) {
  try {
    const results = await helpers.runQuery(
      'updateSentInternalAlertsSelect',
      `
      SELECT *
      FROM hubs
      WHERE system_id = $1
      LIMIT 1
      `,
      [hub.systemId],
      pool,
      clientParam,
    )
    if (results.rows.length === 0) {
      throw new Error("Tried to update internal alert flags for a hub that doesn't exist.")
    }

    await helpers.runQuery(
      'updateSentInternalAlertsUpdate',
      `
      UPDATE hubs
      SET sent_internal_flic_alert = $1, sent_internal_ping_alert = $2, sent_internal_pi_alert = $3
      WHERE system_id = $4
      `,
      [hub.sentInternalFlicAlert, hub.sentInternalPingAlert, hub.sentInternalPiAlert, hub.systemId],
      pool,
      clientParam,
    )
  } catch (e) {
    helpers.logError(`Error running the updateSentInternalAlerts query: ${e}`)
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

  try {
    await helpers.runQuery(
      'clearSessions',
      `
      DELETE FROM sessions
      `,
      [],
      pool,
      clientParam,
    )
  } catch (err) {
    helpers.logError(err.toString())
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

async function createInstallation(name, responderPhoneNumber, fallbackPhoneNumbers, incidentCategories, alertApiKey, responderPushId, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    await client.query(
      'INSERT INTO installations (name, responder_phone_number, fall_back_phone_numbers, incident_categories, alert_api_key, responder_push_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, responderPhoneNumber, fallbackPhoneNumbers, incidentCategories, alertApiKey, responderPushId],
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
    helpers.log(`Error running the getInstallationsWithAlertApiKey query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.log(`getInstallationsWithAlertApiKey: Error releasing client: ${err}`)
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

async function getActiveAlertsByAlertApiKey(alertApiKey, maxTimeAgoInMillis, clientParam) {
  try {
    const results = await helpers.runQuery(
      'getActiveAlertsByAlertApiKey',
      `
      SELECT s.id, s.state, b.unit, s.num_presses, i.incident_categories, s.created_at
      FROM sessions AS s
      LEFT JOIN buttons AS b ON s.button_id = b.button_id
      LEFT JOIN installations AS i ON s.installation_id = i.id
      WHERE i.alert_api_key = $1
      AND (
        s.state != $2
        AND s.updated_at >= now() - $3 * INTERVAL '1 millisecond'
      )
      ORDER BY s.created_at DESC
      `,
      [alertApiKey, CHATBOT_STATE.COMPLETED, maxTimeAgoInMillis],
      pool,
      clientParam,
    )

    return results.rows
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts, maxTimeAgoInMillis, clientParam) {
  try {
    const results = await helpers.runQuery(
      'getHistoricAlertsByAlertApiKey',
      `
      SELECT s.id, b.unit, s.incident_type, s.num_presses, s.created_at, s.responded_at
      FROM sessions AS s
      LEFT JOIN buttons AS b ON s.button_id = b.button_id
      LEFT JOIN installations AS i ON s.installation_id = i.id
      WHERE i.alert_api_key = $1
      AND (
        s.state = $2
        OR s.updated_at <= now() - $3 * INTERVAL '1 millisecond'
      )
      ORDER BY s.created_at DESC
      LIMIT $4
      `,
      [alertApiKey, CHATBOT_STATE.COMPLETED, maxTimeAgoInMillis, maxHistoricAlerts],
      pool,
      clientParam,
    )

    return results.rows
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getNewNotificationsCountByAlertApiKey(alertApiKey, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const query = `SELECT COUNT (*) FROM notifications n LEFT JOIN installations i ON n.installation_id = i.id WHERE i.alert_api_key = $1 AND NOT n.is_acknowledged`
    const { rows } = await client.query(query, [alertApiKey])

    return parseInt(rows[0].count, 10)
  } catch (e) {
    helpers.logError(`Error running the getNewNotificationsCountByAlertApiKey query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`getNewNotificationsCountByAlertApiKey: Error releasing client: ${err}`)
      }
    }
  }
  return 0
}

async function createNotification(installationId, subject, body, isAcknowledged, clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const query = 'INSERT INTO notifications (installation_id, subject, body, is_acknowledged) VALUES ($1, $2, $3, $4)'
    await client.query(query, [installationId, subject, body, isAcknowledged])
  } catch (e) {
    helpers.logError(`Error running the createNotification query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`createNotification: Error releasing client: ${err}`)
      }
    }
  }
}

async function clearNotifications(clientParam) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear notifications table outside of a test environment!')
    return
  }

  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    await client.query('DELETE FROM notifications')
  } catch (e) {
    helpers.logError(`Error running the clearNotifications query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`clearNotifications: Error releasing client: ${err}`)
      }
    }
  }
}

async function clearTables(clientParam) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear tables outside of a test environment!')
    return
  }

  await clearSessions(clientParam)
  await clearButtons(clientParam)
  await clearNotifications(clientParam)
  await clearInstallations(clientParam)
}

async function getHubs(clientParam) {
  try {
    const results = await helpers.runQuery(
      'getHubs',
      `
      SELECT *
      FROM hubs
      ORDER BY system_name
      `,
      [],
      pool,
      clientParam,
    )

    if (results.rows.length > 0) {
      return await Promise.all(results.rows.map(r => createHubFromRow(r, clientParam)))
    }
  } catch (e) {
    helpers.logError(`Error running the getHubs query: ${e}`)
  }
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
      return await createHubFromRow(rows[0], clientParam)
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

async function updateSentAlerts(id, sentalerts, clientParam) {
  try {
    const query = sentalerts
      ? `
        UPDATE hubs
        SET sent_vitals_alert_at = NOW()
        WHERE system_id = $1
        RETURNING *
      `
      : `
        UPDATE hubs
        SET sent_vitals_alert_at = NULL
        WHERE system_id = $1
        RETURNING *
      `

    const results = await helpers.runQuery('updateSentAlerts', query, [id], pool, clientParam)

    if (results === undefined) {
      return null
    }

    return await createHubFromRow(results.rows[0], clientParam)
  } catch (e) {
    helpers.logError(`Error running the updateSentAlerts query: ${e}`)
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
      `
      SELECT
        i.name AS "Installation Name",
        i.responder_phone_number AS "Responder Phone",
        i.fall_back_phone_numbers AS "Fallback Phones",
        TO_CHAR(i.created_at, 'yyyy-MM-dd HH24:mi:ss') AS "Date Installation Created",
        i.incident_categories AS "Incident Categories",
        i.is_active AS "Active?",
        s.unit AS "Unit",
        s.phone_number AS "Button Phone",
        s.state AS "Session State",
        s.num_presses AS "Number of Presses",
        TO_CHAR(s.created_at, 'yyyy-MM-dd HH24:mi:ss') AS "Session Start",
        TO_CHAR(s.updated_at, 'yyyy-MM-dd HH24:mi:ss') AS "Last Session Activity",
        s.incident_type AS "Session Incident Type",
        s.notes as "Session Notes",
        s.fallback_alert_twilio_status AS "Fallback Alert Status (Twilio)",
        s.button_battery_level AS "Button Battery Level",
        TO_CHAR(r.created_at, 'yyyy-MM-dd HH24:mi:ss') AS "Date Button Created",
        TO_CHAR(r.updated_at, 'yyyy-MM-dd HH24:mi:ss') AS "Button Last Updated",
        r.button_serial_number AS "Button Serial Number"
      FROM sessions s
        JOIN buttons r ON s.button_id = r.button_id
        JOIN installations i ON i.id = s.installation_id
      `,
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
  clearNotifications,
  clearSessions,
  clearTables,
  close,
  commitTransaction,
  createButton,
  createInstallation,
  createNotification,
  createSession,
  getActiveAlertsByAlertApiKey,
  getAllSessionsWithButtonId,
  getButtonWithSerialNumber,
  getCurrentTime,
  getDataForExport,
  getHistoricAlertsByAlertApiKey,
  getHubs,
  getHubWithSystemId,
  getInstallations,
  getInstallationsWithAlertApiKey,
  getInstallationWithInstallationId,
  getInstallationWithSessionId,
  getMostRecentIncompleteSessionWithPhoneNumber,
  getNewNotificationsCountByAlertApiKey,
  getPool,
  getRecentSessionsWithInstallationId,
  getSessionWithSessionId,
  getSessionWithSessionIdAndAlertApiKey,
  getUnrespondedSessionWithButtonId,
  rollbackTransaction,
  saveHeartbeat,
  saveSession,
  updateSentAlerts,
  updateSentInternalAlerts,
}
