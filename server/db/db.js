// Third-party dependencies
const { Pool, types } = require('pg')

// In-house dependencies
const { CHATBOT_STATE, Client, DEVICE_TYPE, Device, helpers, Session } = require('brave-alert-lib')
const Gateway = require('../Gateway')
const ButtonsVital = require('../ButtonsVital')
const GatewaysVital = require('../GatewaysVital')

const pool = new Pool({
  host: helpers.getEnvVar('PG_HOST'),
  port: helpers.getEnvVar('PG_PORT'),
  user: helpers.getEnvVar('PG_USER'),
  database: helpers.getEnvVar('PG_DATABASE'),
  password: helpers.getEnvVar('PG_PASSWORD'),
  ssl: { rejectUnauthorized: false },
})

pool.on('error', err => {
  helpers.logError(`unexpected database error: ${JSON.stringify(err)}`)
})

types.setTypeParser(types.builtins.NUMERIC, value => parseFloat(value))

function createSessionFromRow(r, allDevices) {
  const device = allDevices.filter(d => d.id === r.device_id)[0]

  return new Session(
    r.id,
    r.chatbot_state,
    r.alert_type,
    r.number_of_alerts,
    r.created_at,
    r.updated_at,
    r.incident_category,
    r.responded_at,
    r.responded_by_phone_number,
    r.is_resettable,
    device,
  )
}

function createClientFromRow(r) {
  return new Client(
    r.id,
    r.display_name,
    r.responder_phone_numbers,
    r.reminder_timeout,
    r.fallback_phone_numbers,
    r.from_phone_number,
    r.fallback_timeout,
    r.heartbeat_phone_numbers,
    r.incident_categories,
    r.is_displayed,
    r.is_sending_alerts,
    r.is_sending_vitals,
    r.language,
    r.created_at,
    r.updated_at,
  )
}

function createDeviceFromRow(r, allClients) {
  const client = allClients.filter(c => c.id === r.client_id)[0]

  return new Device(
    r.id,
    r.device_type,
    r.locationid,
    r.phone_number,
    r.display_name,
    r.serial_number,
    r.sent_low_battery_alert_at,
    r.sent_vitals_alert_at,
    r.created_at,
    r.updated_at,
    r.is_displayed,
    r.is_sending_alerts,
    r.is_sending_vitals,
    client,
  )
}

function createButtonsVitalFromRow(r, allButtons) {
  const device = allButtons.filter(d => d.id === r.device_id)[0]

  return new ButtonsVital(r.id, r.battery_level, r.created_at, r.snr, r.rssi, device)
}

