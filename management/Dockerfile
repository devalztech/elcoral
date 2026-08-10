# The management console is a THIRD deployment, separate from the backend
# and the member frontend. Build once, serve the static bundle.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback: every admin route is client-side.
RUN printf 'server { listen 80; root /usr/share/nginx/html; location / { try_files $uri /index.html; } }' \
  > /etc/nginx/conf.d/default.conf
EXPOSE 80
