# Build and compile the Deno application
FROM denoland/deno:2.6.3 AS builder
WORKDIR /app
COPY deno.json deno.lock package.json ./
RUN deno install
COPY public public
COPY src src
COPY nodes.json nodes.json
RUN deno compile --allow-all --output explorer ./src/app.ts

# Run it on minimal Alpine linux
FROM alpine:3.23 AS main
WORKDIR /app
COPY --from=builder /app/explorer .
EXPOSE 8000
CMD ["./explorer"]