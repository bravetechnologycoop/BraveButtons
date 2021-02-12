class Hub {
  constructor(systemId, flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime, systemName, hidden, sentAlerts, muted, heartbeatAlertRecipients) {
    this.systemId = systemId
    this.flicLastSeenTime = flicLastSeenTime
    this.flicLastPingTime = flicLastPingTime
    this.heartbeatLastSeenTime = heartbeatLastSeenTime
    this.systemName = systemName
    this.hidden = hidden
    this.sentAlerts = sentAlerts
    this.muted = muted
    this.heartbeatAlertRecipients = heartbeatAlertRecipients
  }
}
module.exports = Hub