function createGatewayFromRow(r, allClients) {
  const client = allClients.filter(c => c.id === r.client_id)[0]

  return new Gateway(r.id, r.display_name, r.is_displayed, r.is_sending_vitals, r.created_at, r.updated_at, r.sent_vitals_alert_at, client)
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
    await pgClient.query(
      'LOCK TABLE sessions, devices, clients, migrations, gateways, gateways_vitals, gateways_vitals_cache, buttons_vitals, buttons_vitals_cache',
    )
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
      ORDER BY display_name
      `,
      [],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      return results.rows.map(createClientFromRow)
    }
  } catch (err) {
    helpers.logError(`Error running the getClients query: ${err.toString()}`)
  }

  return []
}

async function getActiveButtonsClients(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getActiveButtonsClients',
      `
        SELECT c.*
        FROM clients c
        INNER JOIN (
          SELECT DISTINCT client_id AS id
          FROM devices
          WHERE device_type = $1
          AND is_sending_alerts
          AND is_sending_vitals
        ) AS b
        ON c.id = b.id
        WHERE c.is_sending_alerts
        AND c.is_sending_vitals
        ORDER BY c.display_name;
      `,
      [DEVICE_TYPE.DEVICE_BUTTON],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    return await Promise.all(results.rows.map(r => createClientFromRow(r)))
  } catch (err) {
    helpers.logError(`Error running the getActiveButtonsClients query: ${err.toString()}`)
  }
}

async function getButtons(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getButtons',
      `
      SELECT *
      FROM devices
      WHERE device_type = $1
      `,
      [DEVICE_TYPE.DEVICE_BUTTON],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allClients = await getClients(pgClient)
      return results.rows.map(r => createDeviceFromRow(r, allClients))
    }
  } catch (err) {
    helpers.logError(`Error running the getButtons query: ${err.toString()}`)
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
    helpers.logError(`Error running the getGateways query: ${err.toString()}`)
  }

  return []
}

async function getUnrespondedSessionWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getUnrespondedSessionWithDeviceId',
      `
      SELECT *
      FROM sessions
      WHERE device_id = $1
      AND chatbot_state != $2
      AND chatbot_state != $3
      ORDER BY created_at
      DESC LIMIT 1
      `,
      [deviceId, CHATBOT_STATE.WAITING_FOR_CATEGORY, CHATBOT_STATE.COMPLETED],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return createSessionFromRow(results.rows[0], allButtons)
    }
  } catch (err) {
    helpers.logError(`Error running the getUnrespondedSessionWithDeviceId query: ${err.toString()}`)
  }

  return null
}

async function getMostRecentSessionWithPhoneNumbers(devicePhoneNumber, responderPhoneNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getMostRecentSessionWithPhoneNumbers',
      `
      SELECT s.*
      FROM sessions AS s
      LEFT JOIN devices AS d ON s.device_id = d.id
      LEFT JOIN clients AS c ON d.client_id = c.id
      WHERE d.phone_number = $1
      AND $2 = ANY(c.responder_phone_numbers)
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [devicePhoneNumber, responderPhoneNumber],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return createSessionFromRow(results.rows[0], allButtons)
    }
  } catch (err) {
    helpers.logError(`Error running the getMostRecentSessionWithPhoneNumbers query: ${err.toString()}`)
  }

  return null
}

async function getAllSessionsWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getAllSessionsWithDeviceId',
      `
      SELECT *
      FROM sessions
      WHERE device_id = $1
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return results.rows.map(r => createSessionFromRow(r, allButtons))
    }
  } catch (err) {
    helpers.logError(`Error running the getAllSessionsWithDeviceId query: ${err.toString()}`)
  }

  return []
}

async function getRecentButtonsSessionsWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentButtonsSessionsWithClientId',
      `
      SELECT s.*
      FROM sessions AS s
      LEFT JOIN devices AS b on s.device_id = b.id
      WHERE b.device_type = $1
      AND b.client_id = $2
      ORDER BY created_at DESC
      LIMIT 40
      `,
      [DEVICE_TYPE.DEVICE_BUTTON, clientId],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return results.rows.map(r => createSessionFromRow(r, allButtons))
    }
  } catch (err) {
    helpers.logError(`Error running the getRecentButtonsSessionsWithClientId query: ${err.toString()}`)
  }

  return []
}

async function getRecentButtonsVitals(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentButtonsVitals',
      `
      SELECT b.id as device_id, bv.id, bv.battery_level, bv.rssi, bv.snr, bv.created_at
      FROM devices b
      LEFT JOIN buttons_vitals_cache bv ON b.id = bv.device_id
      WHERE b.device_type = $1
      AND b.serial_number like 'ac%'
      ORDER BY bv.created_at
      `,
      [DEVICE_TYPE.DEVICE_BUTTON],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return results.rows.map(r => createButtonsVitalFromRow(r, allButtons))
    }
  } catch (err) {
    helpers.logError(`Error running the getRecentButtonsVitals query: ${err.toString()}`)
  }

  return []
}

async function getRecentButtonsVitalsWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentButtonsVitalsWithClientId',
      `
      SELECT b.id as device_id, bv.id, bv.battery_level, bv.rssi, bv.snr, bv.created_at
      FROM devices b
      LEFT JOIN buttons_vitals_cache bv ON b.id = bv.device_id
      WHERE b.device_type = $1
      AND b.client_id = $2
      AND b.serial_number like 'ac%'
      ORDER BY bv.created_at
      `,
      [DEVICE_TYPE.DEVICE_BUTTON, clientId],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return results.rows.map(r => createButtonsVitalFromRow(r, allButtons))
    }
  } catch (err) {
    helpers.logError(`Error running the getRecentButtonsVitalsWithClientId query: ${err.toString()}`)
  }

  return []
}

async function getRecentGatewaysVitals(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentGatewaysVitals',
      `
      SELECT g.id as gateway_id, gv.id, gv.last_seen_at, gv.created_at
      FROM gateways g
      LEFT JOIN gateways_vitals_cache gv ON g.id = gv.gateway_id
      ORDER BY gv.last_seen_at
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
    helpers.logError(`Error running the getRecentGatewaysVitals query: ${err.toString()}`)
  }

  return []
}

async function getRecentGatewaysVitalsWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentGatewaysVitalsWithClientId',
      `
      SELECT g.id as gateway_id, gv.id, gv.last_seen_at, gv.created_at
      FROM gateways g
      LEFT JOIN gateways_vitals_cache gv ON g.id = gv.gateway_id
      WHERE g.client_id = $1
      ORDER BY gv.last_seen_at
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
    helpers.logError(`Error running the getRecentGatewaysVitalsWithClientId query: ${err.toString()}`)
  }

  return []
}

async function getRecentGatewaysVitalWithGatewayId(gatewayId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentGatewaysVitalWithGatewayId',
      `
      SELECT *
      FROM gateways_vitals_cache
      WHERE gateway_id = $1
      `,
      [gatewayId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    const allGateways = await getGateways(pgClient)
    return createGatewaysVitalFromRow(results.rows[0], allGateways)
  } catch (err) {
    helpers.logError(`Error running the getRecentGatewaysVitalWithGatewayId query: ${err.toString()}`)
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
      const allButtons = await getButtons(pgClient)
      return createSessionFromRow(results.rows[0], allButtons)
    }
  } catch (err) {
    helpers.logError(`Error running the getSessionWithSessionId query: ${err.toString()}`)
  }

  return null
}

async function createSession(
  deviceId,
  incidentCategory,
  chatbotState,
  alertType,
  createdAt,
  respondedAt,
  respondedByPhoneNumber,
  isResettable,
  pgClient,
) {
  try {
    if (createdAt !== undefined) {
      const results = await helpers.runQuery(
        'createSession',
        `
        INSERT INTO sessions (device_id, incident_category, chatbot_state, alert_type, created_at, responded_at, responded_by_phone_number, is_resettable)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [deviceId, incidentCategory, chatbotState, alertType, createdAt, respondedAt, respondedByPhoneNumber, isResettable],
        pool,
        pgClient,
      )

      if (results.rows.length > 0) {
        const allButtons = await getButtons(pgClient)
        return createSessionFromRow(results.rows[0], allButtons)
      }
    } else {
      const results = await helpers.runQuery(
        'createSession',
        `
        INSERT INTO sessions (device_id, incident_category, chatbot_state, alert_type, responded_at, responded_by_phone_number, is_resettable)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [deviceId, incidentCategory, chatbotState, alertType, respondedAt, respondedByPhoneNumber, isResettable],
        pool,
        pgClient,
      )

      if (results.rows.length > 0) {
        const allButtons = await getButtons(pgClient)
        return createSessionFromRow(results.rows[0], allButtons)
      }
    }
  } catch (err) {
    helpers.logError(`Error running the createSession query: ${err.toString()}`)
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
      SET device_id = $1, chatbot_state = $2, alert_type=$3, number_of_alerts = $4, incident_category = $5, responded_at = $6, responded_by_phone_number = $7
      WHERE id = $8
      `,
      [
        session.device.id,
        session.chatbotState,
        session.alertType,
        session.numberOfAlerts,
        session.incidentCategory,
        session.respondedAt,
        session.respondedByPhoneNumber,
        session.id,
      ],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(`Error running the saveSession query: ${err.toString()}`)
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
    helpers.logError(`Error running the clearSessions query: ${err.toString()}`)
  }
}

