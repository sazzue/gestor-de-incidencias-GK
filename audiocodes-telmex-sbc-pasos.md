# AudioCodes Telmex + Grandstream UCM6302

Esta guia es para reconstruir la parte SBC por GUI sin revolver pantallas.

## Datos confirmados

```text
AudioCodes LAN:          192.168.0.1/24
Grandstream UCM:         192.168.0.2/24
WAN VLAN Telmex:         1200
WAN AudioCodes:          187.196.103.42/30
Gateway WAN Telmex:      187.196.103.41
Loopback SIP Telmex:     172.19.127.105
SBC Core Telmex 1:       172.25.37.227 UDP 5060
SBC Core Telmex 2:       172.25.37.235 UDP 5060
GDN:                     8111684739
DIDs:                    8196895768 a 8196895797
PBX SIP:                 192.168.0.2 UDP 5060
```

## 1. Network

Primero carga `audiocodes-telmex-network-restore.cli` por CLI o subelo como script si tu version lo permite.

Pruebas obligatorias antes de seguir:

```text
Grandstream -> ping 192.168.0.1
AudioCodes  -> ping 187.196.103.41
AudioCodes  -> ping 172.25.37.227
AudioCodes  -> ping 172.25.37.235
```

Si falla `187.196.103.41`, no sigas con SBC: falta WAN Telmex.

## 2. Media Realms

Menu:

```text
Setup > Signaling & Media > Core Entities > Media Realms
```

Crear o editar `MR_WAN`:

```text
Index:                         0
Name:                          MR_WAN
Topology Location:             Up
IPv4 Interface Name:           #0 [main-vrf-ipv4]
UDP Port Range Start:          7000
Number Of Media Session Legs:  20
UDP Port Range End:            vacio
TCP Port Range Start:          0
TCP Port Range End:            0
Default Media Realm:           No
```

Crear o editar `MR_IPPBX`:

```text
Index:                         1
Name:                          MR_IPPBX
Topology Location:             Down
IPv4 Interface Name:           #0 [main-vrf-ipv4]
UDP Port Range Start:          20000
Number Of Media Session Legs:  20
UDP Port Range End:            vacio
TCP Port Range Start:          0
TCP Port Range End:            0
Default Media Realm:           No
```

Si marca empalme de puertos, usa `30000` en `MR_IPPBX`.

## 3. SIP Interfaces

Menu:

```text
Setup > Signaling & Media > Core Entities > SIP Interfaces
```

Crear `SIPIf_WAN`:

```text
Index:              0
Name:               SIPIf_WAN
Topology Location:  Up
Network Interface:  #0 [main-vrf-ipv4]
Application Type:   SBC
UDP Port:           5060
TCP Port:           5060
TLS Port:           5061
Media Realm:        MR_WAN
Direct Media:       Disable
TLS Context Name:   #0 [default]
```

Crear `SIPIf_LANIPPBX`:

```text
Index:              1
Name:               SIPIf_LANIPPBX
Topology Location:  Down
Network Interface:  #0 [main-vrf-ipv4]
Application Type:   SBC
UDP Port:           5060
TCP Port:           5060
TLS Port:           5061
Media Realm:        MR_IPPBX
Direct Media:       Disable
TLS Context Name:   #0 [default]
```

## 4. Proxy Sets

Menu:

```text
Setup > Signaling & Media > Core Entities > Proxy Sets
```

Proxy Set Telmex:

```text
Index:                 0
Name:                  TroncalIP_TMX_Huawei
SBC IPv4 SIP Interface: SIPIf_WAN
Proxy Keep-Alive:      Using OPTIONS
Proxy Keep-Alive Time: 60
Redundancy Mode:       Homing
Proxy Hot Swap:        Enable
Proxy Addresses:
  172.25.37.227 UDP 5060
  172.25.37.235 UDP 5060
```

Proxy Set Grandstream:

```text
Index:                 1
Name:                  UCM
SBC IPv4 SIP Interface: SIPIf_LANIPPBX
Proxy Keep-Alive:      Using OPTIONS
Proxy Keep-Alive Time: 60
Proxy Hot Swap:        Disable
Proxy Addresses:
  192.168.0.2 UDP 5060
```

## 5. IP Groups

Menu:

```text
Setup > Signaling & Media > Core Entities > IP Groups
```

IP Group Telmex:

```text
Index:                 0
Name:                  IPG_TMX_CORE
Topology Location:     Up
Type:                  Server
Proxy Set:             #0 [TroncalIP_TMX_Huawei]
Media Realm:           #0 [MR_WAN]
IP Profile:            #0 [IPP_TMX_CORE], si existe
SIP Group Name:        172.19.127.105
Classify By Proxy Set: Enable
SBC Operation Mode:    B2BUA
SIP Source Host Name:  172.19.127.105
```

IP Group Grandstream:

```text
Index:                 1
Name:                  IPG_UCM
Topology Location:     Down
Type:                  Server
Proxy Set:             #1 [UCM]
Media Realm:           #1 [MR_IPPBX]
SIP Group Name:        192.168.0.2
Classify By Proxy Set: Enable
SBC Operation Mode:    B2BUA
```

## 6. IP-to-IP Routing

Menu:

```text
Setup > Signaling & Media > SBC > Routing > IP-to-IP Routing
```

Ruta Telmex hacia PBX:

```text
Index:                 0
Source IP Group:       IPG_TMX_CORE
Destination Type:      IP Group
Destination IP Group:  IPG_UCM
```

Ruta PBX hacia Telmex:

```text
Index:                 1
Source IP Group:       IPG_UCM
Destination Type:      IP Group
Destination IP Group:  IPG_TMX_CORE
```

## 7. Guardar

Cuando ya no haya errores:

```text
Apply
Save
Actions > Burn / Save to flash
```

## 8. Pruebas

En Monitor debe quedar:

```text
Proxy Set UCM:          Alive / Connected
Proxy Set Telmex Core:  Alive / Connected
```

Si `Telmex Core` queda `Not Connected`, llamar a Telmex: el problema esta hacia `172.25.37.227/235` o WAN/VLAN.
