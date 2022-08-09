class Button {
  constructor(id, displayName, phoneNumber, createdAt, updatedAt, buttonSerialNumber, isActive, sentLowBatteryAlertAt, sentVitalsAlertAt, client) {
    this.id = id
    this.displayName = displayName
    this.phoneNumber = phoneNumber
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.buttonSerialNumber = buttonSerialNumber
    this.isActive = isActive
    this.sentLowBatteryAlertAt = sentLowBatteryAlertAt
    this.sentVitalsAlertAt = sentVitalsAlertAt
    this.client = client
  }
}
module.exports = Button
