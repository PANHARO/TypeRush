#ifndef TYPING_ENGINE_H
#define TYPING_ENGINE_H

#include <string>
#include <vector>

void loadWords(const std::string &filename);
void resetTyping();
std::string getCurrentWord();
std::vector<std::string> getUpcomingWords(int count);
void setCurrentInput(const std::string &input);
bool submitCurrentWord();
int getCorrectCharacters();
int getTotalCharacters();
void advanceTypingTime(double deltaSeconds);
double getTypingElapsedSeconds();

#endif
