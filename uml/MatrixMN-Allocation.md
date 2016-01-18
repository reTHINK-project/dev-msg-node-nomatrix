

@startuml "MatrixMN-Allocation.png"

autonumber

box "Runtime A" #LightBlue
  participant RuntimeA as A
  participant ProtocolStub as AStub
end box

box "Matrix-MN" #LightGray
  participant "WS-Server" as WSS
  participant "Adress Allocation Man." as AAM

  participant "WS-Handler" as WSH
end box

box "Registry" #LightBlue
  participant "Registry" as Reg
end box

A -> AStub: createStub(RuntimeID)
A -> AStub: Msg: allocate Address

opt first connect
  AStub -> WSS : connect(RuntimeID)

  WSS --> WSH : create WSH for Stub
  WSS --> WSH : initialize WSH
  WSH --> WSH : instantiate and \nsync Matrix Client
  WSH --> WSH : create individual room
  WSH --> WSS : initialized
  WSS --> WSS : Assign WS to RuntimeID
  WSS --> WSH : construct WebSocket Handler
  WSS --> AAM : Assign WSH to RuntimeID

end

  AStub --> WSS: Msg: allocate Address
  WSS --> WSH: Msg: allocate Address

opt ? isAllocateMsg()
  WSH --> AAM : allocateAddress()
  WSH --> AStub: sendResponse(address)
  AStub --> A: sendResponse(address)
end

A -> AStub: Msg: register hyperty
AStub -> WSS: Msg: register hyperty
WSS -> WSH: Msg: register hyperty

opt ? isRegisterMsg()
  WSH -> Reg : register Hyperty( )
  Reg -> WSH : RESPONSE
  WSH -> AStub : send Response
  AStub -> A : send Response
end

@enduml
