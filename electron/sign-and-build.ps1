# Load Azure signing credentials from .env.signing
$envFile = Join-Path $PSScriptRoot ".env.signing"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "Set $name"
        }
    }
} else {
    Write-Error ".env.signing file not found at $envFile"
    exit 1
}

# Build and package
Write-Host "`nBuilding and signing Electron app..."
npm run package:win
