param([switch]$Run)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$buildRoot = Join-Path $projectRoot 'build'
$qtRoot = Join-Path $buildRoot '_toolchain\ucrt64'
if (!(Test-Path -LiteralPath "$qtRoot\bin\cmake.exe")) {
    $qtRoot = 'C:\msys64\ucrt64'
}
foreach ($tool in @('cmake.exe', 'ninja.exe', 'g++.exe', 'windeployqt6.exe', 'objdump.exe')) {
    if (!(Test-Path -LiteralPath "$qtRoot\bin\$tool")) {
        throw "Missing $tool in $qtRoot\bin. Install the Qt, CMake, Ninja, and GCC toolchain first."
    }
}

$originalPath = $env:PATH
try {
    $env:PATH = "$qtRoot\bin;$originalPath"
    & "$qtRoot\bin\cmake.exe" -S $projectRoot -B $buildRoot -G Ninja `
        "-DCMAKE_BUILD_TYPE=Release" "-DCMAKE_PREFIX_PATH=$qtRoot" `
        "-DCMAKE_CXX_COMPILER=$qtRoot\bin\g++.exe" "-DCMAKE_MAKE_PROGRAM=$qtRoot\bin\ninja.exe"
    if ($LASTEXITCODE -ne 0) { throw 'CMake configuration failed.' }
    & "$qtRoot\bin\cmake.exe" --build $buildRoot --parallel 4
    if ($LASTEXITCODE -ne 0) { throw 'Compilation failed.' }
    & "$qtRoot\bin\windeployqt6.exe" --release --no-translations "$buildRoot\TypeRush.exe"
    if ($LASTEXITCODE -ne 0) { throw 'Qt deployment failed.' }

    # MSYS2 Qt also uses compiler and third-party DLLs that windeployqt omits.
    $pending = [System.Collections.Generic.Queue[string]]::new()
    $visited = [System.Collections.Generic.HashSet[string]]::new()
    $pending.Enqueue("$buildRoot\TypeRush.exe")
    Get-ChildItem -LiteralPath $buildRoot -Filter '*.dll' -File | ForEach-Object {
        $pending.Enqueue($_.FullName)
    }
    Get-ChildItem -LiteralPath $buildRoot -Directory | Where-Object Name -ne '_toolchain' |
        Get-ChildItem -Filter '*.dll' -File -Recurse | ForEach-Object {
            $pending.Enqueue($_.FullName)
        }
    while ($pending.Count -gt 0) {
        $binary = $pending.Dequeue()
        if (!$visited.Add($binary)) { continue }
        $imports = & "$qtRoot\bin\objdump.exe" -p $binary
        if ($LASTEXITCODE -ne 0) { throw "Could not inspect dependencies: $binary" }
        foreach ($line in $imports) {
            if ($line -match 'DLL Name:\s*(\S+)') {
                $libraryName = $Matches[1]
                $librarySource = Join-Path "$qtRoot\bin" $libraryName
                if (Test-Path -LiteralPath $librarySource) {
                    $libraryTarget = Join-Path $buildRoot $libraryName
                    if (!$visited.Contains($libraryTarget)) {
                        Copy-Item -LiteralPath $librarySource -Destination $libraryTarget -Force
                        $pending.Enqueue($libraryTarget)
                    }
                }
            }
        }
    }
    Write-Host "Built: $buildRoot\TypeRush.exe"
    if ($Run) { & "$buildRoot\TypeRush.exe" }
} finally {
    $env:PATH = $originalPath
}