async function getDeviceWithSerialNumber(serialNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDeviceWithSerialNumber',
      `
      SELECT *
      FROM devices
      WHERE serial_number = $1
      `,
      [serialNumber],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allClients = await getClients(pgClient)
      return createDeviceFromRow(results.rows[0], allClients)
    }
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithSerialNumber query: ${err.toString()}`)
  }

  return null
}

async function createButton(
  clientId,
  displayName,
  phoneNumber,
  serialNumber,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  sentLowBatteryAlertAt,
  sentVitalsAlertAt,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createButton',
      `
      INSERT INTO devices (device_type, client_id, display_name, phone_number, serial_number, is_displayed, is_sending_alerts, is_sending_vitals, sent_low_battery_alert_at, sent_vitals_alert_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        DEVICE_TYPE.DEVICE_BUTTON,
        clientId,
        displayName,
        phoneNumber,
        serialNumber,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
        sentLowBatteryAlertAt,
        sentVitalsAlertAt,
      ],
      pool,
      pgClient,
    )

    const allClients = await getClients(pgClient)
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the createButton query: ${err.toString()}`)
  }

  return null
}

async function clearDevices(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear buttons database outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearDevices',
      `DELETE FROM devices
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(`Error running the clearDevices query: ${err.toString()}`)
  }
}

async function createClient(
  displayName,
  responderPhoneNumbers,
  reminderTimeout,
  fallbackPhoneNumbers,
  fromPhoneNumber,
  fallbackTimeout,
  heartbeatPhoneNumbers,
  incidentCategories,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  language,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createClient',
      `
      INSERT INTO clients (display_name, responder_phone_numbers, reminder_timeout, fallback_phone_numbers, from_phone_number, fallback_timeout, heartbeat_phone_numbers, incident_categories, is_displayed, is_sending_alerts, is_sending_vitals, language)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        displayName,
        responderPhoneNumbers,
        reminderTimeout,
        fallbackPhoneNumbers,
        fromPhoneNumber,
        fallbackTimeout,
        heartbeatPhoneNumbers,
        incidentCategories,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
        language,
      ],
      pool,
      pgClient,
    )

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createClient query: ${err.toString()}`)
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
      'clearClientsExtension',
      `
      DELETE FROM clients_extension
      `,
      [],
      pool,
      pgClient,
    )

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
    helpers.logError(`Error running the clearClients query: ${err.toString()}`)
  }
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
    helpers.logError(`Error running the getClientWithId query: ${err.toString()}`)
  }

  return null
}

async function getClientWithSessionId(sessionId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientWithSessionId',
      `
      SELECT c.*
      FROM sessions AS s
      LEFT JOIN devices AS b ON s.device_id = b.id
      LEFT JOIN clients AS c ON b.client_id = c.id 
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
    helpers.logError(`Error running the getClientWithSessionId query: ${err.toString()}`)
  }

  return null
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
    helpers.logError(`Error running the clearButtonsVitals query: ${err.toString()}`)
  }
}

async function clearButtonsVitalsCache(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear buttons vitals cache table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearButtonsVitalsCache',
      `
      DELETE FROM buttons_vitals_cache
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(`Error running the clearButtonsVitalsCache query: ${err.toString()}`)
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
    helpers.logError(`Error running the clearGateways query: ${err.toString()}`)
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
    helpers.logError(`Error running the clearGatewaysVitals query: ${err.toString()}`)
  }
}

