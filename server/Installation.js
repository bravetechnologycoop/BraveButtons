class Installation {
  constructor(
    id,
    name,
    responderPhoneNumber,
    fallbackPhoneNumber,
    incidentCategories,
    isActive,
    createdAt
  ) {
    this.id = id
    this.name = name
    this.responderPhoneNumber = responderPhoneNumber
    this.fallbackPhoneNumber = fallbackPhoneNumber
    this.incidentCategories = incidentCategories
    this.isActive = isActive
    this.createdAt = createdAt
  }
}

module.exports = Installation
