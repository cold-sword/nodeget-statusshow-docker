FROM node:22-alpine AS build

ARG STATUSSHOW_REPO=https://github.com/NodeSeekDev/NodeGet-StatusShow.git
ARG STATUSSHOW_REF=main

RUN apk add --no-cache git
WORKDIR /src

RUN git clone --depth 1 --branch "${STATUSSHOW_REF}" "${STATUSSHOW_REPO}" .

RUN npm ci
RUN npm run build

# ─────────────── runtime ───────────────
FROM node:22-alpine

RUN npm install -g serve

WORKDIR /app
COPY --from=build /src/dist/ .

EXPOSE 3000
CMD ["serve", "-s", "/app", "-l", "tcp://0.0.0.0:3000"]
