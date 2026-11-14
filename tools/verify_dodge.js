// 极限闪避专项：诱敌攻击 -> 翻滚闪掉 -> 验证时空断裂 -> 验证裂空斩
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:8123/?level=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 把玩家放到第一个敌人面前，盯它进入 attack 状态就翻滚
  await page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    const en = gs.enemies.children.entries[0];
    const p = gs.player;
    p.setPosition(en.x - 34, en.y);
    p.body.setVelocity(0, 0);
    en.state = 'chase';
    window.__t = { gs, en, p };
  });

  // 轮询：敌人一进 attack 就按 K 滚
  let dodged = false;
  for (let i = 0; i < 100 && !dodged; i++) {
    const st = await page.evaluate(() => window.__t.en.state);
    if (st === 'attack') {
      await page.keyboard.press('k');
      await page.waitForTimeout(120);
      dodged = await page.evaluate(() =>
        window.__t.gs.fractureUntil > window.__t.gs.time.now);
      if (!dodged) await page.waitForTimeout(400);   // 没蹭到判定盒就等下一刀
    }
    await page.waitForTimeout(60);
  }
  let r = await page.evaluate(() => {
    const { gs, en } = window.__t;
    return {
      frac: gs.fractureUntil > gs.time.now,
      ets: gs.enemyTimeScale,
      fx: !!gs.fractureFx, ring: !!gs.fractureRing, aura: !!gs.fractureAura,
      top: !!gs.fractureTop, motes: gs.timeMotes ? gs.timeMotes.emitting : false,
      banner: gs.registry.get('banner'),
      enTint: '0x' + en.tintTopLeft.toString(16),
      enAnimTs: en.anims.timeScale,
    };
  });
  console.log('断裂触发:', JSON.stringify(r), dodged && r.frac ? 'PASS' : 'FAIL');

  // 断裂中按 J -> 应出裂空斩 rift，且断裂随之解除
  await page.keyboard.press('j');
  await page.waitForTimeout(120);
  const mv = await page.evaluate(() => ({
    moveKey: window.__t.p.moveKey, st: window.__t.p.state }));
  console.log('断裂期J:', JSON.stringify(mv), mv.moveKey === 'rift' ? 'PASS' : 'FAIL');
  await page.waitForTimeout(400);   // 等收尾一帧
  const rel = await page.evaluate(() => ({
    ets: window.__t.gs.enemyTimeScale,
    frac: window.__t.gs.fractureUntil > window.__t.gs.time.now }));
  console.log('裂空斩后断裂解除:', JSON.stringify(rel),
    rel.ets === 1 && !rel.frac ? 'PASS' : 'FAIL');
  await page.screenshot({ path: 'tools/dodge_fx.png' });

  // 断裂结束 -> 敌人复原
  await page.waitForTimeout(2300);
  r = await page.evaluate(() => ({
    ets: window.__t.gs.enemyTimeScale,
    fx: !!window.__t.gs.fractureFx,
    enAnimTs: window.__t.en.anims ? window.__t.en.anims.timeScale : 'destroyed',
    banner: window.__t.gs.registry.get('banner'),
  }));
  console.log('断裂结束:', JSON.stringify(r),
    r.ets === 1 && !r.fx && (r.enAnimTs === 1 || r.enAnimTs === 'destroyed') ? 'PASS' : 'FAIL');

  console.log('控制台错误:', errors.length ? errors : 'none');
  await browser.close();
})();
