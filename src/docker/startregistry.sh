IMAGE=dev-registry-domain
CONTAINER=dev-registry-domain

docker rm "$CONTAINER" 2>/dev/null && echo '[OK] '"$CONTAINER container removed from previous run" || echo '[FAILED] '"removing old $CONTAINER"

#docker run --name="$CONTAINER" -p 4567:4567 "$IMAGE"
docker run --name="$CONTAINER" --net=rethink -p 4567:4567 -e STORAGE_TYPE=RAM -e EXPIRES=3600 "$IMAGE"
docker ps | grep "$CONTAINER" && echo '[OK] '"starting $CONTAINER" || echo '[FAILED] '"starting $CONTAINER"

echo '[OK] ...done'
