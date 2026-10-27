#include "mainwindow.h"
#include "ui_mainwindow.h"
#include "typing_engine.h"
#include "speed_test.h"
#include "survival.h"
#include "score_manager.h"

#include <QTimer>
#include <QButtonGroup>
#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>
#include <QStyle>
#include <QDialog>
#include <QDialogButtonBox>
#include <QVBoxLayout>
#include <QLabel>
#include <QCheckBox>
#include <QTableWidget>
#include <QHeaderView>
#include <QAbstractItemView>
#include <cmath>

using namespace std;

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent), ui(new Ui::MainWindow), timer(new QTimer(this))
{
    ui->setupUi(this);

    QString assetsPath = QCoreApplication::applicationDirPath() + "/assets/words.txt";
    if (!QFileInfo::exists(assetsPath))
        assetsPath = QStringLiteral(TYPERUSH_PROJECT_DIR) + "/assets/words.txt";
    loadWords(assetsPath.toStdString());

    QString dataPath = QCoreApplication::applicationDirPath() + "/data";
    QDir().mkpath(dataPath);
    scoresPath = dataPath + "/scores.txt";

    auto *modeGroup = new QButtonGroup(this);
    modeGroup->addButton(ui->speedButton);
    modeGroup->addButton(ui->survivalButton);

    auto *durationGroup = new QButtonGroup(this);
    QPushButton *buttons[] = {ui->duration15, ui->duration30,
                             ui->duration60, ui->duration120};
    int durations[] = {15, 30, 60, 120};
    for (int i = 0; i < 4; ++i) {
        durationGroup->addButton(buttons[i]);
        int seconds = durations[i];
        connect(buttons[i], &QPushButton::clicked, this, [this, seconds]() {
            duration = seconds;
            prepareGame(false);
        });
    }

    connect(ui->speedButton, &QPushButton::clicked, this, [this]() { prepareGame(false); });
    connect(ui->survivalButton, &QPushButton::clicked, this, [this]() { prepareGame(true); });
    connect(ui->restartButton, &QPushButton::clicked, this, [this]() { prepareGame(survivalMode); });
    connect(ui->switchModeButton, &QPushButton::clicked, this, [this]() { prepareGame(!survivalMode); });
    connect(ui->scoresButton, &QPushButton::clicked, this, &MainWindow::showHighScores);
    connect(ui->settingsButton, &QPushButton::clicked, this, &MainWindow::showSettings);
    connect(ui->typingInput, &QLineEdit::textEdited, this, &MainWindow::handleInput);
    connect(ui->typingInput, &QLineEdit::returnPressed, this, [this]() {
        handleInput(ui->typingInput->text() + ' ');
    });
    connect(timer, &QTimer::timeout, this, &MainWindow::updateTimer);
    timer->setInterval(100);
    prepareGame(false);
}

MainWindow::~MainWindow()
{
    delete ui;
}

void MainWindow::prepareGame(bool survival)
{
    timer->stop();
    survivalMode = survival;
    running = false;
    finished = false;
    completedWords.clear();
    if (survivalMode)
        startSurvival();
    else
        startSpeedTest(duration);

    ui->speedButton->setChecked(!survivalMode);
    ui->survivalButton->setChecked(survivalMode);
    ui->durationPanel->setVisible(!survivalMode);
    ui->switchModeButton->setText(survivalMode ? "\u25b6  Speed Test" : "\u25b6  Survival Mode");
    ui->typingInput->clear();
    ui->typingInput->setEnabled(true);
    ui->typingInput->setPlaceholderText("Type here...");
    ui->statusLabel->setText(survivalMode
        ? "Start typing to begin. Correct word: +2s | Mistake: -1s | Maximum: 30s."
        : "Start typing to begin. Press Space or Enter to submit a word.");
    ui->typingInput->setFocus();
    updateDisplay();
    updateWordDisplay();
}

