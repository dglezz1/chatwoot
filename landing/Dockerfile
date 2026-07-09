# Landing page — Chambeabot
#
# Serves static index.html via nginx. Uses ARG PORT (defaults 3000) for the listen port.
# Build context: this directory (landing/), rootDirectory = "/landing".

FROM nginx:alpine

ARG PORT=3000

# Replace the listen directives with our PORT arg.
RUN sed -i "s/listen       80;/listen       ${PORT};/g" /etc/nginx/conf.d/default.conf \
    && sed -i "s/listen  \[::\]:80;/listen  \[::\]:${PORT};/g" /etc/nginx/conf.d/default.conf

COPY index.html /usr/share/nginx/html/index.html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
