# TypeRush

Practice your typing with Speed Test and Survival Mode, using **1,959 familiar
English words**. Play in your browser or install the web app on your phone or computer.

**[Play and install TypeRush →](https://panharo.github.io/TypeRush/)**

The project includes an offline-capable web app and the original C++17/Qt Widgets
desktop app. Both use the shared word list and the black, yellow, and grey theme.

## Installable web version

The companion [web app](web/README.md) works on iPhone/iPad, Android, Windows,
and Mac through a supported browser. It includes both modes, offline practice,
local name-and-PIN profiles, separate high scores, and JSON backup export/import.

- **iPhone/iPad:** open the live site in Safari → Share → Add to Home Screen.
- **Android:** open in Chrome → menu → Install app or Add to Home screen.
- **Windows:** install from Chrome or Edge using the address bar or browser menu.
- **Mac:** use Chrome's install menu or Safari → File → Add to Dock on macOS Sonoma+.

Wait for **Offline ready** before playing without internet. Guests can play normally;
sign into a local profile to save high scores. Export a backup from **High Scores**
to keep a copy outside the app for recovery after deletion or a move to another device.

See its README for build, installation, recovery, and GitHub Pages instructions.
The original C++/Qt desktop build instructions continue below.

## Build and run

Install Qt 5 or Qt 6 with Widgets, CMake 3.16+, and a compatible C++ compiler.
In Qt Creator, open `CMakeLists.txt`, select a desktop Qt kit, and click Run.
Choose a build directory outside this project if you want to keep its folders unchanged.

On Windows, Qt Creator is optional. With the prepared local toolchain in
`build/_toolchain/ucrt64`, or Qt, CMake, Ninja, and GCC installed in
`C:/msys64/ucrt64`, build from PowerShell with:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

Run `./build/TypeRush.exe`, or add `-Run` to the build command to launch it
after building. The script copies the required Qt runtime files beside the executable.
The local toolchain is ignored by Git; a fresh checkout needs its own toolchain.

The build copies the word list and style beside the executable. Scores are saved
in `data/scores.txt` beside the executable. Run from a writable location.

## Playing

- **Speed Test:** select 15s, 30s, 1m, or 2m. Start typing to start the clock.
- Type the current word and press **Space** or **Enter** to submit it.
- Yellow letters are correct; grey struck-through letters are mistakes. Backspace fixes current input.
- **Survival Mode:** start with 15 seconds. A correct word adds 2 seconds;
  a wrong word removes 1 second. The timer is capped at 30 seconds.
- **Restart** begins a fresh round. Changing the mode or duration also resets the round.
- **High Scores** shows the top 10 speed results per duration and top 10 survival times.
- **Settings** offers larger practice text and explains the rules. Dialogs do not pause play.

WPM is correct characters divided by 5, divided by minutes played. Accuracy is
correct characters divided by typed characters, multiplied by 100. These include
the current word. A submitted space counts as correct only after a correct word.
Backspacing replaces the current input, so corrected errors are not kept in the totals.
Only completed games save scores.

## Files

- `src/typing_engine.cpp`: word list, current word, and character statistics.
- `src/speed_test.cpp`: `startSpeedTest`, `updateSpeedTestTimer`, `calculateWPM`,
  and `calculateAccuracy`.
- `src/survival.cpp`: `startSurvival`, `applySurvivalResult`,
  `updateSurvivalTimer`, and `isSurvivalGameOver`.
- `src/score_manager.cpp`: reads and writes scores using C++ file streams.
- `ui/mainwindow.ui`: Qt Designer layout.
- `ui/mainwindow.cpp`: connects buttons, typing input, and the timer to the game.
- `assets/words.txt`: editable practice words separated by whitespace.

Each game shuffles the words, and the list repeats when it reaches the end.
