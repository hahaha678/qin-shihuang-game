// 主玩法场景：关卡、战斗、相机、胜负判定
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    const lv = this.registry.get('selectedLevel') || '1';   // 选关场景/URL 参数均经 registry 传入
    const L = lv === '2' ? LEVEL2 : lv === '3' ? LEVEL3 : lv === '4' ? LEVEL4 : LEVEL1;
    this.L = L;
    this.belt = L.mode === 'belt';
    this.worldW = this.belt ? L.width : L.map[0].length * L.tileW;
    this.worldH = this.belt ? 270 : L.map.length * L.tileW;
    this.won = false;
    // 时空断裂：敌人走独立慢时钟；玩家/场景计时不变
    this.enemyTime = 0;
    this.enemyTimeScale = 1;
    this.fractureUntil = 0;
    this.fractureFx = null;      // 蓝色滤镜层（呼吸脉动）
    this.fractureAura = null;    // 玩家缠绕光环
    this.fractureRing = null;    // 脚下收缩计时环
    this.fractureTop = null;     // 电影黑边
    this.fractureBot = null;
    this.timeMotes = null;       // 时之尘粒子发射器

    this.registry.set('playerHp', Player.MAX_HP);
    this.registry.set('playerMax', Player.MAX_HP);
    this.registry.set('playerMeter', 0);
    this.registry.set('msg', '');
    this.registry.set('banner', '');
    this.registry.set('levelName', L.name);
    this.registry.set('beltMode', this.belt);
    this.registry.set('bossName', '');   // Boss 血条显隐开关
    this.registry.set('bossHp', 0);
    this.registry.set('bossMax', 1);

    // ---- 背景（视差）----
    this.add.tileSprite(0, 0, 480, 270, 'bg_far')
      .setOrigin(0).setScrollFactor(0).setDepth(-20);
    // 视差中景：宽度铺满全关卡，纹理平铺，随镜头慢速漂移
    this.add.tileSprite(0, this.worldH - 110, this.worldW + 480, 96, 'bg_mid')
      .setOrigin(0).setScrollFactor(0.35).setDepth(-10);

    if (this.belt) {
      // ---- 清版过关：远墙 + 透视地板 ----
      this.add.tileSprite(0, 108, this.worldW, L.floor.min - 108, 'tiles', 3)
        .setOrigin(0).setDepth(-9).setTileScale(2, 2);
      this.add.tileSprite(0, L.floor.min, this.worldW, 270 - L.floor.min,
        'belt_floor').setOrigin(0).setDepth(-8);
      // 远端压暗带，强化纵深
      this.add.rectangle(0, 108, this.worldW, 34, 0x000000, 0.4)
        .setOrigin(0).setDepth(-7);
      // 沿远墙的装饰柱
      for (let x = 120; x < L.width; x += 220) {
        this.add.image(x, L.floor.min, 'tiles', 4)
          .setOrigin(0.5, 1).setDepth(L.floor.min - 2).setScale(1.4);
      }
      // 物理边界=可行走带。脚部碰撞盒为 20x10、底边贴脚，故 bounds 顶/左/右各放宽 10px
      this.physics.world.setBounds(
        L.bounds.x0 - 10, L.floor.min - 10,
        L.bounds.x1 - L.bounds.x0 + 20, L.floor.max - L.floor.min + 10);
    } else {
      // ---- 关卡 tilemap ----
      const map = this.make.tilemap({ data: L.map, tileWidth: 16, tileHeight: 16 });
      const tiles = map.addTilesetImage('tiles');
      this.layer = map.createLayer(0, tiles, 0, 0);
      this.layer.setCollisionBetween(0, 3);
      // 平台(tile 2)设为单向：只有上表面碰撞，可跳下穿过
      this.layer.forEachTile(t => {
        if (t.index === 2) t.setCollision(false, false, true, false);
      });
      this.physics.world.setBounds(0, 0, this.worldW, this.worldH + 120);
    }

    // ---- 玩家 ----
    this.player = new Player(this, L.playerSpawn.x, L.playerSpawn.y);
    if (this.belt) this.player.initBelt(L);
    else this.physics.add.collider(this.player, this.layer);
    this.player.setDepth(10);

    // ---- 敌人（波次 or 静态布置）----
    this.enemies = this.add.group();
    this.wavesDone = !L.waves;
    this.wavePending = false;
    this.waveIdx = -1;
    if (L.waves) {
      this.time.delayedCall(700, () => this.spawnWave(0));
    } else {
      L.enemies.forEach(e => this.spawnEnemy(e));
    }
    if (!this.belt) this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.player, this.enemies);

    // ---- Boss（第四章）：登场延迟 + 横幅亮相 ----
    this.boss = null;
    this.bossShots = this.physics.add.group({ allowGravity: false });   // Boss 灵丹弹
    if (L.boss) this.time.delayedCall(800, () => this.spawnBoss());

    // 灵丹弹 -> 玩家：滚过=极限闪避（弹体继续飞，断裂期冻在半空）；命中才销毁
    // （overlap 回调按调用实参序传参：sprite 在前、group 成员在后）
    this.physics.add.overlap(this.player, this.bossShots, (p, sh) => {
      if (!sh.active) return;
      if (p.tryDodge(sh.swingTag)) return;
      if (p.takeDamage(sh.dmg, sh.x, sh.swingTag)) sh.destroy();
    });
    // 挥剑劈丹（弹反）：攻击判定窗内击碎灵丹，奖励龙威
    for (const z of Object.values(this.player.zones)) {
      this.physics.add.overlap(z, this.bossShots, (zz, sh) => {
        if (!sh.active) return;
        this.burst(sh.x, sh.y - 4, { count: 6 });
        this.player.gainMeter(4);
        Sfx.hit();
        sh.destroy();
      });
    }

    // 三类判定盒 -> 敌人（zone 全程挂重叠器，靠 body.enable + swingId 防连击）
    for (const z of Object.values(this.player.zones)) {
      this.physics.add.overlap(z, this.enemies, (zz, en) => {
        const mv = this.player.move;
        if (en.takeDamage(this.player.currentDamage, this.player.x,
          this.player.swingId, mv && mv.launch)) {
          this.player.gainMeter(8);   // 命中攒龙威
          this.onPlayerHit(en);
        }
      });
    }

    // ---- 粒子发射器（金色火花 / 红血雾 / 尘土）----
    const sparkCfg = tint => ({
      speed: { min: 50, max: 190 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.4, end: 0 },
      lifespan: { min: 180, max: 420 },
      gravityY: 500,
      blendMode: 'ADD',
      emitting: false,
      tint,
    });
    this.sparksGold = this.add.particles(0, 0, 'fx_spark',
      sparkCfg([0xffffff, 0xffd75e, 0xffa030])).setDepth(1000);
    this.sparksRed = this.add.particles(0, 0, 'fx_spark',
      sparkCfg([0xff5030, 0xb03028, 0xff9060])).setDepth(1000);
    this.sparksBlue = this.add.particles(0, 0, 'fx_spark',
      sparkCfg([0xffffff, 0x9fd0ff, 0x6a86e8])).setDepth(1000);
    this.dust = this.add.particles(0, 0, 'fx_spark', {
      speed: { min: 20, max: 70 }, angle: { min: 200, max: 340 },
      scale: { start: 1.8, end: 0 }, lifespan: { min: 200, max: 400 },
      gravityY: -30, alpha: { start: 0.5, end: 0 },
      emitting: false, tint: [0x9a9ab0, 0x6a6a80],
    }).setDepth(this.belt ? 1000 : 7);   // belt: 角色深度是 y(≤270)，尘土也要置顶

    // ---- 仙丹 ----
    this.pills = this.physics.add.group({ allowGravity: !this.belt });
    L.pills.forEach(p => {
      const pill = this.pills.create(p.x, p.y, 'item_pill');
      if (this.belt) pill.setDepth(p.y - 0.6);
    });
    if (!this.belt) this.physics.add.collider(this.pills, this.layer);
    this.physics.add.overlap(this.player, this.pills, (pl, pill) => {
      pill.destroy();
      pl.hp = Math.min(pl.maxHp || Player.MAX_HP, pl.hp + 30);
      this.registry.set('playerHp', pl.hp);
      Sfx.pickup();
      this.burst(pill.x, pill.y, { count: 10 });
      const fx = this.add.sprite(pill.x, pill.y, 'fx_hit').play('fx-hit');
      fx.once('animationcomplete', () => fx.destroy());
    });

    // ---- 相机 ----
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldW, this.worldH);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setDeadzone(70, 90);

    // Q 返回选关（死亡/通关后可用，走时间戳缓冲）
    this.quitSelUntil = 0;
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)
      .on('down', () => { this.quitSelUntil = this.time.now + 400; });

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
  }

  spawnEnemy(e) {
    const en = new Enemy(this, e.x, e.y ?? 200, e.type);
    this.enemies.add(en);
    if (this.belt) en.initBelt(this.L);
    else en.setDepth(9);
    en.setAlpha(0);
    this.tweens.add({ targets: en, alpha: 1, duration: 260 });
    // 矛尖判定 -> 玩家（先判极限闪避，命中才结算伤害）
    en.attackOverlap = this.physics.add.overlap(en.attackBox, this.player,
      (box, p) => {
        if (p.tryDodge(en.attackSwing)) return;   // 滚中受击=极限闪避，触发时空断裂
        p.takeDamage(en.dmg, en.x, en.attackSwing);
      });
    return en;
  }

  spawnBoss() {
    const b = this.L.boss;
    const en = new Boss(this, b.x, b.y, b.name);
    this.enemies.add(en);
    en.initBelt(this.L);
    this.boss = en;
    en.setAlpha(0);
    this.tweens.add({ targets: en, alpha: 1, duration: 500 });
    // Boss 判定盒 -> 玩家（同样先判极限闪避）
    en.attackOverlap = this.physics.add.overlap(en.attackBox, this.player,
      (box, p) => {
        if (p.tryDodge(en.attackSwing)) return;
        p.takeDamage(en.dmg, en.x, en.attackSwing);
      });
    this.registry.set('bossName', en.name);
    this.registry.set('bossMax', en.maxHp);
    this.registry.set('bossHp', en.hp);
    const banner = `${en.name} · 现！`;
    this.registry.set('banner', banner);
    Sfx.gong();
    this.cameras.main.shake(220, 0.006);
    this.time.delayedCall(1600, () => {
      if (this.registry.get('banner') === banner)
        this.registry.set('banner', '');
    });
  }

  spawnWave(i) {
    this.waveIdx = i;
    const names = ['一', '二', '三', '四', '五'];
    this.registry.set('banner', `第${names[i]}阵 · 杀！`);
    Sfx.gong();
    this.cameras.main.shake(180, 0.004);
    this.time.delayedCall(1500, () => {
      if ((this.registry.get('banner') || '').startsWith('第'))
        this.registry.set('banner', '');
    });
    // 生成期间锁波次判定，防“空场=全灭”误判
    this.wavePending = true;
    const n = this.L.waves[i].length;
    this.L.waves[i].forEach((e, j) =>
      this.time.delayedCall(300 + j * 220, () => this.spawnEnemy(e)));
    this.time.delayedCall(300 + n * 220, () => { this.wavePending = false; });
  }

  /** 粒子爆发：dust 落地尘 / red 血色 / blue 时空蓝 / 默认金火花 */
  burst(x, y, { count = 10, red = false, dust = false, blue = false } = {}) {
    const e = dust ? this.dust
      : blue ? this.sparksBlue : red ? this.sparksRed : this.sparksGold;
    e.explode(count, x, y);
  }

  /** 飘伤害数字 */
  dmgNumber(x, y, dmg, crit) {
    const t = this.add.text(x + Phaser.Math.Between(-7, 7), y,
      String(dmg) + (crit ? '!' : ''), {
        fontFamily: '"Georgia", "SimHei", serif',
        fontSize: crit ? '15px' : '11px',
        fontStyle: 'bold',
        color: crit ? '#ff5030' : '#ffd75e',
        stroke: '#201000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(1000);
    this.tweens.add({
      targets: t,
      y: y - 24,
      alpha: { from: 1, to: 0 },
      scale: crit ? { from: 1.5, to: 1 } : { from: 1.2, to: 1 },
      duration: crit ? 720 : 500,
      ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    });
  }

  /** 极限闪避成功 -> 时空断裂：敌人慢时钟减速，玩家全速，期间 J = 裂空斩。
      纯视觉提示：电影黑边+蓝滤镜呼吸+双涟漪+时之尘+脚下计时环（无文字） */
  onPerfectDodge() {
    const dur = 1900;
    const retrigger = this.fractureUntil > this.time.now;  // 断裂仍在持续 -> 只续时，不重演全屏特效（防频闪）
    this.fractureUntil = this.time.now + dur;
    this.fractureDur = dur;
    this.enemyTimeScale = 0.16;
    this.hitstop(90);                                  // 触发瞬间硬直
    if (!retrigger) {
      this.cameras.main.zoomTo(1.07, 220);             // 镜头推近再回弹
      this.time.delayedCall(260, () => this.cameras.main.zoomTo(1, 300));
      this.releaseFractureFx();                        // 上次淡出残留清理
    }
    this.cameras.main.shake(160, 0.007);
    this.player.gainMeter(30);                         // 奖励龙威
    Sfx.fracture();
    // 触发点涟漪 + 蓝色爆花：每次触发都给（局部小特效，不闪屏）
    const rip = this.add.sprite(this.player.x, this.player.y - 10, 'fx_ring')
      .setTint(0x8fb8ff).setDepth(this.player.depth + 0.5)
      .setScale(0.9).play('fx-ring');
    rip.once('animationcomplete', () => rip.destroy());
    this.sparksBlue.explode(16, this.player.x, this.player.y - 14);

    if (!this.fractureFx) {
      // 全屏蓝色滤镜：淡入后恒定覆盖整个断裂期（不遮 HUD——UIScene 是独立场景，天然在上层）
      const fx = this.fractureFx = this.add.rectangle(0, 0, 480, 270, 0x2a4cff, 0)
        .setOrigin(0).setScrollFactor(0).setDepth(998);
      this.tweens.add({ targets: fx, alpha: 0.18, duration: 220 });
      // 电影黑边：上下黑条滑入
      this.fractureTop = this.add.rectangle(0, 0, 480, 0, 0x000000, 0.85)
        .setOrigin(0).setScrollFactor(0).setDepth(999);
      this.fractureBot = this.add.rectangle(0, 270, 480, 0, 0x000000, 0.85)
        .setOrigin(0, 1).setScrollFactor(0).setDepth(999);
      this.tweens.add({ targets: [this.fractureTop, this.fractureBot],
        height: 16, duration: 240, ease: 'Cubic.Out' });
      // 地面冲击波
      const w = this.add.sprite(this.player.x,
        this.player.y + (this.belt ? 2 : 12), 'fx_wave')
        .setTint(0x9fd0ff)
        .setDepth(this.belt ? this.player.y + 0.05 : 26)
        .play('fx-wave');
      w.once('animationcomplete', () => w.destroy());
      // 缠绕玩家的冰蓝光环（放大版）
      this.fractureAura = this.add.sprite(this.player.x,
        this.player.y - 20, 'fx_aura')
        .setTint(0x9fd0ff).setDepth(999).setScale(1.3).play('fx-aura');
      // 脚下收缩计时环 = 断裂剩余时间
      this.fractureRing = this.add.ellipse(this.player.x, this.player.y,
        44, this.belt ? 14 : 18)
        .setStrokeStyle(2, 0x9fd0ff, 0.9)
        .setDepth(this.belt ? this.player.y - 0.2 : 999);
      // 环绕玩家的时之尘（慢速上浮光点）
      if (!this.timeMotes) {
        this.timeMotes = this.add.particles(0, 0, 'fx_spark', {
          speed: { min: 6, max: 26 }, angle: { min: 250, max: 290 },
          scale: { start: 1.1, end: 0 }, lifespan: { min: 400, max: 900 },
          gravityY: -40, blendMode: 'ADD', emitting: false,
          tint: [0x9fd0ff, 0x6a86e8, 0xffffff],
          emitZone: { type: 'random',
            source: new Phaser.Geom.Rectangle(-26, -34, 52, 34) },
        }).setDepth(999);
      }
      this.timeMotes.startFollow(this.player).start();
    }
  }

  /** 裂空斩出手 -> 提前解除时空断裂；收尾统一走 update 里的 enemyTimeScale!==1 分支 */
  endFracture() {
    this.fractureUntil = 0;
  }

  /** 断裂特效统一渐隐退场（断裂结束、或再次触发断裂前调用，避免新旧 FX 重叠） */
  releaseFractureFx() {
    if (this.fractureFx) {
      const fx = this.fractureFx; this.fractureFx = null;
      this.tweens.killTweensOf(fx);
      this.tweens.add({ targets: fx, alpha: 0, duration: 350,
        onComplete: () => fx.destroy() });
    }
    if (this.fractureAura) {
      const au = this.fractureAura; this.fractureAura = null;
      this.tweens.add({ targets: au, alpha: 0, duration: 300,
        onComplete: () => au.destroy() });
    }
    if (this.fractureRing) {
      const rg = this.fractureRing; this.fractureRing = null;
      this.tweens.add({ targets: rg, alpha: 0, duration: 250,
        onComplete: () => rg.destroy() });
    }
    if (this.fractureTop) {
      const top = this.fractureTop, bot = this.fractureBot;
      this.fractureTop = this.fractureBot = null;
      this.tweens.add({
        targets: [top, bot], height: 0, duration: 200,
        onComplete: () => { top.destroy(); bot.destroy(); },
      });
    }
    if (this.timeMotes) this.timeMotes.stop();
  }

  /** 顿帧：物理 + 所有动画一起冻结 ms 毫秒（真实时，不受击杀慢镜 timeScale 影响） */
  hitstop(ms) {
    this.physics.pause();
    this.anims.pauseAll();
    clearTimeout(this._hitstopT);
    this._hitstopT = setTimeout(() => {
      this.physics.resume();
      this.anims.resumeAll();
    }, ms);
  }

  onPlayerHit(en) {
    const heavy = !!(this.player.move && this.player.move.heavy);
    const killing = en.hp <= 0;

    this.hitstop(killing ? 140 : heavy ? 90 : 55);
    this.cameras.main.shake(
      killing ? 180 : heavy ? 140 : 70,
      killing ? 0.012 : heavy ? 0.008 : 0.004);
    if (heavy || killing) Sfx.hitHeavy(); else Sfx.hit();

    // 击杀：慢动作 + 镜头推近 + 大爆花
    const useBlue = this.player.moveKey === 'rift';   // 裂空斩命中=蓝色爆花
    if (killing) {
      this.time.timeScale = 0.25;
      // 慢镜恢复/镜头回弹统一走真实时钟，不与 timeScale 混用导致时序漂移
      setTimeout(() => { if (this.time) this.time.timeScale = 1; }, 170);
      this.cameras.main.zoomTo(1.09, 100);
      setTimeout(() => {
        if (this.cameras && this.cameras.main) this.cameras.main.zoomTo(1, 170);
      }, 240);
      this.burst(en.x, en.y - 6, { count: 14, blue: useBlue });
      this.burst(en.x, en.y - 6, { count: 8, red: true });
    } else {
      this.burst(en.x, en.y - 6,
        { count: heavy ? 9 : 5, blue: useBlue, red: heavy && !useBlue });
    }

    // 伤害数字
    this.dmgNumber(en.x, en.y - 28, this.player.currentDamage, heavy || killing);

    // 命中火花图（belt: 进深度空间并按目标深度缩放，会被近处角色正确遮挡）
    const fdy = this.belt ? -28 * Math.abs(en.scaleX) : -4;
    const fx = this.add.sprite(en.x, en.y + fdy, 'fx_hit')
      .play('fx-hit').setDepth(this.belt ? en.y + 0.2 : 30);
    if (this.belt) fx.setScale(Math.abs(en.scaleX));
    fx.once('animationcomplete', () => fx.destroy());
  }

  update(time, delta) {
    if (this.player) this.player.update(time, delta);   // dead/R重开由 Player 内部处理

    // 敌人时钟：断裂期间慢速推进（AI/攻击窗口/受击僵直统一走慢表）
    this.enemyTime += delta * this.enemyTimeScale;
    this.enemies.children.iterate(en => en.updateEnemy(this.player, this.enemyTime));

    // ---- 时空断裂维持/结束 ----
    if (this.fractureUntil > time) {
      this.enemies.children.iterate(en => {
        if (!en.dead && en.state !== 'hurt') {
          en.anims.timeScale = this.enemyTimeScale;
          en.setTint(0x6a86e8);                        // 蓝化=被时间冻结
        } else if (!en.dead) {
          en.anims.timeScale = this.enemyTimeScale;    // hurt 白闪优先，仍减速
        }
      });
      if (this.fractureAura)
        this.fractureAura.setPosition(this.player.x, this.player.y - 20)
          .setScale(Math.abs(this.player.scaleX) * 1.3);
      if (this.fractureRing)
        this.fractureRing.setPosition(this.player.x, this.player.y)
          .setScale((this.fractureUntil - time) / this.fractureDur, 1);
    } else if (this.enemyTimeScale !== 1) {
      this.enemyTimeScale = 1;
      this.enemies.children.iterate(en => {
        en.anims.timeScale = 1;
        if (!en.dead && en.state !== 'hurt') en.restoreTint();
      });
      // 滤镜/光环/计时环渐隐退出（蓝滤镜持续到解除瞬间再淡出，不闪断）
      this.releaseFractureFx();
    }

    // 波次推进：全灭 -> 下一波 / 全波次清完 -> 开放过关
    if (this.L.waves && !this.wavesDone && this.waveIdx >= 0) {
      const alive = this.enemies.children.entries.some(e => !e.dead);
      if (!alive && !this.wavePending && time > 0) {
        this.wavePending = true;
        this.time.delayedCall(1000, () => {
          this.wavePending = false;
          this.waveIdx++;
          if (this.waveIdx < this.L.waves.length) {
            this.spawnWave(this.waveIdx);
          } else {
            this.wavesDone = true;
            this.registry.set('banner', '敌阵已破 · 登台受赏！');
            Sfx.win();
            this.time.delayedCall(1800, () => this.registry.set('banner', ''));
          }
        });
      }
    }

    // 坠坑
    if (this.L.fallY && !this.player.dead && this.player.y > this.L.fallY)
      this.player.fellInPit();

    // Boss 关：击杀不死药灵即通关（不走 winX）
    if (!this.won && this.L.boss && this.boss && this.boss.dead && !this.player.dead) {
      this.won = true;
      this.player.win();
      Sfx.win();
      this.registry.set('bossName', '');   // 收起 Boss 血条
    }

    // 过关（波次关卡需先清完全部敌阵；Boss 关不走 winX）
    if (!this.won && !this.L.boss && this.wavesDone && !this.player.dead && this.player.x > this.L.winX) {
      this.won = true;
      this.player.win();
      Sfx.win();
      this.enemies.children.iterate(en => {
        if (!en.dead) { en.state = 'patrol'; en.body.setVelocityX(0); }
      });
    }

    // R 重开（死亡或通关后）——走玩家输入缓冲，JustDown 会漏短按键
    if ((this.player.dead || this.won)
        && this.player.bufRestartUntil > time) {
      this.player.bufRestartUntil = 0;
      this.scene.restart();
    }

    // Q 返回选关
    if ((this.player.dead || this.won) && this.quitSelUntil > time) {
      this.quitSelUntil = 0;
      this.scene.stop('UIScene');
      this.scene.start('SelectScene');
    }
  }
}
