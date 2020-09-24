class Heartbeat {
    constructor(systemId,flicLastSeenTime, flicLastPingTime, heartbeatLastSeenTime, systemName, hidden, sentAlerts, muted, twilioAlertNumber, heartbeatAlertRecipients) {
        this.systemId = systemId
        this.flicLastSeenTime = flicLastSeenTime
        this.flicLastPingTime = flicLastPingTime
        this.heartbeatLastSeenTime = heartbeatLastSeenTime
        this.systemName = systemName
        this.hidden = hidden
        this.sentAlerts = sentAlerts
        this.muted = muted
        this.twilioAlertNumber = twilioAlertNumber
        this.heartbeatAlertRecipients = heartbeatAlertRecipients
    }
}
module.exports = Heartbeat;
