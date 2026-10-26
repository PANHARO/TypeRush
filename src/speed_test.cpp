#include "speed_test.h"
#include "typing_engine.h"
#include <algorithm>

namespace {
double timeLeft = 0.0;
}

void startSpeedTest(int durationSeconds)
{
    resetTyping();
    timeLeft = std::max(0, durationSeconds);
}

void updateSpeedTestTimer(double deltaSeconds)
{
    if (deltaSeconds <= 0.0 || isSpeedTestOver())
        return;
    double elapsed = std::min(deltaSeconds, timeLeft);
    timeLeft = std::max(0.0, timeLeft - elapsed);
    advanceTypingTime(elapsed);
}

double calculateWPM()
{
    double elapsed = getTypingElapsedSeconds();
    if (elapsed <= 0.0)
        return 0.0;
    // A standard typing word is five characters, including spaces.
    return (getCorrectCharacters() / 5.0) / (elapsed / 60.0);
}

double calculateAccuracy()
{
    if (getTotalCharacters() == 0)
        return 100.0;
    return 100.0 * getCorrectCharacters() / getTotalCharacters();
}

double getSpeedTestTimeLeft()
{
    return timeLeft;
}

bool isSpeedTestOver()
{
    return timeLeft <= 0.0;
}
