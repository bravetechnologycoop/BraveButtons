// Third-party dependencies
const { Pool, types } = require('pg')

// In-house dependencies
const { CHATBOT_STATE, Client, helpers } = require('brave-alert-lib')
const Button = require('../Button')
const Gateway = require('../Gateway')
const Hub = require('../Hub')
const SessionState = require('../SessionState')
const ButtonsVital = require('../ButtonsVital')
const GatewaysVital = require('../GatewaysVital')

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
  return new SessionState(r.id, r.client_id, r.button_id, r.unit, r.phone_number, r.state, r.num_presses, r.created_at, r.updated_at, r.incident_type, r.notes, r.fallback_alert_twilio_status, r.button_battery_level, r.responded_at)
}

function createClientFromRow(r) {
  // prettier-ignore
  return new Client(r.id, r.display_name, r.responder_phone_number, r.responder_push_id, r.alert_api_key, r.reminder_timeout, r.fallback_phone_numbers, r.from_phone_number, r.fallback_timeout, r.heartbeat_phone_numbers, r.incident_categories, r.is_active, r.created_at, r.updated_at)
}

function createButtonFromRow(r, allClients) {
  const client = allClients.filter(c => c.id === r.client_id)[0]

  // prettier-ignore
  return new Button(r.id, r.button_id, r.display_name, r.phone_number, r.created_at, r.updated_at, r.button_serial_number, client)
}

function createButtonsVitalFromRow(r, allButtons) {
  const button = allButtons.filter(b => b.id === r.button_id)[0]

  // prettier-ignore
  return new ButtonsVital(r.id, r.battery_level, r.created_at, button)
}

function createHubFromRow(r, allClients) {
  const client = allClients.filter(c => c.id === r.client_id)[0]

  // prettier-ignore
  return new Hub(r.system_id, r.flic_last_seen_time, r.flic_last_ping_time, r.heartbeat_last_seen_time, r.system_name, r.sent_vitals_alert_at, r.muted, r.sent_internal_flic_alert, r.sent_internal_ping_alert, r.sent_internal_pi_alert, r.location_description, client)
}

function createGatewayFromRow(r, allClients) {
  const client = allClients.filter(c => c.id === r.client_id)[0]

  return new Gateway(r.id, r.display_name, r.is_active, r.created_at, r.updated_at, client)
}

function createGatewaysVitalFromRow(r, allGateways) {
  const gateway = allGateways.filter(g => g.id === r.gateway_id)[0]

  // prettier-ignore
  return new GatewaysVital(r.id, r.last_seen_at, r.created_at, gateway)
}

async function beginTransaction() {
  let pgClient = null

  try {
    pgClient = await pool.connect()
    await pgClient.query('BEGIN')

    // this fixes a race condition when two button press messages are received in quick succession
    // this means that only one transaction executes at a time, which is not good for performance
    // we should revisit this when / if db performance becomes a concern
    await pgClient.query('LOCK TABLE sessions, buttons, clients, migrations, hubs, notifications, gateways')
  } catch (e) {
    helpers.logError(`Error running the beginTransaction query: ${e}`)
    if (pgClient) {
      try {
        await this.rollbackTransaction(pgClient)
      } catch (err) {
        helpers.logError(`beginTransaction: Error rolling back the errored transaction: ${err}`)
      }
    }
  }

  return pgClient
}

async function commitTransaction(pgClient) {
  try {
    await pgClient.query('COMMIT')
  } catch (e) {
    helpers.logError(`Error running the commitTransaction query: ${e}`)
  } finally {
    try {
      pgClient.release()
    } catch (err) {
      helpers.logError(`commitTransaction: Error releasing client: ${err}`)
    }
  }
}

async function rollbackTransaction(pgClient) {
  try {
    await pgClient.query('ROLLBACK')
  } catch (e) {
    helpers.logError(`Error running the rollbackTransaction query: ${e}`)
  } finally {
    try {
      pgClient.release()
    } catch (err) {
      helpers.logError(`rollbackTransaction: Error releasing client: ${err}`)
    }
  }
}

