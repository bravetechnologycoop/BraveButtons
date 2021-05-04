class Installation {
  constructor(id, name, responderPhoneNumber, fallbackPhoneNumbers, incidentCategories, isActive, createdAt, alertApiKey) {
    this.id = id
    this.name = name
    this.responderPhoneNumber = responderPhoneNumber
    this.fallbackPhoneNumbers = fallbackPhoneNumbers
    this.incidentCategories = incidentCategories
    this.isActive = isActive
    this.createdAt = createdAt
    this.alertApiKey = alertApiKey
  }
}

module.exports = Installation
