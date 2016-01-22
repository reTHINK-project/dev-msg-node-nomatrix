<!--
@startuml "MatrixMN-architecture.png"


node "Management Services" as Man1 {
    node "Registry" as Server1
    node "Identity Management" as IdM1

}

node "Service Provider 2\n(ProtOFly-Server)" as SP2 {
    node "Messaging\nNode" as Msg2
    node "Repository\nServer" as Repo2
}

node "End-User Device 1" as User1 {
    node "Hyperty" as H1
}

node "Service Provider 1\n(ProtOFly-Client)" as SP1 {
    node "Messaging\nNode" as Msg1
    node "Repository\nServer" as Repo1
}

node "Matrix based Messaging Node" as msg {

 node "Application Services" as AppServices {
   node "Connectors" as Conn {
    node "IdM\nConnector" as ConnIdM
    node "Registry\nConnector" as ConnMan
    node "End-User Device\nConnector" as ConnUser
    node "Network Server\nConnector" as ConnNet
   }
   node "ProtOFly-client" as Proto1Sand {
     node "SP2 ProtoStub" as Proto1
   }
   node "Address Allocation\nManagement" as ID
 }


node "Matrix Homeserver" as core {
 node "*            Message      Bus                *" as Bus
 node "Session Management" as Reg
}

node "Matrix Proxy" as proxy {
  node "Access Control\nPEP" as BusPEP
  node "Message Proxy" as MsgProxy
}

Repo2 ..down-> Proto1: provide

Msg2 <-left-> Proto1 : communicate

 Bus <-right-> Proto1

 BusPEP ..down-> MsgProxy : enforce

 MsgProxy -> Bus : forward

 Msg1 <-left-> MsgProxy : communicate

 ConnIdM ..down-> BusPEP : authorise

 BusPEP .down-> Reg

 Reg .left. ID

 Reg <-up. Bus: session valid?

 ConnIdM <-up-> IdM1 : authorise

 Bus <-up-> ConnUser : communicate
 ConnUser <-up-> H1 : communicate

 Bus <-up-> ConnNet : communicate
 ConnNet <-up-> H3 : communicate

 Bus <-up-> ConnMan : communicate
 ConnMan <-up-> Server1 : communicate
    }

@enduml
-->
