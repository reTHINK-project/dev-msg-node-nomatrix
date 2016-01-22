#!/bin/sh
DATA=$(realpath ./data)
IMAGE=rethink-matrixmn
CONTAINER=dev-msg-node-matrix

# remove MatrixMN.js so the messaging node can be started with gulp startmn
rm "$DATA/MatrixMN/MatrixMN.js" 2>/dev/null && echo '[OK] MatrixMN.js removed for development setup'

docker rm $CONTAINER 2>/dev/null && echo '[OK] '"$CONTAINER"' container removed from previous run'

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


docker run --name="$CONTAINER" -d -p 8448:8448 -p 8008:8008 -p 3478:3478 -p 3478:3478/udp -p 3479:3479 -p 3479:3479/udp --link dev-registry-domain:registry -v "$DATA:/data" "$IMAGE" start 1>/dev/null
docker ps | grep "$CONTAINER" && echo '[OK] '"starting $CONTAINER with mounted data-folder $DATA"

echo '[OK] ...done'
