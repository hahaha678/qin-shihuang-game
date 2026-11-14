// HUD：血条 + 提示 + 事件文本
class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }

  create() {
    const font = { fontFamily: '"Microsoft YaHei", "SimHei", sans-serif', color: '#e8d8a0' };

    this.add.text(10, 6, '始皇帝', { ...font, fontSize: '11px' }).setDepth(1);
    // 血条底 + 金边 + 血条
    this.add.rectangle(10, 20, 108, 12, 0x000000, 0.55).setOrigin(0);
    this.add.rectangle(10, 20, 108, 12).setOrigin(0)
      .setStrokeStyle(1, 0xd4a024, 0.9);
    this.hpBar = this.add.rectangle(12, 22, 104, 8, 0xb03028).setOrigin(0);
    this.hpHi = this.add.rectangle(12, 22, 104, 3, 0xe06050).setOrigin(0);
    // 龙威槽（命中积攒，U/L 释放天子之威）
    this.add.rectangle(10, 34, 108, 8, 0x000000, 0.55).setOrigin(0);
    this.add.rectangle(10, 34, 108, 8).setOrigin(0)
      .setStrokeStyle(1, 0xd4a024, 0.7);
    this.meterBar = this.add.rectangle(12, 36, 104, 4, 0xd4a024).setOrigin(0);

    // Boss 血条（顶部居中，GameScene 注册 bossName 才显示）
    this.bossNameT = this.add.text(240, 4, '', {
      ...font, fontSize: '10px', fontStyle: 'bold', color: '#ffd75e',
      stroke: '#200800', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(10);
    this.bossBarBg = this.add.rectangle(120, 20, 240, 9, 0x000000, 0.6)
      .setOrigin(0).setDepth(10);
    this.bossBarBg.setStrokeStyle(1, 0xd4a024, 0.85);
    this.bossBar = this.add.rectangle(122, 22, 236, 5, 0xc03028).setOrigin(0).setDepth(10);
    this.bossUi = [this.bossNameT, this.bossBarBg, this.bossBar];
    this.bossUi.forEach(o => o.setVisible(false));
    this.bossUiOn = false;

    this.add.text(480 - 10, 6, '', { ...font, fontSize: '11px' })
      .setOrigin(1, 0).setName('levelLabel');

    this.bannerText = this.add.text(240, 64, '', {
      ...font, fontSize: '17px', color: '#ffd75e',
      stroke: '#200800', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    this.msgText = this.add.text(240, 110, '', {
      ...font, fontSize: '18px', color: '#f0c040',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    const belt = !!this.registry.get('beltMode');   // 由 GameScene 按关卡 mode 写入
    this.add.text(240, 258,
      belt
        ? 'A/D左右  W/S纵深  J攻击·按住蓄力  空格跳劈  K滚+J冲刺  U龙威  R重开'
        : 'A/D移动  空格跳  J攻击·按住蓄力  空中↑升龙  空中↓+J坠星  K滚+J冲刺  U龙威  R重开',
      { ...font, fontSize: '9px', color: '#8a8aa0' }).setOrigin(0.5, 1);

    this.events.on('shutdown', () => {});
  }

  update() {
    const hp = this.registry.get('playerHp') ?? 100;
    const max = this.registry.get('playerMax') ?? 100;
    const w = Math.max(0, 104 * hp / max);
    this.hpBar.width = w;
    this.hpHi.width = w;
    const m = this.registry.get('playerMeter') ?? 0;
    this.meterBar.width = 104 * m / 100;
    // 龙威满槽时高亮呼吸
    this.meterBar.setFillStyle(m >= 100 ? 0xffe890 : 0xd4a024);
    const msg = this.registry.get('msg') ?? '';
    if (this.msgText.text !== msg) this.msgText.setText(msg);
    const bn = this.registry.get('banner') ?? '';
    if (this.bannerText.text !== bn) {
      this.bannerText.setText(bn);
      if (bn) {   // 横幅弹入
        this.bannerText.setScale(0.3);
        this.tweens.add({
          targets: this.bannerText, scale: 1,
          duration: 220, ease: 'Back.Out',
        });
      }
    }
    const lv = this.registry.get('levelName') ?? '';
    const label = this.children.getByName('levelLabel');
    if (label && label.text !== lv) label.setText(lv);
    // Boss 血条
    const bossName = this.registry.get('bossName') || '';
    if (!!bossName !== this.bossUiOn) {
      this.bossUiOn = !!bossName;
      this.bossUi.forEach(o => o.setVisible(this.bossUiOn));
    }
    if (bossName) {
      if (this.bossNameT.text !== bossName) this.bossNameT.setText(bossName);
      const bh = this.registry.get('bossHp') ?? 0;
      const bm = this.registry.get('bossMax') || 1;
      this.bossBar.width = Math.max(0, 236 * bh / bm);
    }
  }
}