async function getClients(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClients',
      `
      SELECT *
      FROM clients
      `,
      [],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      return results.rows.map(createClientFromRow)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getButtons(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getButtonWithSerialNumber',
      `
      SELECT *
      FROM buttons
      `,
      [],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allClients = await getClients(pgClient)
      return results.rows.map(r => createButtonFromRow(r, allClients))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getGateways(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getGateways',
      `
      SELECT *
      FROM gateways
      `,
      [],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allClients = await getClients(pgClient)
      return results.rows.map(r => createGatewayFromRow(r, allClients))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getHubs(pgClient) {
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
      pgClient,
    )

    const allClients = await getClients(pgClient)

    if (results.rows.length > 0) {
      return results.rows.map(r => createHubFromRow(r, allClients))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getUnrespondedSessionWithButtonId(buttonId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getUnrespondedSessionWithButtonId',
      `
      SELECT *
      FROM sessions
      WHERE button_id = $1
      AND state != $2
      AND state != $3
      AND state != $4
      ORDER BY created_at
      DESC LIMIT 1
      `,
      [buttonId, CHATBOT_STATE.WAITING_FOR_CATEGORY, CHATBOT_STATE.WAITING_FOR_DETAILS, CHATBOT_STATE.COMPLETED],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      return createSessionFromRow(results.rows[0])
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function getMostRecentSessionWithPhoneNumber(phoneNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getMostRecentSessionWithPhoneNumber',
      `
      SELECT *
      FROM sessions
      WHERE phone_number = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [phoneNumber],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      return createSessionFromRow(results.rows[0])
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function getSessionWithSessionIdAndAlertApiKey(sessionId, alertApiKey, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getSessionWithSessionIdAndAlertApiKey',
      `
      SELECT s.*
      FROM sessions AS s
      LEFT JOIN clients AS i ON s.client_id = i.id
      WHERE s.id = $1
      AND i.alert_api_key = $2
      `,
      [sessionId, alertApiKey],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getAllSessionsWithButtonId(buttonId, pgClient) {
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
      pgClient,
    )

    if (results.rows.length > 0) {
      return results.rows.map(createSessionFromRow)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getRecentSessionsWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentSessionsWithClientId',
      `
      SELECT *
      FROM sessions
      WHERE client_id = $1
      ORDER BY created_at DESC
      LIMIT 40
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      return results.rows.map(createSessionFromRow)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getRecentButtonsVitals(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentButtonsVitals',
      `
      SELECT a.*
      FROM (
        SELECT DISTINCT ON (b.display_name) bv.*
        FROM buttons_vitals AS bv
        LEFT JOIN buttons AS b ON b.id = bv.button_id
        ORDER BY b.display_name, bv.created_at DESC
      ) AS a
      ORDER BY a.created_at
      `,
      [],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return results.rows.map(r => createButtonsVitalFromRow(r, allButtons))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getRecentButtonsVitalsWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentButtonsVitalsWithClientId',
      `
      SELECT a.*
      FROM (
        SELECT DISTINCT ON (b.display_name) bv.*
        FROM buttons_vitals AS bv
        LEFT JOIN buttons AS b ON b.id = bv.button_id
        WHERE b.client_id = $1
        ORDER BY b.display_name, bv.created_at DESC
      ) AS a
      ORDER BY a.created_at
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return results.rows.map(r => createButtonsVitalFromRow(r, allButtons))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getRecentGatewaysVitals(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentGatewaysVitals',
      `
      SELECT a.*
      FROM (
        SELECT DISTINCT ON (g.id) gv.*
        FROM gateways_vitals AS gv
        LEFT JOIN gateways AS g ON g.id = gv.gateway_id
        ORDER BY g.id, gv.created_at DESC
      ) AS a
      ORDER BY a.last_seen_at
      `,
      [],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allGateways = await getGateways(pgClient)
      return results.rows.map(r => createGatewaysVitalFromRow(r, allGateways))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getRecentGatewaysVitalsWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentGatewaysVitalsWithClientId',
      `
      SELECT a.*
      FROM (
        SELECT DISTINCT ON (g.id) gv.*
        FROM gateways_vitals AS gv
        LEFT JOIN gateways AS g ON g.id = gv.gateway_id
        WHERE g.client_id = $1
        ORDER BY g.id, gv.created_at DESC
      ) AS a
      ORDER BY a.last_seen_at
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allGateways = await getGateways(pgClient)
      return results.rows.map(r => createGatewaysVitalFromRow(r, allGateways))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getSessionWithSessionId(sessionId, pgClient) {
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
      pgClient,
    )

    if (results.rows.length > 0) {
      return createSessionFromRow(results.rows[0])
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function createSession(clientId, buttonId, unit, phoneNumber, numPresses, buttonBatteryLevel, respondedAt, pgClient) {
  try {
    const results = await helpers.runQuery(
      'createSession',
      `
      INSERT INTO sessions (client_id, button_id, unit, phone_number, state, num_presses, button_battery_level, responded_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [clientId, buttonId, unit, phoneNumber, CHATBOT_STATE.STARTED, numPresses, buttonBatteryLevel, respondedAt],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      return createSessionFromRow(results.rows[0])
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function saveSession(session, pgClient) {
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
      pgClient,
    )
    if (results === null || results.rows.length === 0) {
      throw new Error("Tried to save a session that doesn't exist yet. Use createSession() instead.")
    }

    await helpers.runQuery(
      'saveSessionUpdate',
      `
      UPDATE sessions
      SET client_id = $1, button_id = $2, unit = $3, phone_number = $4, state = $5, num_presses = $6, incident_type = $7, notes = $8, fallback_alert_twilio_status = $9, button_battery_level = $10, responded_at = $11
      WHERE id = $12
      `,
      [
        session.clientId,
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
      pgClient,
    )
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function updateSentInternalAlerts(hub, pgClient) {
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
      pgClient,
    )
    if (results === null || results.rows.length === 0) {
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
      pgClient,
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

async function clearSessions(pgClient) {
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
      pgClient,
    )
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getButtonWithSerialNumber(serialNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getButtonWithSerialNumber',
      `
      SELECT *
      FROM buttons
      WHERE button_serial_number = $1
      `,
      [serialNumber],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allClients = await getClients(pgClient)
      return createButtonFromRow(results.rows[0], allClients)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function createButton(buttonId, clientId, displayName, phoneNumber, button_serial_number, pgClient) {
  try {
    const results = await helpers.runQuery(
      'createButton',
      `
      INSERT INTO buttons (button_id, client_id, display_name, phone_number, button_serial_number)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [buttonId, clientId, displayName, phoneNumber, button_serial_number],
      pool,
      pgClient,
    )

    const allClients = await getClients(pgClient)
    return createButtonFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function clearButtons(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear buttons database outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearButtons',
      `DELETE FROM buttons
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function createClient(
  displayName,
  responderPhoneNumber,
  responderPushId,
  alertApiKey,
  reminderTimeout,
  fallbackPhoneNumbers,
  fromPhoneNumber,
  fallbackTimeout,
  heartbeatPhoneNumbers,
  incidentCategories,
  isActive,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createClient',
      `
      INSERT INTO clients (display_name, responder_phone_number, responder_push_id, alert_api_key, reminder_timeout, fallback_phone_numbers, from_phone_number, fallback_timeout, heartbeat_phone_numbers, incident_categories, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        displayName,
        responderPhoneNumber,
        responderPushId,
        alertApiKey,
        reminderTimeout,
        fallbackPhoneNumbers,
        fromPhoneNumber,
        fallbackTimeout,
        heartbeatPhoneNumbers,
        incidentCategories,
        isActive,
      ],
      pool,
      pgClient,
    )

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }

  return null
}

async function clearClients(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear clients table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearClients',
      `
      DELETE FROM clients
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getClientsWithAlertApiKey(alertApiKey, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientsWithAlertApiKey',
      `SELECT *
      FROM clients
      WHERE alert_api_key = $1
      `,
      [alertApiKey],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      return results.rows.map(createClientFromRow)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function getClientWithId(id, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientWithId',
      `
      SELECT *
      FROM clients
      WHERE id = $1
      `,
      [id],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      return createClientFromRow(results.rows[0])
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function getClientWithSessionId(sessionId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientWithSessionId',
      `
      SELECT c.*
      FROM sessions s
      LEFT JOIN clients c ON s.client_id = c.id 
      WHERE s.id = $1
      `,
      [sessionId],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      return createClientFromRow(results.rows[0])
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function getActiveAlertsByAlertApiKey(alertApiKey, maxTimeAgoInMillis, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getActiveAlertsByAlertApiKey',
      `
      SELECT s.id, s.state, b.display_name, s.num_presses, i.incident_categories, s.created_at
      FROM sessions AS s
      LEFT JOIN buttons AS b ON s.button_id = b.button_id
      LEFT JOIN clients AS i ON s.client_id = i.id
      WHERE i.alert_api_key = $1
      AND (
        s.state != $2
        AND s.updated_at >= now() - $3 * INTERVAL '1 millisecond'
      )
      ORDER BY s.created_at DESC
      `,
      [alertApiKey, CHATBOT_STATE.COMPLETED, maxTimeAgoInMillis],
      pool,
      pgClient,
    )

    return results.rows
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts, maxTimeAgoInMillis, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getHistoricAlertsByAlertApiKey',
      `
      SELECT s.id, b.display_name, s.incident_type, s.num_presses, s.created_at, s.responded_at
      FROM sessions AS s
      LEFT JOIN buttons AS b ON s.button_id = b.button_id
      LEFT JOIN clients AS i ON s.client_id = i.id
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
      pgClient,
    )

    return results.rows
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getNewNotificationsCountByAlertApiKey(alertApiKey, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getNewNotificationsCountByAlertApiKey',
      `
      SELECT COUNT (*)
      FROM notifications n
      LEFT JOIN clients i ON n.client_id = i.id
      WHERE i.alert_api_key = $1
      AND NOT n.is_acknowledged
      `,
      [alertApiKey],
      pool,
      pgClient,
    )

    return parseInt(results.rows[0].count, 10)
  } catch (err) {
    helpers.logError(err.toString())
  }

  return 0
}

async function createNotification(clientId, subject, body, isAcknowledged, pgClient) {
  try {
    await helpers.runQuery(
      'createNotification',
      `
      INSERT INTO notifications (client_id, subject, body, is_acknowledged)
      VALUES ($1, $2, $3, $4)
      `,
      [clientId, subject, body, isAcknowledged],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function clearNotifications(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear notifications table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearNotifications',
      `
      DELETE FROM notifications
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function clearButtonsVitals(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear buttons vitals table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearButtonsVitals',
      `
      DELETE FROM buttons_vitals
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function clearGateways(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear gateways table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearGateways',
      `
      DELETE FROM gateways
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function clearGatewaysVitals(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear gateways vitals table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearGatewaysVitals',
      `
      DELETE FROM gateways_vitals
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function clearTables(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear tables outside of a test environment!')
    return
  }

  await clearGatewaysVitals(pgClient)
  await clearButtonsVitals(pgClient)
  await clearGateways(pgClient)
  await clearSessions(pgClient)
  await clearButtons(pgClient)
  await clearNotifications(pgClient)
  await clearClients(pgClient)
}

async function getHubWithSystemId(systemId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getHubWithSystemId',
      `
      SELECT *
      FROM hubs AS h
      LEFT JOIN clients AS c ON h.client_id = c.id
      WHERE system_id = $1
      `,
      [systemId],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allClients = await getClients(pgClient)
      return createHubFromRow(results.rows[0], allClients)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function getHubsWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getHubsWithClientId',
      `
      SELECT *
      FROM hubs AS h
      LEFT JOIN clients AS c ON h.client_id = c.id
      WHERE client_id = $1
      ORDER BY system_name
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allClients = await getClients(pgClient)
      return results.rows.map(r => createHubFromRow(r, allClients))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function saveHeartbeat(systemId, flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime, pgClient) {
  try {
    const results = await helpers.runQuery(
      'saveHeartbeat select',
      `
      SELECT *
      FROM hubs
      WHERE system_id = $1
      LIMIT 1
      `,
      [systemId],
      pool,
      pgClient,
    )
    if (results === null || results.rows.length === 0) {
      throw new Error("Tried to save a heartbeat for a hub that doesn't exist yet.")
    }

    await helpers.runQuery(
      'saveHeartbeat update',
      `
      UPDATE hubs
      SET flic_last_seen_time = $1, flic_last_ping_time = $2, heartbeat_last_seen_time = $3
      WHERE system_id = $4
      `,
      [flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime, systemId],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function updateSentAlerts(id, sentalerts, pgClient) {
  try {
    const query = sentalerts
      ? `
        UPDATE hubs
        SET sent_vitals_alert_at = NOW()
        WHERE system_id = $1
      `
      : `
        UPDATE hubs
        SET sent_vitals_alert_at = NULL
        WHERE system_id = $1
      `

    await helpers.runQuery('updateSentAlerts', query, [id], pool, pgClient)
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getDataForExport(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDataForExport',
      `
      SELECT
        i.display_name AS "Installation Name",
        i.responder_phone_number AS "Responder Phone",
        i.fallback_phone_numbers AS "Fallback Phones",
        TO_CHAR(i.created_at, 'yyyy-MM-dd HH24:mi:ss') AS "Date Installation Created",
        i.incident_categories AS "Incident Categories",
        i.is_active AS "Active?",
        r.display_name AS "Unit",
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
        JOIN clients i ON i.id = s.client_id
      `,
      [],
      pool,
      pgClient,
    )

    return results.rows
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function logButtonsVital(buttonId, batteryLevel, pgClient) {
  try {
    const results = await helpers.runQuery(
      'logButtonsVital',
      `
      INSERT INTO buttons_vitals (button_id, battery_level)
      VALUES ($1, $2)
      RETURNING *
      `,
      [buttonId, batteryLevel],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return createButtonsVitalFromRow(results.rows[0], allButtons)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function logGatewaysVital(gatewayId, lastSeenAt, pgClient) {
  try {
    const results = await helpers.runQuery(
      'logGatewaysVital',
      `
      INSERT INTO gateways_vitals (gateway_id, last_seen_at)
      VALUES ($1, $2)
      RETURNING *
      `,
      [gatewayId, lastSeenAt],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allGateways = await getGateways(pgClient)
      return createGatewaysVitalFromRow(results.rows[0], allGateways)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function getCurrentTime(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getCurrentTime',
      `
      SELECT NOW()
      `,
      [],
      pool,
      pgClient,
    )

    return results.rows[0].now
  } catch (err) {
    helpers.log(err.toString())
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
  clearButtonsVitals,
  clearClients,
  clearGateways,
  clearGatewaysVitals,
  clearNotifications,
  clearSessions,
  clearTables,
  close,
  commitTransaction,
  createButton,
  createClient,
  createNotification,
  createSession,
  getActiveAlertsByAlertApiKey,
  getAllSessionsWithButtonId,
  getButtons,
  getButtonWithSerialNumber,
  getCurrentTime,
  getDataForExport,
  getHistoricAlertsByAlertApiKey,
  getHubs,
  getHubsWithClientId,
  getHubWithSystemId,
  getClients,
  getClientsWithAlertApiKey,
  getClientWithId,
  getClientWithSessionId,
  getGateways,
  getMostRecentSessionWithPhoneNumber,
  getNewNotificationsCountByAlertApiKey,
  getPool,
  getRecentButtonsVitals,
  getRecentButtonsVitalsWithClientId,
  getRecentGatewaysVitals,
  getRecentGatewaysVitalsWithClientId,
  getRecentSessionsWithClientId,
  getSessionWithSessionId,
  getSessionWithSessionIdAndAlertApiKey,
  getUnrespondedSessionWithButtonId,
  logButtonsVital,
  logGatewaysVital,
  rollbackTransaction,
  saveHeartbeat,
  saveSession,
  updateSentAlerts,
  updateSentInternalAlerts,
}
