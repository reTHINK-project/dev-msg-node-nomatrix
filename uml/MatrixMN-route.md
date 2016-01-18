

@startuml "MatrixMN-routing.png"

autonumber

box "Runtime A" #LightBlue
  participant RuntimeA as A
  participant "ProtocolStub A" as AAStub
end box

box "Matrix-MN" #LightGray
  participant "WS-Handler A" as WSHA
  participant "Adress\nAllocation Man." as AAM
  participant "reTHINK-AS" as AS
    participant "Policy\nDecision" as PDP
    participant "Matrix HS" as HS
  participant "WS-Handler B" as WSHB
  participant "WS-Server" as WSS
end box

box "Runtime B" #LightBlue
  participant "ProtocolStub A" as AStub
  participant "Runtime B" as B
end box

opt both sides have connected stubs and registered hyperties
end

B --> AStub : sendMSG(from, to,\noffer/content)
AStub --> WSS : sendMsg(from, to,\noffer/content)
WSS --> WSHB : sendMsg(from, to,\noffer/content)

opt is the "from" from a foreign domain
  WSHB --> AAM: addHandlerMapping(from, WSHB)
end

opt handler mapping for "to" exists
  WSHB --> HS : sendMessage to\nown individual room

  HS --> AS : AS intercepts\nmessage event
  AS --> PDP : asks for policy decision
  PDP --> AS : return policy decision
  opt if permitted by PDP
    AS --> WSHA : send message\non behalf of A\nto A's individual room
    WSHA --> AAStub : send message(from, to,\noffer/content)
    AAStub --> A : send message(from, to,\noffer/content)
  end

else client side Protocol-on-the-fly needed

end  



@enduml
