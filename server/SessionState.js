class SessionState {
  // prettier-ignore
  constructor(id, installationId, buttonId, unit, phoneNumber, state, numPresses, createdAt, updatedAt, incidentType, notes, fallBackAlertTwilioStatus, buttonBatteryLevel, respondedAt) {
    this.id = id
    this.installationId = installationId
    this.buttonId = buttonId
    this.unit = unit
    this.phoneNumber = phoneNumber
    this.state = state
    this.numPresses = numPresses
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentType = incidentType
    this.notes = notes
    this.fallBackAlertTwilioStatus = fallBackAlertTwilioStatus
    this.buttonBatteryLevel = buttonBatteryLevel
    this.respondedAt = respondedAt
  }

  incrementButtonPresses(numPresses) {
    this.numPresses += numPresses
  }

  updateBatteryLevel(buttonBatteryLevel) {
    this.buttonBatteryLevel = buttonBatteryLevel
  }
}

module.exports = SessionState
