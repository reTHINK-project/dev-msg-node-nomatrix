#!/bin/sh
DATA=$(realpath ./data)
IMAGE=rethink-matrixmn
CONTAINER=matrixmn

echo "deleting $CONTAINER container from previous run ..."
docker rm $CONTAINER
echo ...done

echo starting $CONTAINER container ...
echo "starting $CONTAINER with mounted data-folder $DATA"
docker run --name=$CONTAINER -d --link domainreg:registry -p 8001:8001 -p 8448:8448 -p 8008:8008 -p 3478:3478 -p 3478:3478/udp -p 3479:3479 -p 3479:3479/udp -v $DATA:/data $IMAGE start
