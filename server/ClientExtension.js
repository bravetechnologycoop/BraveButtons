class ClientExtension {
  constructor(clientId, country, countrySubdivision, buildingType, createdAt, updatedAt, organization, funder, postalCode, city, project) {
    this.clientId = clientId
    this.country = country
    this.countrySubdivision = countrySubdivision
    this.buildingType = buildingType
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.organization = organization
    this.funder = funder
    this.postalCode = postalCode
    this.city = city
    this.project = project
  }
}

module.exports = ClientExtension
