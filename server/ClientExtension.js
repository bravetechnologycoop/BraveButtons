class ClientExtension {
  constructor(clientId, country, countrySubdivision, buildingType, createdAt, updatedAt) {
    this.clientId = clientId
    this.country = country
    this.countrySubdivision = countrySubdivision
    this.buildingType = buildingType
    this.createdAt = createdAt
    this.updatedAt = updatedAt
  }
}

module.exports = ClientExtension
