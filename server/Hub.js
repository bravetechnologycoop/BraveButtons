class Hub {
  constructor(
    systemId,
    flicLastSeenTime,
    flicLastPingTime,
    heartbeatLastSeenTime,
    systemName,
    hidden,
    sentVitalsAlertAt,
    muted,
    sentInternalFlicAlert,
    sentInternalPingAlert,
    sentInternalPiAlert,
    locationDescription,
    client,
  ) {
    this.systemId = systemId
    this.flicLastSeenTime = flicLastSeenTime
    this.flicLastPingTime = flicLastPingTime
    this.heartbeatLastSeenTime = heartbeatLastSeenTime
    this.systemName = systemName
    this.hidden = hidden
    this.sentVitalsAlertAt = sentVitalsAlertAt
    this.muted = muted
    this.sentInternalFlicAlert = sentInternalFlicAlert
    this.sentInternalPingAlert = sentInternalPingAlert
    this.sentInternalPiAlert = sentInternalPiAlert
    this.locationDescription = locationDescription
    this.client = client
  }
}

module.exports = Hub
