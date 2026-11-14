// 不死药灵 Boss：胖黄灵兽。出招前红区预警——肚皮横扫/泰山压顶/弹弹冲撞/震地咆哮(狂暴期)
// 接口与 Enemy 对齐：dead/state/attackBox/attackSwing/takeDamage/updateEnemy，直接复用现有战斗管线
class Boss extends Phaser.Physics.Arcade.Sprite {
  static MAX_HP = 420;
  static STAGGER = 140;      // 累计削韧 -> 打断出招硬直
  static SCALE = 2.15;       // 体型倍率

  // warn=预警时长ms, f/u=判定窗, dur=总长, bw/bh=判定盒, box=偏移, tele=预警类型
  static MOVES = {
    sweep:  { anim: 'boss-sweep',  dmg: 18, warn: 640, f: 80,  u: 220,   dur: 520,  bw: 58, bh: 26, box: [36, -8], tele: 'arc'  },
    flop:   { anim: 'boss-slam',   dmg: 22, warn: 720, f: 470, u: 560,   dur: 620,  bw: 84, bh: 40, tele: 'zone' },
    charge: { anim: 'boss-charge', dmg: 20, warn: 720, f: 0,   u: 99999, dur: 4200, bw: 30, bh: 20, box: [16, -8], tele: 'lane' },
    roar:   { anim: 'boss-roar',   dmg: 14, warn: 820, f: 0,   u: 260,   dur: 700,  bw: 130, bh: 56, box: [0, -10], tele: 'ring' },
    spit:   { anim: 'boss-spit',   dmg: 12, warn: 560, f: 150, u: 0,     dur: 680,  tele: 'mouth' },  // 吐丹：f=吐弹时刻
  };

