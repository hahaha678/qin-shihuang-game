// 关卡数据。tile 索引对应 tiles.png:
// 0 地面顶  1 地面填  2 平台(单向,可跳下穿过)  3 砖墙  4 宫柱(装饰)  5 灯笼(装饰)
const LEVEL1 = (() => {
  const W = 96, H = 17;
  const g = Array.from({ length: H }, () => new Array(W).fill(-1));
  const fill = (x0, x1, y0, y1, v) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) g[y][x] = v;
  };
  const set = (x, y, v) => { g[y][x] = v; };

  // 主地面（38-42 列为陷坑）
  fill(0, 37, 14, 14, 0); fill(0, 37, 15, 16, 1);
  fill(43, 95, 14, 14, 0); fill(43, 95, 15, 16, 1);

  // 悬浮平台
  fill(12, 15, 11, 11, 2);
  fill(20, 24, 9, 9, 2);
  fill(30, 33, 11, 11, 2);
  fill(38, 41, 10, 10, 2);   // 陷坑上的断桥
  fill(50, 53, 11, 11, 2);
  fill(58, 61, 9, 9, 2);
  fill(66, 69, 11, 11, 2);
  fill(74, 77, 9, 9, 2);

  // 宫柱 + 柱上灯笼（装饰，无碰撞）
  [8, 18, 28, 48, 57, 67, 77].forEach(x => {
    set(x, 13, 4);
    set(x, 12, 5);
  });

  // 尽头高台 + 封墙
  fill(82, 87, 13, 13, 3);
  fill(88, 95, 8, 13, 3);

  return {
    name: '第一章 · 咸阳宫',
    map: g,
    tileW: 16,
    playerSpawn: { x: 64, y: 200 },
    winX: 85 * 16,                       // 走到高台即过关
    fallY: 17 * 16 + 30,                 // 掉出此高度判定坠坑
    enemies: [
      { type: 'soldier', x: 340, y: 200 },
      { type: 'soldier', x: 560, y: 200 },
      { type: 'soldier', x: 720, y: 200 },
      { type: 'soldier', x: 920, y: 200 },
      { type: 'soldier', x: 1080, y: 200 },
      { type: 'soldier', x: 1240, y: 200 },
    ],
    pills: [
      { x: 22 * 16, y: 8 * 16 },
      { x: 40 * 16, y: 9 * 16 },
      { x: 60 * 16, y: 8 * 16 },
      { x: 84 * 16 + 8, y: 12 * 16 },
    ],
  };
})();

// 第二章 · 热血校场：波次竞技场
const LEVEL2 = (() => {
  const W = 112, H = 17;
  const g = Array.from({ length: H }, () => new Array(W).fill(-1));
  const fill = (x0, x1, y0, y1, v) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) g[y][x] = v;
  };
  const set = (x, y, v) => { g[y][x] = v; };

  // 平整沙场（无坑——纯战斗）
  fill(0, W - 1, 14, 14, 0); fill(0, W - 1, 15, 16, 1);

  // 双层平台：低层4处 + 高层3处（空战用）
  fill(15, 19, 10, 10, 2); fill(42, 46, 10, 10, 2);
  fill(68, 72, 10, 10, 2); fill(90, 94, 10, 10, 2);
  fill(28, 32, 7, 7, 2); fill(55, 59, 7, 7, 2); fill(80, 84, 7, 7, 2);

  // 校场旌柱 + 灯笼
  [10, 25, 40, 55, 70, 85, 100].forEach(x => {
    set(x, 13, 4); set(x, 12, 5);
  });

  // 尽头封墙
  fill(108, 111, 10, 13, 3);

  return {
    name: '第二章 · 校场演武',
    map: g,
    tileW: 16,
    playerSpawn: { x: 56, y: 200 },
    winX: 104 * 16,
    fallY: 17 * 16 + 30,
    waves: [
      // 第一阵：三个轻兵热身
      [{ type: 'soldier', x: 420 }, { type: 'soldier', x: 640 }, { type: 'soldier', x: 860 }],
      // 第二阵：四兵+一精锐
      [{ type: 'soldier', x: 380 }, { type: 'soldier', x: 700 }, { type: 'soldier', x: 1010 },
       { type: 'elite', x: 800 }],
      // 第三阵：五兵+二精锐 总攻
      [{ type: 'soldier', x: 400 }, { type: 'soldier', x: 620 }, { type: 'soldier', x: 920 },
       { type: 'elite', x: 1080 }, { type: 'elite', x: 540 }],
    ],
    pills: [
      { x: 30 * 16, y: 6 * 16 }, { x: 57 * 16, y: 6 * 16 },
      { x: 82 * 16, y: 6 * 16 }, { x: 56 * 16, y: 13 * 16 },
    ],
  };
})();

// 第三章 · 函谷沙场：清版过关（belt）——地面是深度平面，y=纵深
const LEVEL3 = {
  name: '第三章 · 函谷沙场',
  mode: 'belt',
  width: 1400,                    // 战场横向长度(px)
  floor: { min: 168, max: 240 },    // 纵深带（越小越远）
  bounds: { x0: 40, x1: 1360 },     // 可行走范围
  playerSpawn: { x: 90, y: 206 },
  winX: 1300,
  waves: [
    // 第一阵：轻兵试水，分散站位
    [{ type: 'soldier', x: 400, y: 190 }, { type: 'soldier', x: 620, y: 225 },
     { type: 'soldier', x: 780, y: 180 }],
    // 第二阵：合围阵型
    [{ type: 'soldier', x: 380, y: 175 }, { type: 'soldier', x: 460, y: 235 },
     { type: 'soldier', x: 760, y: 185 }, { type: 'soldier', x: 880, y: 228 },
     { type: 'elite', x: 660, y: 205 }],
    // 第三阵：精锐压阵总攻
    [{ type: 'elite', x: 420, y: 195 }, { type: 'soldier', x: 540, y: 230 },
     { type: 'soldier', x: 640, y: 172 }, { type: 'elite', x: 900, y: 210 },
     { type: 'soldier', x: 1050, y: 180 }, { type: 'soldier', x: 1150, y: 232 }],
  ],
  pills: [{ x: 500, y: 215 }, { x: 850, y: 195 }, { x: 1200, y: 220 }],
};

// 第四章 · 不死药灵：Boss 战（belt）——蓬莱仙药的化身灵兽，红区预警+多段招式
const LEVEL4 = {
  name: '第四章 · 不死药灵',
  mode: 'belt',
  width: 1500,
  floor: { min: 168, max: 240 },
  bounds: { x0: 80, x1: 1420 },
  playerSpawn: { x: 140, y: 206 },
  winX: 9999,                          // Boss 关以击杀定胜负，不走 winX
  boss: { x: 980, y: 204, name: '不死药灵' },
  enemies: [],                       // 无杂兵，Boss 由 spawnBoss 登场
  pills: [{ x: 380, y: 220 }, { x: 750, y: 185 }, { x: 1240, y: 228 }],
};
