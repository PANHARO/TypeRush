#include <QApplication>
#include <QFile>
#include <QFont>
#include "mainwindow.h"

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    app.setApplicationName("TypeRush");
    app.setFont(QFont("Segoe UI", 10));

    QFile style(QCoreApplication::applicationDirPath() + "/assets/style.qss");
    if (!style.exists())
        style.setFileName(QStringLiteral(TYPERUSH_PROJECT_DIR) + "/assets/style.qss");
    if (style.open(QIODevice::ReadOnly))
        app.setStyleSheet(QString::fromUtf8(style.readAll()));

    MainWindow window;
    window.show();
    return app.exec();
}
