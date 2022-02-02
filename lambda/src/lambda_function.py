import base64
import boto3
import json
import logging
import os
import requests

FUNCTION_NAME = 'RAK-HelloWorld'

# Setup iot-data client for boto3
client = boto3.client('iot-data', endpoint_url=os.environ['IOT_DATA_CLIENT'])

BUTTONS_URL = f"https://{os.environ['DOMAIN']}/rak_button_press"
RAK_API_KEY = os.environ['RAK_API_KEY']

# Setup logger
logger = logging.getLogger(FUNCTION_NAME)
logger.setLevel(logging.INFO)

def decode(event):
  result = {
    'devEui': event.get('WirelessMetadata').get('LoRaWAN').get('DevEui'),
    'fPort': event.get('WirelessMetadata').get('LoRaWAN').get('FPort'),
    'freq': event.get('WirelessMetadata').get('LoRaWAN').get('Frequency'),
    'timestamp': event.get('WirelessMetadata').get('LoRaWAN').get('Timestamp'),
    'snr': event.get('WirelessMetadata').get('LoRaWAN').get('Gateways')[0].get('Snr'),
    'rssi': event.get('WirelessMetadata').get('LoRaWAN').get('Gateways')[0].get('Rssi'),
    'payload': event.get('PayloadData'),
  }
  return result


def lambda_handler(event, context):
  data = decode(event)

  try:
    requests.post(
      url = BUTTONS_URL, 
      data = json.dumps(data),
      headers = {
        'Content-Type':'application/json',
        'Authorization': format(RAK_API_KEY),
      },
      timeout = 3,
    )
  except requests.exceptions.ReadTimeout: 
    pass
    
  logger.info('Data: %s' % json.dumps(data))
  response = client.publish(
    topic = event.get('WirelessMetadata').get('LoRaWAN').get('DevEui') + '/project/sensor/decoded',
    qos=0,
    payload = json.dumps(data),
  )

  return response
