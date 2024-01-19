const { ALERT_TYPE } = require('brave-alert-lib')

class Session {
  // prettier-ignore
  constructor(id, chatbotState, alertType, numberOfAlerts, createdAt, updatedAt, incidentCategory, respondedAt, respondedByPhoneNumber, button) {
    this.id = id
    this.chatbotState = chatbotState
    this.alertType = alertType
    this.numberOfAlerts = numberOfAlerts
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentCategory = incidentCategory
    this.respondedAt = respondedAt
    this.respondedByPhoneNumber = respondedByPhoneNumber
    this.button = button
  }

  incrementButtonPresses(numberOfAlerts) {
    this.numberOfAlerts += numberOfAlerts
    this.alertType = ALERT_TYPE.BUTTONS_URGENT
  }
}

module.exports = Session
