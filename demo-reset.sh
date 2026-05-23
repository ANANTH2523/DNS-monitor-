#!/bin/bash
set -e

# Define paths for Docker, kubectl, and kind binaries
DOCKER_BIN="/Applications/Docker.app/Contents/Resources/bin/docker"
KUBECTL_BIN="/usr/local/bin/kubectl"
KIND_BIN="/opt/homebrew/bin/kind"

echo "=== [1/5] Tearing down the old pod if it exists ==="
$KUBECTL_BIN delete pod dns-monitor-pod --ignore-not-found=true

echo "=== [2/5] Rebuilding Docker image: dns-sidecar:v1 ==="
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
$DOCKER_BIN build -t dns-sidecar:v1 .

echo "=== [3/5] Loading image into local Kind cluster ==="
$KIND_BIN load docker-image dns-sidecar:v1 --name kind

echo "=== [4/5] Deploying the new pod ==="
$KUBECTL_BIN apply -f pod.yaml

echo "=== [5/5] Waiting for sidecar pod to be ready & streaming logs ==="
$KUBECTL_BIN wait --for=condition=Ready pod/dns-monitor-pod --timeout=60s

echo "=== Streaming logs from dns-sidecar container ==="
$KUBECTL_BIN logs -f dns-monitor-pod -c dns-sidecar
