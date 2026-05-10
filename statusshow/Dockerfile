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

RUN apk add --no-cache gettext \
 && npm install -g serve

WORKDIR /app
COPY --from=build /src/dist/        .
COPY config.json.template           .
COPY docker-entrypoint.sh           /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
