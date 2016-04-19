## Matrix.org based Message Node (MatrixMN)

### Overview

#### Functional location in the reTHINK Architecture
The Matrix.org based Message Node is one of the reference implementations of the Message Node component in the reTHINK Architecture. The overall role of Message Nodes in the reTHINK Architecture is described in detail in [Hyperty Messaging Framework](https://github.com/reTHINK-project/dev-service-framework/blob/d3.2-working-docs/docs/manuals/hyperty-messaging-framework.md).

A general documentation and guideline for the development of Message nodes is given in [Message Nodes and Protostubs Development](https://github.com/reTHINK-project/dev-service-framework/blob/d3.2-working-docs/docs/manuals/development-of-protostubs-and-msg-nodes.md).

#### Dependencies
One of the responsibilities of Message Nodes in the reTHINK architecture is to perform the interactions with the Domain registry. Runtimes send special messages to the Message Nodes to register or query hyperties or data objects at the domain registry. The Message Nodes have to perform the interactions with the registry component and return the results back to the Runtime.

For that reason the Matrix Message Node has a dependency from the domain registry component. That means, before a MatrixMN can be used successfully, an instance of the domain registry must be running. The procedures to achieve this are described in the following section.

### User View

This chapter provides instructions for the setup, configuration and operation of the Matrix Message Node as a docker container.
Assuming you are running a standard Debian 8 Jessie the following steps can be used to setup the environment. Other distributions my need a different setup.

#### 1. Installation of NodeJS and Docker
You need to set up the following requirements.
- [nodejs 5.x](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions)
  - nodejs-legacy for Debian (Ubuntu might not need this)
- [docker](https://docs.docker.com/engine/installation/debian/)
  - If the docker daemon cannot be reached you need to run `sudo usermod -aG docker $USER`. After that logout and back in or use this command `su - $USER`.
  - If the test `sudo docker run hello-world` fails you may need a different kernel. Some kernels like those provided by OVH are not working with docker.

#### 2. Installation of repository-tools and cloning the repository
Execute these commands to install the needed tools and dependencies.
```
sudo npm install -g gulp
git clone https://github.com/reTHINK-project/dev-msg-node-matrix.git
cd dev-msg-node-matrix
npm install
sudo npm install github:rethink-project/dev-service-framework#develop
```

#### 3. Building the MatrixMN
Afterwards you can build the MatrixMN distribution. Please make sure you are located in the `dev-msg-node-matrix` directory. Simply type `pwd` to check that. Then run the following commands.
```
rm -rf dist && gulp dist
docker network create --driver bridge rethink
gulp builddocker matrix1.rethink
```
The last parameter `matrix1.rethink` specifies the domain name for MatrixMN.

When errors occur while building MatrixMN which relate to 404 errors you might want to check your Docker DNS settings.
Try editing `/etc/default/docker` and uncomment the line `#DOCKER_OPTS="--dns 8.8.8.8 --dns 8.8.4.4"`.
You can also add the DNS servers of your company.
The resulting line may look like this one `DOCKER_OPTS="--dns 8.8.8.8 --dns 8.8.4.4 --dns 10.1.100.252 --dns 10.1.100.246"`.

Build the image again and if the errors continue to show up you can check the `/etc/resolv.conf` file.
It should have a line or lines containing something similar to `search company.tld lan lan.` or `nameserver 10.1.100.252`.

#### 4. Building the Registry
As described in the Overview section, the MatrixMN has a dependency to a domain registry, because it needs to interact with this Registry to register and read hyperties and data objects for user-ids.

Therefore the domain registry must be built and started before the MatrixMN can be used. Please change to the `dev-registry-domain/server` directory after cloning it from https://github.com/reTHINK-project/dev-registry-domain.git in a place of your choice. Then run:
```
docker build -t dev-registry-domain .
docker images
```
Now you should see the 2 docker images which were built.

#### 5. Starting the Registry
The first image to be started is the registry.
```
# cd to dev-msg-node-matrix or a subdirectory
gulp startregistry
```
If this fails you probably have named you registry differently in step 4.

#### 6. Starting the MatrixMN
Open another terminal and execute the following.
```
# cd to dev-msg-node-matrix or a subdirectory
gulp start
```

The MatrixMN will now start which might take a while. You can check manually whether it is finished by executing
```
docker logs dev-msg-node-matrix
```

and looking for the last line being similar to:
> `synapse.storage.TIME - 212 - INFO - - Total database time: 0.000% {get_all_pushers(0): 0.000%,`


##### 7. Testing
Finally you can test the correctness of the setup.
```
#cd to dev-msg-node-matrix or a subdirectory
gulp test
```
The test will attempt to open the google chrome browser. If none of the tests are executed you might need to install it with `sudo apt-get install chromium-browser`.


### Developer view

The MatrixMN code does not modify any Matrix.org specific code. It only implements additional components that can be attached to an untouched Matrix Homeserver (HS).
This additional code is written in JavaScript, which is executed in a nodejs runtime.

#### Suggested documentation
Detailed information about the main concepts of the Matrix.org  infrastructure can be found in this high-level **[Matrix-Overview](./Matrix-Overview.md)**.

In order to understand the internal architecture of the MatrixMN the documentation at **[MatrixMN-internal-architecture](./MatrixMN-internal-architecture.md)** is suggested.

#### Structure of the GitHub repository
The "dev-msg-node-matrix" GitHub repository is structured as follows:

- **./src/mn** ... The node.js sources for the MatrixMN
- **./src/stub** ... The sources for the Protocol stub
- **./src/docker** ... Scripts and additional files required for the setup of a dockerized version of the Matrix Message Node
- **./test** ... Test cases for the Matrix Message Node

#### Development setup
To setup the repository for developments on the MatrixMN, follow first the steps described in the "User View" chapter before.
With the resulting setup the MatrixMN code will be executed inside of the docker container. That means that for each change on the MN code the docker container must be restarted. Otherwise the changes take no effect. This is of course not very comfortable for coding and testing in short cycles.

To improve this situation, the MatrixMN can also be operated as a stand-alone NodeJS process outside of the docker container. However, this requires some manipulations on the setup of the container.

Since the MatrixMN operates as an Application Service (AS) for the Matrix HomeServer, the HomeServer must be able to address the AS for sending requests. If the AS is in the same container this address is always *localhost*. If we run it outside this does not work anymore.

Following steps must be performed to make it work:

1. Identify the hosts address on the docker bridge. Execute:
```
ip a
```
and search for the ip address corresponding to the "docker0" bridge interface (may be named similar)

2. Edit ```./src/mn/rethink-mn-registration.yaml```. Replace localhost with this ip-address.

3. Execute step 3 (Building the MN) of the installation instructions

4. Start the Matrix docker container without the MatrixMN code
```
#cd to dist/docker
./startdevelopment.sh
```

5. execute the MatrixMN stand-alone
```
gulp startmn
```

Now you can perform changes and extension on the Matrix MN implementation (below directory ./src/mn) and do a
```
gulp build && gulp dist && gulp startmn
```
whenever you want to test your changes without the need to restart the full docker container.

If your development is done, change the configuration in rethink-mn-registration.yaml back to "localhost", stop the docker container, perform step 3 again and start the container with the built-in MatrixMN code.
