// 《秦皇·长生》入口
window.addEventListener('load', () => {
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 480,
    height: 270,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#0a0c18',
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 1400 }, debug: false }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, SelectScene, GameScene, UIScene]
  });
});
