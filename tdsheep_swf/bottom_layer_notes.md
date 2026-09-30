# TDSheep bottom-layer notes

## Loader chain

- Entry SWF: TDSheepMain.swf
- Init XML: xmlFile/initXML.xml
- Runtime SWF base: https://tdsheep.tdsheepvillage.com/static/images/swf/
- XML base: https://tdsheep.tdsheepvillage.com/static/images/swf/xmlFile/
- Material/image base discovered in AS3: https://tdsheep.tdsheepvillage.com/static/images/swf/gameImg/
- AMF gateway shape: base_url + /gateway/?... with session/gateway_key/REFERER/LANG
- AMF method wrapper: NetConnection.call("call_service", ...)

## Hidden resource names found in decompressed SWFs

See embedded_resource_names.txt. Important non-initXML names:

- gameUI/3366qqvip.swf
- sheepNPC0.jpg through sheepNPC4.jpg
- inviteFriends_tw2.swf
- ktyellow.swf

## Extra resources downloaded

| file | bytes |
| --- | ---: |
| gameImg_inviteFriends_tw2.swf | 37293 |
| gameImg_ktyellow.swf | 42765 |
| gameUI_3366qqvip.swf | 119116 |
| sheepNPC0.jpg | 14164 |
| sheepNPC1.jpg | 14669 |
| sheepNPC2.jpg | 15422 |
| sheepNPC3.jpg | 15757 |
| sheepNPC4.jpg | 14813 |

## Service map

See service_actions.tsv. Read-ish config endpoints visible in code include sys.get_config, sys.get_dmap_cfg, user.get, user.get_umap, user.get_dmap, and user.get_camp. Most others are state-changing gameplay actions and should be treated carefully.

## Asset conclusion

The character/tower/bullet/effect graphics are primarily embedded Flash vector symbols in the gameUI_*.swf files. The deeper layer exposes a small gameImg directory for supplemental JPG/SWF UI resources, plus an AMF gateway for gameplay/config data; I did not find a separate public folder of per-character PNG/SVG files in the client strings.
