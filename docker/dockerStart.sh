#!/bin/bash
docker rm nomatrix
if [ "$1" == "local" ]; then
	LOCALPARAM="-v /home/steffen/work/git/rethink/dev-msg-node-nomatrix:/opt/volume/nomatrix --entrypoint /bin/bash "
fi
docker run -it --name nomatrix --net=rethink -p 2701:2701 \
	-e "DOMAIN=matrix2.rethink.com" \
	-e "PORT=8001" \
	-e "REGISTRY=http://dev-registry-domain:4567" \
	$LOCALPARAM \
	dev-msg-node-nomatrix
