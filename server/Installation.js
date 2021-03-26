class Installation {
  constructor(id, name, responderPhoneNumber, fallbackPhoneNumbers, incidentCategories, isActive, createdAt) {
    this.id = id
    this.name = name
    this.responderPhoneNumber = responderPhoneNumber
    this.fallbackPhoneNumbers = fallbackPhoneNumbers
    this.incidentCategories = incidentCategories
    this.isActive = isActive
    this.createdAt = createdAt
  }
}

module.exports = Installation
