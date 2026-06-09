// system.js — /system/health endpoint for the Brave Central pipeline monitor.
//
// Auth: requires HEALTH_CHECK_TOKEN env var to be set, and the caller must
// supply that token via the X-Health-Token header. Without the env var the
// endpoint returns 503 'unconfigured'; with the wrong token, 401.
//
// Response mirrors the BraveSensor /system/health shape so one monitor can
// consume both services.

const os = require('os')
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')

const STARTED_AT = new Date()

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- intentional bitwise accumulation for constant-time comparison
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function toMb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

async function handleSystemHealth(req, res) {
  const expected = (helpers.getEnvVar('HEALTH_CHECK_TOKEN') || '').trim()
  if (!expected) {
    return res.status(503).json({ status: 'unconfigured', error: 'HEALTH_CHECK_TOKEN not set' })
  }

  const provided = (req.headers['x-health-token'] || '').toString().trim()
  if (!provided || !constantTimeEqual(provided, expected)) {
    return res.status(401).json({ status: 'unauthorized' })
  }

  const dbStart = Date.now()
  let dbReachable = false
  let dbError = null
  let dbLatencyMs = null
  try {
    await db.getCurrentTimeForHealthCheck()
    dbReachable = true
  } catch (err) {
    dbError = (err && err.message) || String(err)
  }
  dbLatencyMs = Date.now() - dbStart

  const poolStats = typeof db.getPoolStats === 'function' ? db.getPoolStats() : null
  const memUsage = process.memoryUsage()

  const payload = {
    status: dbReachable ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: {
      name: 'brave_buttons_server',
      environment: helpers.getEnvVar('SENTRY_ENVIRONMENT') || 'unknown',
      hostname: os.hostname(),
      uptime_seconds: Math.floor(process.uptime()),
      started_at: STARTED_AT.toISOString(),
    },
    process: {
      memory_mb: {
        rss: toMb(memUsage.rss),
        heap_used: toMb(memUsage.heapUsed),
        heap_total: toMb(memUsage.heapTotal),
      },
      node_version: process.version,
    },
    db: {
      reachable: dbReachable,
      latency_ms: dbLatencyMs,
      pool: poolStats,
      error: dbError,
    },
  }

  return res.status(dbReachable ? 200 : 503).json(payload)
}

module.exports = {
  handleSystemHealth,
}
