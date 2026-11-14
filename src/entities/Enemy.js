// 六国士兵：巡逻 -> 索敌 -> 追击 -> 长矛突刺。elite=玄甲精锐（更快更硬）
class Enemy extends Phaser.Physics.Arcade.Sprite {
  static STATS = {
    soldier: { hp: 30, walk: 42, chase: 78, dmg: 12, sight: 175, reach: 40 },
    elite:   { hp: 55, walk: 56, chase: 96, dmg: 16, sight: 210, reach: 44, tint: 0x9ab8ff },
  };

  constructor(scene, x, y, type = 'soldier') {
    super(scene, x, y, 'soldier_idle', 0);
    this.st = Enemy.STATS[type] || Enemy.STATS.soldier;
    this.type = type;
    this.dmg = this.st.dmg;
    this.baseTint = this.st.tint || 0;
    if (this.baseTint) this.setTint(this.baseTint);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(15, 30);
    this.body.setOffset(17, 14);
    this.setOrigin(0.5);

    this.hp = this.st.hp;
    this.dead = false;
    this.state = 'patrol';    // patrol chase attack hurt dead
    this.facing = -1;
    this.homeX = x;
    this.patrolRange = 55;
    this.lastHitSwing = -1;
    this.attackStartAt = 0;
    this.attackSwing = 0;
    this.hurtUntil = 0;
    this.stateUntil = 0;

    // 长矛判定盒
    this.attackBox = scene.add.zone(x, y, 26, 24);
    scene.physics.add.existing(this.attackBox);
    this.attackBox.body.setAllowGravity(false);
    this.attackBox.body.enable = false;
  }

  /** 清版过关模式：脚为原点/薄片判定/分道站位/脚影 */
  initBelt(L) {
    this.belt = true;
    this.floor = L.floor;
    this.bounds = L.bounds;
    this.setOrigin(0.5, 1);
    this.body.setAllowGravity(false);
    this.body.setSize(20, 10);
    this.body.setOffset(14, 38);
    this.body.setCollideWorldBounds(true);
    this.attackBox.body.setSize(26, 14);
    this.laneOff = Phaser.Math.Between(-24, 24);   // 各自错开一条道围殴
    this.depthScale = 1;
    this.shadow = this.scene.add.image(this.x, this.y + 1, 'fx_shadow')
      .setDepth(L.floor.min - 1).setAlpha(0.45);
  }

  updateBelt(player, time) {
    if (this.dead) return;
    const body = this.body;
    const dx = player.x - this.x;
    const dy = (player.y + this.laneOff) - this.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(player.y - this.y);
    const playerAlive = !player.dead && player.state !== 'win';

    switch (this.state) {
      case 'patrol':
      case 'chase': {
        if (!playerAlive) {
          body.setVelocity(0, 0);
          this.play('soldier-idle', true);
          break;
        }
        if (adx < this.st.reach * 0.85 && ady < 12) {
          this.startAttack(time);
          break;
        }
        // 朝玩家方向走，目标是自己那条道
        let mx = dx, my = dy;
        // 分离避让：不挤成一团
        this.scene.enemies.children.iterate(o => {
          if (o !== this && !o.dead) {
            const sx = this.x - o.x, sy = this.y - o.y;
            const sd = Math.hypot(sx, sy);
            if (sd > 0 && sd < 26) { mx += sx / sd * 60; my += sy / sd * 60; }
          }
        });
        const ml = Math.hypot(mx, my) || 1;
        const ts = this.scene.enemyTimeScale || 1;   // 时空断裂减速
        body.setVelocity(mx / ml * this.st.chase * ts, my / ml * this.st.chase * 0.65 * ts);
        if (Math.abs(dx) > 4) this.facing = dx > 0 ? 1 : -1;
        this.play('soldier-walk', true);
        break;
      }

      case 'attack': {
        body.setVelocity(0, 0);
        const active = time >= this.attackStartAt + 200
          && time <= this.attackStartAt + 330;
        this.attackBox.body.enable = active;
        if (active)
          this.attackBox.setPosition(this.x + this.facing * 18, this.y - 8);
        if (time >= this.stateUntil) {
          this.attackBox.body.enable = false;
          this.state = 'chase';
        }
        break;
      }

      case 'hurt':
        if (time >= this.hurtUntil) {
          this.state = 'chase';
          this.restoreTint();
        }
        break;
    }

    // 钳进战场
    this.x = Phaser.Math.Clamp(this.x, this.bounds.x0, this.bounds.x1);
    this.y = Phaser.Math.Clamp(this.y, this.floor.min, this.floor.max);
    this.setFlipX(this.facing > 0);
    if (this.state !== 'attack') this.attackBox.body.enable = false;

    // 深度缩放/排序/脚影
    const t = Phaser.Math.Clamp(
      (this.y - this.floor.min) / (this.floor.max - this.floor.min), 0, 1);
    this.depthScale = 0.78 + 0.4 * t;
    if (this.state !== 'hurt') this.setScale(this.depthScale);
    this.setDepth(this.y);
    if (this.shadow) {
      this.shadow.setPosition(this.x, this.y + 1);
      this.shadow.setDepth(this.y - 0.5);
      this.shadow.setScale(0.9 + 0.5 * t);
    }
  }

  // 前方脚下是否是实地（防止巡逻/追击时走出悬崖）
  edgeAhead(dir) {
    const t = this.scene.layer.getTileAtWorldXY(
      this.x + dir * 10, this.y + 24);
    return !t || t.index < 0;
  }

