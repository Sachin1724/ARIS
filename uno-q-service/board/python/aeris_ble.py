"""AERIS BlueZ GATT application — Just Works pairing mode.
Physical D3 long-press opens 180s window. Any BLE connection during window
is auto-authorized — no PIN entry needed. Physical presence IS the auth.
"""
import asyncio
import json
import os
import secrets
import time
import subprocess
from pathlib import Path
from dbus_next import BusType, Variant, DBusError
from dbus_next.aio import MessageBus
from dbus_next.service import ServiceInterface, dbus_property, method, PropertyAccess

ROOT='/org/aeris'
SERVICE=ROOT+'/service0'
ADV=ROOT+'/advertisement0'
GATE=Path(__file__).resolve().parent/'aeris_discovery_gate.json'
BLUEZ='org.bluez'
UUID_BASE='8f4c000{}-6a2b-4b6a-9e14-8d6c3b7a2f00'
UUID=lambda n: UUID_BASE.format(n)
CHAR='org.bluez.GattCharacteristic1'
GATT='org.bluez.GattService1'
ADV_IFACE='org.bluez.LEAdvertisement1'
PROPS='org.freedesktop.DBus.Properties'


def pack(data): return bytes(json.dumps(data,separators=(',',':')).encode('utf-8'))

def discovery_open():
    try:
        d=json.loads(GATE.read_text())
        remaining=float(d.get('expires_at',0))-time.time()
        return d.get('source')=='physical_d3_long_press' and 0 < remaining <= 180.5
    except (OSError, ValueError, TypeError, AttributeError):
        return False


class Manager(ServiceInterface):
    def __init__(self, objects):
        super().__init__('org.freedesktop.DBus.ObjectManager')
        self.objects=objects
    @method()
    def GetManagedObjects(self) -> 'a{oa{sa{sv}}}':
        return self.objects


class Service(ServiceInterface):
    def __init__(self): super().__init__(GATT)
    @dbus_property(access=PropertyAccess.READ)
    def UUID(self) -> 's': return UUID(1)
    @dbus_property(access=PropertyAccess.READ)
    def Primary(self) -> 'b': return True
    @dbus_property(access=PropertyAccess.READ)
    def Includes(self) -> 'ao': return []


class Session:
    def __init__(self):
        self.nonce=None
        self.expires=0
        self.authorized=False
        self.status={'status':'waiting','message':'Press D3 to start pairing','progress_pct':0}
    def open(self):
        self.nonce=secrets.token_hex(16)
        self.expires=time.monotonic()+180
        self.authorized=True
        self.status={'status':'paired','message':'Pairing window open — connect from ARIS app','progress_pct':65}
    def confirm(self, raw):
        if not discovery_open() or time.monotonic()>self.expires:
            raise DBusError('org.bluez.Error.NotAuthorized','Pairing window closed')
        self.authorized=True
        self.status={'status':'paired','message':'Device confirmed','progress_pct':80}


class Characteristic(ServiceInterface):
    def __init__(self,idx,flags,session):
        super().__init__(CHAR)
        self.idx=idx
        self.flags=flags
        self.session=session
        self.value=b''
    @dbus_property(access=PropertyAccess.READ)
    def UUID(self) -> 's': return UUID(self.idx)
    @dbus_property(access=PropertyAccess.READ)
    def Service(self) -> 'o': return SERVICE
    @dbus_property(access=PropertyAccess.READ)
    def Flags(self) -> 'as': return self.flags
    @dbus_property(access=PropertyAccess.READ)
    def Notifying(self) -> 'b': return False
    @dbus_property(access=PropertyAccess.READ)
    def Value(self) -> 'ay': return self.value
    @method()
    def ReadValue(self,options:'a{sv}') -> 'ay':
        s=self.session
        if self.idx==2:
            obj={'id':os.getenv('AERIS_DEVICE_ID','UNOQ-03E1'),'name':'ARIS UNO Q',
                 'model':'Arduino UNO Q','firmware_version':'0.1.0','protocol_version':'1.0.0'}
        elif self.idx==3:
            if not discovery_open():
                raise DBusError('org.bluez.Error.NotAuthorized','Press D3 for 3 seconds')
            if s.nonce is None or time.monotonic()>s.expires: s.open()
            obj={'auth_mode':'just_works','challenge':s.nonce,
                 'expires_in_s':max(0,int(s.expires-time.monotonic()))}
        elif self.idx==6:
            obj=s.status
        elif self.idx==7:
            if not discovery_open():
                raise DBusError('org.bluez.Error.NotAuthorized','Pairing window closed')
            if not s.authorized: s.open()
            cred = Path(__file__).resolve().parent / '.aeris_wifi_credentials.json'
            if cred.exists():
                wifi=json.loads(cred.read_text())
                active=subprocess.run(['nmcli','-t','-f','NAME','connection','show','--active'],
                                      capture_output=True,text=True).stdout.splitlines()
                up='AERIS-DIRECT' in active
                obj={'ip':wifi.get('ip','192.168.31.46'),'port':int(wifi.get('port',8000)),
                     'mdns_host':'aris-unoq.local','connected':True,
                     'ssid':wifi.get('ssid',''),'api_token':wifi.get('token',''),
                     'ws_endpoint':f"ws://{wifi.get('ip','192.168.31.46')}:8000/ws/live?token={wifi.get('token','')}",
                     'rest_base':f"http://{wifi.get('ip','192.168.31.46')}:8000/api/v1"}
            else:
                obj={'ip':None,'port':8000,'mdns_host':None,'connected':False,
                     'ws_endpoint':None,'rest_base':None,'api_token':None}
        else:
            raise DBusError('org.bluez.Error.NotPermitted','Read is not supported')
        data=pack(obj)
        off=options.get('offset',Variant('q',0)).value
        return data[off:]
    @method()
    def WriteValue(self,value:'ay',options:'a{sv}'):
        if self.idx==4:
            self.session.confirm(bytes(value))
        elif self.idx==5:
            raise DBusError('org.bluez.Error.NotSupported','Wi-Fi provisioning not enabled')
        else:
            raise DBusError('org.bluez.Error.NotPermitted','Write not permitted')
    @method()
    def StartNotify(self):
        if self.idx not in (3,6): raise DBusError('org.bluez.Error.NotSupported','No notifications')
    @method()
    def StopNotify(self): pass


