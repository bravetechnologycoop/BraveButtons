// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const { helpers, HistoricAlert, ALERT_TYPE } = require('brave-alert-lib')
const db = require('../../../db/db.js')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

// Configure Chai
use(sinonChai)

describe('BraveAlerterConfigurator.js unit tests: getHistoricAlertsByAlertApiKey and createHistoricAlertFromRow', () => {
  beforeEach(() => {
    this.maxTimeAgoInMillis = 60000
    sinon.stub(helpers, 'getEnvVar').returns(this.maxTimeAgoInMillis)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    this.braveAlerter = braveAlerterConfigurator.createBraveAlerter()
  })

  afterEach(() => {
    helpers.getEnvVar.restore()
    db.getHistoricAlertsByAlertApiKey.restore()
  })

  it('if there is a single result from db.getHistoricAlertsByAlertApiKey with num_presses > 1, returns an array containing a single HistoricAlert object with the returned data and ALERT_TYPE.BUTTONS_URGENT', async () => {
    const results = {
      id: 'id',
      unit: 'unit',
      incident_type: 'incidentType',
      num_presses: 2,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
      responded_at: new Date('2020-01-20T10:12:40.000Z'),
    }
    sinon.stub(db, 'getHistoricAlertsByAlertApiKey').returns([results])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([
      new HistoricAlert(
        results.id,
        results.unit,
        results.incident_type,
        ALERT_TYPE.BUTTONS_URGENT,
        results.num_presses,
        results.created_at,
        results.responded_at,
      ),
    ])
  })

  it('if there is a single result from db.getHistoricAlertsByAlertApiKey with num_presses = 1, returns an array containing a single HistoricAlert object with the returned data and ALERT_TYPE.BUTTONS_NOT_URGENT', async () => {
    const results = {
      id: 'id',
      unit: 'unit',
      incident_type: 'incidentType',
      num_presses: 1,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
      responded_at: new Date('2020-01-20T10:12:40.000Z'),
    }
    sinon.stub(db, 'getHistoricAlertsByAlertApiKey').returns([results])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([
      new HistoricAlert(
        results.id,
        results.unit,
        results.incident_type,
        ALERT_TYPE.BUTTONS_NOT_URGENT,
        results.num_presses,
        results.created_at,
        results.responded_at,
      ),
    ])
  })

  it('if there are multiple results from db.getHistoricAlertsByAlertApiKey, returns an array containing the HistoricAlert objects with the returned data', async () => {
    const results1 = {
      id: 'id1',
      unit: 'unit1',
      incident_type: 'incidentType1',
      num_presses: 1,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
      responded_at: new Date('2020-01-20T10:12:40.000Z'),
    }
    const results2 = {
      id: 'id2',
      unit: 'unit2',
      incident_type: 'incidentType2',
      num_presses: 2,
      created_at: new Date('2019-02-20T09:10:10.000Z'),
      responded_at: new Date('2019-02-20T09:12:40.000Z'),
    }
    sinon.stub(db, 'getHistoricAlertsByAlertApiKey').returns([results1, results2])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([
      new HistoricAlert(
        results1.id,
        results1.unit,
        results1.incident_type,
        ALERT_TYPE.BUTTONS_NOT_URGENT,
        results1.num_presses,
        results1.created_at,
        results1.responded_at,
      ),
      new HistoricAlert(
        results2.id,
        results2.unit,
        results2.incident_type,
        ALERT_TYPE.BUTTONS_URGENT,
        results2.num_presses,
        results2.created_at,
        results2.responded_at,
      ),
    ])
  })

  it('if there no results from db.getHistoricAlertsByAlertApiKey, returns an empty array', async () => {
    sinon.stub(db, 'getHistoricAlertsByAlertApiKey').returns([])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([])
  })

  it('if db.getHistoricAlertsByAlertApiKey returns a non-array, returns null', async () => {
    sinon.stub(db, 'getHistoricAlertsByAlertApiKey').returns()

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.be.null
  })

  it('db.getHistoricAlertsByAlertApiKey is called with the given alertApiKey, the given maxHistoricAlerts, and the SESSION_RESET_TIMEOUT from .env', async () => {
    sinon.stub(db, 'getHistoricAlertsByAlertApiKey').returns()

    const alertApiKey = 'alertApiKey'
    const maxHistoricAlerts = 'maxHistoricAlerts'
    await this.braveAlerter.getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts)

    expect(db.getHistoricAlertsByAlertApiKey).to.be.calledWith(alertApiKey, maxHistoricAlerts, this.maxTimeAgoInMillis)
  })
})