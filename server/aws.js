// Third-party dependencies
const { IoTWirelessClient, GetWirelessGatewayStatisticsCommand } = require('@aws-sdk/client-iot-wireless')
const { helpers } = require('brave-alert-lib')

const iotWirelessClient = new IoTWirelessClient({ region: helpers.getEnvVar('AWS_REGION') })

async function getGatewayStats(gatewayId) {
  try {
    const stats = await iotWirelessClient.send(
      new GetWirelessGatewayStatisticsCommand({
        WirelessGatewayId: gatewayId,
      }),
    )

    return new Date(stats.LastUplinkReceivedAt)
  } catch (e) {
    helpers.log(`Error getting gateways vitals for "${gatewayId}": ${e}`)
  }

  return null
}

module.exports = {
  getGatewayStats,
}
