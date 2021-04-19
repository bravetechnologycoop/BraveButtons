class Installation {
  constructor(id, name, responderPhoneNumber, fallbackPhoneNumbers, incidentCategories, isActive, createdAt, apiKey) {
    this.id = id
    this.name = name
    this.responderPhoneNumber = responderPhoneNumber
    this.fallbackPhoneNumbers = fallbackPhoneNumbers
    this.incidentCategories = incidentCategories
    this.isActive = isActive
    this.createdAt = createdAt
    this.apiKey = apiKey
  }
}

module.exports = Installation
