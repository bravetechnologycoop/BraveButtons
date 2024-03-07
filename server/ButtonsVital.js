class ButtonsVital {
  constructor(id, batteryLevel, createdAt, snr, rssi, device) {
    this.id = id
    this.batteryLevel = batteryLevel
    this.createdAt = createdAt
    this.snr = snr
    this.rssi = rssi
    this.device = device
  }
}
module.exports = ButtonsVital
