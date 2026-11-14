// 自动通关演示：读游戏状态 -> 决策 -> 按键，全程录屏 webm
// 用法: node tools/record_run.js [level]   level=1/2/3/4，3为清版过关，4为 Boss 战
// 每次尝试独立录像：阵亡整段丢弃重来，落盘的保证是「一次完整通关」
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VIDEO_DIR = path.join(__dirname, 'video');
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const LV = process.argv[2] || '2';
const MAX_ATTEMPTS = 10;      // 最多尝试次数
const ATTEMPT_MS = 200000;    // 单次尝试上限

// ---------------- 一次尝试：新开页面打完整局，赢了 return true ----------------
async function playAttempt(ctx, att) {
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.text().startsWith('[bot]')) console.log(' ', m.text()); });
  await page.goto(`http://localhost:8123/?level=${LV}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // ---- 按键管理 ----
  const held = new Set();
  const hold = async (keys = []) => {
    for (const k of held) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const tap = async (k, ms = 70) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
  const sleep = ms => page.waitForTimeout(ms);

  const state = () => page.evaluate(() => {
    const gs = window.game.scene.getScene('GameScene');
    if (!gs || !gs.player) return null;
    const p = gs.player;
    const alive = gs.enemies.children.entries.filter(e => !e.dead);
    const b = gs.boss;
    return {
      x: p.x, y: p.y, hp: p.hp, dead: p.dead, st: p.state, meter: p.meter,
      facing: p.facing, air: p.state === 'air' || !p.body.blocked.down,
      won: gs.won, wavesDone: gs.wavesDone, winX: gs.L.winX, belt: !!gs.belt,
      frac: (gs.enemyTimeScale || 1) < 1,
      boss: b && !b.dead ? {
        x: b.x, y: b.y, st: b.state, hp: b.hp, wkey: b.warnKey,
        tLeft: b.stateUntil - gs.enemyTime,        // 当前状态剩余 ms（敌人时钟）
        tIn: gs.enemyTime - b.attackStartAt,       // 已出招 ms（attack 状态用）
        wz: b.warnZone ? { x: b.warnZone.x, y: b.warnZone.y } : null,
      } : null,
      foes: alive.map(e => ({ x: e.x, y: e.y, st: e.state, type: e.type })),
    };
  });

  console.log(`第${att}次尝试…`);
  const t0 = Date.now();
  let lastHp = 100;

  // ---- Boss 战：页内逐帧驱动（TAS）——读 stateUntil 读秒卡极限闪避 ----
  // 直接写玩家输入缓冲/方向键 isDown，走游戏真实输入管线，无轮询延迟
  if (LV === '4') {
    await page.evaluate(() => {
      const gs = window.game.scene.getScene('GameScene');
      let lastJab = 0;
      const tick = () => {
        const p = gs.player, b = gs.boss;
        if (!p || p.dead || !b || b.dead) return;
        const t = gs.time.now;
        const dx = b.x - p.x, dy = b.y - p.y;
        const adx = Math.abs(dx), ady = Math.abs(dy);
        const toward = dx > 0 ? 1 : -1, away = -toward;
        const laneAway = dy > 0 ? -1 : 1;
        const setDir = (x, y) => {
          p.kLeft.forEach(k => { k.isDown = x < 0; });
          p.kRight.forEach(k => { k.isDown = x > 0; });
          p.kDepthUp.forEach(k => { k.isDown = y < 0; });
          p.kDown.forEach(k => { k.isDown = y > 0; });
        };
        // 时空断裂中：J = 裂空斩
        if ((gs.enemyTimeScale || 1) < 1) {
          setDir(0, 0);
          if (t - lastJab > 300) { lastJab = t; p.bufAtkUntil = t + 130; }
          return;
        }
        const tLeft = b.stateUntil - gs.enemyTime;   // 当前状态剩余 ms
        const tIn = gs.enemyTime - b.attackStartAt;  // 已出招 ms
        if (b.state === 'warn') {
          if (b.warnKey === 'flop' && b.warnZone) {   // 落点锁定 -> 离开红区
            setDir(b.warnZone.x > p.x ? -1 : 1, b.warnZone.y > p.y ? -1 : 1);
            return;
          }
          if (b.warnKey === 'charge') {               // 车道冲撞 -> 纯错道拉开纵深
            setDir(0, laneAway); return;
          }
          // sweep / roar：贴到判定边缘，读秒迎滚 -> 极限闪避 -> 断裂
          setDir(adx > 70 ? toward : adx < 40 ? away : 0,
            ady > 10 ? Math.sign(dy) : 0);
          if (tLeft < 150 && adx < 130) {
            setDir(toward, 0);
            p.bufRollUntil = t + 130;
          }
          return;
        }
        if (b.state === 'attack') {
          if (b.warnKey === 'flop') {                 // 落点已锁定 -> 全程跑离
            setDir(b.flopTx > p.x ? -1 : 1, b.flopTy > p.y ? -1 : 1);
            return;
          }
          if (b.warnKey === 'charge' && ady < 34) { setDir(0, laneAway); return; }
          if ((b.warnKey === 'sweep' || b.warnKey === 'roar')
              && tIn < 120 && adx < 130) {            // 预警期没滚上 -> 补滚
            setDir(toward, 0); p.bufRollUntil = t + 130; return;
          }
          if (adx < 100 && ady < 18) { setDir(away, laneAway); return; }
          setDir(0, 0); return;
        }
        // 输出窗口：recover/hurt 必打；idle 只在 Boss 不会马上出手时偷刀
        const canJab = ady < 12 && adx < 38
          && (b.state !== 'idle' || (b.nextActAt - gs.enemyTime) > 450);
        if (canJab) {
          setDir(0, 0);
          if (p.meter >= 100) { p.bufRoarUntil = t + 130; return; }
          if (t - lastJab > 240) { lastJab = t; p.bufAtkUntil = t + 130; }
          return;
        }
        // idle 下保持 55-75 读招距
        const want = adx > 75 ? toward : adx < 55 ? away : 0;
        setDir(want, ady > 8 ? Math.sign(dy) : 0);
      };
      gs.events.on('update', tick);
      window.__botOff = () => gs.events.off('update', tick);
    });
    // 只看不打：等通关或阵亡
    while (Date.now() - t0 < ATTEMPT_MS) {
      const s = await state();
      if (!s) { await sleep(300); continue; }
      if (s.hp < lastHp)
        console.log(`  >> 掉血 ${lastHp}->${s.hp} boss=${s.boss ? s.boss.st + '/' + s.boss.wkey : '-'}`);
      lastHp = s.hp;
      if (s.dead) { console.log(`  第${att}次阵亡`); return { won: false, page }; }
      if (s.won) { console.log(`  第${att}次通关！`); await sleep(600); return { won: true, page }; }
      await sleep(200);
    }
    console.log(`  第${att}次超时`);
    return { won: false, page };
  }

  let lastDash = 0, lastCharge = 0, lastSlam = 0, lastRiser = 0, lastRoll = 0, tick = 0;
  const R = Math.random;
  while (Date.now() - t0 < ATTEMPT_MS) {
    tick++;
    const s = await state();
    if (!s) { await sleep(300); continue; }
    if (s.hp < lastHp)
      console.log(`  >> 掉血 ${lastHp}->${s.hp} boss=${s.boss ? s.boss.st + '/' + s.boss.wkey : '-'}`);
    lastHp = s.hp;
    if (s.dead) { console.log(`  第${att}次阵亡`); return { won: false, page }; }
    if (s.won) { console.log(`  第${att}次通关！`); await sleep(600); return { won: true, page }; }
    if (tick % 30 === 0)
      console.log(`  t${((Date.now() - t0) / 1000) | 0}s 敌${s.foes.length} 血${s.hp} 龙威${s.meter} x${s.x | 0}`);

    const foes = s.foes;
    if (!foes.length) {
      // 无敌：向右走向终点（波次中会自动出怪）
      if (s.wavesDone) await hold(s.won ? [] : ['d']);
      else await hold(s.x < 700 ? ['d'] : []);
      await sleep(120);
      continue;
    }

    // ============ 清版过关（belt）决策：纵深对道/换道闪避/范围技 ============
    if (s.belt) {
      // ---- Boss 战（level 4）：看红区预警拆招，安全窗口输出 ----
      if (s.boss) {
        const b = s.boss;
        const dx = b.x - s.x, dy = b.y - s.y;
        const adx = Math.abs(dx), ady = Math.abs(dy);
        const dirKey = dx > 0 ? 'd' : 'a';
        const backKey = dx > 0 ? 'a' : 'd';
        const laneAway = dy > 0 ? 'w' : 's';   // 远离 Boss 所在道

        // 时空断裂中：J = 裂空斩
        if (s.frac) {
          await hold([]); await tap('j', 60); await sleep(320); continue;
        }
        // 红区预警：按招拆
        if (b.st === 'warn') {
          if (b.wkey === 'flop' && b.wz) {
            // 落点已锁定 -> 远离红区
            const kx = b.wz.x - s.x > 0 ? 'a' : 'd';
            const ky = b.wz.y - s.y > 0 ? 'w' : 's';
            await hold([kx, ky]); await sleep(300); continue;
          }
          if (b.wkey === 'charge') {
            // 车道冲撞 -> 离开 Boss 所在道
            await hold([backKey, laneAway]); await sleep(300); continue;
          }
          // sweep / roar：站到判定边缘，按剩余时间读秒卡极限闪避
          const keys = [];
          if (adx > 90) keys.push(dirKey);
          else if (adx < 36) keys.push(backKey);
          if (ady > 12) keys.push(dy > 0 ? 's' : 'w');
          await hold(keys);
          if (b.tLeft < 160 && adx < 130 && Date.now() - lastRoll > 700) {
            lastRoll = Date.now();
            await hold([dirKey]); await tap('k', 60);   // 迎滚 -> 无敌帧罩起手 -> 断裂
            await sleep(300);
          } else await sleep(45);
          continue;
        }
        // 出招进行中
        if (b.st === 'attack') {
          if ((b.wkey === 'sweep' || b.wkey === 'roar')
              && b.tIn < 140 && adx < 130 && Date.now() - lastRoll > 700) {
            lastRoll = Date.now();                      // 预警期没赶上 -> 补滚
            await hold([dirKey]); await tap('k', 60);
            await sleep(300); continue;
          }
          if ((b.wkey === 'charge' && ady < 18)
              || (b.wkey !== 'charge' && adx < 90 && ady < 18)) {
            await hold([b.wkey === 'charge' ? laneAway : backKey, laneAway]);
            await sleep(180); continue;
          }
        }
        // 远距离：翻滚取消冲刺斩赶路
        if (adx > 95 && Date.now() - lastDash > 3000 && R() < 0.4) {
          lastDash = Date.now();
          await hold([dirKey]); await tap('k', 60); await sleep(60);
          await tap('j', 70); await sleep(300); continue;
        }
        // 龙威：槽满且够得着就放
        if (s.meter >= 100 && adx < 140) {
          await hold([]); await tap('u', 80); await sleep(430); continue;
        }
        // 贴身对齐：三连输出（Boss 受击盒 26x14 在脚部）
        if (ady < 12 && adx < 40) {
          await hold([]); await tap('j', 60);
          await sleep(R() < 0.5 ? 200 : 130); continue;
        }
        // 逼近：双轴对齐
        const keys = [];
        if (dx > 15) keys.push('d'); else if (dx < -15) keys.push('a');
        if (ady > 8) keys.push(dy > 0 ? 's' : 'w');
        await hold(keys); await sleep(90); continue;
      }
      const f = foes.reduce((a, b) =>
        Math.abs(b.x - s.x) + Math.abs(b.y - s.y) <
        Math.abs(a.x - s.x) + Math.abs(a.y - s.y) ? b : a);
      const dx = f.x - s.x, dy = f.y - s.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const dirKey = dx > 0 ? 'd' : 'a';
      const laneKey = dy > 0 ? 's' : 'w';
      const nearCount = foes.filter(e =>
        Math.abs(e.x - s.x) < 120 && Math.abs(e.y - s.y) < 30).length;
      const threat = foes.some(e => e.st === 'attack'
        && Math.abs(e.x - s.x) < 60 && Math.abs(e.y - s.y) < 16);

      // 龙威：被围就震
      if (s.meter >= 100 && nearCount >= 2) {
        await hold([]); await tap('u', 80); await sleep(430); continue;
      }
      // 敌人在刺 -> 上下错道闪避（清版精髓）
      if (threat && R() < 0.55) {
        const upCrowd = foes.filter(e => e.y < s.y - 6).length;
        const dnCrowd = foes.filter(e => e.y > s.y + 6).length;
        await hold([upCrowd <= dnCrowd ? 'w' : 's']);
        await sleep(280); continue;
      }
      // 远距离：翻滚取消冲刺斩，突进中按道向斜切
      if (adx > 110 && Date.now() - lastDash > 2800 && R() < 0.42) {
        lastDash = Date.now();
        await hold([dirKey]); await tap('k', 60); await sleep(60);
        await tap('j', 70);
        const ks = [dirKey]; if (ady > 10) ks.push(laneKey);
        await hold(ks); await sleep(280); continue;
      }
      // 被围偶尔跳劈 AoE
      if (adx < 55 && nearCount >= 2 && Date.now() - lastSlam > 4500 && R() < 0.28) {
        lastSlam = Date.now();
        await hold([]); await tap(' ', 70); await sleep(220);
        await tap('j', 60); await sleep(450); continue;
      }
      // 安全中距蓄力斩
      if (adx > 60 && !threat && Date.now() - lastCharge > 7000 && R() < 0.2) {
        lastCharge = Date.now();
        await hold([]); await page.keyboard.down('j');
        await sleep(720); await page.keyboard.up('j');
        await sleep(380); continue;
      }
      // 对道近身：三连输出
      if (adx < 42 && ady < 14) {
        await hold([]); await tap('j', 60);
        await sleep(R() < 0.5 ? 200 : 130); continue;
      }
      // 逼近：双轴对齐（先对道再贴近）
      const keys = [];
      if (dx > 16) keys.push('d'); else if (dx < -16) keys.push('a');
      if (ady > 8) keys.push(laneKey);
      await hold(keys); await sleep(90); continue;
    }
    // ============ 平台模式（level 1/2）原有决策 ============

    const f = foes.reduce((a, b) => Math.abs(b.x - s.x) < Math.abs(a.x - s.x) ? b : a);
    const dx = f.x - s.x, adx = Math.abs(dx);
    const dirKey = dx > 0 ? 'd' : 'a';
    const foeAbove = f.y < s.y - 40;
    const foeAttacking = foes.some(e => e.st === 'attack' && Math.abs(e.x - s.x) < 55);
    const nearCount = foes.filter(e => Math.abs(e.x - s.x) < 120).length;

    // 龙威：槽满且周围有敌 -> 释放
    if (s.meter >= 100 && nearCount >= 2 && !s.air) {
      await hold([]);
      await tap('u', 80);
      await sleep(400);
      continue;
    }
    // 被围攻时后撤翻滚
    if (foeAttacking && R() < 0.3) {
      await hold([dx > 0 ? 'a' : 'd']);   // 反向滚
      await tap('k', 70);
      await sleep(300);
      continue;
    }
    // 敌人在上方平台 -> 跳上去/升龙
    if (foeAbove && adx < 90 && Date.now() - lastRiser > 3000 && R() < 0.5) {
      lastRiser = Date.now();
      await hold([]);
      await tap(' ', 80);          // 起跳
      await sleep(200);
      await tap('ArrowUp', 80);    // 升龙斩
      await sleep(400);
      continue;
    }
    // 远距离：冲刺斩赶路（带冷却）
    if (adx > 110 && !s.air && Date.now() - lastDash > 2600 && R() < 0.45) {
      lastDash = Date.now();
      await hold([dirKey]);
      await tap('k', 60);
      await sleep(60);
      await tap('j', 70);          // 滚中J = 冲刺斩
      await sleep(350);
      continue;
    }
    // 中距离安全时蓄力斩
    if (adx > 70 && !foeAttacking && !s.air && Date.now() - lastCharge > 7000 && R() < 0.3) {
      lastCharge = Date.now();
      await hold([]);
      await page.keyboard.down('j');
      await sleep(750);            // 按住蓄力
      await page.keyboard.up('j');
      await sleep(350);
      continue;
    }
    // 近身：三连击，偶尔跳砸
    if (adx <= 48) {
      await hold([]);
      if (R() < 0.12 && Date.now() - lastSlam > 5000) {
        lastSlam = Date.now();
        await tap(' ', 70);
        await sleep(240);
        await page.keyboard.down('ArrowDown');
        await tap('j', 60);
        await page.keyboard.up('ArrowDown');
        await sleep(400);
        continue;
      }
      await tap('j', 60);
      await sleep(R() < 0.5 ? 210 : 130);   // 留出连击窗口
      continue;
    }
    // 逼近
    await hold([dirKey]);
    await sleep(110);
  }
  console.log(`  第${att}次超时`);
  return { won: false, page };
}

(async () => {
  const browser = await chromium.launch();
  let saved = false;
  for (let att = 1; att <= MAX_ATTEMPTS && !saved; att++) {
    const ctx = await browser.newContext({
      viewport: { width: 960, height: 540 },
      recordVideo: { dir: VIDEO_DIR, size: { width: 960, height: 540 } },
    });
    const r = await playAttempt(ctx, att)
      .catch(e => { console.log('  异常:', e.message); return { won: false, page: null }; });
    const video = r.page ? r.page.video() : null;
    await ctx.close().catch(() => {});   // 关闭context后视频才落盘
    if (r.won && video) {
      try {
        const vpath = await video.path();
        const target = path.join(VIDEO_DIR, `playthrough_lv${LV}.webm`);
        fs.copyFileSync(vpath, target);
        console.log('视频已保存:', target);
        saved = true;
      } catch (e) { console.log('  录像落盘失败:', e.message); }
    }
  }
  if (!saved) console.log(`${MAX_ATTEMPTS}次尝试未通关，未产出视频`);
  await browser.close();
})();
