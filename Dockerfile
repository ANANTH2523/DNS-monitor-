# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libpcap-dev gcc libc-dev
COPY . .
# Fetch dependencies and build the app with C bindings enabled
RUN go mod tidy
RUN CGO_ENABLED=1 GOOS=linux go build -o dns-monitor main.go

# Run stage
FROM alpine:latest
RUN apk add --no-cache libpcap
WORKDIR /root/
COPY --from=builder /app/dns-monitor .
CMD ["./dns-monitor"]