class Advertisement(ServiceInterface):
    def __init__(self):
        super().__init__(ADV_IFACE)
        self._tx_power = 0
    @dbus_property(access=PropertyAccess.READ)
    def Type(self) -> 's': return 'peripheral'
    @dbus_property(access=PropertyAccess.READ)
    def ServiceUUIDs(self) -> 'as': return [UUID(1)]
    @dbus_property(access=PropertyAccess.READ)
    def LocalName(self) -> 's': return 'ARIS-UNOQ'
    @dbus_property(access=PropertyAccess.READ)
    def Includes(self) -> 'as': return []
    @dbus_property(access=PropertyAccess.READWRITE)
    def TxPower(self) -> 'n': return self._tx_power
    @TxPower.setter
    def TxPower(self, value: 'n'): self._tx_power = int(value)
    @method()
    def Release(self): print('[AERIS BLE] Advertisement released', flush=True)


def properties(obj,iface,names):
    return {name:Variant(sig,getattr(obj,name)) for name,sig in names.items()}


async def main():
    session=Session()
    bus=await MessageBus(bus_type=BusType.SYSTEM).connect()
    paths={SERVICE: Service()}
    for n,flags in {2:['read'],3:['read','notify'],4:['write'],5:['write'],6:['read','notify'],7:['read']}.items():
        paths[SERVICE+f'/char{n}']=Characteristic(n,flags,session)
    objs={}
    for path,obj in paths.items():
        if path==SERVICE: props=properties(obj,GATT,{'UUID':'s','Primary':'b','Includes':'ao'})
        else: props=properties(obj,CHAR,{'UUID':'s','Service':'o','Flags':'as'})
        objs[path]={obj.name:props}
        bus.export(path,obj)
    bus.export(ROOT,Manager(objs))
    bus.export(ADV,Advertisement())
    intro=await bus.introspect(BLUEZ,'/org/bluez/hci0')
    adapter=bus.get_proxy_object(BLUEZ,'/org/bluez/hci0',intro)
    gatt=adapter.get_interface('org.bluez.GattManager1')
    adv=adapter.get_interface('org.bluez.LEAdvertisingManager1')
    registered=False; advertising=False
    try:
        await gatt.call_register_application(ROOT,{})
        registered=True
        print('[AERIS BLE] GATT registered (Just Works mode). Waiting for D3 hold.',flush=True)
        while True:
            wanted=discovery_open()
            if wanted and not advertising:
                try:
                    session.open()
                    await adv.call_register_advertisement(ADV,{})
                    advertising=True
                    print('[AERIS BLE] ARIS-UNOQ discoverable — auto-pair on connect',flush=True)
                except Exception as exc:
                    print('[AERIS BLE] Advertisement registration failed:',exc,flush=True)
            elif not wanted and advertising:
                try: await adv.call_unregister_advertisement(ADV)
                except Exception as exc: print('[AERIS BLE] Close warning:',exc,flush=True)
                advertising=False
                session.nonce=None
                session.authorized=False
                session.status={'status':'waiting','message':'Press D3 to start pairing','progress_pct':0}
                print('[AERIS BLE] Pairing window closed',flush=True)
            await asyncio.sleep(1.0)
    finally:
        if advertising:
            try: await adv.call_unregister_advertisement(ADV)
            except Exception: pass
        if registered:
            try: await gatt.call_unregister_application(ROOT)
            except Exception: pass
        bus.disconnect()

if __name__=='__main__':
    try: asyncio.run(main())
    except KeyboardInterrupt: print('[AERIS BLE] Stopped')
