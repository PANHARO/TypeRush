#ifndef SPEED_TEST_H
#define SPEED_TEST_H

void startSpeedTest(int durationSeconds);
void updateSpeedTestTimer(double deltaSeconds);
double calculateWPM();
double calculateAccuracy();
double getSpeedTestTimeLeft();
bool isSpeedTestOver();

#endif
