/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
*/

#include "Particle.h"
#include "rb50button.h"

#define DEBUG_LEVEL LOG_LEVEL_INFO
#define BRAVE_FIRMWARE_VERSION 3000 //see versioning notes in the readme
#define BRAVE_PRODUCT_ID 14807 //14807 = beta units, 15054 = production units

PRODUCT_ID(BRAVE_PRODUCT_ID); //you get this number off the particle console, see readme for instructions
PRODUCT_VERSION(BRAVE_FIRMWARE_VERSION); //must be an int, see versioning notes above
SYSTEM_THREAD(ENABLED);
SerialLogHandler logHandler(WARN_LEVEL);

unsigned long lastTime = 0;

void setup() {
  // enable reset reason
  System.enableFeature(FEATURE_RESET_INFO);

  // use external antenna on Boron
  BLE.selectAntenna(BleAntennaType::EXTERNAL);
  Particle.publishVitals(900);  //15 minutes
}

void loop() {

    static bool initialized = false;
      if(!initialized && Particle.connected()){ 
            setupButtons();
            initialized = true; 

      }

  if(initialized){
      checkButtonsandPublish();
  }
}