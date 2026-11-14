// 第四章 Boss 战端到端：登场/预警/招式/血条/胜负
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CON: ' + m.text()); });

  await page.goto('http://localhost:8123/?level=4');
  await page.waitForTimeout(2500);   // 等 boss 登场

  const st1 = await page.evaluate(() => {
    const s = window.game.scene.getScene('GameScene');
    return {
      boss: !!s.boss, bossHp: s.boss && s.boss.hp,
      bossName: s.registry.get('bossName'),
      banner: s.registry.get('banner'),
      state: s.boss && s.boss.state,
    };
  });
  console.log('登场:', JSON.stringify(st1), st1.boss && st1.bossHp === 420 ? 'PASS' : 'FAIL');
  await page.screenshot({ path: 'tools/boss_appear.png' });

  // 等第一个预警（boss 1.4s 后出招）
  let warnShot = false;
  for (let i = 0; i < 60 && !warnShot; i++) {
    await page.waitForTimeout(100);
    const w = await page.evaluate(() => {
      const s = window.game.scene.getScene('GameScene');
      return s.boss && s.boss.state === 'warn' && !!s.boss.warnZone
        ? { key: s.boss.warnKey } : null;
    });
    if (w) {
      warnShot = w.key;
      await page.screenshot({ path: 'tools/boss_warn.png' });
    }
  }
  console.log('预警红区:', warnShot ? `PASS (${warnShot})` : 'FAIL');

  // 等 boss 出手（attack 状态）— 验证 attackBox 激活过，或吐丹弹已发射
  let atkSeen = false;
  for (let i = 0; i < 80 && !atkSeen; i++) {
    await page.waitForTimeout(100);
    atkSeen = await page.evaluate(() => {
      const s = window.game.scene.getScene('GameScene');
      return !!(s.boss && s.boss.state === 'attack'
        && (s.boss.attackBox.body.enable
          || s.bossShots.children.entries.length > 0));
    });
  }
  console.log('出招判定:', atkSeen ? 'PASS' : 'FAIL');

  // 玩家近身连击 -> bossHp 下降
  await page.evaluate(() => {
    const s = window.game.scene.getScene('GameScene');
    s.player.x = s.boss.x - 50; s.player.y = s.boss.y;
  });
  for (let i = 0; i < 12; i++) { await page.keyboard.press('j'); await page.waitForTimeout(320); }
  const hp2 = await page.evaluate(() =>
    window.game.scene.getScene('GameScene').boss.hp);
  console.log('Boss 掉血:', hp2 < 420 ? `PASS (hp=${hp2})` : 'FAIL');
  await page.screenshot({ path: 'tools/boss_fight.png' });

  // 直接打死 -> 通关
  await page.evaluate(() => {
    const s = window.game.scene.getScene('GameScene');
    s.boss.takeDamage(9999, s.player.x, 999999);
  });
  await page.waitForTimeout(1200);
  const end = await page.evaluate(() => {
    const s = window.game.scene.getScene('GameScene');
    return {
      dead: s.boss && s.boss.dead, won: s.won,
      anim: s.boss && s.boss.anims.currentAnim && s.boss.anims.currentAnim.key,
      bossName: s.registry.get('bossName'),
      msg: s.registry.get('msg'),
    };
  });
  console.log('击杀通关:', JSON.stringify(end), end.won ? 'PASS' : 'FAIL');
  await page.screenshot({ path: 'tools/boss_win.png' });

  console.log('控制台错误:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
