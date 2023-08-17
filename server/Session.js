const { ALERT_TYPE } = require('brave-alert-lib')

class Session {
  // prettier-ignore
  constructor(id, chatbotState, alertType, numButtonPresses, createdAt, updatedAt, incidentCategory, respondedAt, respondedByPhoneNumber, button) {
    this.id = id
    this.chatbotState = chatbotState
    this.alertType = alertType
    this.numButtonPresses = numButtonPresses
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentCategory = incidentCategory
    this.respondedAt = respondedAt
    this.respondedByPhoneNumber = respondedByPhoneNumber
    this.button = button
  }

  incrementButtonPresses(numButtonPresses) {
    this.numButtonPresses += numButtonPresses
    this.alertType = ALERT_TYPE.BUTTONS_URGENT
  }
}

module.exports = Session
