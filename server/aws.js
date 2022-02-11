// Third-party dependencies
const { IoTWirelessClient, GetWirelessGatewayStatisticsCommand } = require('@aws-sdk/client-iot-wireless')
const { helpers } = require('brave-alert-lib')

// In-house dependencies
const db = require('./db/db')

const iotWirelessClient = new IoTWirelessClient({ region: helpers.getEnvVar('AWS_REGION') })

async function getGatewayVitalsWithClientId(clientId) {
  const gatewayVitals = []

  try {
    const gateways = await db.getGatewaysWithClientId(clientId)
    for (let i = 0; i < gateways.length; i += 1) {
      const stats = await iotWirelessClient.send(
        new GetWirelessGatewayStatisticsCommand({
          WirelessGatewayId: gateways[i].id,
        }),
      )

      gatewayVitals.push({
        gateway: gateways[i],
        lastSeenAt: stats.LastUplinkReceivedAt,
      })
    }
  } catch (e) {
    helpers.logError(`Error getting gateways vitals: ${e}`)
  }

  return gatewayVitals
}

module.exports = {
  getGatewayVitalsWithClientId,
}
