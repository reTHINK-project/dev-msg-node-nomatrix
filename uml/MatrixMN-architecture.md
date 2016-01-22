<!--
@startuml "MatrixMN-architecture.png"

node "Matrix based Messaging Node" as msg {

  node "MatrixMN Application service" as AppServices {
    node "Matrix-Client Man." as AS_CM
  }
  node "Address Allocation\nManagement" as AS_AA
  node "Websocket-Server" as WSS


  node "Connectors" as Conn {
    node "IdM\nConnector" as ConnIdM
    node "Registry\nConnector" as ConnMan
    node "End-User Device\nConnector" as ConnUser
    node "Network Server\nConnector" as ConnNet
  }

  node "ProtOFly-client" as ProtoStub {
    node "ProtoStub(s)" as Stubs
  }

  node "Matrix Homeserver" as HS {
    node "Room Man."
    node "Session Man."
    node "Routing"
  }

}
@enduml
-->
