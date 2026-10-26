#ifndef SURVIVAL_H
#define SURVIVAL_H

void startSurvival();
void applySurvivalResult(bool correct);
void updateSurvivalTimer(double deltaSeconds);
bool isSurvivalGameOver();
double getSurvivalTimeLeft();

#endif
