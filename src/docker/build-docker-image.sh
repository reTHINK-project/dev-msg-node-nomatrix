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

if [ -z "$1" ]; then
  echo "======================================================================================"
  echo "You did not specify the name of the domain that this MatrixMN will be responsible for!"
  echo "\n Please run the script again with the name of the Matrix-domain as parameter."
  echo "e.g: $0 matrix1.rethink"
  echo "======================================================================================"
  exit 1
else
  DOMAIN="$1"
fi

IMAGE="dev-msg-node-matrix"

cd $(dirname $0)

docker images | grep $DOMAIN
if [ $? ]; then
  echo -e -n "\n### [ 1. ] docker image $IMAGE already exists, will not overwrite it"
  echo -e -n "\n### [INFO] Please run 'docker rmi $IMAGE' first, if you want to create a fresh image"
fi


echo -e -n "\n### [ 2. ] setting up docker data folder ..."
  mkdir -p ./data/MatrixMN
  cp -r ../../dist/node_modules ./data/MatrixMN/
  cp ../../dist/*js ./data/MatrixMN/
  cp ../../dist/*yaml ./data/MatrixMN/

echo -e -n "\n### [ 3. ] patching config.js with requested domain: $DOMAIN"
  sed "s/config.domain.*/config.domain = $DOMAIN/" -i ./data/MatrixMN/config.js
echo -e -n "\n### [ 3. ] ... done, data folder prepared"

echo -e -n "\n### [ 4. ] creating docker image (will take a while)..."
  docker build -t $IMAGE .
  docker images | grep $DOMAIN
if [ $? ]; then
  echo -e -n "\n### [ 4. ] ... done, docker image $IMAGE created"
else
  echo -e -n "\n### [ 4. ] ... somethink went wrong --> please check the console output"
  exit 1;
fi

echo -e -n "\n### [ 5. ] creating Matrix configuration for domain: $DOMAIN ...\n\n"
REALPATHEXISTS=$(realpath . 2>/dev/null)
if [[ "$REALPATHEXISTS""n" == "n" ]]; then
  realpath ()
  {
	f=$@;
	if [ -d "$f" ]; then
	base="";
	dir="$f";
	else
	base="/$(basename "$f")";
	dir=$(dirname "$f");
	fi;
	dir=$(cd "$dir" && /bin/pwd);
	echo -e -n "$dir$base"
  }
fi

  DATA=$(realpath ./data)
  docker run -v $DATA:/data --rm -e SERVER_NAME=$DOMAIN $IMAGE generate

  echo -e -n "\n### [ 6. ] patching generated $DATA/homeserver.yaml to enable the reTHINK AS  and to allow user self-provisioning via http"

  sed 's/app_service_config_files: \[\]/app_service_config_files: \["\/data\/MatrixMN\/rethink-mn-registration.yaml"\]/' -i $DATA/homeserver.yaml
  sed 's/enable_registration: False/enable_registration: True/' -i $DATA/homeserver.yaml
  sed 's/rc_messages_per_second.*/rc_messages_per_second: 10000/' -i $DATA/homeserver.yaml
  sed 's/rc_messages_burst_count.*/rc_messages_burst_count: 10000/' -i $DATA/homeserver.yaml

echo -e -n "\n### [ 6. ] ... done, please check $DATA/homeserver.yaml for correctness"
echo -e -n "\n### [ 7. ] You can use the start.sh and stop.sh scripts to start and stop the matrixMN container"
