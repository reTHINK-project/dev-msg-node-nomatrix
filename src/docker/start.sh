#!/bin/bash
DATA=$(realpath ./data)
IMAGE=rethink-matrixmn
CONTAINER=dev-msg-node-matrix

docker rm "$CONTAINER" 2>/dev/null && echo '[OK] '"$CONTAINER"' container removed from previous run'

# check if registry is running and if not start in background
docker ps | grep "dev-registry-domain" && echo '[OK] dev-registry-domain already started' || echo '[FAILED] please start dev-registry-domain'

# run dev-msg-node-matrix
docker run --name=$CONTAINER -d -p 8001:8001 -p 8448:8448 -p 8008:8008 -p 3478:3478 -p 3478:3478/udp -p 3479:3479 -p 3479:3479/udp --link dev-registry-domain:dev-registry-domain -v $DATA:/data $IMAGE start 1>/dev/null
docker ps | grep "$CONTAINER" && echo '[OK] '"starting $CONTAINER with mounted data-folder $DATA"

echo '[OK] ...done'
