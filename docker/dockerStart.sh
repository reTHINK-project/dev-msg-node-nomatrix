#!/bin/bash
docker rm nomatrix
mkdir -p /opt/rethink/storage
if [ "$1" == "local" ]; then
	LOCALPARAM="-v /home/steffen/work/git/rethink/dev-msg-node-nomatrix:/opt/volume/nomatrix --entrypoint /bin/bash "
fi
docker run -it --name nomatrix --net=rethink -p 8001:8001 \
	-e "DOMAIN=matrix2.rethink.com" \
	-e "PORT=8001" \
	-e "REGISTRY=http://dev-registry-domain:4567" \
	-e "GLOBALREGISTRY =http://130.149.22.133:5002" \
	# set CLEARFLAG to "-clear" in order to delete the persisted subscription data
	-e "CLEARFLAG="" \
	# mount folder for persistence outside of docker container
	-v /opt/rethink/storage:/opt/storage \
	$LOCALPARAM \
	dev-msg-node-nomatrix
