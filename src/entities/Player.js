// 秦始皇：移动/跳跃(土狼时间+缓冲+可变跳高)/翻滚无敌帧/三连击/蓄力斩/升龙/下砸/冲刺斩/龙威
class Player extends Phaser.Physics.Arcade.Sprite {
  static SPEED = 150;
  static JUMP = -500;
  static ROLL_SPEED = 275;
  static MAX_HP = 100;
  static CHARGE_MS = 430;      // 按住 J 多久进入蓄力
  static ROAR_COST = 100;      // 龙威消耗

  // 招式表：f/u=命中窗口, dur=总时长, lunge=突进, box=[dx,dy]判定盒偏移, zone=用哪个判定盒
  // bw/bh = belt 模式脚部判定盒宽高（纵深宽=能扫到几条道）
  static MOVES = {
    atk1:     { anim: 'qin-atk1',      dmg: 10, f: 110, u: 220, dur: 340, lunge: 90,  box: [21, -2],  zone: 'hitbox', bw: 30, bh: 14 },
    atk2:     { anim: 'qin-atk2',      dmg: 10, f: 100, u: 210, dur: 330, lunge: 90,  box: [21, -2],  zone: 'hitbox', bw: 30, bh: 14 },
    atk3:     { anim: 'qin-atk3',      dmg: 22, f: 160, u: 300, dur: 460, lunge: 140, box: [22, -2],  zone: 'hitbox', bw: 38, bh: 18, heavy: true },
    charge:   { anim: 'qin-chargehit', dmg: 32, f: 60,  u: 260, dur: 430, lunge: 170, box: [26, -2],  zone: 'bigbox', bw: 54, bh: 22, heavy: true },
    launcher: { anim: 'qin-launcher',  dmg: 12, f: 130, u: 290, dur: 430, lunge: 20,  box: [8, -26],  zone: 'hitbox', bw: 30, bh: 14, launch: -400 },
    riser:    { anim: 'qin-riser',     dmg: 14, f: 90,  u: 260, dur: 400, lunge: 40,  box: [8, -26],  zone: 'hitbox', bw: 30, bh: 14, launch: -430, vy: -370 },
    dashatk:  { anim: 'qin-dashatk',   dmg: 16, f: 90,  u: 240, dur: 330, lunge: 380, box: [26, -2],  zone: 'bigbox', bw: 50, bh: 18 },
    slam:     { anim: 'qin-slamhit',   dmg: 18, f: 0,   u: 220, dur: 380, lunge: 0,   box: [0, 14],   zone: 'bigbox', bw: 86, bh: 44, heavy: true },
    roar:     { anim: 'qin-roar',      dmg: 20, f: 280, u: 460, dur: 660, lunge: 0,   box: [0, -6],   zone: 'roarbox', bw: 210, bh: 60, heavy: true },
    rift:     { anim: 'qin-dashatk',   dmg: 36, f: 60,  u: 230, dur: 350, lunge: 330, box: [30, -2],  zone: 'bigbox', bw: 74, bh: 30, heavy: true },
  };
  // 剑光弧表现类型 -> [scaleX, scaleY, angle]
  static ARC = {
    atk1: {}, atk2: { flipY: true },
    atk3: { scale: 1.45, ang: 30 }, charge: { scale: 1.7, ang: 0 },
    dashatk: { scaleX: 1.45, scaleY: 0.65, ang: 8 },
    launcher: { ang: -95 }, riser: { ang: -95 },
    rift: { scaleX: 2.0, scaleY: 1.15, ang: 0 },
  };

