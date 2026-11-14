// 命中判定专项调试：把敌人放到剑前 -> 攻击 -> 逐帧观察判定盒/伤害
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));

  await page.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 把敌人0放到玩家正右方30px，冻结其AI
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    const en = gs.enemies.children.entries[0];
    const p = gs.player;
    en.setPosition(p.x + 30, p.y);
    en.body.setVelocity(0, 0);
    en.state = 'hurt'; en.hurtUntil = 1e9; // 冻结
    window.__dbg = { gs, en, p };
  });

  // 攻击 + 高频采样
  await page.keyboard.down('j'); await page.keyboard.up('j');
  const samples = [];
  for (let i = 0; i < 12; i++) {
    const s = await page.evaluate(() => {
      const { en, p } = window.__dbg;
      return {
        t: p.scene.time.now,
        state: p.state, stage: p.comboStage,
        swing: p.swingId,
        hitboxOn: p.zones.hitbox.body.enable,
        hbX: Math.round(p.zones.hitbox.x), hbY: Math.round(p.zones.hitbox.y),
        enX: Math.round(en.x), enHp: en.hp,
        px: Math.round(p.x), facing: p.facing,
        atkStart: p.attackStartAt,
      };
    });
    samples.push(s);
    await page.waitForTimeout(60);
  }
  samples.forEach(s => console.log(JSON.stringify(s)));
  await browser.close();
})();
