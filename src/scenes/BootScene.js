// 资源加载 + 动画注册
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    const S = 'assets/sprites/';
    const sheet = (k, f, w = 48, h = 48) =>
      this.load.spritesheet(k, S + f, { frameWidth: w, frameHeight: h });

    sheet('qin_idle', 'qin_idle.png');
    sheet('qin_run', 'qin_run.png');
    sheet('qin_jump', 'qin_jump.png');
    sheet('qin_atk1', 'qin_attack1.png');
    sheet('qin_atk2', 'qin_attack2.png');
    sheet('qin_atk3', 'qin_attack3.png');
    sheet('qin_roll', 'qin_roll.png');
    sheet('qin_hurt', 'qin_hurt.png');
    sheet('qin_death', 'qin_death.png');
    sheet('qin_charge', 'qin_charge.png');
    sheet('qin_launcher', 'qin_launcher.png');
    sheet('qin_slam', 'qin_slam.png');
    sheet('qin_dashatk', 'qin_dashatk.png');
    sheet('qin_roar', 'qin_roar.png');
    sheet('soldier_idle', 'soldier_idle.png');
    sheet('soldier_walk', 'soldier_walk.png');
    sheet('soldier_attack', 'soldier_attack.png');
    sheet('soldier_hurt', 'soldier_hurt.png');
    sheet('soldier_death', 'soldier_death.png');
    sheet('boss_idle', 'boss_idle.png');
    sheet('boss_walk', 'boss_walk.png');
    sheet('boss_sweep', 'boss_sweep.png');
    sheet('boss_slam', 'boss_slam.png');
    sheet('boss_charge', 'boss_charge.png');
    sheet('boss_roar', 'boss_roar.png');
    sheet('boss_spit', 'boss_spit.png');
    sheet('boss_hurt', 'boss_hurt.png');
    sheet('boss_death', 'boss_death.png');
    sheet('tiles', 'tiles.png', 16, 16);
    sheet('fx_slash', 'fx_slash.png');
    sheet('fx_hit', 'fx_hit.png', 24, 24);
    sheet('fx_wave', 'fx_wave.png');
    sheet('fx_aura', 'fx_aura.png');
    sheet('fx_ring', 'fx_ring.png', 96, 96);
    this.load.image('fx_spark', S + 'fx_spark.png');
    this.load.image('fx_shadow', S + 'fx_shadow.png');
    this.load.image('belt_floor', S + 'belt_floor.png');
    this.load.image('bg_far', S + 'bg_far.png');
    this.load.image('bg_mid', S + 'bg_mid.png');
    this.load.image('item_pill', S + 'item_pill.png');
    this.load.image('boss_dart', S + 'boss_dart.png');
  }

  create() {
    // mk(key, 贴图, 起始帧, 结束帧, fps, 循环)
    const mk = (key, tex, s, e, rate, repeat = 0) =>
      this.anims.create({
        key, frames: this.anims.generateFrameNumbers(tex, { start: s, end: e }),
        frameRate: rate, repeat
      });

    mk('qin-idle', 'qin_idle', 0, 3, 6, -1);
    mk('qin-run', 'qin_run', 0, 5, 11, -1);
    mk('qin-jump', 'qin_jump', 0, 1, 3, -1);
    mk('qin-atk1', 'qin_atk1', 0, 3, 15);
    mk('qin-atk2', 'qin_atk2', 0, 3, 15);
    mk('qin-atk3', 'qin_atk3', 0, 4, 15);
    mk('qin-charge', 'qin_charge', 0, 2, 8, -1);
    mk('qin-chargehit', 'qin_charge', 3, 4, 14);
    mk('qin-launcher', 'qin_launcher', 0, 4, 13);
    mk('qin-riser', 'qin_launcher', 1, 3, 13);
    mk('qin-slam', 'qin_slam', 0, 2, 10);
    mk('qin-slamhit', 'qin_slam', 3, 3, 1);
    mk('qin-dashatk', 'qin_dashatk', 0, 3, 15);
    mk('qin-roar', 'qin_roar', 0, 3, 9);
    mk('qin-roll', 'qin_roll', 0, 3, 12);
    mk('qin-hurt', 'qin_hurt', 0, 0, 1);
    mk('qin-death', 'qin_death', 0, 2, 6);
    mk('soldier-idle', 'soldier_idle', 0, 3, 6, -1);
    mk('soldier-walk', 'soldier_walk', 0, 7, 9, -1);
    mk('soldier-attack', 'soldier_attack', 0, 4, 9);
    mk('soldier-hurt', 'soldier_hurt', 0, 0, 1);
    mk('soldier-death', 'soldier_death', 0, 1, 6);
    mk('boss-idle', 'boss_idle', 0, 3, 5, -1);
    mk('boss-walk', 'boss_walk', 0, 3, 7, -1);
    mk('boss-sweep', 'boss_sweep', 0, 3, 10);
    mk('boss-slam', 'boss_slam', 0, 2, 5);   // 3帧@5fps≈600ms，与 flop dur=620 对齐
    mk('boss-charge', 'boss_charge', 0, 1, 8, -1);
    mk('boss-roar', 'boss_roar', 0, 2, 10);
    mk('boss-spit', 'boss_spit', 0, 2, 8);
    mk('boss-hurt', 'boss_hurt', 0, 0, 1);
    mk('boss-death', 'boss_death', 0, 2, 5);
    mk('fx-slash', 'fx_slash', 0, 3, 24);
    mk('fx-hit', 'fx_hit', 0, 3, 20);
    mk('fx-wave', 'fx_wave', 0, 3, 18);
    mk('fx-aura', 'fx_aura', 0, 2, 9, -1);
    mk('fx-ring', 'fx_ring', 0, 3, 20);

    // ?level=N 直进该关（工具/测试链路）；无参数进选关
    const lv = new URLSearchParams(location.search).get('level');
    if (lv) {
      this.registry.set('selectedLevel', lv);
      this.scene.start('GameScene');
    } else {
      this.scene.start('SelectScene');
    }
  }
}
