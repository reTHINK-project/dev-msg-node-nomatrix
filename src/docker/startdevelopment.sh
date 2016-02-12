#!/bin/bash
DATA=$(realpath ./data)
IMAGE=dev-msg-node-matrix
CONTAINER=dev-msg-node-matrix

# remove MatrixMN.js so the messaging node can be started with gulp startmn
rm "$DATA/MatrixMN/MatrixMN.js" 2>/dev/null && echo '[OK] MatrixMN.js removed for development setup'

#remove old container
docker rm "$CONTAINER" 2>/dev/null && echo '[OK] '"$CONTAINER container removed from previous run"

# check if registry is running and if not start in background
docker ps | grep -q "dev-registry-domain" && echo '[OK] dev-registry-domain already started' || echo '[FAILED] please start dev-registry-domain'

# add domain entry to /etc/hosts to be able to reach the registry when using "gulp startmn"
if grep dev-registry-domain /etc/hosts | grep -q '127.0.0.1'
then
  echo '[OK] found registry entry in /etc/hosts'
else
  echo '[NOT FOUND] entry "dev-registry-domain" not found in /etc/hosts'
  # echo 'trying to add the hostname of "dev-registry-domain" to /etc/hosts'
  if [ -f `which sudo` ]
  then
    echo '[OK] sudo seems to be installed'
    echo '127.0.0.1	dev-registry-domain' | sudo tee -a /etc/hosts
  else
    # Am I root?
    if [ $EUID -ne 0 ]
    then
      echo '[PERMISSION NEEDED] please install sudo or run the following as root:'
      echo 'echo 127.0.0.1 >> dev-registry-domain	dev-registry-domain'
      exit
    fi
  fi
fi

# run dev-msg-node-matrix
if docker ps | grep -q "$CONTAINER"
then
  echo '[FAILED] container already started'
  echo "please stop the container with './stop.sh'"
  exit
else
  docker run --name="$CONTAINER" -d -p 8448:8448 -p 8008:8008 -p 3478:3478 -p 3478:3478/udp -p 3479:3479 -p 3479:3479/udp --link dev-registry-domain:dev-registry-domain -v "$DATA":/data "$IMAGE" start 1>/dev/null
  docker ps | grep -q "$CONTAINER" && echo '[OK] '"starting $CONTAINER with mounted data-folder $DATA"
fi

# print small docker ps for an overview
sleep 1
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
