// 特效特写：敌人放面前 -> 攻击 -> 命中瞬间连拍
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    gs.enemies.children.entries[0].setPosition(gs.player.x + 32, gs.player.y);
  });
  // 第一刀命中瞬间
  await page.keyboard.down('j');
  await page.waitForTimeout(60);
  await page.keyboard.up('j');
  await page.waitForTimeout(120);
  await page.screenshot({ path: 'tools/fx_hit1.png' });
  // 连到第三段重击
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down('j'); await page.waitForTimeout(60);
    await page.keyboard.up('j'); await page.waitForTimeout(120);
  }
  await page.screenshot({ path: 'tools/fx_combo.png' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tools/fx_after.png' });
  await browser.close();
})();
