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

docker stop dev-msg-node-matrix 2>&1 >/dev/null

# print small docker ps for an overview
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
exit
