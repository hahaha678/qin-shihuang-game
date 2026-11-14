// 清版过关(belt)冒烟测试：纵深移动/分道命中/波次/通关
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8123/?level=3', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const state = () => page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    const p = gs.player;
    return {
      x: Math.round(p.x), y: Math.round(p.y), st: p.state,
      scale: +p.scaleX.toFixed(2), depth: p.depth,
      hp: p.hp, meter: p.meter, won: gs.won,
      foes: gs.enemies.children.entries.filter(e => !e.dead)
        .map(e => ({ x: Math.round(e.x), y: Math.round(e.y), hp: e.hp, st: e.state })),
      aliveN: gs.enemies.children.entries.filter(e => !e.dead).length,
    };
  });

  let s = await state();
  console.log('初始:', JSON.stringify(s));

  // 1) 纵深移动：按 S 应向近处走（y 变大），按 W 向远处
  const y0 = s.y;
  await page.keyboard.down('s'); await page.waitForTimeout(500); await page.keyboard.up('s');
  s = await state();
  console.log('按S后 y:', s.y, '（应 >', y0, '）scale:', s.scale);
  await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
  s = await state();
  console.log('按W后 y:', s.y, 'scale:', s.scale);

  // 2) 传送到敌人面前同一条道 -> 攻击应命中
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    const p = gs.player;
    const en = gs.enemies.children.entries.find(e => !e.dead);
    if (en) { p.x = en.x - 40; p.y = en.y; }
  });
  await page.waitForTimeout(120);
  const before = (await state()).foes[0];
  await page.keyboard.press('j');
  await page.waitForTimeout(350);
  s = await state();
  console.log('同道攻击: 敌人hp', before ? before.hp : '?', '->', s.foes[0] ? s.foes[0].hp : '已死');

  // 3) 错道攻击：把玩家移到上下错开的位置 -> 不应命中
  const hpBefore = s.foes.length ? s.foes[0].hp : null;
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    const p = gs.player;
    const en = gs.enemies.children.entries.find(e => !e.dead);
    if (en) { p.x = en.x - 40; p.y = en.y - 45; }
  });
  await page.waitForTimeout(120);
  await page.keyboard.press('j');
  await page.waitForTimeout(350);
  s = await state();
  console.log('错道攻击: hp', hpBefore, '->', s.foes[0] ? s.foes[0].hp : '已死', '（应不变）');

  // 4) 跳劈
  await page.keyboard.press(' ');
  await page.waitForTimeout(200);
  s = await state();
  console.log('跳劈中:', s.st);
  await page.waitForTimeout(600);
  s = await state();
  console.log('落地后:', s.st);

  // 5) 截图看纵深效果
  await page.screenshot({ path: 'tools/belt_shot.png' });

  // 6) 自动战斗几分钟测波次推进（粗糙但够用：追最近敌人同层打）
  console.log('自动战斗 30s…');
  const t0 = Date.now();
  let lastAtk = 0;
  while (Date.now() - t0 < 30000) {
    const st = await page.evaluate(() => {
      const gs = window.game.scene.getScene('GameScene');
      const p = gs.player;
      const en = gs.enemies.children.entries.find(e => !e.dead);
      return en ? { px: p.x, py: p.y, ex: en.x, ey: en.y, won: gs.won, dead: p.dead }
                : { px: p.x, py: p.y, won: gs.won, dead: p.dead };
    });
    if (st.dead || st.won) break;
    if (st.ex === undefined) { await page.keyboard.down('d'); await page.waitForTimeout(150); await page.keyboard.up('d'); continue; }
    const dx = st.ex - st.px, dy = st.ey - st.py;
    const keys = [];
    if (dx > 30) keys.push('d'); else if (dx < -30) keys.push('a');
    if (dy > 8) keys.push('s'); else if (dy < -8) keys.push('w');
    for (const k of keys) await page.keyboard.down(k);
    if (Math.abs(dx) < 38 && Math.abs(dy) < 12 && Date.now() - lastAtk > 300) {
      lastAtk = Date.now();
      await page.keyboard.press('j');
    }
    await page.waitForTimeout(90);
    for (const k of keys) await page.keyboard.up(k);
  }
  s = await state();
  console.log('战斗结束态:', JSON.stringify({ won: s.won, hp: s.hp, alive: s.aliveN, x: s.x }));
  await page.screenshot({ path: 'tools/belt_shot2.png' });

  console.log('控制台错误:', errors.length ? errors : 'none');
  await browser.close();
})();
