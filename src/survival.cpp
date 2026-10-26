#include "survival.h"
#include "typing_engine.h"
#include <algorithm>

namespace {
double timeLeft = 0.0;
}

void startSurvival()
{
    resetTyping();
    timeLeft = 15.0;
}

void applySurvivalResult(bool correct)
{
    if (isSurvivalGameOver())
        return;
    // Correct words add two seconds. Mistakes cost one second.
    timeLeft += correct ? 2.0 : -1.0;
    timeLeft = std::clamp(timeLeft, 0.0, 30.0);
}

void updateSurvivalTimer(double deltaSeconds)
{
    if (deltaSeconds <= 0.0 || isSurvivalGameOver())
        return;
    double elapsed = std::min(deltaSeconds, timeLeft);
    timeLeft = std::max(0.0, timeLeft - elapsed);
    advanceTypingTime(elapsed);
}

bool isSurvivalGameOver()
{
    return timeLeft <= 0.0;
}

double getSurvivalTimeLeft()
{
    return timeLeft;
}
