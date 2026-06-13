FROM node:22-alpine AS console-builder

WORKDIR /src

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/console/package.json apps/console/package.json
RUN pnpm install --frozen-lockfile

COPY apps/console apps/console
RUN pnpm build:console

FROM golang:1.25-alpine AS go-builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd cmd
COPY internal internal
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/platform-all ./cmd/platform-all
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/migrate-db ./cmd/migrate-db
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/seed-db ./cmd/seed-db

FROM alpine:3.20

RUN adduser -D -u 10001 anjing

WORKDIR /app

COPY --from=go-builder /out/platform-all /app/platform-all
COPY --from=go-builder /out/migrate-db /app/migrate-db
COPY --from=go-builder /out/seed-db /app/seed-db
COPY --from=console-builder /src/apps/console/dist /app/apps/console/dist
COPY infra/postgres/migrations /app/infra/postgres/migrations
COPY infra/postgres/seeds /app/infra/postgres/seeds

ENV ANJING_ADDR=:18080
ENV ANJING_CONSOLE_DIST=/app/apps/console/dist
ENV ANJING_MIGRATIONS_DIR=/app/infra/postgres/migrations
ENV ANJING_SEEDS_DIR=/app/infra/postgres/seeds

EXPOSE 18080

USER anjing

CMD ["/app/platform-all"]
