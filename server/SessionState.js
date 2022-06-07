class SessionState {
  // prettier-ignore
  constructor(id, clientId, buttonId, unit, phoneNumber, state, numPresses, createdAt, updatedAt, incidentType, buttonBatteryLevel, respondedAt) {
    this.id = id
    this.clientId = clientId
    this.buttonId = buttonId
    this.unit = unit
    this.phoneNumber = phoneNumber
    this.state = state
    this.numPresses = numPresses
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentType = incidentType
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
