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

IMAGE=dev-registry-domain
CONTAINER=dev-registry-domain

docker rm "$CONTAINER" 2>/dev/null && echo '[OK] '"$CONTAINER container removed from previous run" || echo '[FAILED] '"removing old $CONTAINER"

docker run --name="$CONTAINER" --net=rethink -e STORAGE_TYPE=RAM -e EXPIRES=3600 -p 4567:4567 "$IMAGE"
docker ps | grep "$CONTAINER" && echo '[OK] '"starting $CONTAINER" || echo '[FAILED] '"starting $CONTAINER"

echo '[OK] ...done'
