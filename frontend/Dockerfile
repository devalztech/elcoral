# Elcoral frontend — React (Vite), built and served as static files
# Built for use as a Pterodactyl egg Docker image, or standalone docker build/run.
#
# NOTE: build context must be the MONOREPO ROOT (not frontend/), since this
# needs the root package.json for the npm workspace:
#   docker build -f frontend/Dockerfile -t elcoral-frontend .

FROM node:20-slim AS build
WORKDIR /app

# Render's dashboard env vars are only injected at container RUNTIME by
# default — they are NOT passed into `docker build` automatically. Vite
# bakes import.meta.env.VITE_* values in at BUILD time, so without this
# ARG/ENV pair, VITE_API_URL is always empty in the built JS no matter
# what's set in Render's Environment tab. Render must be configured to
# pass this as a Docker build argument (Render dashboard -> service ->
# Settings -> Docker Build Args / "Secret Files" or "Build Args" section)
# with the SAME key name, VITE_API_URL, pointing at the backend's public
# URL.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json ./
COPY frontend/package.json ./frontend/
RUN npm install --workspace=frontend
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

FROM node:20-slim
WORKDIR /home/container
RUN npm install -g serve
COPY --from=build /app/frontend/dist ./dist

RUN useradd -u 999 -m container && chown -R container:container /home/container
USER container

EXPOSE 3000

# Pterodactyl eggs typically override the port/command via variables;
# this is the sane default for `docker run` / local testing.
CMD ["serve", "-s", "dist", "-l", "3000"]
