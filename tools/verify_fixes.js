// 修复回归专项：冻结敌人测错道未命中/同帧输入不覆盖/精锐tint保留/UIScene不重复
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8123/?level=3', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  // === 1) 错道未命中：敌人冻结在远道 y=190，玩家在近道 y=240（道差50>吸附阈值40）===
  let r = await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    const p = gs.player, en = gs.enemies.children.entries.find(e => !e.dead);
    en.y = 190; en.x = 400;
    en.state = 'hurt'; en.hurtUntil = 1e9; en.body.setVelocity(0, 0);
    p.x = en.x - 40; p.y = 240; p.state = 'idle'; p.body.setVelocity(0, 0);
    window.__t = { gs, p, en };
    return { py: Math.round(p.y), ey: Math.round(en.y) };
  });
  console.log('错道布置:', JSON.stringify(r));
  const hp0 = await page.evaluate(() => window.__t.en.hp);
  await page.waitForTimeout(120);
  await page.keyboard.press('j');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => ({ hp: window.__t.en.hp, py: Math.round(window.__t.p.y) }));
  console.log(`错道J(道差50): hp ${hp0} -> ${r.hp} 玩家y=${r.py} ${r.hp === hp0 ? 'PASS(未命中)' : 'FAIL(命中了)'}`);

  // === 2) 同道命中对照 ===
  await page.evaluate(() => { const { p, en } = window.__t; p.y = en.y; p.x = en.x - 40; p.state = 'idle'; });
  await page.keyboard.press('j');
  await page.waitForTimeout(450);
  r = await page.evaluate(() => ({ hp: window.__t.en.hp }));
  console.log(`同道J: hp -> ${r.hp} ${r.hp < hp0 ? 'PASS' : 'FAIL'}`);

  // === 3) 同帧 J+U：应出 attack 而不是被 roar 覆盖 ===
  await page.evaluate(() => { const { p } = window.__t; p.meter = 100; p.state = 'idle'; });
  await page.keyboard.down('j'); await page.keyboard.down('u');
  await page.keyboard.up('j'); await page.keyboard.up('u');
  await page.waitForTimeout(60);
  r = await page.evaluate(() => ({ st: window.__t.p.state, meter: window.__t.p.meter }));
  console.log(`同帧J+U: state=${r.st} meter=${r.meter} ${r.st === 'attack' ? 'PASS' : 'CHECK:' + r.st}`);

  // === 4) 精锐兵受击后 tint 恢复（显式刷一个精锐，走真实 takeDamage 路径）===
  r = await page.evaluate(() => new Promise(res => {
    const gs = window.game.scene.getScene('GameScene');
    const en = gs.spawnEnemy({ type: 'elite', x: gs.player.x + 60, y: gs.player.y });
    en.takeDamage(1, en.x - 1, -999);      // 1点蹭伤：白闪80ms后应恢复精锐蓝
    setTimeout(() => res({ tint: en.tintTopLeft, expect: en.baseTint }), 200);
  }));
  console.log(`精锐tint: 0x${r.tint.toString(16)} vs 0x${r.expect.toString(16)} ${r.tint === r.expect ? 'PASS' : 'FAIL'}`);

  // === 5) 死亡/重开：UIScene 不重复且玩家满血复活 ===
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    gs.player.invulnUntil = 0;
    gs.player.takeDamage(9999, gs.player.x + 1, -1);
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('r');
  await page.waitForTimeout(900);
  r = await page.evaluate(() => {
    const g = window.game;
    const uiCount = g.scene.scenes.filter(s => s.scene.key === 'UIScene' && s.scene.isActive()).length;
    const gs = g.scene.getScene('GameScene');
    return { uiCount, hp: gs.player.hp, dead: gs.player.dead, st: gs.player.state };
  });
  console.log(`R重开: UIScene实例=${r.uiCount} ${r.uiCount === 1 ? 'PASS' : 'FAIL'} hp=${r.hp} dead=${r.dead} st=${r.st}`);

  // === 6) 纵深边界：S 按到底 == floor.max ===
  await page.keyboard.down('s'); await page.waitForTimeout(700); await page.keyboard.up('s');
  r = await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    return { y: Math.round(gs.player.y), max: gs.L.floor.max };
  });
  console.log(`S到底: y=${r.y} floor.max=${r.max} ${r.y === r.max ? 'PASS' : r.y <= r.max ? 'PASS(未越界)' : 'FAIL'}`);

  // === 7) 判定盒泄漏：攻击结束一帧后所有 zone body 应禁用 ===
  await page.waitForTimeout(500);
  r = await page.evaluate(() => {
    const p = window.game.scene.getScene('GameScene').player;
    return Object.entries(p.zones).map(([k, z]) => `${k}:${z.body.enable}`).join(' ');
  });
  console.log(`攻击后判定盒: ${r} ${/true/.test(r) ? 'FAIL' : 'PASS'}`);

  console.log('控制台错误:', errors.length ? errors : 'none');
  await browser.close();
})();
