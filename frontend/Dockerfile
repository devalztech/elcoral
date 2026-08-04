# Elcoral frontend — React (Vite), built and served as static files
# Built for use as a Pterodactyl egg Docker image, or standalone docker build/run.
#
# NOTE: build context must be the MONOREPO ROOT (not frontend/), since this
# needs the root package.json for the npm workspace:
#   docker build -f frontend/Dockerfile -t elcoral-frontend .

FROM node:20-slim AS build
WORKDIR /app
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