async function clearGatewaysVitalsCache(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear gateways vitals cache table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearGatewaysVitalsCache',
      `
      DELETE FROM gateways_vitals_cache
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(`Error running the clearGatewaysVitalsCache query: ${err.toString()}`)
  }
}

async function clearTables(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear tables outside of a test environment!')
    return
  }

  await clearGatewaysVitalsCache(pgClient)
  await clearButtonsVitalsCache(pgClient)
  await clearGatewaysVitals(pgClient)
  await clearButtonsVitals(pgClient)
  await clearGateways(pgClient)
  await clearSessions(pgClient)
  await clearDevices(pgClient)
  await clearClients(pgClient)
}

async function updateGatewaySentVitalsAlerts(gatewayId, sentalerts, pgClient) {
  try {
    const query = sentalerts
      ? `
        UPDATE gateways
        SET sent_vitals_alert_at = NOW()
        WHERE id = $1
      `
      : `
        UPDATE gateways
        SET sent_vitals_alert_at = NULL
        WHERE id = $1
      `

    await helpers.runQuery('updateGatewaySentVitalsAlerts', query, [gatewayId], pool, pgClient)
  } catch (err) {
    helpers.logError(`Error running the updateGatewaySentVitalsAlerts query: ${err.toString()}`)
  }
}

async function updateDevicesSentLowBatteryAlerts(deviceId, sentalerts, pgClient) {
  try {
    const query = sentalerts
      ? `
        UPDATE devices
        SET sent_low_battery_alert_at = NOW()
        WHERE id = $1
      `
      : `
        UPDATE devices
        SET sent_low_battery_alert_at = NULL
        WHERE id = $1
      `

    await helpers.runQuery('updateDevicesSentLowBatteryAlerts', query, [deviceId], pool, pgClient)
  } catch (err) {
    helpers.logError(`Error running the updateDevicesSentLowBatteryAlerts query: ${err.toString()}`)
  }
}

async function updateDevicesSentVitalsAlerts(deviceId, sentalerts, pgClient) {
  try {
    const query = sentalerts
      ? `
        UPDATE devices
        SET sent_vitals_alert_at = NOW()
        WHERE id = $1
      `
      : `
        UPDATE devices
        SET sent_vitals_alert_at = NULL
        WHERE id = $1
      `

    await helpers.runQuery('updateDevicesSentVitalsAlerts', query, [deviceId], pool, pgClient)
  } catch (err) {
    helpers.logError(`Error running the updateDevicesSentVitalsAlerts query: ${err.toString()}`)
  }
}

async function getDataForExport(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDataForExport',
      `
      SELECT
        c.display_name AS "Installation Name",
        c.responder_phone_numbers AS "Responder Phone",
        c.fallback_phone_numbers AS "Fallback Phones",
        TO_CHAR(c.created_at, 'yyyy-MM-dd HH24:mi:ss') AS "Date Installation Created",
        c.incident_categories AS "Incident Categories",
        c.is_sending_vitals AS "Active?",
        b.display_name AS "Unit",
        b.phone_number AS "Button Phone",
        s.chatbot_state AS "Session State",
        s.number_of_alerts AS "Number of Presses",
        TO_CHAR(s.created_at, 'yyyy-MM-dd HH24:mi:ss') AS "Session Start",
        TO_CHAR(s.updated_at, 'yyyy-MM-dd HH24:mi:ss') AS "Last Session Activity",
        s.incident_category AS "Session Incident Type",
        '' AS "Session Notes",
        '' AS "Fallback Alert Status (Twilio)",
        '' AS "Button Battery Level",
        TO_CHAR(b.created_at, 'yyyy-MM-dd HH24:mi:ss') AS "Date Button Created",
        TO_CHAR(b.updated_at, 'yyyy-MM-dd HH24:mi:ss') AS "Button Last Updated",
        b.serial_number AS "Button Serial Number",
        TO_CHAR(s.responded_at, 'yyyy-MM-dd HH24:mi:ss') AS "Session Responded At",
        s.responded_by_phone_number AS "Session Responded By",
        x.country AS "Country",
        x.country_subdivision AS "Country Subdivision",
        x.building_type AS "Building Type"
      FROM sessions AS s
        LEFT JOIN devices AS b ON s.device_id = b.id
        LEFT JOIN clients AS c ON c.id = b.client_id
        LEFT JOIN clients_extension x on x.client_id = c.id
        LEFT JOIN buttons_vitals_cache bv ON b.id = bv.device_id
        WHERE b.device_type = $1
      `,
      [DEVICE_TYPE.DEVICE_BUTTON],
      pool,
      pgClient,
    )

    return results.rows
  } catch (err) {
    helpers.logError(`Error running the getDataForExport query: ${err.toString()}`)
  }
}

async function logButtonsVital(deviceId, batteryLevel, snr, rssi, pgClient) {
  try {
    const results = await helpers.runQuery(
      'logButtonsVital',
      `
      INSERT INTO buttons_vitals (device_id, battery_level, snr, rssi)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [deviceId, batteryLevel, snr, rssi],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allButtons = await getButtons(pgClient)
      return createButtonsVitalFromRow(results.rows[0], allButtons)
    }
  } catch (err) {
    helpers.logError(`Error running the logButtonsVital query: ${err.toString()}`)
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
    helpers.logError(`Error running the logGatewaysVital query: ${err.toString()}`)
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
    helpers.logError(`Error running the getCurrentTime query: ${err.toString()}`)
  }
}

