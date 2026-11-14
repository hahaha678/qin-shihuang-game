const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
  await page.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await page.keyboard.down('j');
  await page.waitForTimeout(120);
  const s1 = await page.evaluate(() => {
    const p = window.game.scene.getScene('GameScene').player;
    return {
      jDown: p.kAtk[0].isDown, jCode: p.kAtk[0].keyCode,
      kbEnabled: p.scene.input.keyboard.enabled,
      state: p.state, swing: p.swingId,
      listener: typeof window.onkeydown,
    };
  });
  console.log('按住j时:', JSON.stringify(s1));
  await page.keyboard.up('j');
  await page.waitForTimeout(400);
  const s2 = await page.evaluate(() => {
    const p = window.game.scene.getScene('GameScene').player;
    return { state: p.state, swing: p.swingId, stage: p.comboStage };
  });
  console.log('松开后:', JSON.stringify(s2));
  await browser.close();
})();
