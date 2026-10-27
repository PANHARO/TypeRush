#ifndef TYPING_ENGINE_H
#define TYPING_ENGINE_H

#include <string>
#include <vector>

using namespace std;

void loadWords(const string &filename);
void resetTyping();
string getCurrentWord();
vector<string> getUpcomingWords(int count);
void setCurrentInput(const string &input);
bool submitCurrentWord();
int getCorrectCharacters();
int getTotalCharacters();
void advanceTypingTime(double deltaSeconds);
double getTypingElapsedSeconds();

#endif
