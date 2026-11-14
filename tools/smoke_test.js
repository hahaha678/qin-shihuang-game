// 冒烟测试：加载游戏页面，收集报错，模拟操作，截图验证
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:8123/?level=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tools/shot_1_start.png' });

  // 向右跑 + 跳
  await page.keyboard.down('d');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tools/shot_2_run.png' });
  await page.keyboard.down(' ');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tools/shot_3_jump.png' });
  await page.keyboard.up(' ');
  await page.waitForTimeout(800);
  await page.keyboard.up('d');

  // 攻击
  await page.keyboard.press('j');
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'tools/shot_4_attack.png' });
  await page.waitForTimeout(300);
  await page.keyboard.press('j');
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'tools/shot_5_combo.png' });
  await page.waitForTimeout(500);

  // 一直向右跑到敌人处打一架
  await page.keyboard.down('d');
  await page.waitForTimeout(1500);
  await page.keyboard.up('d');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('j'); await page.waitForTimeout(380); }
  await page.screenshot({ path: 'tools/shot_6_fight.png' });

  // 读取游戏状态
  const state = await page.evaluate(() => {
    const g = window.game;
    if (!g) return 'no game';
    const gs = g.scene.getScene('GameScene');
    const p = gs.player;
    return {
      playerX: Math.round(p.x), playerY: Math.round(p.y),
      hp: p.hp, state: p.state,
      enemies: gs.enemies.children.entries.map(e => ({ hp: e.hp, dead: e.dead, st: e.state })),
    };
  });
  console.log(JSON.stringify(state, null, 1));
  console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
