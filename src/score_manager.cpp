#include "score_manager.h"
#include <fstream>
#include <algorithm>
#include <iomanip>

using namespace std;

vector<Score> loadScores(const string &filename)
{
    vector<Score> scores;
    ifstream file(filename);
    Score score;
    while (file >> score.mode >> score.duration >> score.wpm
                >> score.accuracy >> score.survivedSeconds) {
        if ((score.mode == "Speed" || score.mode == "Survival") &&
            score.wpm >= 0.0 && score.accuracy >= 0.0 && score.accuracy <= 100.0)
            scores.push_back(score);
    }
    return scores;
}

bool saveScore(const string &filename, const Score &score)
{
    vector<Score> scores = loadScores(filename);
    scores.push_back(score);
    sort(scores.begin(), scores.end(), [](const Score &a, const Score &b) {
        if (a.mode != b.mode)
            return a.mode < b.mode;
        if (a.mode == "Survival")
            return a.survivedSeconds > b.survivedSeconds;
        if (a.duration != b.duration)
            return a.duration < b.duration;
        return a.wpm > b.wpm;
    });

    ofstream file(filename);
    if (!file)
        return false;
    file << fixed << setprecision(2);
    string previousMode;
    int previousDuration = -1;
    int count = 0;
    for (const Score &entry : scores) {
        int groupDuration = entry.mode == "Speed" ? entry.duration : 0;
        if (entry.mode != previousMode || groupDuration != previousDuration) {
            count = 0;
            previousMode = entry.mode;
            previousDuration = groupDuration;
        }
        if (++count <= 10) {
            file << entry.mode << ' ' << entry.duration << ' ' << entry.wpm << ' '
                 << entry.accuracy << ' ' << entry.survivedSeconds << '\n';
        }
    }
    return static_cast<bool>(file);
}
