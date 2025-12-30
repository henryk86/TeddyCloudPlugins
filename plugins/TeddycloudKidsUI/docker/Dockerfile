FROM nginx:alpine

# Copy nginx config template
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template

# Copy static files (build context is parent directory)
COPY index.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/

# Default TeddyCloud URL (can be overridden via environment variable)
ENV TEDDYCLOUD_URL=http://teddycloud:80

# Expose port 80
EXPOSE 80

# nginx:alpine image handles envsubst automatically via docker-entrypoint.sh
# It processes files in /etc/nginx/templates/*.template
CMD ["nginx", "-g", "daemon off;"]
