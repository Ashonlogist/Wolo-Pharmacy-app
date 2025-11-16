# Workaround script for electron-builder code signing tool extraction issue
# This script manually handles the cache extraction to avoid symbolic link errors

Write-Host "Building Wolo Pharmacy Installer..." -ForegroundColor Cyan
Write-Host ""

# Clear the problematic cache
$cachePath = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
if (Test-Path $cachePath) {
    Write-Host "Clearing code signing cache..." -ForegroundColor Yellow
    Remove-Item -Path $cachePath -Recurse -Force -ErrorAction SilentlyContinue
}

# Set environment variable to skip code signing
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

# Try to build
Write-Host "Starting build process..." -ForegroundColor Green
npm run build:win:installer

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed. This is likely due to code signing tool extraction issues." -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUTION: Please run PowerShell as Administrator and try again:" -ForegroundColor Yellow
    Write-Host "  1. Right-click PowerShell" -ForegroundColor White
    Write-Host "  2. Select 'Run as Administrator'" -ForegroundColor White
    Write-Host "  3. Navigate to: $PWD" -ForegroundColor White
    Write-Host "  4. Run: npm run build:win:installer" -ForegroundColor White
    Write-Host ""
    Write-Host "Alternatively, the errors about 'darwin' files are non-critical." -ForegroundColor Cyan
    Write-Host "The Windows files should extract fine. You may need to manually" -ForegroundColor Cyan
    Write-Host "extract the archive or run as admin." -ForegroundColor Cyan
}

