# Landing page — Chambeabot (nginx static)
#
# Build context: this directory (landing/), rootDirectory = "/landing".

FROM nginx:alpine

# Remove the default config to avoid port conflicts with our custom one.
RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf
COPY index.html /usr/share/nginx/html/index.html
COPY assets/ /usr/share/nginx/html/assets/

# Cheap favicon — single inline SVG so we don't need a separate request handler.
RUN printf '%s' '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#10b981"/><text x="16" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="18" fill="#0a0e1a">C</text></svg>' > /usr/share/nginx/html/assets/favicon.svg

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]