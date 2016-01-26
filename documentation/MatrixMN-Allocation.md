

@startuml "MatrixMN-Allocation.png"

autonumber

box "Runtime A" #LightBlue
  participant RuntimeA as A
  participant ProtocolStub as AStub
end box

box "Matrix-MN" #LightGray
  participant "WS-Server /\n Client-Manager" as WSS
  participant "Matrix-Client" as WSH
  participant "Address\n Allocation Man." as AAM
  participant "Registry\nConnector" as RegCon
end box

box "Registry" #LightBlue
  participant "Domain\nRegistry" as Reg
end box

A -> AStub: createStub(RuntimeID)
A -> AStub: Msg: allocate Address

opt first connect ?
  AStub -> WSS : connect(RuntimeID)

  WSS --> WSS : assign WS to RuntimeID
  WSS --> WSH : create client for RuntimeID
  WSS --> WSH : initialize client
  WSH --> WSH : instantiate and \nsync Matrix Client
  WSH --> WSH : create individual room
  WSH --> WSS : initialized
else re-connect
  WSS --> WSS : assign/update WS to RuntimeID
end

  AStub --> WSS: Msg: allocate address

opt is allocate msg ?
  WSS --> AAM : allocateAddress()
  AAM --> WSS : return address
  WSS --> AStub: sendResponse(address)
  AStub --> A: sendResponse(address)
end

A -> AStub: Msg: register hyperty
AStub -> WSS: Msg: register hyperty

opt is register msg ?
  WSS -> RegCon : register Hyperty( )
  RegCon -> Reg : register Hyperty( )
  Reg -> RegCon : RESPONSE
  RegCon -> WSS : RESPONSE
  WSS -> AStub : send Response
  AStub -> A : send Response
end

@enduml
