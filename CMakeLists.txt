cmake_minimum_required(VERSION 3.16)
project(TypeRush LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOUIC ON)

find_package(QT NAMES Qt6 Qt5 REQUIRED COMPONENTS Widgets)
find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Widgets)

add_executable(TypeRush WIN32
    main.cpp
    ui/mainwindow.cpp
    ui/mainwindow.h
    ui/mainwindow.ui
    src/typing_engine.cpp
    src/speed_test.cpp
    src/survival.cpp
    src/score_manager.cpp
)
target_include_directories(TypeRush PRIVATE include ui)
target_link_libraries(TypeRush PRIVATE Qt${QT_VERSION_MAJOR}::Widgets)
target_compile_definitions(TypeRush PRIVATE TYPERUSH_PROJECT_DIR="${CMAKE_CURRENT_SOURCE_DIR}")

# Keep the existing assets and data folders next to the built program.
add_custom_command(TARGET TypeRush POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/assets" "$<TARGET_FILE_DIR:TypeRush>/assets"
    COMMAND ${CMAKE_COMMAND} -E make_directory "$<TARGET_FILE_DIR:TypeRush>/data"
)
