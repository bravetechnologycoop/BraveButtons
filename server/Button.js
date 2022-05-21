class Button {
  constructor(id, buttonId, displayName, phoneNumber, createdAt, updatedAt, buttonSerialNumber, client) {
    this.id = id
    this.buttonId = buttonId
    this.displayName = displayName
    this.phoneNumber = phoneNumber
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.buttonSerialNumber = buttonSerialNumber
    this.client = client
  }
}
module.exports = Button
