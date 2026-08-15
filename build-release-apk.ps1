# build-release-apk.ps1
# Automates local standalone Android Release APK build for Female Only Ride project

# 1. Set paths
$androidSdkPath = "C:\Users\abdul\AppData\Local\Android\Sdk"
$javaPath = (Get-Command java -ErrorAction SilentlyContinue).Source

Write-Host "=== Pink Rides Local Android Release APK Builder ===" -ForegroundColor Cyan

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

# 4. Set required Environment Variables for the current session
$env:ANDROID_HOME = $androidSdkPath
$env:ANDROID_SDK_ROOT = $androidSdkPath

# 5. Find npx path
$npxCmd = Get-Command npx -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $npxCmd) {
    $npxCmd = "npx"
}

# 6. Generate Android native directory via Expo Prebuild
Write-Host "`nGenerating native Android project files via Expo Prebuild..." -ForegroundColor Yellow
& $npxCmd expo prebuild --platform android

if ($LASTEXITCODE -ne 0) {
    Write-Error "Expo Prebuild failed. Check the errors above."
    exit 1
}
Write-Host "Expo Prebuild completed successfully." -ForegroundColor Green

# 7. Configure local.properties with correct SDK path
$localPropsPath = Join-Path (Get-Location) "android\local.properties"
$escapedSdkPath = $androidSdkPath.Replace('\', '/')
Write-Host "Configuring local.properties with correct SDK path..." -ForegroundColor Yellow
"sdk.dir=$escapedSdkPath" | Out-File -FilePath $localPropsPath -Encoding ascii -Force

# 8. Configure ndkVersion to use installed NDK 27.0.12077973
$buildGradlePath = Join-Path (Get-Location) "android\build.gradle"
if (Test-Path $buildGradlePath) {
    $content = Get-Content $buildGradlePath -Raw
    $updatedContent = $content -replace 'ndkVersion = "26\.1\.10909125"', 'ndkVersion = findProperty("android.ndkVersion") ?: "27.0.12077973"'
    Set-Content -Path $buildGradlePath -Value $updatedContent
}

# 9. Ensure splashscreen_background color exists in colors.xml
$colorsXmlPath = Join-Path (Get-Location) "android\app\src\main\res\values\colors.xml"
if (Test-Path $colorsXmlPath) {
    $colorsContent = Get-Content $colorsXmlPath -Raw
    if ($colorsContent -notlike "*splashscreen_background*") {
        $colorsContent = $colorsContent -replace '</resources>', "  <color name=""splashscreen_background"">#ffffff</color>`n</resources>"
        Set-Content -Path $colorsXmlPath -Value $colorsContent
    }
}

# 10. Bundle offline JavaScript code into android assets
Write-Host "`nBundling updated React Native JavaScript bundle into APK assets..." -ForegroundColor Yellow
$assetsDir = Join-Path (Get-Location) "android\app\src\main\assets"
if (-not (Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
}
& $npxCmd react-native bundle --platform android --dev false --entry-file node_modules/expo/AppEntry.js --bundle-output "android/app/src/main/assets/index.android.bundle" --assets-dest "android/app/src/main/res"

# 11. Build the Release APK using Gradle wrapper
Write-Host "`nCompiling standalone Android Release APK..." -ForegroundColor Yellow
Push-Location android

cmd.exe /c "gradlew.bat assembleRelease"
$buildExitCode = $LASTEXITCODE

Pop-Location

if ($buildExitCode -ne 0) {
    Write-Error "Gradle Release build failed. Please check compilation logs above."
    exit 1
}

# 12. Locate and copy the generated Release APK
$sourceApk = "android\app\build\outputs\apk\release\app-release.apk"
$targetApk = "SheDrive-release.apk"

if (Test-Path $sourceApk) {
    Copy-Item -Path $sourceApk -Destination $targetApk -Force
    $apkItem = Get-Item $targetApk
    $sizeMb = [math]::Round($apkItem.Length / 1MB, 2)
    Write-Host "`n=============================================" -ForegroundColor Green
    Write-Host "SUCCESS: Standalone Release APK generated successfully!" -ForegroundColor Green
    Write-Host "Location: $(Join-Path (Get-Location) $targetApk)" -ForegroundColor Green
    Write-Host "File Size: $sizeMb MB ($($apkItem.Length) bytes)" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
} else {
    Write-Error "Could not locate built Release APK at $sourceApk"
}
