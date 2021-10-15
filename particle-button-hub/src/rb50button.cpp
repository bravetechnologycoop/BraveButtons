#include "Particle.h"
#include "rb50button.h"
#include <queue>


unsigned char previousControlByte = 0x00;
os_queue_t bleQueue;


//**********setup()******************

void setupButtons(){

	// Create a queue. Each element is an unsigned char, there are 25 elements. Last parameter is always 0.
	os_queue_create(&bleQueue, sizeof(buttonData), 25, 0);
	// Create the thread
	new Thread("scanBLEThread", threadBLEScanner);

}

//**********loop()*******************

void checkButtonsandPublish(){
  static int initialButtonDataFlag = 1;
  static buttonData currentButtonData = {"BUTTONADDRESS", 0x00, 0};
  static buttonData previousButtonData = {"BUTTONADDRESS", 0x99, 0};

  if (os_queue_take(bleQueue, &currentButtonData, 0, 0) == 0) {

    if(initialButtonDataFlag){
      initialButtonDataFlag = 0;
      logAndPublishButtonData(currentButtonData);
      previousButtonData = currentButtonData;
    } 
    else if(currentButtonData.controlByte == (previousButtonData.controlByte+0x01)){
      logAndPublishButtonData(currentButtonData);
      previousButtonData = currentButtonData;
    }
    else if (currentButtonData.controlByte > (previousButtonData.controlByte+0x01)){
      logAndPublishButtonData(currentButtonData);
      logAndPublishButtonWarning(currentButtonData);
      previousButtonData = currentButtonData;
    }
    else if ((currentButtonData.controlByte == 0x00) && (previousButtonData.controlByte == 0xFF)){
      logAndPublishButtonData(currentButtonData);
      previousButtonData = currentButtonData;
    }
    else {
      Log.info("no new data");
    } // end publish if-else
  }//end queue if 
}

void threadBLEScanner(void *param) {
  
  const unsigned int SCAN_RESULT_MAX = 10;
  BleScanResult scanResults[SCAN_RESULT_MAX];
  buttonData scanThreadButtonData;
  unsigned char buttonAdvertisingData[BLE_MAX_ADV_DATA_LEN];
  
  //setting scan timeout (how long scan runs for) to 50ms = 5 centiseconds
  //using millis() to measure, timeout(1) = 13-14 ms. timout(5) = 53-54ms
  BLE.setScanTimeout(5);

  while(true){
    int count = BLE.scan(scanResults, SCAN_RESULT_MAX);

    //loop over all devices found in the BLE scan
    for (int i = 0; i < count; i++) {
    
      scanResults[i].advertisingData.get(BleAdvertisingDataType::MANUFACTURER_SPECIFIC_DATA, buttonAdvertisingData, BLE_MAX_ADV_DATA_LEN);

      String name = scanResults[i].advertisingData.deviceName();
      unsigned char typeID = buttonAdvertisingData[4];
      unsigned char rb50ID = 0x36;
  
      //if advertising data has device name "iSensor " and deviceType matching rb50 button, check it's control byte and add it to the queue
      if(name == "iSensor " && typeID == rb50ID){

        scanThreadButtonData.buttonAddress = scanResults[i].address.toString();;
        scanThreadButtonData.controlByte = buttonAdvertisingData[6];
        scanThreadButtonData.rssi = scanResults[i].rssi;

        os_queue_put(bleQueue, (void *)&scanThreadButtonData, 0, 0);
      }
    }
    
    os_thread_yield();
      
  }//endwhile

}

void logAndPublishButtonData(buttonData currentButtonData){

  char buttonPublishBuffer[128];

  sprintf(buttonPublishBuffer, "{ \"address\": \"%s\", \"controlByte\": \"%02X\", \"rssi\": \"%d\" }", 
          currentButtonData.buttonAddress.c_str(), currentButtonData.controlByte, currentButtonData.rssi);
  Particle.publish("RB50 Data", buttonPublishBuffer, PRIVATE);
}

void logAndPublishButtonWarning(buttonData currentButtonData){

  char buttonPublishBuffer[128];

  sprintf(buttonPublishBuffer, "{ \"address\": \"%s\", \"controlByte\": \"%02X\", \"rssi\": \"%d\" }", 
          currentButtonData.buttonAddress.c_str(), currentButtonData.controlByte, currentButtonData.rssi);
  Particle.publish("RB50 Warning", buttonPublishBuffer, PRIVATE);
}
