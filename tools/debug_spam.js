// 复现"连按J卡死"
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 传送到敌人边上，模拟真人快速连点 J（60ms 间隔）
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    const en = gs.enemies.children.entries[0];
    en.setPosition(gs.player.x + 30, gs.player.y);
    window.__p = gs.player; window.__gs = gs;
  });

  for (let i = 0; i < 20; i++) {
    await page.keyboard.down('j');
    await page.waitForTimeout(30);
    await page.keyboard.up('j');
    await page.waitForTimeout(60);
    if (i % 5 === 4) {
      const s = await page.evaluate(() => {
        const p = window.__p;
        return { i: 'chk', state: p.state, stage: p.comboStage, swing: p.swingId,
                 queued: p.queuedAttack, hp: p.hp, x: Math.round(p.x),
                 anim: p.anims.currentAnim ? p.anims.currentAnim.key : null };
      });
      console.log(JSON.stringify(s));
    }
  }
  // 再观察 1.5s 看是否恢复
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => {
    const p = window.__p;
    return { final: true, state: p.state, stage: p.comboStage, swing: p.swingId,
             anim: p.anims.currentAnim ? p.anims.currentAnim.key : null,
             animPlaying: p.anims.isPlaying };
  });
  console.log(JSON.stringify(s));
  await page.screenshot({ path: 'tools/shot_spam.png' });
  await browser.close();
})();
