# Landing page — Chambeabot
#
# Serves static index.html via nginx on port 3000 (Railway's $PORT or 3000 default).
#
# Build context: this directory (landing/), `rootDirectory = "/landing"`.

FROM nginx:alpine

# Replace the default config with one that listens on port 3000.
RUN sed -i 's/listen       80;/listen       3000;/' /etc/nginx/conf.d/default.conf \
    && sed -i 's/listen  \[::\]:80;/listen  \[::\]:3000;/' /etc/nginx/conf.d/default.conf

COPY index.html /usr/share/nginx/html/index.html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
