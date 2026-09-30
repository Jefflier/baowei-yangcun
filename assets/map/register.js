/* 原作战斗底图逐关标定（tools/map_register.py 生成，勿手改）。
 * 键 = 关卡序号（0 起，与 data.js 的 maps 下标一致）；art = assets/map/<art>.png；
 * x,y = 棋盘（65×50 长方形格）左上角在原图里的像素位置；edge = 图外填充色。 */
window.SVA_MAP_REG = {
  0: {art: 'm1', x: 116, y: 220, bx: 143, by: 48, bx1: 904, by1: 698, edge: '#a5c429'},   // L1 巴罗村   verified on p01
  1: {art: 'm2', x: 330, y: 70, bx: 66, by: 59, bx1: 972, by1: 830, edge: '#b5cc4e'},   // L2 比丘村   verified on p02
  4: {art: 'm3', x: 180, y: 98, bx: 76, by: 23, bx1: 1256, by1: 974, edge: '#c9872d'},   // L5 安蒂亚村 fenced yurt village bbox centre = goal 3x3 centre
  5: {art: 'm5', x: 187, y: 140, bx: 1, by: 0, bx1: 1149, by1: 986, edge: '#e6b041', patch: [{"rect": [335, 280, 400, 290], "fill": "#dca336"}]},   // L6 菲洛克村 p07: m5 + a canyon the game draws itself (cols 6-7); the statue platform baked into m5 belongs to level 8 -> patched out
  7: {art: 'm5', x: 122, y: 190, bx: 1, by: 0, bx1: 1149, by1: 986, edge: '#e6b041'},   // L8 艾伊尔村 p08
  8: {art: 'm6', x: 262, y: 80, bx: 128, by: 0, bx1: 1286, by1: 1066, edge: '#e6b042'},   // L9 拉帕斯村 p09 (two farms = two goals)
  11: {art: 'm7', x: 219, y: 193, bx: 7, by: 1, bx1: 1221, by1: 1086, edge: '#4c433b'},   // L12 埃特纳村 p12 (hut = goal 3x3, rock platform = spawns)
  18: {art: 'm10', x: 233, y: 199, bx: 112, by: 60, bx1: 1311, by1: 1069, edge: '#5c8396'},   // L19 塔特村   the three ice holes = the three type-6 tower slots (2,8)(3,11)(5,10)
  30: {art: 'm15', x: 110, y: 266, bx: 20, by: 46, bx1: 1174, by1: 973, edge: '#5b581c'},   // L31 斯贝斯镇 the six red-X crates = the six 爆炸箱 cells (2/5/8, 4/10)  [exact]
  32: {art: 'm16', x: 109, y: 269, bx: 25, by: 46, bx1: 1178, by1: 937, edge: '#5b5e0e'},   // L33 泰勒斯镇 the black grates = the 有洞的钢网桥 cells  [exact]
  37: {art: 'mfx2', x: 222, y: 235, bx: 47, by: 58, bx1: 1262, by1: 1067, edge: '#548a1e'},   // L38 防线     p42 (goal = gap between the two horned gates)
  39: {art: 'm17', x: 181, y: 150, bx: 73, by: 65, bx1: 1471, by1: 1095, edge: '#d2ebf9'},   // L40 远古冰川 the two plank bridges = the 桥 cells (2,6-8)(11,9-11)  [exact]
  42: {art: 'm6', x: 262, y: 80, bx: 128, by: 0, bx1: 1286, by1: 1066, edge: '#e6b042'},   // L43 楼兰城   p39 (same layout as level 9)
  44: {art: 'm11'},   // L45 凌绽雪原 p41 shows a m11-like art but the layout does not line up: art only, no registration
};
