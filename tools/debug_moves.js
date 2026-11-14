// 全招式验证：蓄力/升龙/下砸/冲刺斩/龙威
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:8123/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const get = () => page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    const p = gs.player;
    return { st: p.state, mv: p.moveKey, hp: p.hp, meter: p.meter,
             x: Math.round(p.x), y: Math.round(p.y) };
  });
  const log = async (tag) => console.log(tag, JSON.stringify(await get()));

  // 1. 蓄力斩：按住J 700ms
  await page.keyboard.down('j');
  await page.waitForTimeout(700);
  await log('蓄力中');
  await page.keyboard.up('j');
  await page.waitForTimeout(150);
  await log('释放后');
  await page.waitForTimeout(500);

  // 2. 升龙斩：跳起后空中按↑
  await page.keyboard.down(' ');
  await page.waitForTimeout(80);
  await page.keyboard.up(' ');
  await page.waitForTimeout(150);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(80);
  await log('升龙');
  await page.screenshot({ path: 'tools/mv_riser.png' });
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(700);

  // 3. 下砸：跳起后空中↓+J
  await page.keyboard.down(' '); await page.waitForTimeout(80); await page.keyboard.up(' ');
  await page.waitForTimeout(250);
  await page.keyboard.down('ArrowDown');
  await page.keyboard.down('j');
  await page.waitForTimeout(60);
  await page.keyboard.up('j');
  await log('下砸中');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowDown');
  await log('落地后');
  await page.screenshot({ path: 'tools/mv_slam.png' });
  await page.waitForTimeout(400);

  // 4. 冲刺斩：翻滚中按J
  await page.keyboard.down('k');
  await page.waitForTimeout(80);
  await page.keyboard.up('k');
  await page.waitForTimeout(80);
  await page.keyboard.down('j');
  await page.waitForTimeout(80);
  await page.keyboard.up('j');
  await log('冲刺斩');
  await page.screenshot({ path: 'tools/mv_dash.png' });
  await page.waitForTimeout(500);

  // 5. 龙威：灌满槽后按U
  await page.evaluate(() => { window.game.scene.getScene('GameScene').player.meter = 100; });
  await page.keyboard.down('u');
  await page.waitForTimeout(80);
  await page.keyboard.up('u');
  await page.waitForTimeout(300);
  await log('龙威');
  await page.screenshot({ path: 'tools/mv_roar.png' });
  await browser.close();
})();
