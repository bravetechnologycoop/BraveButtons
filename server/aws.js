// Third-party dependencies
const {
  AssociateWirelessDeviceWithThingCommand,
  CreateWirelessDeviceCommand,
  DeleteWirelessDeviceCommand,
  GetWirelessGatewayStatisticsCommand,
  IoTWirelessClient,
  WirelessDeviceType,
} = require('@aws-sdk/client-iot-wireless')
const { IoTClient, CreateThingCommand, DeleteThingCommand } = require('@aws-sdk/client-iot')
const { v4: uuidv4 } = require('uuid')

// In-house dependencies
const { helpers } = require('brave-alert-lib')

const iotWirelessClient = new IoTWirelessClient({ region: helpers.getEnvVar('AWS_REGION') })
const iotClient = new IoTClient({ region: helpers.getEnvVar('AWS_REGION') })
const awsAppEui = 'AC1F09FFF9157201'

async function getGatewayStats(gatewayId) {
  try {
    const stats = await iotWirelessClient.send(
      new GetWirelessGatewayStatisticsCommand({
        WirelessGatewayId: gatewayId,
      }),
    )

    return stats.LastUplinkReceivedAt !== undefined ? new Date(stats.LastUplinkReceivedAt) : null
  } catch (e) {
    helpers.log(`Error getting gateways vitals for "${gatewayId}": ${e}`)
  }

  return null
}

async function createThing() {
  try {
    const createThingResponse = await iotClient.send(
      new CreateThingCommand({
        thingName: uuidv4(),
      }),
    )

    return createThingResponse
  } catch (e) {
    helpers.log(`Error creating an AWS Thing: ${e}`)
    throw e
  }
}

async function deleteThing(thingName) {
  try {
    const deleteThingResponse = await iotClient.send(
      new DeleteThingCommand({
        thingName,
      }),
    )

    return deleteThingResponse.thingArn
  } catch (e) {
    helpers.log(`Error deleting the AWS Thing ${thingName}: ${e}`)
  }

  return null
}

async function createDevice(name, eui) {
  try {
    const createThingResponse = await iotWirelessClient.send(
      new CreateWirelessDeviceCommand({
        Type: WirelessDeviceType.LoRaWAN,
        DestinationName: 'ProcessLoRa',
        Name: `${name} ${eui}`,
        LoRaWAN: {
          DevEui: eui,
          OtaaV1_0_x: {
            AppEui: awsAppEui,
            AppKey: `${eui}${awsAppEui}`,
          },
          ServiceProfileId: helpers.getEnvVar('AWS_SERVICE_PROFILE_ID'),
          DeviceProfileId: helpers.getEnvVar('AWS_DEVICE_PROFILE_ID'),
        },
      }),
    )

    return createThingResponse.Id
  } catch (e) {
    helpers.log(`Error creating an Device: ${e}`)

    throw e
  }
}

async function deleteDevice(id) {
  try {
    await iotWirelessClient.send(
      new DeleteWirelessDeviceCommand({
        Id: id,
      }),
    )
  } catch (e) {
    helpers.log(`Error deleting Device ${id}: ${e}`)
  }

  return null
}

async function associateDeviceWithThing(deviceId, thingArn) {
  try {
    await iotWirelessClient.send(
      new AssociateWirelessDeviceWithThingCommand({
        Id: deviceId,
        ThingArn: thingArn,
      }),
    )
  } catch (e) {
    helpers.log(`Error in associating device ${deviceId} with thing ${thingArn}: ${e}`)

    throw e
  }

  return null
}

module.exports = {
  associateDeviceWithThing,
  createDevice,
  createThing,
  deleteDevice,
  deleteThing,
  getGatewayStats,
}
