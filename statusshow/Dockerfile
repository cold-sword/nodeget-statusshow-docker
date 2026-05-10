FROM node:22-alpine AS build

ARG STATUSSHOW_REPO=https://github.com/NodeSeekDev/NodeGet-StatusShow.git
ARG STATUSSHOW_REF=main
ARG STATUSSHOW_SOURCE_REV=unknown

RUN apk add --no-cache git
WORKDIR /src

RUN echo "StatusShow source revision: ${STATUSSHOW_SOURCE_REV}" \
  && git clone --depth 1 --branch "${STATUSSHOW_REF}" "${STATUSSHOW_REPO}" . \
  && if [ "${STATUSSHOW_SOURCE_REV}" != "unknown" ]; then \
       test "$(git rev-parse HEAD)" = "${STATUSSHOW_SOURCE_REV}"; \
     fi

RUN npm ci
RUN npm run build

# ─────────────── runtime ───────────────
FROM node:22-alpine

RUN npm install -g serve

WORKDIR /app
COPY --from=build /src/dist/ .

EXPOSE 3000
CMD ["serve", "-s", "/app", "-l", "tcp://0.0.0.0:3000"]
