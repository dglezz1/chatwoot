# Landing page — Chambeabot (nginx static)
# 
# Build context: this directory (landing/), rootDirectory = "/landing".

FROM nginx:alpine

# Overwrite the default nginx config with one that listens on port 3000.
RUN cat > /etc/nginx/conf.d/default.conf << 'NGINX'
server {
    listen 3000;
    server_name _;
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
NGINX

COPY index.html /usr/share/nginx/html/index.html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
