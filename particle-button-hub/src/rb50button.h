#ifndef RB50BUTTON_H
#define RB50BUTTON_H

//************************global typedef aliases*********************************

typedef struct buttonData {
    String buttonAddress;
    unsigned char controlByte;
    int8_t rssi;

} buttonData;

void setupButtons();

void checkButtonsandPublish();
void logAndPublishButtonData(buttonData buttonData);
void logAndPublishButtonWarning(buttonData buttonData);

//threads
void threadBLEScanner(void *param);

void checkButtonsandPublish();


#endif