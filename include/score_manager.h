#ifndef SCORE_MANAGER_H
#define SCORE_MANAGER_H

#include <string>
#include <vector>

using namespace std;

struct Score {
    string mode;
    int duration;
    double wpm;
    double accuracy;
    double survivedSeconds;
};

vector<Score> loadScores(const string &filename);
bool saveScore(const string &filename, const Score &score);

#endif
