#!/bin/sh

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
  echo "\n ### docker image $IMAGE already exists, will not overwrite it"
  echo "\n ### Please run >docker rmi $IMAGE first, if you want to create a fresh image"
fi


echo "\n ### setting up docker data folder ..."
  mkdir -p ./data/MatrixMN
  cp -r ../../dist/node_modules ./data/MatrixMN/
  cp ../../dist/*js ./data/MatrixMN/
  cp ../../dist/*yaml ./data/MatrixMN/
  echo "\n ## patching config.js with requested domain: $DOMAIN"

  sed "s/config.domain.*/config.domain = $DOMAIN/" -i ./data/MatrixMN/config.js
echo "\n ### ... done, data folder prepared"

echo "\n ### creating docker image (will take a while)..."
  docker build -t $IMAGE .
  docker images | grep $DOMAIN
if [ $? ]; then
  echo "\n ### ... done, docker image $IMAGE created"
else
  echo "\n ### ... somethink went wrong --> please check the console output"
  exit 1;
fi

echo "\n ### creating Matrix configuration for domain: $DOMAIN ..."
  DATA=$(realpath ./data)
  docker run -v $DATA:/data --rm -e SERVER_NAME=$DOMAIN $IMAGE generate

  echo "\n ## patching generated $DATA/homeserver.yaml to enable the reTHINK AS  and to allow user self-provisioning via http"

  sed 's/app_service_config_files: \[\]/app_service_config_files: \["\/data\/MatrixMN\/rethink-mn-registration.yaml"\]/' -i $DATA/homeserver.yaml
  sed 's/enable_registration: False/enable_registration: True/' -i $DATA/homeserver.yaml

echo "\n ### ... done, please check $DATA/homeserver.yaml for correctness"

echo "\n ### You can use the start.sh and stop.sh scripts to start and stop the matrixMN container"
