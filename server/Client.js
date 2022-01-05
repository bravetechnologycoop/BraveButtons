class Client {
  constructor(
    id,
    displayName,
    responderPhoneNumber,
    fallbackPhoneNumbers,
    incidentCategories,
    isActive,
    createdAt,
    alertApiKey,
    responderPushId,
    updatedAt,
  ) {
    this.id = id
    this.displayName = displayName
    this.responderPhoneNumber = responderPhoneNumber
    this.fallbackPhoneNumbers = fallbackPhoneNumbers
    this.incidentCategories = incidentCategories
    this.isActive = isActive
    this.createdAt = createdAt
    this.alertApiKey = alertApiKey
    this.responderPushId = responderPushId
    this.updatedAt = updatedAt
  }
}

module.exports = Client
