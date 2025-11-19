FROM nginx:alpine

# Copier la configuration personnalisée
COPY nginx.conf /etc/nginx/nginx.conf

# Créer le dossier pour les logs si nécessaire
RUN mkdir -p /var/log/nginx

# Exposer les ports
EXPOSE 80 443

# Commande par défaut
CMD ["nginx", "-g", "daemon off;"]