  constructor(scene, x, y, name) {
    super(scene, x, y, 'boss_idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.name = name || '不死药灵';
    this.type = 'boss';
    this.hp = Boss.MAX_HP;
    this.maxHp = Boss.MAX_HP;
    this.dead = false;
    this.state = 'idle';       // idle warn attack recover hurt dead
    this.facing = -1;
    this.dmg = 10;
    this.baseTint = 0;
    this.lastHitSwing = -1;
    this.attackSwing = 0;
    this.attackStartAt = 0;
    this.stateUntil = 0;
    this.nextActAt = 1400;     // 登场后 1.4s 开始出招
    this.staggerAcc = 0;
    this.warnKey = null;
    this.move = null;
    this.warnZone = null;
    this.chargeVx = 0;
    this.chargeDir = 1;
    this.chargeCd = 0;
    this.roarCd = 0;
    this.flopTx = 0;
    this.flopTy = 0;
    this.landed = false;
    this.z = 0;
    this.spitCd = 0;
    this.warnStartAt = 0;
    this.spitFired = false;
    this.maneuver = 'press';   // idle 走位意图：press 压进 / flank 侧翼换道 / back 拉开诱敌
    this.maneuverUntil = 0;
    this.flankDir = 1;

    this.setOrigin(0.5, 1);
    this.body.setAllowGravity(false);
    this.body.setSize(26, 14);
    this.body.setOffset(11, 34);
    this.body.setCollideWorldBounds(true);

    this.attackBox = scene.add.zone(x, y, 40, 24);
    scene.physics.add.existing(this.attackBox);
    this.attackBox.body.setAllowGravity(false);
    this.attackBox.body.enable = false;
  }

  get phase2() { return this.hp <= this.maxHp * 0.5; }   // 狂暴期：预警更短/间隙更密

  initBelt(L) {
    this.belt = true;
    this.floor = L.floor;
    this.bounds = L.bounds;
    this.depthScale = Boss.SCALE;
    this.body.setImmovable(true);   // 大体积，不被玩家碰撞推走
    this.shadow = this.scene.add.image(this.x, this.y + 1, 'fx_shadow')
      .setDepth(L.floor.min - 1).setAlpha(0.5).setScale(2.4);
  }

  restoreTint() {
    if (!this.scene) return;
    this.clearTint();
    if (this.baseTint) this.setTint(this.baseTint);
  }

  /** 红区预警：地面高亮 + 急促提示音 */
  telegraph(kind, cx, cy, w, h) {
    this.clearWarn();
    const opt = kind === 'lane'
      ? this.scene.add.rectangle(cx, cy, w, h, 0xff3838, 0.14)
      : this.scene.add.ellipse(cx, cy, w, h, 0xff3838, 0.14);
    opt.setStrokeStyle(2, 0xff5050, 0.9).setDepth(this.floor.min + 0.2);
    this.scene.tweens.add({
      targets: opt, alpha: { from: 0.25, to: 0.85 },
      duration: 160, yoyo: true, repeat: -1,
    });
    this.warnZone = opt;
    Sfx.warn();
  }

  clearWarn() {
    if (this.warnZone) {
      this.scene.tweens.killTweensOf(this.warnZone);
      this.warnZone.destroy();
      this.warnZone = null;
    }
  }

  startMove(key, time) {
    const m = Boss.MOVES[key];
    this.state = 'attack';
    this.attackStartAt = time;
    this.stateUntil = time + m.dur;
    this.attackSwing++;
    this.dmg = m.dmg;
    this.clearWarn();
    this.play(m.anim, true);
    this.landed = false;
    this.spitFired = false;
    if (key === 'spit') this.spitCd = time + 2600;
    if (key === 'charge') {
      this.chargeDir = this.facing;
      this.chargeVx = this.chargeDir * 560;
      this.chargeCd = time + 6000;
      Sfx.swingHeavy();
    } else if (key === 'roar') {
      this.roarCd = time + 6500;
      this.scene.cameras.main.shake(300, 0.01);
      Sfx.roar();
    } else if (key === 'flop') {
      Sfx.jump();
    } else {
      Sfx.swing();
    }
  }

  pickAttack(player, time, adx, ady) {
    if (this.phase2 && time > this.roarCd && adx < 150) return 'roar';
    if (time > this.chargeCd && adx > 240) return 'charge';
    // 玩家进近战范围：概率后跳拉开吐丹，而非贴身横扫——拒绝被白嫖近身
    if (time > this.spitCd && adx < 90 && ady < 20 && Math.random() < 0.45) return 'spit';
    if (adx < 85 && ady < 18) return 'sweep';
    if (time > this.spitCd && adx < 220 && Math.random() < 0.3) return 'spit';
    return 'flop';
  }

  /** 吐丹：从口腔位置向玩家当前站位射出灵丹（可走位/翻滚闪，可被挥剑劈掉） */
  fireDart(player, yOff) {
    if (!this.scene.bossShots) return;
    const s = this.depthScale || Boss.SCALE;
    const sh = this.scene.bossShots.create(
      this.x + this.facing * 7 * s, this.y - 6, 'boss_dart');
    const d = Math.max(1, Math.hypot(player.x - sh.x, player.y + yOff - sh.y));
    sh.bvx = (player.x - sh.x) / d * 235;
    sh.bvy = (player.y + yOff - sh.y) / d * 235;
    sh.dmg = Boss.MOVES.spit.dmg;
    sh.swingTag = ++this.attackSwing;                  // 每发独立标签——滚过即极限闪避
    sh.until = this.scene.enemyTime + 2200;            // 走敌人慢时钟：断裂期冻在半空
    sh.body.setSize(12, 12);
    sh.body.setOffset(2, 2);
    this.scene.burst(sh.x, sh.y - 4, { count: 4 });
    Sfx.swing();
  }

  updateEnemy(player, time) { this.updateBoss(player, time); }

  updateBoss(player, time) {
    if (this.dead) return;
    const body = this.body;
    const ts = this.scene.enemyTimeScale || 1;
    const s = this.depthScale || Boss.SCALE;   // 判定盒/红区随体型缩放（同 Player.updateBelt 约定）
    const dx = player.x - this.x, dy = player.y - this.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const playerAlive = !player.dead && player.state !== 'win';

    switch (this.state) {
      case 'idle': {
        if (!playerAlive) { body.setVelocity(0, 0); this.play('boss-idle', true); break; }
        this.facing = dx >= 0 ? 1 : -1;
        if (time >= this.nextActAt) {
          const key = this.pickAttack(player, time, adx, ady);
          const m = Boss.MOVES[key];
          this.warnKey = key;
          this.move = m;
          this.state = 'warn';
          this.warnStartAt = time;
          this.stateUntil = time + m.warn * (this.phase2 ? 0.72 : 1);
          const B = this.bounds;
          if (m.tele === 'arc')
            this.telegraph('arc', this.x + this.facing * m.box[0] * s,
              this.y + m.box[1] * s, (m.bw + 20) * s, (m.bh + 12) * s);
          else if (m.tele === 'zone') {
            this.flopTx = player.x; this.flopTy = player.y;   // 锁定当下站位——可走位躲开
            this.telegraph('zone', this.flopTx, this.flopTy - 8,
              m.bw * s + 10, m.bh * s + 10);
          } else if (m.tele === 'lane')
            this.telegraph('lane', (B.x0 + B.x1) / 2, this.y - 8,
              B.x1 - B.x0, 20);
          else if (m.tele === 'mouth')
            this.telegraph('mouth', this.x + this.facing * 7 * s,
              this.y - 34 * s, 13 * s, 9 * s);   // 口腔蓄力红光
          else
            this.telegraph('ring', this.x, this.y - 8,
              m.bw * 1.4 * s + 12, m.bh * s + 12);
        } else {
          // 走位意图定期刷新——贴身压进/侧翼换道/拉开诱敌，像在和玩家博弈
          if (time >= this.maneuverUntil) {
            this.maneuverUntil = time + 600 + Math.random() * 450;
            const r = Math.random();
            if (adx > 140 || r < 0.45) this.maneuver = 'press';
            else if (r < 0.78) { this.maneuver = 'flank'; this.flankDir = dy >= 0 ? -1 : 1; }
            else this.maneuver = 'back';
          }
          // 玩家蓄力大招 -> 立刻错道规避
          if (player.state === 'charge' && ady < 20) {
            this.maneuver = 'flank'; this.flankDir = dy >= 0 ? -1 : 1;
          }
          if (this.maneuver === 'flank'
              && ((this.flankDir < 0 && this.y <= this.floor.min + 2)
                || (this.flankDir > 0 && this.y >= this.floor.max - 2)))
            this.flankDir = -this.flankDir;
          let vx = 0, vy = 0;
          if (this.maneuver === 'press') {          // 咬上玩家的道，为横扫/咆哮站位
            vx = adx > 52 ? Math.sign(dx) * 74 : 0;
            vy = ady > 8 ? Math.sign(dy) * 50 : 0;
          } else if (this.maneuver === 'flank') {   // 侧向换道绕位
            vy = this.flankDir * 56;
            vx = adx > 95 ? Math.sign(dx) * 52 : adx < 60 ? -Math.sign(dx) * 44 : 0;
          } else {                                // 拉开诱敌深入（常接冲撞/压顶）
            vx = adx < 150 ? -Math.sign(dx) * 62 : 0;
            vy = ady > 16 ? Math.sign(dy) * 34 : 0;
          }
          body.setVelocity(vx * ts, vy * ts);
          this.play('boss-walk', true);
        }
        break;
      }

      case 'warn': {
        if (this.warnKey === 'sweep' || this.warnKey === 'flop' || this.warnKey === 'spit')
          this.facing = dx >= 0 ? 1 : -1;
        if (this.warnKey === 'spit' && time - this.warnStartAt < 280) {
          // 吐丹预警=后跳拉开距离，顺势错开玩家的道
          body.setVelocity(
            -(dx >= 0 ? 1 : -1) * 118 * ts,
            -Math.sign(dy || this.flankDir) * 34 * ts);
        } else {
          body.setVelocity(0, 0);
        }
        // 跟身型预警区随 boss 移动；落点/车道预警固定
        if (this.warnZone) {
          if (this.move.tele === 'arc')
            this.warnZone.setPosition(
              this.x + this.facing * this.move.box[0] * s, this.y + this.move.box[1] * s);
          else if (this.move.tele === 'mouth')
            this.warnZone.setPosition(
              this.x + this.facing * 7 * s, this.y - 34 * s);
          else if (this.move.tele === 'ring')
            this.warnZone.setPosition(this.x, this.y - 8);
          else if (this.move.tele === 'lane')
            this.warnZone.setPosition(this.warnZone.x, this.y - 8);
        }
        if (time >= this.stateUntil) this.startMove(this.warnKey, time);
        break;
      }

      case 'attack': {
        const m = this.move;
        const el = time - this.attackStartAt;
        switch (this.warnKey) {
          case 'sweep': {
            body.setVelocity(0, 0);
            const active = el >= m.f && el <= m.u;
            this.attackBox.body.enable = active;
            if (active) {
              this.attackBox.body.setSize(m.bw * s, m.bh * s);
              this.attackBox.setPosition(
                this.x + this.facing * m.box[0] * s, this.y + m.box[1] * s);
            }
            break;
          }
          case 'flop': {
            const p = Phaser.Math.Clamp(el / m.dur, 0, 1);
            this.z = Math.sin(p * Math.PI) * 52;
            body.setVelocity((this.flopTx - this.x) * 6 * ts,
              (this.flopTy - this.y) * 6 * ts);        // 空中追踪落点
            if (p >= 0.78 && !this.landed) {
              this.landed = true;
              this.z = 0;
              body.setVelocity(0, 0);
              this.setPosition(this.flopTx, this.flopTy);
              this.scene.cameras.main.shake(200, 0.012);
              this.scene.burst(this.flopTx, this.flopTy, { count: 12, dust: true });
              const w = this.scene.add.sprite(this.flopTx, this.flopTy + 2, 'fx_wave')
                .setDepth(this.flopTy + 0.05).setScale(1.6).play('fx-wave');
              w.once('animationcomplete', () => w.destroy());
              Sfx.hitHeavy();
            }
            // 落地后 f~u 判定窗（f/u 已对齐落地时刻，之前 u<落地点导致全程空判定）
            if (this.landed) {
              const active = el >= m.f && el <= m.u;
              this.attackBox.body.enable = active;
              if (active) {
                this.attackBox.body.setSize(m.bw * s, m.bh * s);
                this.attackBox.setPosition(this.flopTx, this.flopTy - 8);
              }
            }
            break;
          }
          case 'charge': {
            body.setVelocity(this.chargeVx * ts, 0);
            this.attackBox.body.enable = true;
            this.attackBox.body.setSize(m.bw * s, m.bh * s);
            this.attackBox.setPosition(
              this.x + this.chargeDir * m.box[0] * s, this.y + m.box[1] * s);
            const atEdge = this.chargeDir > 0
              ? this.x >= this.bounds.x1 - 30 : this.x <= this.bounds.x0 + 30;
            if (atEdge) {                               // 撞墙收招
              this.stateUntil = 0;
              this.scene.cameras.main.shake(160, 0.01);
              this.scene.burst(this.x + this.chargeDir * 10, this.y - 10,
                { count: 10, dust: true });
              Sfx.hitHeavy();
            }
            break;
          }
          case 'roar': {
            body.setVelocity(0, 0);
            const active = el >= m.f && el <= m.u;
            this.attackBox.body.enable = active;
            if (active) {
              this.attackBox.body.setSize(m.bw * (1 + el / m.u * 0.4) * s, m.bh * s);
              this.attackBox.setPosition(this.x, this.y + m.box[1] * s);
            }
            break;
          }
          case 'spit': {
            body.setVelocity(0, 0);
            if (!this.spitFired && el >= m.f) {
              this.spitFired = true;
              const offs = this.phase2 ? [-18, 0, 18] : [0];   // 狂暴期三连吐封道
              for (const o of offs) this.fireDart(player, o);
            }
            break;
          }
        }
        if (time >= this.stateUntil) {
          this.attackBox.body.enable = false;
          this.z = 0;
          this.state = 'recover';
          this.stateUntil = time + (this.phase2 ? 380 : 620);
          this.nextActAt = time + (this.phase2 ? 550 : 900) + Math.random() * 400;
          this.play('boss-idle', true);
        }
        break;
      }

      case 'recover':
        // 收招期缓步贴向玩家（保留输出窗口，但不站桩）
        body.setVelocity(Math.sign(dx) * 16 * ts, Math.sign(dy) * 12 * ts);
        if (time >= this.stateUntil) this.state = 'idle';
        break;

      case 'hurt':
        body.setVelocity(0, 0);
        if (time >= this.hurtUntil) this.state = 'idle';
        break;
    }

    // 弹体推进：慢时钟同步减速（断裂期冻在空中）+ 深度缩放/排序 + 出界/寿命回收
    if (this.scene.bossShots) {
      this.scene.bossShots.children.iterate(sh => {
        if (!sh || !sh.active) return;
        sh.body.setVelocity(sh.bvx * ts, sh.bvy * ts);
        const tt = Phaser.Math.Clamp(
          (sh.y - this.floor.min) / (this.floor.max - this.floor.min), 0, 1);
        sh.setScale(0.6 + 0.35 * tt).setDepth(sh.y - 0.1);
        if (time > sh.until || sh.x < this.bounds.x0 - 24 || sh.x > this.bounds.x1 + 24
            || sh.y < this.floor.min - 16 || sh.y > this.floor.max + 16)
          sh.destroy();
      });
    }

    // 钳进战场 + 深度排序（体型 = 深度缩放 × 2.15）
    this.x = Phaser.Math.Clamp(this.x, this.bounds.x0, this.bounds.x1);
    this.y = Phaser.Math.Clamp(this.y, this.floor.min, this.floor.max);
    this.setFlipX(this.facing > 0);
    const t = Phaser.Math.Clamp(
      (this.y - this.floor.min) / (this.floor.max - this.floor.min), 0, 1);
    this.depthScale = (0.78 + 0.4 * t) * Boss.SCALE;
    if (this.state !== 'hurt') this.setScale(this.depthScale);
    this.setDepth(this.y);
    this.setDisplayOrigin(24, 48 + this.z);
    if (this.shadow) {
      this.shadow.setPosition(this.x, this.y + 1);
      this.shadow.setDepth(this.y - 0.5);
      this.shadow.setScale(2.4 * (0.9 + 0.5 * t));
    }
  }

  takeDamage(dmg, fromX, swingId, launchVy) {
    if (this.dead || swingId === this.lastHitSwing) return false;
    this.lastHitSwing = swingId;
    this.hp -= dmg;
    this.scene.registry.set('bossHp', Math.max(0, this.hp));
    if (this.hp <= 0) { this.die(); return true; }

    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.restoreTint());
    // 削韧：累计 STAGGER 伤害 -> 打断当前出招，进入硬直
    this.staggerAcc += dmg;
    if (this.staggerAcc >= Boss.STAGGER) {
      this.staggerAcc = 0;
      const t = this.scene.enemyTime ?? this.scene.time.now;
      this.state = 'hurt';
      this.hurtUntil = t + 700;
      this.attackBox.body.enable = false;
      this.clearWarn();
      this.play('boss-hurt', true);
      this.scene.cameras.main.shake(120, 0.006);
    }
    return true;
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.attackBox.body.enable = false;
    this.clearWarn();
    if (this.scene.bossShots) this.scene.bossShots.clear(true, true);   // 死亡清弹
    this.setScale(this.depthScale || Boss.SCALE);
    this.setDisplayOrigin(24, 48);
    this.play('boss-death', true);
    Sfx.enemyDie();
    if (this.scene.burst) {
      this.scene.burst(this.x, this.y - 10, { count: 20 });
      this.scene.burst(this.x, this.y - 10, { count: 12, blue: true });
    }
    this.once('animationcomplete', () => {
      this.scene.time.delayedCall(1400, () => {
        this.scene.tweens.add({
          targets: this.shadow ? [this, this.shadow] : this,
          alpha: 0, duration: 500,
          onComplete: () => {
            if (this.attackOverlap)
              this.scene.physics.world.removeCollider(this.attackOverlap);
            this.attackBox.destroy();
            this.destroy();
            if (this.shadow) this.shadow.destroy();
          },
        });
      });
    });
    // 灵兽消散 -> 爆三粒仙丹
    if (this.scene.pills) {
      for (let i = -1; i <= 1; i++) {
        const p = this.scene.pills.create(this.x + i * 20, this.y - 8, 'item_pill');
        p.body.setAllowGravity(false);
        p.setDepth(this.y - 0.6);
      }
    }
  }
}
