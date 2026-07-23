# build-apk.ps1
# Automates local standalone Android APK build for Female Only Ride project

# 1. Set paths
$androidSdkPath = "C:\Users\abdul\AppData\Local\Android\Sdk"
$javaPath = (Get-Command java -ErrorAction SilentlyContinue).Source

Write-Host "=== Pink Rides Local Android APK Builder ===" -ForegroundColor Cyan

# 2. Verify Java JDK
if (-not $javaPath) {
    Write-Error "Java SDK not found. Please install JDK 17 (or ensure it is on your PATH)."
    exit 1
}
Write-Host "Found Java at: $javaPath" -ForegroundColor Green

# 3. Verify Android SDK
if (-not (Test-Path $androidSdkPath)) {
    Write-Error "Android SDK not found at $androidSdkPath. Please verify your installation."
    exit 1
}
Write-Host "Found Android SDK at: $androidSdkPath" -ForegroundColor Green

# 4. Clean corrupted NDK 26.1 download if present
$corruptedNdk = Join-Path $androidSdkPath "ndk\26.1.10909125"
if (Test-Path $corruptedNdk) {
    Write-Host "Cleaning corrupted NDK 26.1 cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $corruptedNdk -ErrorAction SilentlyContinue
}

# 5. Set required Environment Variables for the current session
$env:ANDROID_HOME = $androidSdkPath
$env:ANDROID_SDK_ROOT = $androidSdkPath

# 6. Find npx path
$npxCmd = Get-Command npx -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $npxCmd) {
    $npxCmd = "npx"
}

# 7. Generate Android native directory via Expo Prebuild
Write-Host "`nGenerating native Android project files via Expo Prebuild..." -ForegroundColor Yellow
& $npxCmd expo prebuild --platform android --clean

if ($LASTEXITCODE -ne 0) {
    Write-Error "Expo Prebuild failed. Check the errors above."
    exit 1
}
Write-Host "Expo Prebuild completed successfully." -ForegroundColor Green

# 8. Configure local.properties with correct SDK path
$localPropsPath = Join-Path (Get-Location) "android\local.properties"
$escapedSdkPath = $androidSdkPath.Replace('\', '/')
Write-Host "Configuring local.properties with correct SDK path..." -ForegroundColor Yellow
"sdk.dir=$escapedSdkPath" | Out-File -FilePath $localPropsPath -Encoding ascii -Force

# 9. Configure ndkVersion to use installed NDK 27.0.12077973
$buildGradlePath = Join-Path (Get-Location) "android\build.gradle"
if (Test-Path $buildGradlePath) {
    $content = Get-Content $buildGradlePath -Raw
    $updatedContent = $content -replace 'ndkVersion = "26\.1\.10909125"', 'ndkVersion = findProperty("android.ndkVersion") ?: "27.0.12077973"'
    Set-Content -Path $buildGradlePath -Value $updatedContent
}

# 10. Ensure splashscreen_background color exists in colors.xml
$colorsXmlPath = Join-Path (Get-Location) "android\app\src\main\res\values\colors.xml"
if (Test-Path $colorsXmlPath) {
    $colorsContent = Get-Content $colorsXmlPath -Raw
    if ($colorsContent -notlike "*splashscreen_background*") {
        $colorsContent = $colorsContent -replace '</resources>', "  <color name=""splashscreen_background"">#ffffff</color>`n</resources>"
        Set-Content -Path $colorsXmlPath -Value $colorsContent
    }
}

# 11. Build the Debug APK using Gradle wrapper
Write-Host "`nCompiling standalone Android debug APK..." -ForegroundColor Yellow
Push-Location android

cmd.exe /c "gradlew.bat assembleDebug"
$buildExitCode = $LASTEXITCODE

Pop-Location

if ($buildExitCode -ne 0) {
    Write-Error "Gradle build failed. Please check compilation logs above."
    exit 1
}

# 12. Locate and copy the generated APK
$sourceApk = "android\app\build\outputs\apk\debug\app-debug.apk"
$targetApk = "SheDrive-debug.apk"

if (Test-Path $sourceApk) {
    Copy-Item -Path $sourceApk -Destination $targetApk -Force
    Write-Host "`n=============================================" -ForegroundColor Green
    Write-Host "SUCCESS: standalone APK generated successfully!" -ForegroundColor Green
    Write-Host "Location: $(Join-Path (Get-Location) $targetApk)" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
} else {
    Write-Error "Could not locate built APK at $sourceApk"
}
