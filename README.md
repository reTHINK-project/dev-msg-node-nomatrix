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
***The Matrix HS is not part of this repository.***

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

- ***gulp startmn*** builds, deploys and runs the MatrixMN
- ***gulp test*** executes the testcases
