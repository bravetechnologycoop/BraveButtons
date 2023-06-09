class ButtonsVital {
  constructor(id, batteryLevel, createdAt, snr, rssi, button) {
    this.id = id
    this.batteryLevel = batteryLevel
    this.createdAt = createdAt
    this.snr = snr
    this.rssi = rssi
    this.button = button
  }
}
module.exports = ButtonsVital
