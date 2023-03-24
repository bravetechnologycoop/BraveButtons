class Button {
  constructor(
    id,
    displayName,
    phoneNumber,
    createdAt,
    updatedAt,
    buttonSerialNumber,
    isDisplayed,
    isSendingAlerts,
    isSendingVitals,
    sentLowBatteryAlertAt,
    sentVitalsAlertAt,
    client,
  ) {
    this.id = id
    this.displayName = displayName
    this.phoneNumber = phoneNumber
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.buttonSerialNumber = buttonSerialNumber
    this.isDisplayed = isDisplayed
    this.isSendingAlerts = isSendingAlerts
    this.isSendingVitals = isSendingVitals
    this.sentLowBatteryAlertAt = sentLowBatteryAlertAt
    this.sentVitalsAlertAt = sentVitalsAlertAt
    this.client = client
  }
}
module.exports = Button
