// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const { helpers, HistoricAlert, ALERT_TYPE } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('BraveAlerterConfigurator.js unit tests: getHistoricAlertsByAlertApiKey and createHistoricAlertFromRow', () => {
  beforeEach(() => {
    this.maxTimeAgoInMillis = 60000
    sandbox.stub(helpers, 'getEnvVar').returns(this.maxTimeAgoInMillis)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    this.braveAlerter = braveAlerterConfigurator.createBraveAlerter()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('if there is a single result from db.getHistoricAlertsByAlertApiKey with num_button_presses > 1, returns an array containing a single HistoricAlert object with the returned data and ALERT_TYPE.BUTTONS_URGENT', async () => {
    const results = {
      id: 'id',
      alert_type: ALERT_TYPE.BUTTONS_URGENT,
      display_name: 'unit',
      incident_category: 'incidentCategory',
      num_button_presses: 2,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
      responded_at: new Date('2020-01-20T10:12:40.000Z'),
    }
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns([results])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([
      new HistoricAlert(
        results.id,
        results.display_name,
        results.incident_category,
        ALERT_TYPE.BUTTONS_URGENT,
        results.num_button_presses,
        results.created_at,
        results.responded_at,
      ),
    ])
  })

  it('if there is a single result from db.getHistoricAlertsByAlertApiKey with num_button_presses = 1, returns an array containing a single HistoricAlert object with the returned data and ALERT_TYPE.BUTTONS_NOT_URGENT', async () => {
    const results = {
      id: 'id',
      alert_type: ALERT_TYPE.BUTTONS_NOT_URGENT,
      display_name: 'unit',
      incident_category: 'incidentCategory',
      num_button_presses: 1,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
      responded_at: new Date('2020-01-20T10:12:40.000Z'),
    }
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns([results])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([
      new HistoricAlert(
        results.id,
        results.display_name,
        results.incident_category,
        ALERT_TYPE.BUTTONS_NOT_URGENT,
        results.num_button_presses,
        results.created_at,
        results.responded_at,
      ),
    ])
  })

  it('if there are multiple results from db.getHistoricAlertsByAlertApiKey, returns an array containing the HistoricAlert objects with the returned data', async () => {
    const results1 = {
      id: 'id1',
      alert_type: ALERT_TYPE.BUTTONS_NOT_URGENT,
      display_name: 'unit1',
      incident_category: 'incidentType1',
      num_button_presses: 1,
      created_at: new Date('2020-01-20T10:10:10.000Z'),
      responded_at: new Date('2020-01-20T10:12:40.000Z'),
    }
    const results2 = {
      id: 'id2',
      alert_type: ALERT_TYPE.BUTTONS_URGENT,
      display_name: 'unit2',
      incident_category: 'incidentType2',
      num_button_presses: 2,
      created_at: new Date('2019-02-20T09:10:10.000Z'),
      responded_at: new Date('2019-02-20T09:12:40.000Z'),
    }
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns([results1, results2])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([
      new HistoricAlert(
        results1.id,
        results1.display_name,
        results1.incident_category,
        ALERT_TYPE.BUTTONS_NOT_URGENT,
        results1.num_button_presses,
        results1.created_at,
        results1.responded_at,
      ),
      new HistoricAlert(
        results2.id,
        results2.display_name,
        results2.incident_category,
        ALERT_TYPE.BUTTONS_URGENT,
        results2.num_button_presses,
        results2.created_at,
        results2.responded_at,
      ),
    ])
  })

  it('if there no results from db.getHistoricAlertsByAlertApiKey, returns an empty array', async () => {
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns([])

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.eql([])
  })

  it('if db.getHistoricAlertsByAlertApiKey returns a non-array, returns null', async () => {
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey').returns()

    const historicAlerts = await this.braveAlerter.getHistoricAlertsByAlertApiKey('alertApiKey', 'maxHistoricAlerts')

    expect(historicAlerts).to.be.null
  })

  it('db.getHistoricAlertsByAlertApiKey is called with the given alertApiKey, the given maxHistoricAlerts, and the SESSION_RESET_TIMEOUT from .env', async () => {
    sandbox.stub(db, 'getHistoricAlertsByAlertApiKey')

    const alertApiKey = 'alertApiKey'
    const maxHistoricAlerts = 'maxHistoricAlerts'
    await this.braveAlerter.getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts)

    expect(db.getHistoricAlertsByAlertApiKey).to.be.calledWith(alertApiKey, maxHistoricAlerts, this.maxTimeAgoInMillis)
  })
})
