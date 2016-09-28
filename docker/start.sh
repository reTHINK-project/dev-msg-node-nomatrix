#!/bin/sh

cd ${0%/*}
DIR=`pwd`
echo "DIR is " $DIR

echo "starting nomatrix MN ..."
docker ps | grep nomatrix

if [ $? -eq 0 ]; then
	echo "nomatrix MN container already started ... "
else 
	echo "starting nomatrix MN container in a screen session ..." 
	screen -d -m -S nomatrix $DIR/dockerStart.sh
	echo DONE!
fi
