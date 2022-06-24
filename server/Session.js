const { ALERT_TYPE } = require('brave-alert-lib')

class Session {
  // prettier-ignore
  constructor(id, chatbotState, alertType, numButtonPresses, createdAt, updatedAt, incidentCategory, buttonBatteryLevel, respondedAt, respondedByPhoneNumber, button) {
    this.id = id
    this.chatbotState = chatbotState
    this.alertType = alertType
    this.numButtonPresses = numButtonPresses
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentCategory = incidentCategory
    this.buttonBatteryLevel = buttonBatteryLevel
    this.respondedAt = respondedAt
    this.respondedByPhoneNumber = respondedByPhoneNumber
    this.button = button
  }

  incrementButtonPresses(numButtonPresses) {
    this.numButtonPresses += numButtonPresses
    this.alertType = ALERT_TYPE.BUTTONS_URGENT
  }

  updateBatteryLevel(buttonBatteryLevel) {
    this.buttonBatteryLevel = buttonBatteryLevel
  }
}

module.exports = Session
