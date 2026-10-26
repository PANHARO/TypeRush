#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QElapsedTimer>
#include <QStringList>

class QTimer;
namespace Ui { class MainWindow; }

class MainWindow : public QMainWindow
{
public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private:
    Ui::MainWindow *ui;
    QTimer *timer;
    QElapsedTimer clock;
    bool survivalMode = false;
    bool running = false;
    bool finished = false;
    int duration = 30;
    QStringList completedWords;
    QString scoresPath;

    void prepareGame(bool survival);
    void handleInput(const QString &text);
    void updateTimer();
    void updateDisplay();
    void updateWordDisplay();
    void finishGame();
    void showHighScores();
    void showSettings();
};

#endif
