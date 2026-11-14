// 观察 Boss 战：每次玩家掉血时打印 Boss 状态/招式/相对位置，定位死因
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto('http://localhost:8123/?level=4', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  let lastHp = -1, lastEvt = '', t0 = Date.now();
  const T = () => ((Date.now() - t0) / 1000).toFixed(1);
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => {
      const gs = window.game.scene.getScene('GameScene');
      if (!gs || !gs.player || !gs.boss) return null;
      const p = gs.player, b = gs.boss;
      return {
        hp: p.hp, dead: p.dead, pst: p.state, x: p.x | 0, y: p.y | 0,
        bst: b.state, wkey: b.warnKey, bx: b.x | 0, by: b.y | 0,
        boxOn: b.attackBox.body.enable, won: gs.won, frac: (gs.enemyTimeScale || 1) < 1,
        atkSwing: b.attackSwing, dmg: b.dmg,
      };
    });
    if (!s) { await page.waitForTimeout(200); continue; }
    if (lastHp >= 0 && s.hp < lastHp) {
      console.log(`t${T()}s 掉血 ${lastHp}->${s.hp}  boss=${s.bst}/${s.wkey} box=${s.boxOn} dmg=${s.dmg}`
        + `  玩家(${s.x},${s.y},${s.pst}) boss(${s.bx},${s.by}) frac=${s.frac}`);
      lastEvt = s.wkey;
    }
    if (s.dead) { console.log(`t${T()}s 阵亡 (上一击=${lastEvt})`); }
    if (s.won) { console.log(`t${T()}s 通关`); break; }
    lastHp = s.hp;
    await page.waitForTimeout(80);
  }
  await browser.close();
})();
