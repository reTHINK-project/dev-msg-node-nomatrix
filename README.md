## The "NoMatrix" Message Node (NoMatrixMN)

### History
The name "NoMatrix" of this MN is caused by its history. The initial work was done for a Matrix based  message node (http://matrix.org).
You can find this base project here: https://github.com/reTHINK-project/dev-msg-node-matrix. The NoMatrixMN is a fork of this work, but all dependencies to Matrix libs and functionalities for routing calls have been removed. Matrix's architecture is using http/https for its message routing, which lead to performance bottlenecks. The NoMatrix MN was derived to provide all required reTHINK features but with a much better performance.

> NOTE: Due to this historical relation, both MNs can be accessed via the same MatrixProtostub. There is no new stub required for the NoMatrixMN.

### Overview

#### Functional location in the reTHINK Architecture
The NoMatrix.org based Message Node is one of currently 4 different reference implementations of the Message Node component in the reTHINK Architecture. The overall role of Message Nodes in the reTHINK Architecture is described in detail in [Hyperty Messaging Framework](https://github.com/reTHINK-project/specs/tree/master/messaging-framework). Details of the general MN architecture can be found in [Messaging Node Architecture]( https://github.com/reTHINK-project/specs/blob/master/messaging-framework/msg-node.md)

A general documentation and guideline for the development of Message nodes is given in [Message Nodes and Protostubs Development](https://github.com/reTHINK-project/specs/blob/master/tutorials/development-of-protostubs-and-msg-nodes.md).

#### Dependencies
One of the responsibilities of Message Nodes in the reTHINK architecture is to perform the interactions with the Domain registry. Runtimes send special messages to the Message Nodes to register or query hyperties or data objects at the domain registry. The Message Nodes have to perform the interactions with the registry component and return the results back to the Runtime.

For that reason the NoMatrix Message Node has a dependency to the domain registry component. That means, before a NoMatrixMN can be used with full functionalities, an instance of the domain registry must be running. The procedures to setup and operate a domain registry are described at [dev-registry-domain](https://github.com/reTHINK-project/dev-registry-domain)

The NoMatrix MN is implemented in JavaScript (ES6) and requires a NodeJS (version 6.x preferred) environment to be executed. It is also prepared to be operated in a docker container, a Dockerfile is provided as part of this repository.


### User View

This chapter provides instructions for the setup, configuration and operation of the NoMatrix Message Node as a stand-alone process or as a docker container.
Assuming you are running a standard Debian 8 Jessie the following steps can be used to setup the environment. Other distributions my need a modified setup.

#### NoMatrix MN stand-alone operation

##### 1. Installation of NodeJS

Since the version of NodeJs in the Debian repositories is quite outdated, the preferred installation method is via the installation procedure described at: [nodejs 6.x](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions)

This includes these two steps:
```
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs
```


#### 2. Cloning the repository and transpiling the sources
Execute these commands to install the needed tools and dependencies.
```
sudo apt install git
git clone https://github.com/reTHINK-project/dev-msg-node-nomatrix.git
cd dev-msg-node-nomatrix
sudo npm install
```
Now the sources can be built:
```
npm run build
```

#### 3. Configuration and execution
The NoMatrixMN supports 3 configuration parameters for its operation. Two of them are mandatory.

option         | mandatory     | description
---------------|-------------- | ---------------------------
-domain, -d    | mandatory     | the domain that the MN is responsible for (e.g. rethink.tlabscloud.com)
-registry, -r  | mandatory     | the full URL of the Domain Registry incl. the port number (e.g. http://localhost:4567)
-port, -p      | optional      | the Websocket port that the MN is listening to (default: 8001)

These configurations can be provided as command line parameters to the start of the MN:
```
node dist/NoMatrixMN -d rethink.mydomain.com -r http://localhost:4567 -p 2701
```

Please note again that for a fully operational MN a running domain-registry is required! You can find the instructions for the setup and operation of the domain-registry here [dev-registry-domain](https://github.com/reTHINK-project/dev-registry-domain).

> As an alternativ to providing command-line options you can also modify the default configuration in src/mn/config.js.


#### NoMatrix MN as docker container

##### 1. Docker installation

The full documentation of the docker installation is out-of-scope for this document. Please refer to [docker](https://docs.docker.com/engine/installation/debian/) for detailled instructions.

##### 2. Building the docker image
> The NoMatrixMN will soon be available as prepared image on [dockerhub](https://hub.docker.com), which will make this build step unneccessary in the future.

In order to build the NoMatrixMN perform these steps:
```
#cd to dev-msg-node-nomatrix/docker
docker build -t dev-msg-node-nomatrix .
```
This process will take a while. Once it is finished you can check with
```
docker images
```
that you have a new image tagged as "dev-msg-node-nomatrix" in your image list.

##### 2. Running the NoMatrixMN docker image

In order to support the execution of the MN as docker image you can use the **dockerStart.sh** script that you can find in the **docker** folder. This script looks as follows:
```
#!/bin/bash
docker rm nomatrix
if [ "$1" == "local" ]; then
        LOCALPARAM="-v /home/steffen/work/git/rethink/dev-msg-node-nomatrix:/opt/volume/nomatrix --entrypoint /bin/bash "
fi
docker run -it --name nomatrix --net=rethink -p 8001:8001 \
        -e "DOMAIN=matrix2.rethink.com" \
        -e "PORT=8001" \
        -e "REGISTRY=http://dev-registry-domain:4567" \
        $LOCALPARAM \
        dev-msg-node-nomatrix
```
This example script:
- deletes a potentially existing container with of "nomatrix", so that it can be re-used
- runs the docker image "dev-msg-node-nomatrix" in an interactive mode (-it),
- gives the name "nomatrix" to the created container,
- indicates that it shall use a custom docker network of name "rethink" (must be pre-existing),
- defines a port-forwarding of the containers port 8001 to the hosts port 8001,
- specifies the already known configuration options as environment variables (capitalized) inside the docker container

> NOTE:

> The custom network "rethink" is used here, because it is much more flexible than the alternativ method of "host" networking, where all containers share the hosts network and must fight with other containers for the ports they want to claim. If you want to use "host" networking instead then the -p directive with the port mappings is not required.

> The LOCALPARAM part is just for local testing situations where you might want to run the MN from sources on a locally mounted volume instead of the dockerized sources.

In case you want to run the docker containers in a [GNU screen](https://www.gnu.org/software/screen/) you can use the **start.sh** and **stop.sh** that wrap the docker start/stop procedure in a screen-session.

### Developer view

The NoMatrixMN is written in ECMAScript 6 (ES6). In order to be executed on a NodeJs environment, it must be transpiled to ES5. This section explains how this is done.


#### Structure of the GitHub repository
The "dev-msg-node-nomatrix" GitHub repository is structured as follows:

- **./src/** ... The sources for the NoMatrixMN and the protocol stub
- **./docker** ... Scripts and additional files required for the setup of a dockerized version of the Message Node


#### Development setup

##### Preparations
In order to start the development and testing of the NoMatrixMN you just need a proper installtion of NodeJs as described above.

##### Build and run
There is a simple npm based tooling that provides the compilation/transpilation of the ES6 code to ES5.
Run
```
npm run build
```
to transpile the source. If all runs well the resulting ES 5 code is placed into the ./dist folder.

It can be executed there either via:
```
node dist/NoMatrixMN
```
> NOTE: If you omit the command-line parameters, the MN will use the configuration from **src/mn/config.js**.

or via:
```
npm start
```
> NOTE: The npm start method does not accept the described command line parameters. Instead you can set the environment variables DOMAIN, PORT and REGISTRY.

##### Testcases
The NoMatrix MN does not come with it's own testcases. There is a common set of testcases for all Messaging Node implementations. They can be used to verify the correct behaviour of the MN according to the specification.

You can find them including a Quickstart documentation at [Message Node tests](https://github.com/reTHINK-project/testbeds/tree/master/dev/mntest).

> TODO: The testbed repo is private and the testcases are therefore not accessible.
