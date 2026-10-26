#ifndef SCORE_MANAGER_H
#define SCORE_MANAGER_H

#include <string>
#include <vector>

struct Score {
    std::string mode;
    int duration;
    double wpm;
    double accuracy;
    double survivedSeconds;
};

std::vector<Score> loadScores(const std::string &filename);
bool saveScore(const std::string &filename, const Score &score);

#endif
