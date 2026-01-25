# PowerShell script for exporting JASK offline package
# Run this from the project root

$Version = "1.0.0"
$OutputDir = "jask-offline-v$Version"
$ImagesDir = "$OutputDir\images"

Write-Host "Starting Offline Package Export (v$Version)" -ForegroundColor Cyan
Write-Host "--------------------------------------------"

# 1. Clean & Prepare
Write-Host "[1/5] Creating output directory structure..." -ForegroundColor Green
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Force -Path $ImagesDir | Out-Null

# 2. Build Custom Images
Write-Host "[2/5] Building custom images..." -ForegroundColor Green
Write-Host "  Building Backend..."
docker build -t jask-backend:latest ./backend
if ($LASTEXITCODE -ne 0) { Write-Error "Backend build failed"; exit 1 }

Write-Host "  Building Frontend..."
docker build -t jask-frontend:latest ./frontend
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed"; exit 1 }

# 3. Pull External Images
Write-Host "[3/5] Pulling external images..." -ForegroundColor Green
Write-Host "  Pulling Postgres (pgvector)..."
docker pull pgvector/pgvector:pg16
Write-Host "  Pulling Redis..."
docker pull redis:7-alpine

# 4. Save Images
Write-Host "[4/5] Exporting images to .tar archives..." -ForegroundColor Green
$Images = @(
    @{ Name = "pgvector/pgvector:pg16"; File = "postgres.tar" },
    @{ Name = "redis:7-alpine"; File = "redis.tar" },
    @{ Name = "jask-backend:latest"; File = "jask-backend.tar" },
    @{ Name = "jask-frontend:latest"; File = "jask-frontend.tar" }
)

foreach ($Img in $Images) {
    Write-Host "  Saving $($Img.Name) -> $($Img.File)..."
    docker save -o "$ImagesDir\$($Img.File)" $Img.Name
}

# 5. Package Files
Write-Host "[5/5] Packaging configuration and scripts..." -ForegroundColor Green
Copy-Item "docker-compose.prod.yml" -Destination "$OutputDir\docker-compose.yml"
Copy-Item "scripts\install.sh" -Destination "$OutputDir\install.sh"

# Archive
Write-Host "Creating compressed archive..." -ForegroundColor Green
# Check if tar is available (Windows 10/11 usually has it)
if (Get-Command tar -ErrorAction SilentlyContinue) {
    tar -czf "$OutputDir.tar.gz" "$OutputDir"
    Write-Host "Success! Package created: $OutputDir.tar.gz" -ForegroundColor Cyan
} else {
    Write-Host "Warning: 'tar' command not found. Folder '$OutputDir' created but not compressed." -ForegroundColor Yellow
    Write-Host "Success! Package created in folder: $OutputDir" -ForegroundColor Cyan
}

Write-Host "--------------------------------------------"
Write-Host "Transfer the package to the target machine and run ./install.sh"
