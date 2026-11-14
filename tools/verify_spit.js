// 吐丹链路专项验证：弹体生成 / 命中扣血 / 滚过极限闪避 / 挥剑弹反
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CON: ' + m.text()); });

  await page.goto('http://localhost:8123/?level=4');
  await page.waitForTimeout(2500);

  // 强制下一招必出 spit：清 cd、堵死其他招路的条件
  await page.evaluate(() => {
    const s = window.game.scene.getScene('GameScene');
    s.boss.spitCd = 0; s.boss.chargeCd = 0; s.boss.roarCd = 0;
    s.player.x = s.boss.x - 60; s.player.y = s.boss.y;
    s.player.body.setVelocity(0, 0);
    s.boss.nextActAt = s.enemyTime + 10;
    // 概率兜底：直接锁定 pickAttack 返回 spit
    s.boss.pickAttack = () => 'spit';
  });

  // 等弹体发射
  let dart = null;
  for (let i = 0; i < 60 && !dart; i++) {
    await page.waitForTimeout(100);
    dart = await page.evaluate(() => {
      const s = window.game.scene.getScene('GameScene');
      const sh = s.bossShots.children.entries[0];
      return sh ? { vx: sh.bvx, vy: sh.bvy, x: sh.x, y: sh.y } : null;
    });
  }
  console.log('弹体发射:', dart ? `PASS ${JSON.stringify(dart)}` : 'FAIL');

  // 站桩吃弹 -> 掉血
  const hp0 = await page.evaluate(() =>
    window.game.scene.getScene('GameScene').player.hp);
  await page.waitForTimeout(1200);
  const hp1 = await page.evaluate(() =>
    window.game.scene.getScene('GameScene').player.hp);
  console.log('弹体命中扣血:', hp1 < hp0 ? `PASS (${hp0}->${hp1})` : 'FAIL');

  // 滚过弹体 -> 极限闪避触发断裂（弹体不死，断裂期慢速）
  await page.evaluate(() => {
    const s = window.game.scene.getScene('GameScene');
    // 弹放身前飞来，等逼近再滚迎
    const sh = s.bossShots.create(s.player.x + 75, s.player.y, 'boss_dart');
    sh.bvx = -140; sh.bvy = 0; sh.dmg = 12; sh.swingTag = 7777;
    sh.until = s.enemyTime + 3000;
    sh.body.setSize(12, 12); sh.body.setOffset(2, 2);
    s.player.invulnUntil = 0; s.player.hp = 100;
    s.player.facing = 1; s.player.state = 'idle';
    s.player.body.setVelocity(0, 0);
  });
  // 等弹逼近到 ~45px 内再滚，保证 overlap 落在无敌帧里
  for (let i = 0; i < 40; i++) {
    const near = await page.evaluate(() => {
      const s = window.game.scene.getScene('GameScene');
      const sh = s.bossShots.children.entries[0];
      return !sh || sh.x - s.player.x < 45;
    });
    if (near) break;
    await page.waitForTimeout(30);
  }
  await page.keyboard.down('k');       // 滚迎弹体
  await page.waitForTimeout(80);
  await page.keyboard.up('k');
  await page.waitForTimeout(400);
  const frac = await page.evaluate(() => {
    const s = window.game.scene.getScene('GameScene');
    return { frac: s.fractureUntil > s.time.now, ets: s.enemyTimeScale,
      dartAlive: s.bossShots.children.entries.length > 0 };
  });
  console.log('滚弹=极限闪避:', JSON.stringify(frac), frac.frac && frac.ets < 1 ? 'PASS' : 'FAIL');
  await page.screenshot({ path: 'tools/spit_dodge.png' });
  await page.waitForTimeout(2200);     // 等断裂结束

  // 挥剑劈丹 -> 弹体销毁 + 龙威（先给无敌帧，保证弹体活到挥剑判定窗）
  await page.evaluate(() => {
    const s = window.game.scene.getScene('GameScene');
    const sh = s.bossShots.create(s.player.x + 30, s.player.y, 'boss_dart');
    sh.bvx = 0; sh.bvy = 0; sh.dmg = 12; sh.swingTag = 8888;
    sh.until = s.enemyTime + 3000;
    sh.body.setSize(12, 12); sh.body.setOffset(2, 2);
    s.player.invulnUntil = s.time.now + 5000;
    s.player.facing = 1; s.player.state = 'idle';
    s.player.body.setVelocity(0, 0);
  });
  await page.waitForTimeout(60);
  await page.keyboard.press('j');      // 普攻 -> 判定盒覆盖弹体
  await page.waitForTimeout(500);
  const def = await page.evaluate(() => {
    const s = window.game.scene.getScene('GameScene');
    return { left: s.bossShots.children.entries.length,
      meter: s.registry.get('playerMeter') };
  });
  console.log('挥剑弹反:', JSON.stringify(def), def.meter > 0 ? 'PASS' : 'FAIL');
  await page.screenshot({ path: 'tools/spit_deflect.png' });

  console.log('控制台错误:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
