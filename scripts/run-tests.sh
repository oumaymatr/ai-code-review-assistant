#!/bin/bash

# Script d'exécution des tests pour tous les services

echo "🧪 Exécution des tests pour AI Code Review Assistant"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

run_tests() {
    local service_name=$1
    local service_path=$2
    local test_command=$3
    
    echo -e "${BLUE}🔍 Tests pour $service_name...${NC}"
    
    if [ -d "$service_path" ]; then
        cd "$service_path"
        
        if eval "$test_command"; then
            echo -e "${GREEN}✅ Tests $service_name réussis${NC}"
        else
            echo -e "${RED}❌ Tests $service_name échoués${NC}"
            return 1
        fi
        
        cd ..
    else
        echo -e "${RED}❌ Répertoire $service_path non trouvé${NC}"
        return 1
    fi
}

# Variable pour tracker les échecs
test_failures=0

# Tests pour chaque service
run_tests "API Gateway" "./api-gateway" "npm test" || ((test_failures++))
run_tests "User Service" "./user-service" "npm test" || ((test_failures++))
run_tests "Review Service" "./review-service" "npm test" || ((test_failures++))
run_tests "Code Analysis Service" "./code-analysis-service" "python -m pytest" || ((test_failures++))
run_tests "Notification Service" "./notification-service" "npm test" || ((test_failures++))
run_tests "Frontend" "./frontend" "npm test -- --watchAll=false" || ((test_failures++))

# Résumé
if [ $test_failures -eq 0 ]; then
    echo -e "${GREEN}🎉 Tous les tests sont passés avec succès !${NC}"
    exit 0
else
    echo -e "${RED}❌ $test_failures service(s) ont des tests en échec${NC}"
    exit 1
fi