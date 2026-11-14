# 秦皇·长生

秦始皇横版动作闯关游戏。Phaser 3.90 + 原生 JavaScript（无构建工具），素材由代码生成。

## 运行

```bash
python -m http.server 8123        # 项目根目录，然后访问 http://localhost:8123（进选关界面）
                                  # ?level=1|2|3|4 直进对应章节（跳过选关，工具/测试用）
```

注意：不能用 file:// 直接打开 index.html（Phaser 加载图片需要 HTTP）。

## 结构

- `index.html` / `src/main.js` — 入口，Phaser 配置（480×270，像素风，FIT 缩放）
- `src/scenes/` — BootScene（加载+动画注册+分流）/ SelectScene（选关）/ GameScene（主玩法）/ UIScene（HUD）
- `src/entities/Player.js` — 始皇状态机：idle/run/air/attack/charge/slam/roll/hurt/win/dead；招式表 `Player.MOVES`（三连/蓄力斩/上挑/升龙/冲刺斩/下砸/龙威），判定盒分 hitbox/bigbox/roarbox 三个 zone
- `src/entities/Enemy.js` — 六国士兵 AI：patrol/chase/attack/hurt/dead；兵型在 `Enemy.STATS`（soldier 轻兵 / elite 玄甲精锐）
- `src/entities/Boss.js` — 不死药灵 Boss：idle/warn/attack/recover/hurt 状态机；`Boss.MOVES` 五招式（sweep 横扫/flop 压顶/charge 冲撞/roar 咆哮狂暴期/spit 吐丹远程）；出招前 `telegraph()` 红区预警（arc 扇形/zone 落点/lane 车道/ring 圆环/mouth 口腔）；idle 期 maneuver 走位（press 压进/flank 换道/back 诱敌）+ 读玩家蓄力错道；`STAGGER` 削韧硬直；接口与 Enemy 对齐直接进 enemies 组
- `src/data/levels.js` — 关卡 tile 数据（程序化生成）。LEVEL1 静态布敌；LEVEL2/3 用 `waves` 数组定义波次；LEVEL4 用 `boss:{x,y,name}` 定义 Boss 战（enemies:[]，`winX` 不走、击杀即通关）
- `tools/gen_sprites.py` — Pillow 像素画生成器，输出到 `assets/sprites/`
- `tools/smoke_test.js` — Playwright 冒烟测试：第一章平台模式（需 `npm i`）
- `tools/debug_belt.js` — Playwright 冒烟测试：第三章清版过关（纵深/分道命中/跳劈/波次）
- `tools/debug_boss.js` — Playwright 冒烟测试：第四章 Boss 战（登场/预警红区/判定盒/掉血/击杀通关）
- `tools/record_run.js` — 自动通关演示机器人 + 录屏，产出 `tools/video/playthrough_lvN.webm`；每次尝试独立录像、阵亡整段丢弃，落盘保证「一次完整通关」；lv4 Boss 战改走**页内逐帧驱动器**（evaluate 注入，直接写 `bufAtkUntil`/`bufRollUntil`/方向键 `isDown` 数组，读 `stateUntil-enemyTime` 卡极限闪避），不走键盘模拟

## 关键约定

- 角色 spritesheet 一律 48×48 帧；tiles 16×16；角色原点在帧中心，脚底约 y+20
- 输入用**事件缓冲**（key.on('down') 写缓冲时间戳），不要用 JustDown——它会漏掉短于一帧的按键
- 关卡选择：统一经 `registry.selectedLevel`（BootScene 把 `?level=` URL 参数写入，SelectScene 确认时写入）；阵亡/通关后 R 再战、Q 返回选关
- 战斗命中：Zone + arcade body 做 hitbox，`swingId` 防单挥多段命中
- 极限闪避→时空断裂：翻滚无敌帧内被敌 attackBox 扫到（`tryDodge`，按敌方 `attackSwing` 防同击重触发）触发 1.9s 断裂；敌人走独立慢时钟 `enemyTime`（GameScene 每帧 `+= delta*enemyTimeScale`，AI/攻击窗口/hurtUntil 统一用它），外加 `anims.timeScale` 减速+蓝化染色；断裂期 J=裂空斩 `rift`（出手即解除断裂），特效=呼吸蓝滤镜+电影黑边+时间涟漪+缠绕光环+脚下计时环+时之尘
- 波次关卡：关卡数据含 `waves` 数组时 GameScene 走波次模式，全灭才开放过关（`wavesDone`）；横幅走 `registry.banner`；`spawnWave` 期间 `wavePending` 锁定防"空场=全灭"误判
- 清版过关（belt）模式：关卡 `mode:'belt'` + `floor:{min,max}` 纵深带 + `bounds`。y 坐标=深度，角色 `initBelt()` 切脚部原点(0.5,1)+无重力+薄片判定盒（错道打不中，判定盒随深度缩放）+按 y 排序/缩放/脚影；物理世界边界=可行走带（按脚盒换算外扩 10px），UIScene 经 `registry.beltMode` 感知模式；Player 走 `updateBelt`、Enemy 走 `updateBelt`（分道包围 laneOff + 分离避让）；空格=跳劈（`setDisplayOrigin` 视觉抬升，不落坑）
- Boss 战：关卡 `boss` 字段触发 `spawnBoss()`（GameScene 登场横幅+镲音+震屏）；Boss 血量经 `registry.bossHp/bossMax/bossName` 同步给 UIScene 顶部血条；击杀 boss 即 `won`（隐藏血条）；Boss 走 belt 深度缩放 ×2.15，可被极限闪避/裂空斩命中，断裂期同样慢时钟+蓝化；HP<50% 狂暴：预警×0.72、出招间隔缩短、解锁震地咆哮+三连吐；吐丹弹走 `bossShots` 组（瞄准出射，含纵深分量），滚过=极限闪避（断裂期冻结悬空）、挥剑可劈碎（弹反+龙威），寿命/速度均走 `enemyTime` 慢时钟
- 修改素材后重跑 `python tools/gen_sprites.py` 再刷新页面

## 验证

```bash
npm i                          # 首次
node tools/smoke_test.js       # 第一章端到端：移动/跳/攻击/击杀，输出状态+截图到 tools/
node tools/debug_belt.js       # 第三章端到端：纵深移动/同道命中/错道未命中/跳劈/波次推进
node tools/debug_boss.js       # 第四章端到端：Boss 登场/红区预警/出招判定/掉血/击杀通关
node tools/verify_spit.js      # 吐丹弹链路：发射/命中扣血/滚弹触发断裂/挥剑弹反
node tools/record_run.js [1|2|3|4]   # 自动通关 + 录屏 -> tools/video/playthrough_lvN.webm
# webm -> mp4 用 tools/ffmpeg.exe（npmmirror 拉的完整 ffmpeg；Playwright 自带版只有 VP8 编码器）
#   tools/ffmpeg.exe -y -i in.webm -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -an out.mp4
```
