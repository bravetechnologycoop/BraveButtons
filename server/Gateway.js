class Gateway {
  constructor(id, displayName, isDisplayed, isSendingVitals, createdAt, updatedAt, sentVitalsAlertAt, client) {
    this.id = id
    this.displayName = displayName
    this.isDisplayed = isDisplayed
    this.isSendingVitals = isSendingVitals
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.sentVitalsAlertAt = sentVitalsAlertAt
    this.client = client
  }
}

module.exports = Gateway