void MainWindow::handleInput(const QString &text)
{
    if (finished)
        return;

    // Update time first so a late keystroke cannot extend an expired game.
    if (running) {
        updateTimer();
        if (finished)
            return;
    }

    if (!running && !text.trimmed().isEmpty()) {
        running = true;
        clock.start();
        timer->start();
    }

    QString remaining = text;
    int space = remaining.indexOf(' ');
    while (space >= 0) {
        QString word = remaining.left(space);
        remaining.remove(0, space + 1);
        if (!word.isEmpty()) {
            QString expected = QString::fromStdString(getCurrentWord());
            setCurrentInput(word.toStdString());
            bool correct = submitCurrentWord();
            QString style = correct ? "color:#ffd600" : "color:#aaaaaa;text-decoration:line-through";
            completedWords.append("<span style='" + style + "'>" + expected.toHtmlEscaped() + "</span>");
            if (completedWords.size() > 3)
                completedWords.removeFirst();

            if (survivalMode) {
                applySurvivalResult(correct);
                ui->statusLabel->setText(correct ? "Correct! +2 seconds. Keep going!"
                                                        : "Mistake! -1 second. Try the next word.");
                if (isSurvivalGameOver()) {
                    ui->typingInput->clear();
                    finishGame();
                    return;
                }
            } else {
                ui->statusLabel->setText(correct ? "Correct! Keep your rhythm."
                                                        : "Word submitted with a mistake. Keep practicing!");
            }
        }
        space = remaining.indexOf(' ');
    }

    if (remaining != ui->typingInput->text()) {
        ui->typingInput->setText(remaining);
    }
    setCurrentInput(remaining.toStdString());
    updateDisplay();
    updateWordDisplay();
}

void MainWindow::updateTimer()
{
    if (!running)
        return;
    double deltaSeconds = clock.nsecsElapsed() / 1000000000.0;
    clock.restart();
    if (survivalMode)
        updateSurvivalTimer(deltaSeconds);
    else
        updateSpeedTestTimer(deltaSeconds);

    if (survivalMode ? isSurvivalGameOver() : isSpeedTestOver())
        finishGame();
    else
        updateDisplay();
}

void MainWindow::updateDisplay()
{
    double timeLeft = survivalMode ? getSurvivalTimeLeft() : getSpeedTestTimeLeft();
    int maximum = survivalMode ? 30 : duration;
    ui->wpmValue->setText(QString::number(calculateWPM(), 'f', 0));
    ui->accuracyValue->setText(QString::number(calculateAccuracy(), 'f', 0) + '%');
    ui->timeValue->setText(QString::number(static_cast<int>(ceil(timeLeft))) + 's');
    ui->timeProgress->setRange(0, maximum * 10);
    ui->timeProgress->setValue(static_cast<int>(ceil(timeLeft * 10)));
    ui->progressLabel->setText(QString("%1s / %2s").arg(static_cast<int>(ceil(timeLeft))).arg(maximum));
}

void MainWindow::updateWordDisplay()
{
    QString expected = QString::fromStdString(getCurrentWord());
    QString input = ui->typingInput->text();
    QString current;
    for (int i = 0; i < expected.size(); ++i) {
        bool incorrectLetter = i < input.size() && input[i] != expected[i];
        QString color = i < input.size()
            ? (incorrectLetter ? "#aaaaaa" : "#ffd600") : "#dddddd";
        QString decoration = i == input.size() ? ";text-decoration:underline" : "";
        if (incorrectLetter)
            decoration = ";text-decoration:line-through";
        current += "<span style='color:" + color + decoration + "'>"
                   + QString(expected[i]).toHtmlEscaped() + "</span>";
    }
    // Extra letters are also visible as errors.
    if (input.size() > expected.size())
        current += "<span style='color:#aaaaaa;text-decoration:line-through'>" + input.mid(expected.size()).toHtmlEscaped() + "</span>";

    QStringList display = completedWords;
    display.append(current);
    vector<string> upcoming = getUpcomingWords(6);
    for (size_t i = 1; i < upcoming.size(); ++i)
        display.append("<span style='color:#888888'>" + QString::fromStdString(upcoming[i]).toHtmlEscaped() + "</span>");
    ui->wordsLabel->setText(display.join(" "));

    bool incorrect = !expected.startsWith(input);
    ui->typingInput->setProperty("incorrect", incorrect);
    ui->typingInput->style()->unpolish(ui->typingInput);
    ui->typingInput->style()->polish(ui->typingInput);
}

