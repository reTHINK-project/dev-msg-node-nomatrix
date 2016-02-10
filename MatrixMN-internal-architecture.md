
#### MatrixMN internal architecture

##### General considerations, requirements and decisions

Matrix.org is a very vital and active project with frequent releases and new surrounding developments and projects. However, the provided API's are rather stable and backward compatible as seen so far. For that reason the first and most important decision for the design of the Matrix based messaging node was made:
- Don't touch the core of the Homeserver implementation! Just implement components that use standard API's to add the required functionalities!

If the reTHINK concepts of Protocol Stubs and Messaging Nodes are translated to the Matrix.org concepts, it seems like the Stubs map well to Matrix clients and the Messaging Nodes to Matrix Homeservers.

As described before, a Matrix client communicates to a Homeserver via a REST protocol. Several available SDKs encapsulate this protocol, so that - at the end - it is not obvious for the implementor of a client, when and how much traffic is generated between client and HS. Furthermore the SDKs come with a set of dependencies that potentially blow up the size of a Stub and make its deployment more complicated.

For these reasons it was decided that:
- The stub should be kept as small and simple as possible to ensure easy deployment.
- The real Matrix REST communication should be limited to the Messaging Node internally while the communication protocol between Stub and Messaging Node can be implemented differently.

Another challenge is that Matrix.org requires provisioned users and established room relationships between them to perform a communication. The establishment of a room relationship between two users is a process that requires several round-trip message exchanges between their corresponding clients and rather complex state monitoring. This process can take potentially too long and might lead to unacceptable delays for an ad-hoc message exchange between two Runtimes. Furthermore this would produce a lot of persistent room relationships in the Matrix Homeservers which might never be re-used again.

Therefore following requirements for the design of the Matrix based Messaging Node were identified:
- The Messaging node must support an automatic provisioning of Matrix users on-the-fly.
- The message routing must not depend on fully established room relationships between the matrix users that correspond with the "from" and "to" addresses of a retHINK message.

These 5 decisions guided the architecture approach that is described in the following section.

##### Matrix Messaging Node architecture
The figure below illustrates the high-level architecture of the Matrix Messaging Node. The Matrix Homeserver itself is left unchanged. It was decided to wrap all additional functionalities into an Application Service that communicates via standardized APIs with the HS.

The reTHINK AS includes a WebSocket Server component that is the endpoint for connection requests from Protocol Stubs, which are deployed and running in reTHINK Runtimes. The Matrix Client - Manager is then responsible to identify the connected Stubs/Runtimes and to maintain the life-cycle of a dedicated Matrix Client instance for this particular Stub-/Runtime-connection. This includes the instantiation and also the re-assignment of Matrix Clients to stubs, in case of re-connections, for instance after a network interruption.

![Figure @matrix-address-allocation](MatrixMN-Architecture.png)

Due to the trust-relationship of the Application Service, the Matrix Client Manager is allowed to create and auto-provision Matrix Clients on-the-fly. These Matrix Clients then communicate with the HS core via standard client API's.

The Address-Allocation Manager handles CREATE requests to the address-allocation part of the Messaging Node. It creates addresses that can be used to address Hyperties in the connected Runtimes and keeps their relation to the connected Stub.

The Registry connector handles requests to fetch user data from the domain registry or to register Hyperties with the allocated addresses. Furthermore the Policy Enforcement Point component allows to block message flows according to policies which can be managed from remote via the Policy Management Connector. Additional connectors can be implemented and used to manage or control certain aspect of the message routing.

##### Dynamic Views

The following sequence chart shows the processes for the connection of a Protocol Stub at the Messaging Node, the allocation of a hyperty address and the registratio of this address at the domain registry.

![Figure @matrix-address-allocation](MatrixMN-Allocation.png)
- 1-2: The Stub is initialized and connected by the Runtime (simplified) and the Runtime sends a CREATE message to the address-allocation module of the Messaging Node.

- 3: The Stub connects with the WS-Server for the first time and provides the RuntimeID as identifier.
- 4: The WS-Server assigns the given RuntimeID to the Websocket.
- 5-6: The Client Manager creates and inititializes a Matrix Client for the given RuntimeID.
- 7-8: The Matrix Client inititializes (connects to the HS, syncs etc.) and creates its individual room.
- 10: In case of a re-connection, the Client Manager only updates the relation between the existing client and the new Websocket
- 11: The WS-Server receives the address allocation request from the Stub
- 12 -15: The Address Allocation Manager is invoked to create a new address, which is returned to the Runtime via the Protocol Stub
- 16-21: These steps show the flow for a message to create a hyperty registration. It invokes the Registry Connector that interacts with the domain registry to perform the registration. The response will be returned via the corresponding stub to the Runtime

In order to avoid expensive creation of bi-lateral room relationships and to allow to block messages depending on policies, it was decided that the AS acts as a "man-in-the-middle" between sender and receiver. To achieve this, each Matrix Client creates a private individual room with no other invited or joined members during its Initialization.

The alias name of these rooms starts with a defined prefix "#\_rethink\_". The AS is configured to monitor such rooms. Every message that arrives via the Stub will then only be sent to the individual room of the sender. The AS receives the message and can perform the required policy decisions. If everything is OK, then the message is forwarded to the room that corresponds to the user in the "to"-field of the message. The Matrix client, that is the owner of the receivers individual room, receives the message and will send it to the receivers Runtime via the connected Stub.

The following sequence chart illustrates this routing principle.

![Figure @matrix-message-routing](MatrixMN-routing.png)

This sequence starts with the precondition that both sides (Runtimes A and B) have connected a stub with the Matrix Messaging Node, that Runtime A has registered a Hyperty and Runtime B knows its address.

- 1-2: Runtime B sends a message (e.g. an call invitation) via the Stub to the Websocket Server
- 3: The Client Manager looks up the Matrix-Client that is responsible for this Runtime
- 4: If the "from"-field is not for the own domain, a mapping of this "from" address to the Matrix Client is created. This is required to investigate the return route in requests that have been initiated from a foreign domain.
- 6: The client Manager forwards the message to the client that is responsible for B's connected Stub and this one sends it to its own individual room.
- 7-9: The reTHINK Application Server receives the message, because it monitors the individual rooms and invokes the policy component to get a decision about the further handling of the message.
- 10: In case of a positive decision, the AS sends the message to client A's individual room.
- 11-12: The message is forwarded via A's Protocol stub to Runtime A


#### Matrix Messaging Stub

Due to the described architecture where the real Matrix REST communication is kept on the server side, the protocol stub can be kept very small and simple. It implements a Websocket client that automatically connects to the WS-Server as soon as a message is going to be sent. During the connection establishment it forwards the RuntimeID, that it was created for, to the Server, so that the Messaging Node can identify and correctly assign this stub also after potentially interruptions and re-connections.

The Messaging Stub is integrated with the Runtimes Messaging Bus. Each message that is received via the Websocket is forwarded to the bus and will be routed there to the correct receiver.

Furthermore the Stub uses the Bus to publish events about its internal status, especially on changes of its connection state.
