#!/bin/bash

# Script d'installation des dépendances pour tous les services
# Utilise npm pour Node.js et pip pour Python

echo "🚀 Installation des dépendances pour AI Code Review Assistant"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

install_service() {
    local service_name=$1
    local service_path=$2
    local package_manager=$3
    
    echo -e "${BLUE}📦 Installation des dépendances pour $service_name...${NC}"
    
    if [ -d "$service_path" ]; then
        cd "$service_path"
        
        if [ "$package_manager" = "npm" ]; then
            if [ -f "package.json" ]; then
                npm install
                echo -e "${GREEN}✅ $service_name dependencies installed${NC}"
            else
                echo -e "${YELLOW}⚠️  package.json non trouvé dans $service_path${NC}"
            fi
        elif [ "$package_manager" = "pip" ]; then
            if [ -f "requirements.txt" ]; then
                pip install -r requirements.txt
                echo -e "${GREEN}✅ $service_name dependencies installed${NC}"
            else
                echo -e "${YELLOW}⚠️  requirements.txt non trouvé dans $service_path${NC}"
            fi
        fi
        
        cd ..
    else
        echo -e "${RED}❌ Répertoire $service_path non trouvé${NC}"
    fi
}

# Vérification de la présence de npm et pip
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé. Veuillez installer Node.js${NC}"
    exit 1
fi

if ! command -v pip &> /dev/null; then
    echo -e "${RED}❌ pip n'est pas installé. Veuillez installer Python${NC}"
    exit 1
fi

# Installation pour chaque service
install_service "API Gateway" "./api-gateway" "npm"
install_service "User Service" "./user-service" "npm"
install_service "Review Service" "./review-service" "npm"
install_service "Code Analysis Service" "./code-analysis-service" "pip"
install_service "Notification Service" "./notification-service" "npm"
install_service "Frontend" "./frontend" "npm"

echo -e "${GREEN}🎉 Installation terminée pour tous les services !${NC}"
echo -e "${BLUE}💡 Utilise 'docker-compose up' pour lancer l'application${NC}"