void MainWindow::finishGame()
{
    if (finished)
        return;
    timer->stop();
    running = false;
    finished = true;
    ui->typingInput->setEnabled(false);
    updateDisplay();

    Score score{survivalMode ? "Survival" : "Speed", survivalMode ? 0 : duration,
                calculateWPM(), calculateAccuracy(), getTypingElapsedSeconds()};
    // The unsubmitted word is included in the final character statistics.
    bool saved = saveScore(scoresPath.toStdString(), score);
    QString result = survivalMode
        ? QString("Survived %1s").arg(score.survivedSeconds, 0, 'f', 1)
        : QString("%1-second test complete").arg(duration);
    ui->statusLabel->setText(QString("%1 | %2 WPM | %3% accuracy. %4")
        .arg(result).arg(score.wpm, 0, 'f', 0).arg(score.accuracy, 0, 'f', 0)
        .arg(saved ? "Score saved! Press Restart to play again."
                   : "Could not save score. Check the data folder permissions."));
}

void MainWindow::showHighScores()
{
    QDialog dialog(this);
    dialog.setWindowTitle("TypeRush - High Scores");
    dialog.resize(620, 400);
    auto *layout = new QVBoxLayout(&dialog);
    auto *heading = new QLabel("Speed: top 10 per duration by WPM. Survival: top 10 by time.", &dialog);
    heading->setWordWrap(true);
    layout->addWidget(heading);

    vector<Score> scores = loadScores(scoresPath.toStdString());
    auto *table = new QTableWidget(static_cast<int>(scores.size()), 5, &dialog);
    table->setHorizontalHeaderLabels({"Mode", "Duration", "WPM", "Accuracy", "Survived"});
    table->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    table->setSelectionBehavior(QAbstractItemView::SelectRows);
    table->setAlternatingRowColors(true);
    for (int row = 0; row < static_cast<int>(scores.size()); ++row) {
        const Score &score = scores[row];
        QStringList values = {QString::fromStdString(score.mode),
            score.mode == "Speed" ? QString::number(score.duration) + 's' : "-",
            QString::number(score.wpm, 'f', 1), QString::number(score.accuracy, 'f', 1) + '%',
            score.mode == "Survival" ? QString::number(score.survivedSeconds, 'f', 1) + 's' : "-"};
        for (int column = 0; column < values.size(); ++column)
            table->setItem(row, column, new QTableWidgetItem(values[column]));
    }
    layout->addWidget(table);
    if (scores.empty())
        layout->addWidget(new QLabel("No scores yet. Finish a round to save your first score.", &dialog));
    auto *close = new QDialogButtonBox(QDialogButtonBox::Close, &dialog);
    connect(close, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);
    layout->addWidget(close);
    dialog.exec();
}

void MainWindow::showSettings()
{
    QDialog dialog(this);
    dialog.setWindowTitle("TypeRush - Settings");
    auto *layout = new QVBoxLayout(&dialog);
    auto *largeText = new QCheckBox("Use larger practice text", &dialog);
    largeText->setChecked(ui->wordsLabel->property("largeText").toBool());
    connect(largeText, &QCheckBox::toggled, this, [this](bool checked) {
        ui->wordsLabel->setProperty("largeText", checked);
        ui->wordsLabel->setStyleSheet(checked ? "font-size: 26px;" : "font-size: 21px;");
    });
    layout->addWidget(largeText);
    auto *help = new QLabel(
        "Type the highlighted word, then press Space or Enter.\n"
        "The timer starts with your first letter. Backspace corrects your input.\n\n"
        "Speed Test: choose 15, 30, 60, or 120 seconds.\n"
        "Survival: start with 15s, gain 2s per correct word, lose 1s per mistake.\n"
        "The survival timer can hold up to 30 seconds.\n\n"
        "WPM = correct characters / 5 / minutes played.\n"
        "Accuracy = correct characters / typed characters x 100.\n"
        "Both include your current input; corrected letters replace mistakes.\n"
        "Scores are stored in data/scores.txt beside the program.\n"
        "An active game keeps running while these windows are open.", &dialog);
    help->setWordWrap(true);
    layout->addWidget(help);
    auto *close = new QDialogButtonBox(QDialogButtonBox::Close, &dialog);
    connect(close, &QDialogButtonBox::rejected, &dialog, &QDialog::reject);
    layout->addWidget(close);
    dialog.exec();
}
