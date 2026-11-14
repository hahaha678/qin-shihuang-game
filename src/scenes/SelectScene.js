// 选关场景：三章择一。↑↓/W/S 选择，J/回车/空格确认，鼠标悬停/点击亦可
class SelectScene extends Phaser.Scene {
  constructor() { super('SelectScene'); }

  create() {
    const F = { fontFamily: '"Microsoft YaHei", "SimHei", sans-serif' };
    const CHAPTERS = [
      { lv: '1', name: '第一章 · 咸阳宫', desc: '夜探宫阙 · 横版闯关' },
      { lv: '2', name: '第二章 · 校场演武', desc: '三阵擂台 · 波次厮杀' },
      { lv: '3', name: '第三章 · 函谷沙场', desc: '纵深清版 · 2.5D 沙场' },
      { lv: '4', name: '第四章 · 不死药灵', desc: 'BOSS · 仙药化身' },
    ];

    // 背景：远景夜空 + 压暗，始皇立像装饰
    this.add.tileSprite(0, 0, 480, 270, 'bg_far').setOrigin(0);
    this.add.rectangle(0, 0, 480, 270, 0x05060d, 0.45).setOrigin(0);
    this.add.sprite(424, 216, 'qin_idle').setScale(1.5).play('qin-idle');
    this.add.sprite(52, 216, 'boss_idle').setScale(1.3).play('boss-idle');   // 药灵作伴

    this.add.text(240, 42, '秦 皇 · 长 生', {
      ...F, fontSize: '28px', fontStyle: 'bold', color: '#ffd75e',
      stroke: '#201000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(240, 74, '—— 横扫六合 · 寻仙蓬莱 ——', {
      ...F, fontSize: '10px', color: '#8a8aa0',
    }).setOrigin(0.5);

    this.sel = 0;
    this.rows = CHAPTERS.map((c, i) => {
      const y = 106 + i * 39;
      const name = this.add.text(168, y, c.name, {
        ...F, fontSize: '15px', fontStyle: 'bold', color: '#9a8f70',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0, 0.5);
      const desc = this.add.text(172, y + 15, c.desc, {
        ...F, fontSize: '9px', color: '#6a6a80',
      }).setOrigin(0, 0.5);
      const hit = this.add.zone(230, y + 5, 340, 40)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.pick(i));
      hit.on('pointerdown', () => { this.pick(i); this.confirm(); });
      return { name, desc, lv: c.lv };
    });

    this.cursor = this.add.text(152, 0, '▶', {
      ...F, fontSize: '12px', color: '#ffd75e',
      stroke: '#201000', strokeThickness: 3,
    }).setOrigin(1, 0.5);
    this.tweens.add({
      targets: this.cursor, x: 146, duration: 380,
      yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });
    this.pick(0);

    this.add.text(240, 254, '↑↓ 或 W/S 选择      J / 回车 / 空格 确认      场内阵亡或通关后按 Q 返回', {
      ...F, fontSize: '9px', color: '#6a6a80',
    }).setOrigin(0.5, 1);

    const K = Phaser.Input.Keyboard.KeyCodes;
    const kb = this.input.keyboard;
    [K.UP, K.W].forEach(c => kb.addKey(c).on('down', () => this.pick(this.sel - 1)));
    [K.DOWN, K.S].forEach(c => kb.addKey(c).on('down', () => this.pick(this.sel + 1)));
    [K.ENTER, K.SPACE, K.J].forEach(c => kb.addKey(c).on('down', () => this.confirm()));
  }

  pick(i) {
    const n = this.rows.length;
    this.sel = ((i % n) + n) % n;
    this.rows.forEach((r, j) => {
      const on = j === this.sel;
      r.name.setColor(on ? '#ffd75e' : '#9a8f70');
      r.desc.setColor(on ? '#c8b890' : '#6a6a80');
    });
    this.cursor.y = 106 + this.sel * 39;
    Sfx.tone(600, 720, 0.05, 'sine', 0.06);
  }

  confirm() {
    this.registry.set('selectedLevel', this.rows[this.sel].lv);
    Sfx.gong();
    this.scene.start('GameScene');
  }
}
