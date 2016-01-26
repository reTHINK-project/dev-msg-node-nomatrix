#!/bin/bash
DATA=$(realpath ./data)
IMAGE=rethink-matrixmn
CONTAINER=dev-msg-node-matrix

#remove old container
docker rm "$CONTAINER" 2>/dev/null && echo '[OK] '"$CONTAINER"' container removed from previous run'

# check if registry is running and if not start in background
docker ps | grep -q "dev-registry-domain" && echo '[OK] dev-registry-domain already started' || echo '[FAILED] please start dev-registry-domain'

# run dev-msg-node-matrix
if docker ps | grep -q "$CONTAINER"
then
  echo '[FAILED] container already started'
  echo "please stop the container with './stop.sh'"
  exit
else
  docker run --name="$CONTAINER" -d -p 8001:8001 -p 8448:8448 -p 8008:8008 --link dev-registry-domain:dev-registry-domain -v "$DATA":/data "$IMAGE" start 1>/dev/null
  #-p 3478:3478 -p 3478:3478/udp -p 3479:3479 -p 3479:3479/udp # turnserver
  docker ps | grep -q "$CONTAINER" && echo '[OK] '"starting $CONTAINER with mounted data-folder $DATA"
fi

# print small docker ps for an overview
echo ""
oldifs="$IFS"
IFS=$'\n'
row1=( $(docker ps --format "table {{.Image}}\t{{.CreatedAt}}\t{{.Status}}") )
row2=( $(docker ps | awk '{print $NF}') )
r1len=${#row1[@]}
r2len=${#row2[@]}
for (( i=0; i<$r1len; i++ ));
do
  for (( j=0; j<$r2len; j++ ));
  do
    if [ $j == $i ]
    then
      if [ $i == 0 ]
      then
        echo -e "${row1[i]}\t\t ${row2[j]}"
      else
        echo -e "${row1[i]}\t ${row2[j]}"
      fi
    fi
  done
done
IFS="$oldifs"
echo ""

echo '[OK] ...done'
