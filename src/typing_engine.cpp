#include "typing_engine.h"
#include <fstream>
#include <random>
#include <algorithm>

namespace {
std::vector<std::string> words;
std::string currentInput;
int wordIndex = 0;
int correctCharacters = 0;
int totalCharacters = 0;
double elapsedSeconds = 0.0;

int countMatches(const std::string &input, const std::string &target)
{
    int matches = 0;
    for (std::size_t i = 0; i < input.size() && i < target.size(); ++i) {
        if (input[i] == target[i])
            ++matches;
    }
    return matches;
}
}

void loadWords(const std::string &filename)
{
    words.clear();
    std::ifstream file(filename);
    std::string word;
    while (file >> word)
        words.push_back(word);

    if (words.empty()) {
        words = {"the", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog",
                 "learn", "code", "bright", "play", "time", "simple", "happy", "world"};
    }
}

void resetTyping()
{
    if (words.empty())
        loadWords("");
    // A different order makes each new round useful practice.
    static std::mt19937 generator(std::random_device{}());
    std::shuffle(words.begin(), words.end(), generator);
    wordIndex = 0;
    currentInput.clear();
    correctCharacters = 0;
    totalCharacters = 0;
    elapsedSeconds = 0.0;
}

std::string getCurrentWord()
{
    return words.empty() ? "" : words[wordIndex];
}

std::vector<std::string> getUpcomingWords(int count)
{
    std::vector<std::string> upcoming;
    if (words.empty())
        return upcoming;
    for (int i = 0; i < count; ++i)
        upcoming.push_back(words[(wordIndex + i) % words.size()]);
    return upcoming;
}

void setCurrentInput(const std::string &input)
{
    currentInput = input;
}

bool submitCurrentWord()
{
    if (words.empty())
        return false;
    bool correct = currentInput == getCurrentWord();
    correctCharacters += countMatches(currentInput, getCurrentWord());
    totalCharacters += static_cast<int>(currentInput.size()) + 1;
    // Count the separating space only when the entire word was correct.
    if (correct)
        ++correctCharacters;
    currentInput.clear();
    wordIndex = (wordIndex + 1) % static_cast<int>(words.size());
    return correct;
}

int getCorrectCharacters()
{
    return correctCharacters + countMatches(currentInput, getCurrentWord());
}

int getTotalCharacters()
{
    return totalCharacters + static_cast<int>(currentInput.size());
}

void advanceTypingTime(double deltaSeconds)
{
    if (deltaSeconds > 0.0)
        elapsedSeconds += deltaSeconds;
}

double getTypingElapsedSeconds()
{
    return elapsedSeconds;
}
