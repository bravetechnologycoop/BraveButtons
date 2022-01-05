class Button {
  constructor(id, buttonId, unit, phoneNumber, createdAt, updatedAt, buttonSerialNumber, installation) {
    this.id = id
    this.buttonId = buttonId
    this.unit = unit
    this.phoneNumber = phoneNumber
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.buttonSerialNumber = buttonSerialNumber
    this.installation = installation
  }
}
module.exports = Button
