

@startuml "MatrixMN-routing.png"

autonumber

box "Runtime A" #LightBlue
  participant RuntimeA as A
  participant "ProtocolStub A" as AAStub
end box

box "Matrix-MN" #LightGray
  participant "Adress Allocation Man." as AAM
  participant "WS-Handler A" as WSHA
  participant "WS-Handler B" as WSHB
  participant "WS-Server" as WSS
  participant "Matrix HS" as HS
end box

box "Runtime B" #LightBlue
  participant "ProtocolStub A" as AStub
  participant "Runtime B" as B
end box

opt both sides have connected stubs and registered hyperties
end

B --> AStub : sendMSG(from, to, offer/content)
AStub --> WSS : sendMsg(from, to, offer/content)
WSS --> WSHB : sendMsg(from, to, offer/content)

opt is the "from" from a foreign domain
  WSHB --> AAM: addHandlerMapping(from, WSHB)
end

opt mapping for "to" exists (internal or external)
  WSHB --> AAM : getMatrixId for "to" address
  AAM --> WSHB : return toUserID
  opt ? do "to" and "from" user share a room already
    WSHB --> HS : sendMessage to shared room id
  else
    WSHB --> WSHB : create new room alias (prefix + fromHash + toHash)
    WSHB --> HS : create room with alias and invite toUser
    HS --> WSHB : room created (Promise resolved)
    HS --> WSHA : event: invitation to new room
    WSHA --> HS : join room
    HS --> WSHB : event: toUser has joined the new room

    WSHB --> HS : sendMessage to shared room id
  end
  HS --> WSHA : event: message(offer/content)
  WSHA --> AAStub : send message(offer/content)
  AAStub --> A : send message(offer/content)
else client side Protocol-on-the-fly needed

end  



@enduml
