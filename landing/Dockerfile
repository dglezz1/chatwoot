# Landing page — Chambeabot
#
# Serves static index.html via nginx. Listens on port 3000 (Railway's $PORT or default).
#
# Build context: this directory (landing/), rootDirectory = "/landing".

FROM nginx:alpine

# Read $PORT from Railway (defaults to 3000)
ENV LISTEN_PORT=${PORT:-3000}

# Replace the listen directives in the default nginx config with our dynamic port.
RUN sed -i "s/listen       80;/listen       ${LISTEN_PORT};/g" /etc/nginx/conf.d/default.conf \
    && sed -i "s/listen  \[::\]:80;/listen  \[::\]:${LISTEN_PORT};/g" /etc/nginx/conf.d/default.conf

COPY index.html /usr/share/nginx/html/index.html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