  constructor(scene, x, y) {
    super(scene, x, y, 'qin_idle', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(16, 33);
    this.body.setOffset(16, 11);
    this.body.setCollideWorldBounds(true);
    this.setOrigin(0.5);

    this.hp = Player.MAX_HP;
    this.maxHp = Player.MAX_HP;
    this.meter = 0;              // 龙威槽 0~100
    this.dead = false;
    this.state = 'idle';         // idle run air attack charge slam roll hurt win dead
    this.facing = 1;
    this.comboStage = -1;
    this.move = null;            // 当前招式对象
    this.moveKey = null;
    this.swingId = 0;
    this.lastDodgeSwing = -1;    // 极限闪避已消费过的敌方攻击 swing 号
    this.currentDamage = 0;
    this.attackStartAt = 0;
    this.comboOpenAt = 0;
    this.queuedAttack = false;
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.jumpCutDone = true;
    this.invulnUntil = 0;
    this.rollUntil = 0;
    this.rollCdUntil = 0;
    this.hurtUntil = 0;
    this.lastSafe = { x, y };
    this.safeAt = 0;
    this.nextGhost = 0;
    this.wasGround = true;
    this.peakVy = 0;
    this.airRisen = false;       // 本段滞空是否已用升龙
    this.atkDownAt = 0;          // J 按下时刻（蓄力判定）
    this.aura = null;
    this.ringSpawned = false;

    // 三种判定盒：标准剑击 / 大招宽幅 / 龙威全场
    const mkZone = (w, h) => {
      const z = scene.add.zone(x, y, w, h);
      scene.physics.add.existing(z);
      z.body.setAllowGravity(false);
      z.body.enable = false;
      return z;
    };
    this.zones = {
      hitbox: mkZone(34, 26),
      bigbox: mkZone(50, 34),
      roarbox: mkZone(230, 80),
    };

    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = scene.input.keyboard;
    this.kLeft = [kb.addKey(K.LEFT), kb.addKey(K.A)];
    this.kRight = [kb.addKey(K.RIGHT), kb.addKey(K.D)];
    this.kDown = [kb.addKey(K.DOWN), kb.addKey(K.S)];
    this.kUp = [kb.addKey(K.UP), kb.addKey(K.W), kb.addKey(K.SPACE)];
    this.kDepthUp = [kb.addKey(K.UP), kb.addKey(K.W)];   // belt: 纯纵深上移
    this.kHop = [kb.addKey(K.SPACE)];                   // belt: 跳劈
    this.kAtk = [kb.addKey(K.J), kb.addKey(K.Z)];
    this.kRoll = [kb.addKey(K.K), kb.addKey(K.SHIFT)];
    this.kRoar = [kb.addKey(K.U), kb.addKey(K.L)];
    this.kRestart = kb.addKey(K.R);

    // 事件驱动输入缓冲：即使按键短于一帧也不丢
    this.bufJumpUntil = 0;
    this.bufAtkUntil = 0;
    this.bufRollUntil = 0;
    this.bufRoarUntil = 0;
    this.bufHopUntil = 0;
    this.bufRestartUntil = 0;
    this.kRestart.on('down', () => { this.bufRestartUntil = scene.time.now + 400; });
    const buf = (keys, prop, ms) =>
      keys.forEach(k => k.on('down', () => { this[prop] = scene.time.now + ms; }));
    buf(this.kUp, 'bufJumpUntil', 130);
    buf(this.kAtk, 'bufAtkUntil', 150);
    buf(this.kRoll, 'bufRollUntil', 150);
    buf(this.kRoar, 'bufRoarUntil', 200);
    buf(this.kHop, 'bufHopUntil', 130);
    this.kAtk.forEach(k => {
      k.on('down', () => { this.atkDownAt = scene.time.now; });
      k.on('up', () => { if (this.state === 'charge') this.releaseCharge(); });
    });
  }

  get hitActive() {
    if (this.state !== 'attack' || !this.move) return false;
    const t = this.scene.time.now;
    return t >= this.attackStartAt + this.move.f && t <= this.attackStartAt + this.move.u;
  }

  down(list) { return list.some(k => k.isDown); }

  gainMeter(v) {
    this.meter = Math.min(100, this.meter + v);
    this.scene.registry.set('playerMeter', this.meter);
  }

  clearAura() {
    if (this.aura) { this.aura.destroy(); this.aura = null; }
  }

  /** 清版过关模式初始化：脚为原点/无重力/薄片判定盒/脚影 */
  initBelt(L) {
    this.belt = true;
    this.floor = L.floor;
    this.bounds = L.bounds;
    this.setOrigin(0.5, 1);
    this.body.setAllowGravity(false);
    this.body.setSize(20, 10);          // 脚下薄片碰撞盒 = 走道判定
    this.body.setOffset(14, 38);
    this.body.setCollideWorldBounds(true);
    // 判定盒尺寸随招式动态设置（见 updateBelt 判定盒管理）
    this.z = 0;                          // 跳劈离地高度（纯视觉）
    this.hopAtk = false;
    this.shadow = this.scene.add.image(this.x, this.y + 1, 'fx_shadow')
      .setDepth(this.floor.min - 1).setAlpha(0.5);
    this.rollVx = 0; this.rollVy = 0;
  }

  destroySelf() { if (this.shadow) this.shadow.destroy(); }

  /** 深度 -> 缩放/排序/脚影 同步 */
  syncDepth() {
    const t = Phaser.Math.Clamp(
      (this.y - this.floor.min) / (this.floor.max - this.floor.min), 0, 1);
    const s = 0.78 + 0.4 * t;
    this.setScale(s);
    this.setDepth(this.y);
    if (this.shadow) {
      this.shadow.setPosition(this.x, this.y + 1);
      this.shadow.setDepth(this.y - 0.5);
      this.shadow.setScale(0.9 + 0.5 * t);
    }
  }

  updateBelt(time) {
    const body = this.body;
    const left = this.down(this.kLeft);
    const right = this.down(this.kRight);
    const up = this.down(this.kDepthUp);
    const dn = this.down(this.kDown);
    const isLocked = () => this.state === 'attack' || this.state === 'roll'
      || this.state === 'hurt' || this.state === 'win'
      || this.state === 'charge' || this.state === 'hop';

    // ---- 攻击 ----
    if (this.bufAtkUntil > time) {
      this.bufAtkUntil = 0;
      if (this.state === 'roll') this.startMove('dashatk', time);
      else if (this.state === 'hop') this.hopAtk = true;
      else if (!isLocked()) {
        if (this.scene.fractureUntil > time) this.startMove('rift', time);  // 断裂中=裂空斩
        else this.startAttack(time);
      }
      else if (this.state === 'attack' && time >= this.comboOpenAt) {
        this.queuedAttack = true;
      }
    }
    // ---- 龙威 ----
    if (this.bufRoarUntil > time) {
      this.bufRoarUntil = 0;
      if (!isLocked() && this.meter >= Player.ROAR_COST) {
        this.meter = 0;
        this.scene.registry.set('playerMeter', 0);
        this.startMove('roar', time);
      }
    }
    // ---- 蓄力 ----
    if ((this.state === 'idle' || this.state === 'walk')
        && this.kAtk.some(k => k.isDown)
        && this.atkDownAt && time - this.atkDownAt > Player.CHARGE_MS) {
      this.state = 'charge';
      this.play('qin-charge', true);
      Sfx.charge();
      this.aura = this.scene.add.sprite(this.x, this.y - 22, 'fx_aura')
        .setDepth(9999).play('fx-aura');
    }
    // ---- 跳劈 ----
    if (this.bufHopUntil > time) {
      this.bufHopUntil = 0;
      if (!isLocked() || this.state === 'charge') {
        this.clearAura();
        this.state = 'hop';
        this.hopUntil = time + 420;
        this.hopAtk = false;
        this.hopVx = (right ? 1 : left ? -1 : this.facing) * 130;
        this.hopVy = (dn ? 1 : up ? -1 : 0) * 60;
        this.play('qin-jump', true);
        Sfx.jump();
      }
    }
    // ---- 翻滚（八向）----
    if (this.bufRollUntil > time) {
      this.bufRollUntil = 0;
      if ((this.state === 'charge' || !isLocked()) && time > this.rollCdUntil) {
        this.clearAura();
        this.state = 'roll';
        this.rollUntil = time + 360;
        this.rollCdUntil = time + 750;
        this.invulnUntil = Math.max(this.invulnUntil, this.rollUntil);
        let rx = (right ? 1 : 0) - (left ? 1 : 0);
        let ry = (dn ? 1 : 0) - (up ? 1 : 0);
        if (!rx && !ry) rx = this.facing;
        if (rx) this.facing = rx;
        const len = Math.hypot(rx, ry) || 1;
        this.rollVx = rx / len * Player.ROLL_SPEED;
        this.rollVy = ry / len * Player.ROLL_SPEED * 0.6;
        this.play('qin-roll', true);
        Sfx.roll();
      }
    }

    // ---- 状态机 ----
    switch (this.state) {
      case 'charge':
        body.setVelocity(0, 0);
        if (this.aura)
          this.aura.setPosition(this.x, this.y - 22)
            .setDepth(this.y + 0.2).setScale(Math.abs(this.scaleX));
        break;

      case 'hop': {
        const p = 1 - (this.hopUntil - time) / 420;   // 0->1
        this.z = Math.sin(Phaser.Math.Clamp(p, 0, 1) * Math.PI) * 16;
        body.setVelocity(this.hopVx, this.hopVy);
        if (time >= this.hopUntil) {
          this.z = 0;
          if (this.hopAtk) this.slamImpact(time);      // 落点范围震击
          else this.state = 'idle';
        }
        break;
      }

      case 'roll':
        body.setVelocity(this.rollVx, this.rollVy);
        if (time >= this.rollUntil) this.state = 'idle';
        break;

      case 'hurt':
        if (time >= this.hurtUntil) this.state = 'idle';
        break;

      case 'attack': {
        body.setVelocityX(Phaser.Math.Linear(body.velocity.x, 0, 0.22));
        body.setVelocityY(0);
        // 起手吸附：出招前微调向最近敌人那条道（清版手感）
        if (time < this.attackStartAt + this.move.f + 60) {
          const en = this.scene.enemies.children.entries
            .filter(e => !e.dead
              && Math.abs(e.x - this.x) < 80
              && Math.abs(e.y - this.y) < 40
              && Math.sign(e.x - this.x) === this.facing)
            .sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x))[0];
          if (en) this.y += Phaser.Math.Clamp(en.y - this.y, -1.6, 1.6);
        }
        // 冲刺斩可按 W/S 斜切走道
        if (this.moveKey === 'dashatk')
          body.setVelocityY(((dn ? 1 : 0) - (up ? 1 : 0)) * 90);
        if (time >= this.attackStartAt + this.move.dur) {
          if (this.queuedAttack
              && (this.moveKey === 'atk1' || this.moveKey === 'atk2')) {
            this.comboStage++;
            this.startMove(this.comboStage === 1 ? 'atk2' : 'atk3', time);
          } else {
            this.comboStage = -1;
            this.move = null;
            this.state = 'idle';
          }
        }
        break;
      }

      case 'win':
        body.setVelocity(0, 0);
        break;

      default: { // idle / walk
        const vx = (right ? 1 : 0) - (left ? 1 : 0);
        const vy = (dn ? 1 : 0) - (up ? 1 : 0);
        const len = (vx && vy) ? 0.78 : 1;             // 斜向降速
        body.setVelocityX(vx * Player.SPEED * len);
        body.setVelocityY(vy * Player.SPEED * 0.66 * len);
        if (vx) this.facing = vx;
        this.state = (vx || vy) ? 'walk' : 'idle';
      }
    }

