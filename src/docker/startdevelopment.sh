#!/bin/bash

#
# Copyright 2016 PT Inovação e Sistemas SA
# Copyright 2016 INESC-ID
# Copyright 2016 QUOBIS NETWORKS SL
# Copyright 2016 FRAUNHOFER-GESELLSCHAFT ZUR FOERDERUNG DER ANGEWANDTEN FORSCHUNG E.V
# Copyright 2016 ORANGE SA
# Copyright 2016 Deutsche Telekom AG
# Copyright 2016 Apizee
# Copyright 2016 TECHNISCHE UNIVERSITAT BERLIN
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

DATA=`dirname $(readlink -f "$0")`"/data"
IMAGE=dev-msg-node-matrix
CONTAINER=dev-msg-node-matrix
GREPSTART='synapse.storage.TIME - '
GREPEND=' - INFO - - Total database time:'
STATUS="ok"

cd `dirname $(readlink -f "$0")`

printover () {
  printf "\r"
  for i in $(seq 1 $1)
  do
    printf " "
  done
  printf "\r"
}

# check if registry is running
if docker ps | grep -q "dev-registry-domain"
then
  echo '[OK] dev-registry-domain already started'
else
  echo '[FAILED] '"please start dev-registry-domain - you can use 'gulp startregsitry'"
  STATUS="failed"
  exit 1
fi

# Development specific changes start here
# remove MatrixMN.js so the messaging node can be started with gulp startmn
rm "$DATA/MatrixMN/MatrixMN.js" 2>/dev/null && echo '[OK] MatrixMN.js removed for development setup'

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
    echo "127.0.0.1\tdev-registry-domain" | sudo tee -a /etc/hosts
  else
    # Am I root?
    if [ $EUID -ne 0 ]
    then
      echo '[PERMISSION NEEDED] please install sudo or run the following as root:'
      echo 'echo "127.0.0.1\tdev-registry-domain" | sudo tee -a /etc/hosts'
      exit
    fi
  fi
fi

# make sure the Matrix Homeserver finds the messaging node
IPADR=$(ip -4 a s docker0 up | grep -Eo '((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])' | grep -m1 '.*')
sed -i 's/localhost'/$IPADR/ data/MatrixMN/rethink-mn-registration.yaml
grep -Eoq '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' data/MatrixMN/rethink-mn-registration.yaml && echo '[OK] '"Matrix AS IP changed to $IPADR, Matrix HS can now find MatrixMN / MatrixAS"
# Development specific changes end here

# stop already running container
if docker ps | grep -q "$CONTAINER"
then
  echo '[WARNING] container already started'
  stopping='[..] '"stopping the container $CONTAINER ..."
  size=${#stopping}
  echo $stopping
  ./stop.sh 2>&1>/dev/null
  printover $size
  echo '[OK] '"$CONTAINER has been stopped"
fi

#remove old container
docker rm "$CONTAINER" 2>&1>/dev/null && echo '[OK] '"$CONTAINER"' container removed from previous run'

# run dev-msg-node-matrix
docker run --name="$CONTAINER" --net=rethink -d -p 8448:8448 -p 8008:8008 -v "$DATA":/data "$IMAGE" start 1>/dev/null
#-p 3478:3478 -p 3478:3478/udp -p 3479:3479 -p 3479:3479/udp # turnserver
if docker ps | grep -q "$CONTAINER"
then
  echo '[OK] '"starting $CONTAINER with mounted data-folder $DATA"
else
  echo '[FAILED] '"starting $CONTAINER with mounted data-folder $DATA"
  STATUS="failed"
  exit 3
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

# wait for $CONTAINER to be started
WAITINGCONTAINER='[..] '"waiting for the container $CONTAINER to be ready (may take a while) ..."
size=${#WAITINGCONTAINER}
echo -n $WAITINGCONTAINER
i=0
until docker logs "$CONTAINER" 2>&1 | grep "$GREPSTART" | grep -q "$GREPEND"
do
  if [[ "$STATUS" != "ok" ]]
  then
    printover $size
    echo '[FAILED] '"waiting for $CONTAINER to start up"
    exit 4
  fi
  if docker logs "$CONTAINER" 2>&1 | grep -iq error
  then
    # check for errors
    notok=$(docker logs "$CONTAINER" 2>&1 | grep -icq error)
    okay1=$(docker logs "$CONTAINER" 2>&1 | grep -icq "verror@")
    if [ "$notok" != "$okay1" ]
    then
      STATUS="failed"
    fi
  fi
  if (( "$i" >= "100" ))
  then
    printover $size
    echo '[FAILED] '"waiting for $CONTAINER to start up takes too long"
    exit 5
  fi
  ((i=i+1))
  sleep 1
done
printover $size
#printf "\r%-${COLUMNS}s" '[OK] '"$CONTAINER has finished starting up\n"
echo '[OK] '"$CONTAINER has finished starting up                                         "
echo '[OK] ...done'
