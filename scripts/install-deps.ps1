# Script PowerShell pour installer les dépendances sur Windows

Write-Host "🚀 Installation des dépendances pour AI Code Review Assistant" -ForegroundColor Blue

function Install-ServiceDependencies {
    param(
        [string]$ServiceName,
        [string]$ServicePath,
        [string]$PackageManager
    )
    
    Write-Host "📦 Installation des dépendances pour $ServiceName..." -ForegroundColor Cyan
    
    if (Test-Path $ServicePath) {
        Set-Location $ServicePath
        
        if ($PackageManager -eq "npm") {
            if (Test-Path "package.json") {
                npm install
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ $ServiceName dependencies installed" -ForegroundColor Green
                } else {
                    Write-Host "❌ Erreur lors de l'installation pour $ServiceName" -ForegroundColor Red
                }
            } else {
                Write-Host "⚠️  package.json non trouvé dans $ServicePath" -ForegroundColor Yellow
            }
        } elseif ($PackageManager -eq "pip") {
            if (Test-Path "requirements.txt") {
                pip install -r requirements.txt
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ $ServiceName dependencies installed" -ForegroundColor Green
                } else {
                    Write-Host "❌ Erreur lors de l'installation pour $ServiceName" -ForegroundColor Red
                }
            } else {
                Write-Host "⚠️  requirements.txt non trouvé dans $ServicePath" -ForegroundColor Yellow
            }
        }
        
        Set-Location ..
    } else {
        Write-Host "❌ Répertoire $ServicePath non trouvé" -ForegroundColor Red
    }
}

# Vérification de la présence de npm et pip
try {
    npm --version | Out-Null
} catch {
    Write-Host "❌ npm n'est pas installé. Veuillez installer Node.js" -ForegroundColor Red
    exit 1
}

try {
    pip --version | Out-Null
} catch {
    Write-Host "❌ pip n'est pas installé. Veuillez installer Python" -ForegroundColor Red
    exit 1
}

# Installation pour chaque service
Install-ServiceDependencies "API Gateway" ".\api-gateway" "npm"
Install-ServiceDependencies "User Service" ".\user-service" "npm"
Install-ServiceDependencies "Review Service" ".\review-service" "npm"
Install-ServiceDependencies "Code Analysis Service" ".\code-analysis-service" "pip"
Install-ServiceDependencies "Notification Service" ".\notification-service" "npm"
Install-ServiceDependencies "Frontend" ".\frontend" "npm"

Write-Host "🎉 Installation terminée pour tous les services !" -ForegroundColor Green
Write-Host "💡 Utilise 'docker-compose up' pour lancer l'application" -ForegroundColor Blue