  updateEnemy(player, time) {
    if (this.belt) { this.updateBelt(player, time); return; }
    if (this.dead) return;
    const body = this.body;
    const dx = player.x - this.x;
    const adx = Math.abs(dx);
    const ady = Math.abs(player.y - this.y);
    const playerAlive = !player.dead && player.state !== 'win';

    switch (this.state) {
      case 'patrol': {
        const dir = this.facing;
        const ts = this.scene.enemyTimeScale || 1;   // 时空断裂减速
        if (this.edgeAhead(dir)) {
          this.facing = -dir;
          body.setVelocityX(-dir * this.st.walk * ts);
        } else {
          body.setVelocityX(dir * this.st.walk * ts);
        }
        if (this.x < this.homeX - this.patrolRange) this.facing = 1;
        else if (this.x > this.homeX + this.patrolRange) this.facing = -1;
        if (body.blocked.left) this.facing = 1;
        if (body.blocked.right) this.facing = -1;
        this.play('soldier-walk', true);
        if (playerAlive && adx < this.st.sight && ady < 56) this.state = 'chase';
        break;
      }

      case 'chase': {
        if (!playerAlive || adx > this.st.sight + 60 || ady > 80) {
          this.state = 'patrol';
          break;
        }
        this.facing = dx > 0 ? 1 : -1;
        if (this.edgeAhead(this.facing)) body.setVelocityX(0);  // 崖边等待
        else body.setVelocityX(this.facing * this.st.chase * (this.scene.enemyTimeScale || 1));
        this.play('soldier-walk', true);
        if (adx < this.st.reach && ady < 34) this.startAttack(time);
        break;
      }

      case 'attack': {
        body.setVelocityX(0);
        // 突刺命中窗口（第3~4帧）
        const active = time >= this.attackStartAt + 200 && time <= this.attackStartAt + 330;
        this.attackBox.body.enable = active;
        if (active) this.attackBox.setPosition(this.x + this.facing * 16, this.y - 2);
        if (time >= this.stateUntil) {
          this.attackBox.body.enable = false;
          this.state = playerAlive && adx < this.st.sight ? 'chase' : 'patrol';
        }
        break;
      }

      case 'hurt':
        if (time >= this.hurtUntil) {
          this.state = 'chase';
          this.restoreTint();
        }
        break;
    }

    this.setFlipX(this.facing > 0);   // 素材面朝右
    if (this.state !== 'attack') this.attackBox.body.enable = false;
  }

  startAttack(time) {
    this.state = 'attack';
    this.attackStartAt = time;
    this.stateUntil = time + 560;
    this.attackSwing++;
    this.play('soldier-attack', true);
  }

  /** 恢复底色：精锐兵回蓝 tint，普通兵清除 */
  restoreTint() {
    if (!this.scene) return;   // 已销毁
    this.clearTint();
    if (this.baseTint) this.setTint(this.baseTint);
  }

  /** 返回 true = 本次命中生效；launchVy 用于挑飞（升龙/上挑） */
  takeDamage(dmg, fromX, swingId, launchVy) {
    if (this.dead || swingId === this.lastHitSwing) return false;
    this.lastHitSwing = swingId;
    this.hp -= dmg;
    const t = this.scene.enemyTime ?? this.scene.time.now;   // 敌人走慢时钟
    const ts = this.scene.enemyTimeScale || 1;

    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.restoreTint());
    // 受击挤压（形变弹跳）；belt 模式下基准缩放是深度缩放
    const bs = this.belt ? this.depthScale : 1;
    this.setScale(bs * 1.15, bs * 0.85);
    this.scene.tweens.add({
      targets: this, scaleX: bs, scaleY: bs, duration: 140, ease: 'Back.Out',
    });
    this.state = 'hurt';
    this.attackBox.body.enable = false;
    if (this.belt) {
      this.hurtUntil = t + (launchVy ? 380 : 240);
      this.body.setVelocityX((this.x < fromX ? -1 : 1) * (launchVy ? 150 : 110) * ts);
      this.body.setVelocityY((Math.random() - 0.5) * 60 * ts);
    } else if (launchVy) {   // 挑飞：浮空更久，可被空连
      this.hurtUntil = t + 430;
      this.body.setVelocityY(launchVy * ts);
      this.body.setVelocityX((this.x < fromX ? -1 : 1) * 50 * ts);
    } else {
      this.hurtUntil = t + 240;
      this.body.setVelocityX((this.x < fromX ? -1 : 1) * 110 * ts);
      this.body.setVelocityY(-70 * ts);
    }
    this.play('soldier-hurt', true);
    return true;
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    this.attackBox.body.enable = false;
    this.setScale(1, 1);
    this.play('soldier-death', true);
    Sfx.enemyDie();
    if (this.scene.burst) {
      this.scene.burst(this.x, this.y - 4, { count: 16 });
      this.scene.burst(this.x, this.y - 4, { count: 8, red: true });
    }
    this.once('animationcomplete', () => {
      // 尸体停留片刻后淡出销毁；attackBox 连同其重叠器一并移除
      this.scene.time.delayedCall(1200, () => {
        this.scene.tweens.add({
          targets: this.shadow ? [this, this.shadow] : this,
          alpha: 0, duration: 400,
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
    // 35% 掉仙丹
    if (Math.random() < 0.35 && this.scene.pills) {
      const p = this.scene.pills.create(this.x, this.y - 6, 'item_pill');
      p.body.setAllowGravity(!this.belt);
      if (!this.belt) p.body.setVelocityY(-140);
      p.setDepth(this.belt ? this.y - 0.6 : 5);
    }
  }
}
