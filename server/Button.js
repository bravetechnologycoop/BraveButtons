class Button {
  constructor(id, buttonId, unit, phoneNumber, createdAt, updatedAt, buttonSerialNumber, client) {
    this.id = id
    this.buttonId = buttonId
    this.unit = unit
    this.phoneNumber = phoneNumber
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.buttonSerialNumber = buttonSerialNumber
    this.client = client
  }
}
module.exports = Button
