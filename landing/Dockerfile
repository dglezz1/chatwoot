# Landing page — Chambeabot (nginx static)
# 
# Build context: this directory (landing/), rootDirectory = "/landing".

FROM nginx:alpine

# Remove the default config to avoid port conflicts with our custom one.
RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
