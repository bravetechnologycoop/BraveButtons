class Gateway {
  constructor(id, displayName, isActive, createdAt, updatedAt, client) {
    this.id = id
    this.displayName = displayName
    this.isActive = isActive
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.client = client
  }
}

module.exports = Gateway