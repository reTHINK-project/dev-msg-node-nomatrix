

@startuml "MatrixMN-routing.png"

autonumber

box "Runtime A" #LightBlue
  participant RuntimeA as A
  participant "Protocol\nStub A" as AAStub
end box

box "Matrix-MN" #LightGray
  participant "Matrix-\nClient A" as WSHA
  participant "Policy\nDecision" as PDP
  participant "reTHINK-\nAS" as AS
    participant "Matrix\nHomeserver" as HS
    participant "Adress\nAllocation Man." as AAM
  participant "Matrix-\nClient B" as WSHB
  participant "WS-Server /\nClient Manager" as WSS
end box

box "Runtime B" #LightBlue
  participant "ProtocolStub A" as AStub
  participant "Runtime B" as B
end box

note left of AS
 both sides have connected stubs and A has registered a hyperty
end note

B --> AStub : sendMSG\n(from, to,\noffer/content)
AStub --> WSS : sendMsg\n(from, to,\noffer/content)
WSS --> WSS: lookup responsible\nMatrix Client
opt is the "from"-field \nfrom a foreign domain
  WSS --> AAM: map "from" address\nto client B
end
WSS --> WSHB : sendMsg\n(from, to,\noffer/content)

opt handler mapping for "to" exists
  WSHB --> HS : sendMessage to\nown individual room

  HS --> AS : AS intercepts\nmessage event
  AS --> PDP : asks for\npolicy decision
  PDP --> AS : return policy\ndecision
  opt if permitted by PDP
    AS --> WSHA : sendMSG\non behalf of A\nto A's individual room
    WSHA --> AAStub : sendMSG(from, to,\noffer/content)
    AAStub --> A : sendMSG(from, to,\noffer/content)
  end

else client side Protocol-on-the-fly needed

end  



@enduml
