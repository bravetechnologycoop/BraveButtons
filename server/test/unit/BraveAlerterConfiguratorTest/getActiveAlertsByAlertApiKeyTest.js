// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

const { helpers, ActiveAlert, ALERT_TYPE, CHATBOT_STATE } = require('brave-alert-lib')
const db = require('../../../db/db')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('BraveAlerterConfigurator.js unit tests: getActiveAlertsByAlertApiKey and createActiveAlertFromRow', () => {
  beforeEach(() => {
    this.maxTimeAgoInMillis = 60000
    sandbox.stub(helpers, 'getEnvVar').returns(this.maxTimeAgoInMillis)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    this.braveAlerter = braveAlerterConfigurator.createBraveAlerter()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('if there is a single result from db.getActiveAlertsByAlertApiKey with num_button_presses > 1, returns an array containing a single ActiveAlert object with the returned data and ALERT_TYPE.BUTTONS_URGENT', async () => {
    const results = {
      id: 'id',
      chatbot_state: CHATBOT_STATE.STARTED,
      alert_type: ALERT_TYPE.BUTTONS_URGENT,
      display_name: 'unit',
      num_button_presses: 2,
      incident_categories: ['Cat1', 'Cat2'],
      created_at: new Date(),
    }
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns([results])

    const activeAlerts = await this.braveAlerter.getActiveAlertsByAlertApiKey('alertApiKey')

    expect(activeAlerts).to.eql([
      new ActiveAlert(
        results.id,
        results.chatbot_state,
        results.display_name,
        ALERT_TYPE.BUTTONS_URGENT,
        results.incident_categories,
        results.created_at,
      ),
    ])
  })

  it('if there is a single result from db.getActiveAlertsByAlertApiKey with num_button_presses = 1, returns an array containing a single ActiveAlert object with the returned data and ALERT_TYPE.BUTTONS_NOT_URGENT', async () => {
    const results = {
      id: 'id',
      chatbot_state: CHATBOT_STATE.STARTED,
      alert_type: ALERT_TYPE.BUTTONS_NOT_URGENT,
      display_name: 'unit',
      num_button_presses: 1,
      incident_categories: ['Cat1', 'Cat2'],
      created_at: new Date(),
    }
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns([results])

    const activeAlerts = await this.braveAlerter.getActiveAlertsByAlertApiKey('alertApiKey')

    expect(activeAlerts).to.eql([
      new ActiveAlert(
        results.id,
        results.chatbot_state,
        results.display_name,
        ALERT_TYPE.BUTTONS_NOT_URGENT,
        results.incident_categories,
        results.created_at,
      ),
    ])
  })

  it('if there is a multiple results from db.getActiveAlertsByAlertApiKey, returns an array containing the ActiveAlert objects with the returned data', async () => {
    const results1 = {
      id: 'id1',
      chatbot_state: CHATBOT_STATE.STARTED,
      alert_type: ALERT_TYPE.BUTTONS_NOT_URGENT,
      display_name: 'unit1',
      num_button_presses: 1,
      incident_categories: ['Cat1', 'Cat2'],
      created_at: new Date(),
    }
    const results2 = {
      id: 'id2',
      chatbot_state: CHATBOT_STATE.STARTED,
      alert_type: ALERT_TYPE.BUTTONS_URGENT,
      display_name: 'unit2',
      num_button_presses: 2,
      incident_categories: ['Cat1', 'Cat2'],
      created_at: new Date(),
    }
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns([results1, results2])

    const activeAlerts = await this.braveAlerter.getActiveAlertsByAlertApiKey('alertApiKey')

    expect(activeAlerts).to.eql([
      new ActiveAlert(
        results1.id,
        results1.chatbot_state,
        results1.display_name,
        ALERT_TYPE.BUTTONS_NOT_URGENT,
        results1.incident_categories,
        results1.created_at,
      ),
      new ActiveAlert(
        results2.id,
        results2.chatbot_state,
        results2.display_name,
        ALERT_TYPE.BUTTONS_URGENT,
        results2.incident_categories,
        results2.created_at,
      ),
    ])
  })

  it('if there no results from db.getActiveAlertsByAlertApiKey, returns an empty array', async () => {
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns([])

    const activeAlerts = await this.braveAlerter.getActiveAlertsByAlertApiKey('alertApiKey')

    expect(activeAlerts).to.eql([])
  })

  it('if db.getActiveAlertsByAlertApiKey returns a non-array, returns null', async () => {
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey').returns()

    const activeAlerts = await this.braveAlerter.getActiveAlertsByAlertApiKey('alertApiKey')

    expect(activeAlerts).to.be.null
  })

  it('db.getActiveAlertsByAlertApiKey is called with the given alertApiKey and the SESSION_RESET_TIMEOUT from .env', async () => {
    sandbox.stub(db, 'getActiveAlertsByAlertApiKey')

    const alertApiKey = 'alertApiKey'
    await this.braveAlerter.getActiveAlertsByAlertApiKey(alertApiKey)

    expect(db.getActiveAlertsByAlertApiKey).to.be.calledWith(alertApiKey, this.maxTimeAgoInMillis)
  })
})
