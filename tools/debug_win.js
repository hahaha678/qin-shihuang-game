const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    gs.player.setPosition(84 * 16, 190);   // 落在高台上
  });
  await page.keyboard.down('d');
  await page.waitForTimeout(900);
  await page.keyboard.up('d');
  const s = await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    return { won: gs.won, state: gs.player.state, msg: gs.registry.get('msg'), x: Math.round(gs.player.x) };
  });
  console.log(JSON.stringify(s));
  await page.screenshot({ path: 'tools/shot_7_win.png' });
  await browser.close();
})();