    // ---- 深度范围钳制 ----
    this.x = Phaser.Math.Clamp(this.x, this.bounds.x0, this.bounds.x1);
    this.y = Phaser.Math.Clamp(this.y, this.floor.min, this.floor.max);

    // ---- 动画 ----
    if (this.state !== 'attack' && this.state !== 'roll'
        && this.state !== 'hurt' && this.state !== 'charge' && this.state !== 'hop') {
      this.play(this.state === 'walk' ? 'qin-run' : 'qin-idle', true);
    }
    this.setFlipX(this.facing < 0);
    this.setDisplayOrigin(24, 48 + this.z);            // 跳劈视觉抬升

    // 动作残影
    if ((this.state === 'attack' || this.state === 'roll' || this.state === 'hop')
        && time >= this.nextGhost) {
      this.nextGhost = time + 55;
      const g = this.scene.add.sprite(this.x, this.y,
        this.texture.key, this.frame.name)
        .setOrigin(0.5, 1).setDepth(this.y - 1)
        .setAlpha(0.32).setFlipX(this.flipX).setScale(this.scaleX);
      g.setTint(this.scene.fractureUntil > time ? 0x8fb8ff : 0xd4a024);
      this.scene.tweens.add({
        targets: g, alpha: 0, duration: 220,
        onComplete: () => g.destroy(),
      });
    }

