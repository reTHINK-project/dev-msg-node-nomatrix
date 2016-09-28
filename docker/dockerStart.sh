#!/bin/sh
docker rm nomatrix
docker run -it --name nomatrix --net=rethink -p 2701:2701 \
	-e "DOMAIN=rethink.tlabscloud.com" \
	-e "PORT=8001" \
	-e "REGISTRY=http://localhost:4567" \
	dev-msg-node-nomatrix "$1"
