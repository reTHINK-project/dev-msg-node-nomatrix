# dev-msg-node-matrix
The repository for the Matrix.org based message node.
The MN code does not modify any Matrix.org specific code. It only adds componentes "around" an untouched Matrix Homeserver (HS).

### Contents of this repository:
- **./src/mn** ... The node.js sources for the MatrixMN
- **./src/stub** ... The sources for the Protocol stub
- **./test** ... Test cases for the execution of following tasks:
  - Intra-domain connection to the Matrix MN with an accessToken as credentials
  - Intra-domain connection to the Matrix MN with user/password as credentials
  - Extra-domain connection to the Matrix MN without credentials
  - 2 Intra-domain connections, allocation of 2 hyperty addresses and ping/pong messages between them
  - One Intra-domain connection incl. address allocation, one Extra-domain connection and ping/pong messages, initialized from external domain

**NOTE:**
In order to operate, the MatrixMN needs a Matrix.org HS running that is configured with the MatrixMN Application service details/credentials.
***See below for quickstart instructions for the setup of a dockerized Matrix based MN***

***TODOs:***
- describe setup of a Matrix.org HS as docker container (refer to https://hub.docker.com/r/silviof/docker-matrix/ for initial information.)
- describe configuration of the MatrixMN as Application Service in the HS (i.e. howto link the MatrixMN code with the HS)

### Configuration

The configuration of the MatrixHS details can be done in *./src/mn/MatrixMN*, by modifiying the attributes of the JSON Object MN_CONFIG.
- WS_PORT : The Port that the MN uses to open a Websocket server (default 8011)
- homeserverUrl: The URL of the Homeserver to connect to (e.g. "http://localhost:8008")
- domain: The domain that the MatrixMN is responsible for. Must correspond to the configuration of the HS (default: matrix.docker)
- registration: The file that holds the registration details for the MatrixMN Application service (default: "rethink-mn-registration.yaml")

### Initialization and Operation of the MatrixMN
- ensure that you have a global installation of the gulp task-runner. If not: ***sudo npm install -g gulp***
- first execute ***npm install*** to install the dependencies
- execute ***gulp help*** to see a list of available commands

- ***gulp build*** just transpiles the code to ./dist
- ***gulp dist*** ensures that the ./dist folder contains a self-contained runnable version of the MN
- ***gulp startmn*** builds, deploys and runs the MatrixMN
- ***gulp test*** executes the testcases


### Setting up a docker image for the Matrix MN

The Matrix MN Docker image is based on the Matrix HS image from https://github.com/silvio/docker-matrix. The corresponding Dockerfile and some tooling scripts are available in folder **./dist/docker** after a successful execution of ***gulp dist***.

***NOTE:*** If you want to create the Docker image on a separate machine, you have to copy the ./dist folder to that machine and perform the following steps there.

- change to ./dist/docker
- run ***./build-docker-image.sh matrix1.rethink*** (where matrix1.rethink stands for the domain name that is currently also used by the testcases. If you choose a different name and want to execute the tests, also the configuration of the testcases must be adapated.)
- wait a while
- if things went right, there should be a new docker image "rethink-matrixmn"
- execute ***./start.sh*** from "./dist/docker" folder to start the docker container (name is "matrixmn")
- the start-script takes care of port-mappings, shared folder config etc.
- use ***./stop.sh*** from "./dist/docker" folder to stop the docker container