    // 受击无敌闪烁
    this.setAlpha(time < this.invulnUntil && !this.dead
      ? (Math.floor(time / 70) % 2 ? 0.35 : 0.9) : 1);

    // ---- 判定盒（脚部平面，宽高随招式纵深范围变化）----
    for (const z of Object.values(this.zones)) z.body.enable = false;
    if (this.hitActive) {
      const z = this.zones[this.move.zone];
      const s = Math.abs(this.scaleX);            // 判定盒随深度同步缩放
      z.body.setSize(this.move.bw * s, this.move.bh * s);
      z.body.enable = true;
      const [dx, dyRaw] = this.move.box;
      const dy = dyRaw > 0 ? -2 : dyRaw;   // belt 以脚为原点，正下偏移压回脚面
      z.setPosition(this.x + this.facing * dx * s, this.y + dy * s);
      if (this.moveKey === 'roar' && !this.ringSpawned) {
        this.ringSpawned = true;
        const r = this.scene.add.sprite(this.x, this.y - 22, 'fx_ring')
          .setDepth(this.y + 0.4).setScale(Math.abs(this.scaleX))
          .play('fx-ring');
        r.once('animationcomplete', () => r.destroy());
      }
    }
    this.syncDepth();
  }

  update(time, delta) {
    if (this.dead) return;   // R 重开由 GameScene 统一处理
    if (this.belt) { this.updateBelt(time); return; }
    const body = this.body;
    const onGround = body.blocked.down;
    const left = this.down(this.kLeft);
    const right = this.down(this.kRight);

    if (onGround) {
      this.coyoteUntil = time + 110;
      this.airRisen = false;
      if (time > this.safeAt) {           // 每0.5s记录安全落点（坠坑回位用）
        this.lastSafe = { x: this.x, y: this.y };
        this.safeAt = time + 500;
      }
    }

    const isLocked = () => this.state === 'attack' || this.state === 'roll'
      || this.state === 'hurt' || this.state === 'win'
      || this.state === 'charge' || this.state === 'slam';

    // ---- 跳跃/升龙 输入 ----
    if (this.bufJumpUntil > time) {
      this.bufJumpUntil = 0;
      if (this.state === 'air' && time >= this.coyoteUntil
          && !this.airRisen && body.velocity.y < 60) {
        this.airRisen = true;
        this.startMove('riser', time);   // 空中↑ = 升龙斩
      } else {
        this.jumpBufferUntil = time + 130;
      }
    }

    // ---- 攻击输入 ----
    if (this.bufAtkUntil > time) {
      this.bufAtkUntil = 0;
      if (this.state === 'roll') {
        this.startMove('dashatk', time);            // 翻滚取消->冲刺斩
      } else if (!isLocked()) {
        if (this.scene.fractureUntil > time) this.startMove('rift', time);  // 断裂中=裂空斩（优先于空中下砸）
        else if (this.state === 'air' && this.down(this.kDown)) this.startSlam(time);
        else this.startAttack(time);
      } else if (this.state === 'attack' && time >= this.comboOpenAt) {
        this.queuedAttack = true;
      }
    }

    // ---- 龙威 ----
    if (this.bufRoarUntil > time) {
      this.bufRoarUntil = 0;
      if (!isLocked() && this.meter >= Player.ROAR_COST) {
        this.meter = 0;
        this.scene.registry.set('playerMeter', 0);
        this.startMove('roar', time);
      }
    }

    // ---- 蓄力进入判定：J按住不放且在地 ----
    if ((this.state === 'idle' || this.state === 'run') && onGround
        && this.kAtk.some(k => k.isDown)
        && this.atkDownAt && time - this.atkDownAt > Player.CHARGE_MS) {
      this.state = 'charge';
      this.play('qin-charge', true);
      Sfx.charge();
      this.aura = this.scene.add.sprite(this.x, this.y, 'fx_aura')
        .setDepth(11).play('fx-aura');
    }

    // ---- 翻滚 ----
    if (this.bufRollUntil > time) {
      this.bufRollUntil = 0;
      if ((this.state === 'charge' || !isLocked()) && time > this.rollCdUntil) {
        this.clearAura();
        this.state = 'roll';
        this.rollUntil = time + 360;
        this.rollCdUntil = time + 750;
        this.invulnUntil = Math.max(this.invulnUntil, this.rollUntil);
        if (left) this.facing = -1; else if (right) this.facing = 1;
        this.play('qin-roll', true);
        Sfx.roll();
      }
    }

    // ---- 状态机 ----
    switch (this.state) {
      case 'charge':
        body.setVelocityX(Phaser.Math.Linear(body.velocity.x, 0, 0.2));
        if (this.aura) this.aura.setPosition(this.x, this.y);
        if (this.jumpBufferUntil > time && onGround) {   // 跳跃取消蓄力
          this.clearAura();
          body.setVelocityY(Player.JUMP);
          this.jumpBufferUntil = 0; this.jumpCutDone = false;
          this.state = 'air'; Sfx.jump();
        }
        break;

      case 'slam':
        body.setVelocityX(0);
        body.setVelocityY(680);
        if (onGround) this.slamImpact(time);
        break;

      case 'roll':
        body.setVelocityX(this.facing * Player.ROLL_SPEED);
        if (time >= this.rollUntil) this.state = onGround ? 'idle' : 'air';
        break;

      case 'hurt':
        if (time >= this.hurtUntil) this.state = onGround ? 'idle' : 'air';
        break;

      case 'attack': {
        body.setVelocityX(Phaser.Math.Linear(body.velocity.x, 0, 0.22));
        if (time >= this.attackStartAt + this.move.dur) {
          if (this.queuedAttack
              && (this.moveKey === 'atk1' || this.moveKey === 'atk2')) {
            this.comboStage++;
            this.startMove(this.comboStage === 1 ? 'atk2' : 'atk3', time);
          } else {
            this.comboStage = -1;
            this.move = null;
            this.state = onGround ? 'idle' : 'air';
          }
        }
        break;
      }

      case 'win':
        body.setVelocityX(0);
        break;

      default: { // idle / run / air
        if (left)  { body.setVelocityX(-Player.SPEED); this.facing = -1; }
        else if (right) { body.setVelocityX(Player.SPEED); this.facing = 1; }
        else body.setVelocityX(0);

        if (this.jumpBufferUntil > time && time < this.coyoteUntil) {
          body.setVelocityY(Player.JUMP);
          this.jumpBufferUntil = 0;
          this.coyoteUntil = 0;
          this.jumpCutDone = false;
          Sfx.jump();
        }
        if (!this.jumpCutDone && !this.down(this.kUp) && body.velocity.y < -170) {
          body.setVelocityY(-170);
          this.jumpCutDone = true;
        }
        if (onGround) this.state = Math.abs(body.velocity.x) > 10 ? 'run' : 'idle';
        else this.state = 'air';
      }
    }

    // ---- 动画 ----
    if (this.state !== 'attack' && this.state !== 'roll'
        && this.state !== 'hurt' && this.state !== 'charge' && this.state !== 'slam') {
      if (this.state === 'air') this.play('qin-jump', true);
      else if (this.state === 'run') this.play('qin-run', true);
      else this.play('qin-idle', true);
    }
    this.setFlipX(this.facing < 0);

    // 落地尘 + 记录滞空峰值速度
    if (!onGround) this.peakVy = Math.max(this.peakVy, body.velocity.y);
    if (!this.wasGround && onGround) {
      if (this.peakVy > 320) {
        Sfx.land();
        if (this.scene.burst) this.scene.burst(this.x, this.y + 20,
          { count: 5, dust: true });
      }
      this.peakVy = 0;
    }
    this.wasGround = onGround;

    // 动作残影
    if ((this.state === 'attack' || this.state === 'roll' || this.state === 'slam')
        && time >= this.nextGhost) {
      this.nextGhost = time + 55;
      const g = this.scene.add.sprite(this.x, this.y,
        this.texture.key, this.frame.name)
        .setDepth(8).setAlpha(0.32).setFlipX(this.flipX);
      g.setTint(this.scene.fractureUntil > time ? 0x8fb8ff : 0xd4a024);
      this.scene.tweens.add({
        targets: g, alpha: 0, duration: 220,
        onComplete: () => g.destroy(),
      });
    }

    // 受击无敌闪烁
    this.setAlpha(time < this.invulnUntil && !this.dead
      ? (Math.floor(time / 70) % 2 ? 0.35 : 0.9) : 1);

    // ---- 判定盒管理 ----
    for (const z of Object.values(this.zones)) z.body.enable = false;
    if (this.hitActive) {
      const z = this.zones[this.move.zone];
      z.body.enable = true;
      const [dx, dy] = this.move.box;
      z.setPosition(this.x + this.facing * dx, this.y + dy);
      if (this.moveKey === 'roar' && !this.ringSpawned) {
        this.ringSpawned = true;
        const r = this.scene.add.sprite(this.x, this.y - 6, 'fx_ring')
          .setDepth(28).play('fx-ring');
        r.once('animationcomplete', () => r.destroy());
      }
    }
  }

  /** 极限闪避：翻滚中被敌击判定扫到 -> 触发时空断裂。返回 true 表示该击已被闪掉 */
  tryDodge(swingTag) {
    if (swingTag === this.lastDodgeSwing) return true;   // 同一击已闪掉 -> 永久免疫（防闪后接裂空斩被同招尾巴补刀）
    if (this.dead || this.state !== 'roll') return false;
    this.lastDodgeSwing = swingTag;
    this.scene.onPerfectDodge();
    return true;
  }

  startAttack(time) {
    this.comboStage = 0;
    this.startMove('atk1', time);
  }

  startMove(key, time) {
    const m = Player.MOVES[key];
    this.move = m;
    this.moveKey = key;
    this.attackStartAt = time;
    this.comboOpenAt = time + m.dur * 0.45;
    this.queuedAttack = false;
    this.swingId++;
    this.currentDamage = m.dmg;
    this.ringSpawned = false;
    this.state = 'attack';
    this.body.setVelocityX(this.facing * m.lunge);
    if (m.vy) this.body.setVelocityY(m.vy);
    this.play(m.anim, true);
    if (key === 'roar') Sfx.roar();
    else if (m.heavy) Sfx.swingHeavy();
    else Sfx.swing();

    const a = Player.ARC[key];
    const ds = this.belt ? Math.abs(this.scaleX) : 1;    // belt: 随深度缩放
    if (a) {
      const arc = this.scene.add.sprite(
        this.x + this.facing * (a.ang === -95 ? 8 : 20),
        this.y + (this.belt ? -24 * ds : (a.ang === -95 ? -14 : 2)), 'fx_slash')
        .setDepth(this.belt ? this.y + 0.1 : 25)
        .setFlipX(this.facing < 0).play('fx-slash');
      let ax = ds, ay = ds;                             // 深度缩放与招式缩放乘算
      if (a.scale) { ax *= a.scale; ay *= a.scale; }
      if (a.scaleX) { ax *= a.scaleX; ay *= a.scaleY; }
      arc.setScale(ax, ay);
      if (a.flipY) arc.setFlipY(true);
      if (a.ang) arc.setAngle(this.facing * a.ang);
      arc.once('animationcomplete', () => arc.destroy());
    }

    if (key === 'rift') {   // 裂空斩：出手即解除时空断裂（时停结算斩）
      this.scene.endFracture();
      this.scene.cameras.main.shake(130, 0.008);
      const r2 = this.scene.add.sprite(
        this.x - this.facing * 8, this.y + (this.belt ? -20 : -4), 'fx_slash')
        .setDepth(this.belt ? this.y + 0.15 : 25)
        .setFlipX(this.facing < 0).setFlipY(true)
        .setScale(ds * 1.4).setTint(0x9fd0ff).play('fx-slash');
      r2.once('animationcomplete', () => r2.destroy());
    }
  }

  startSlam(time) {
    this.state = 'slam';
    this.play('qin-slam', true);
    this.body.setVelocity(0, 680);
    Sfx.swingHeavy();
  }

  slamImpact(time) {
    this.move = Player.MOVES.slam;
    this.moveKey = 'slam';
    this.attackStartAt = time;
    this.comboOpenAt = time + 200;
    this.swingId++;
    this.currentDamage = this.move.dmg;
    this.state = 'attack';
    this.play('qin-slamhit', true);
    const wy = this.belt ? this.y + 2 : this.y + 14;
    const w = this.scene.add.sprite(this.x, wy, 'fx_wave')
      .setDepth(this.belt ? this.y + 0.05 : 26)
      .setScale(this.belt ? Math.abs(this.scaleX) : 1)
      .play('fx-wave');
    w.once('animationcomplete', () => w.destroy());
    if (this.scene.burst) this.scene.burst(this.x, wy + 2, { count: 10, dust: true });
    this.scene.cameras.main.shake(160, 0.01);
    Sfx.hitHeavy();
  }

  releaseCharge() {
    this.clearAura();
    this.startMove('charge', this.scene.time.now);
  }

  takeDamage(dmg, fromX, swingTag) {
    const t = this.scene.time.now;
    if (this.dead || t < this.invulnUntil || this.state === 'win') return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.scene.registry.set('playerHp', this.hp);
    this.comboStage = -1;
    this.move = null;
    this.queuedAttack = false;
    this.clearAura();

    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => this.clearTint());
    this.scene.cameras.main.shake(120, 0.006);
    Sfx.hurt();
    if (this.scene.hitstop) this.scene.hitstop(60);

    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.state = 'hurt';
    this.hurtUntil = t + 320;
    this.invulnUntil = t + 1000;
    if (this.belt) {
      this.z = 0;
      this.body.setVelocityY((Math.random() - 0.5) * 70);
    } else {
      this.body.setVelocityY(-160);
    }
    this.body.setVelocityX((this.x < fromX ? -1 : 1) * 170);
    this.play('qin-hurt', true);
    return true;
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.clearAura();
    this.z = 0;
    this.body.setVelocity(0, 0);
    this.zones.hitbox.body.enable = false;
    this.zones.bigbox.body.enable = false;
    this.zones.roarbox.body.enable = false;
    this.play('qin-death', true);
    this.scene.registry.set('msg', '陛下殒落了…  R 再战 · Q 选关');
    this.scene.cameras.main.shake(300, 0.012);
    Sfx.die();
  }

  fellInPit() {
    if (this.dead) return;
    this.clearAura();
    this.hp = Math.max(0, this.hp - 25);
    this.scene.registry.set('playerHp', this.hp);
    if (this.hp <= 0) { this.die(); return; }
    this.setPosition(this.lastSafe.x, this.lastSafe.y - 4);
    this.body.setVelocity(0, 0);
    this.invulnUntil = this.scene.time.now + 1200;
    this.scene.cameras.main.flash(150, 40, 0, 0);
  }

  win() {
    this.state = 'win';
    this.clearAura();
    this.body.setVelocity(0, 0);
    this.zones.hitbox.body.enable = false;
    this.zones.bigbox.body.enable = false;
    this.zones.roarbox.body.enable = false;
    this.play('qin-idle', true);
    const lv = this.scene.L && this.scene.L.name ? this.scene.L.name : '此关';
    this.scene.registry.set('msg', `${lv} · 破！  R 再战 · Q 选关`);
  }
}