// Checks the database connection, if not able to connect will throw an error
async function getCurrentTimeForHealthCheck() {
  if (helpers.isDbLogging()) {
    helpers.log(`STARTED: getCurrentTimeForHealthCheck`)
  }

  let pgClient = null

  try {
    pgClient = await pool.connect()
    if (helpers.isDbLogging()) {
      helpers.log(`CONNECTED: getCurrentTimeForHealthCheck`)
    }

    const results = await pgClient.query(`SELECT NOW()`)
    return results.rows[0].now
  } catch (err) {
    helpers.logError(`Error running the getCurrentTimeForHealthCheck query: ${err}`)
    throw err
  } finally {
    try {
      pgClient.release()
    } catch (err) {
      helpers.logError(`getCurrentTimeForHealthCheck: Error releasing client: ${err}`)
    }

    if (helpers.isDbLogging()) {
      helpers.log(`COMPLETED: getCurrentTimeForHealthCheck`)
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

async function getDisconnectedGatewaysWithClient(client, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDisconnectedGatewaysWithClient',
      `
      SELECT *
      FROM gateways g
      WHERE g.client_id = $1
      AND g.sent_vitals_alert_at IS NOT NULL
      `,
      [client.id],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      return results.rows.map(r => createGatewayFromRow(r, [client]))
    }

    if (results.rows.length === 0) {
      return []
    }
  } catch (err) {
    helpers.logError(`Error running the getDisconnectedGatewaysWithClient query: ${err.toString()}`)
  }

  return null
}

async function createDevice(
  deviceType,
  clientId,
  locationid,
  phoneNumber,
  displayName,
  serialNumber,
  sentLowBatteryAlertAt,
  sentVitalsAlertAt,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createButton',
      `
      INSERT INTO devices (device_type, client_id, locationid, phone_number, display_name, serial_number, sent_low_battery_alert_at, sent_vitals_alert_at, is_displayed, is_sending_alerts, is_sending_vitals)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        deviceType,
        clientId,
        locationid,
        phoneNumber,
        displayName,
        serialNumber,
        sentLowBatteryAlertAt,
        sentVitalsAlertAt,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
      ],
      pool,
      pgClient,
    )

    const allClients = await getClients(pgClient)
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the createButton query: ${err.toString()}`)
  }

  return null
}

async function getDeviceWithIds(deviceId, clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDeviceWithIds',
      `
      SELECT *
      FROM devices
      WHERE id = $1
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const client = await getClientWithId(clientId, pgClient)
      return createDeviceFromRow(results.rows[0], [client])
    }
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithSerialNumber query: ${err.toString()}`)
  }

  return null
}

module.exports = {
  beginTransaction,
  clearButtonsVitals,
  clearButtonsVitalsCache,
  clearClients,
  clearDevices,
  clearGateways,
  clearGatewaysVitals,
  clearGatewaysVitalsCache,
  clearSessions,
  clearTables,
  close,
  commitTransaction,
  createButton,
  createClient,
  createDevice,
  createSession,
  getActiveButtonsClients,
  getAllSessionsWithDeviceId,
  getButtons,
  getClientWithId,
  getClientWithSessionId,
  getClients,
  getCurrentTime,
  getCurrentTimeForHealthCheck,
  getDataForExport,
  getDeviceWithIds,
  getDeviceWithSerialNumber,
  getDisconnectedGatewaysWithClient,
  getGateways,
  getMostRecentSessionWithPhoneNumbers,
  getPool,
  getRecentButtonsSessionsWithClientId,
  getRecentButtonsVitals,
  getRecentButtonsVitalsWithClientId,
  getRecentGatewaysVitalWithGatewayId,
  getRecentGatewaysVitals,
  getRecentGatewaysVitalsWithClientId,
  getSessionWithSessionId,
  getUnrespondedSessionWithDeviceId,
  logButtonsVital,
  logGatewaysVital,
  rollbackTransaction,
  saveSession,
  updateDevicesSentLowBatteryAlerts,
  updateDevicesSentVitalsAlerts,
  updateGatewaySentVitalsAlerts,
}
