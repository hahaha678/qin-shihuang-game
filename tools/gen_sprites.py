#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
像素画素材生成器 —— 《秦皇·长生》
按部位参数化绘制 spritesheet，输出到 assets/sprites/
"""
import os
import math
import random
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'sprites')
os.makedirs(OUT, exist_ok=True)

FW = FH = 48  # 角色帧尺寸

# ---------- 秦风调色板 ----------
C = {
    'robe_dk':   (18, 18, 26, 255),
    'robe':      (32, 32, 46, 255),
    'robe_hi':   (52, 52, 72, 255),
    'gold':      (214, 164, 36, 255),
    'gold_hi':   (246, 205, 90, 255),
    'gold_dk':   (148, 108, 22, 255),
    'red':       (158, 28, 28, 255),
    'red_hi':    (206, 62, 48, 255),
    'skin':      (234, 186, 140, 255),
    'skin_dk':   (198, 148, 106, 255),
    'hair':      (26, 20, 16, 255),
    'beard':     (40, 30, 24, 255),
    'steel':     (198, 208, 222, 255),
    'steel_dk':  (138, 152, 168, 255),
    'steel_hi':  (242, 248, 255, 255),
    'bronze':    (178, 128, 50, 255),
    'bronze_dk': (128, 90, 32, 255),
    'boot':      (22, 18, 16, 255),
    # 士兵
    'leather':   (110, 74, 44, 255),
    'leather_dk':(80, 52, 30, 255),
    'leather_hi':(140, 98, 60, 255),
    'helm':      (140, 110, 56, 255),
    'helm_dk':   (100, 78, 38, 255),
    'plume':     (178, 40, 36, 255),
    'pants':     (64, 48, 36, 255),
    'wood':      (120, 84, 50, 255),
}
TRAN = (0, 0, 0, 0)


def new_frame():
    return Image.new('RGBA', (FW, FH), TRAN)


def px(d, x, y, c):
    x, y = round(x), round(y)
    if 0 <= x < FW and 0 <= y < FH:
        d.point((x, y), fill=c)


def rect(d, x0, y0, x1, y1, c):
    d.rectangle([round(x0), round(y0), round(x1), round(y1)], fill=c)


def hline(d, x0, x1, y, c):
    y = round(y)
    if 0 <= y < FH:
        d.line([round(x0), y, round(x1), y], fill=c)


def vline(d, x, y0, y1, c):
    x = round(x)
    if 0 <= x < FW:
        d.line([x, round(y0), x, round(y1)], fill=c)


def thick_line(d, x0, y0, x1, y1, c, w=3):
    d.line([round(x0), round(y0), round(x1), round(y1)], fill=c, width=w)


# ================= 秦始皇部件 =================

def qin_crown(d, cx, y):
    """冕冠：平板 + 前后垂旒（珠串）"""
    rect(d, cx - 11, y, cx + 11, y + 3, C['hair'])          # 冕板
    hline(d, cx - 11, cx + 11, y, C['gold_dk'])             # 板顶金边
    hline(d, cx - 11, cx + 11, y + 3, C['gold'])            # 板底金边
    for bx in (cx - 9, cx - 5, cx - 1, cx + 3, cx + 7, cx + 9):  # 旒
        col = C['gold_hi'] if bx in (cx - 9, cx + 9) else C['gold_dk']
        for j in range(3):
            px(d, bx, y + 4 + j * 2, col)


def qin_head(d, cx, y):
    rect(d, cx - 4, y, cx + 4, y + 7, C['skin'])            # 脸
    rect(d, cx - 4, y, cx + 4, y + 1, C['hair'])            # 发际线
    px(d, cx + 3, y + 4, C['hair'])                         # 眼（面朝右）
    px(d, cx + 2, y + 4, C['skin_dk'])
    rect(d, cx + 1, y + 6, cx + 4, y + 7, C['beard'])       # 山羊须
    px(d, cx - 4, y + 4, C['skin_dk'])                      # 耳


def qin_robe(d, cx, top, hem_y, hem_hw=13, swing=0):
    """黑金龙袍：梯形袍身 + 右衽金领 + 腰带 + 下摆金边"""
    sh_w = 7
    for y in range(round(top), round(hem_y) + 1):
        t = (y - top) / max(1, hem_y - top)
        hw = sh_w + (hem_hw - sh_w) * t
        x0 = cx - hw + swing * t
        x1 = cx + hw + swing * t
        col = C['robe']
        hline(d, x0, x1, y, col)
        px(d, x0, y, C['robe_dk'])          # 左缘阴影
        px(d, x1, y, C['robe_hi'])          # 右缘高光
    # 下摆金边
    hline(d, cx - hem_hw + swing, cx + hem_hw + swing, hem_y, C['gold_dk'])
    hline(d, cx - hem_hw + swing, cx + hem_hw + swing, hem_y - 1, C['gold'])
    # 腰带
    belt_y = top + 9
    hline(d, cx - sh_w - 1, cx + sh_w + 1, belt_y, C['gold'])
    hline(d, cx - sh_w - 1, cx + sh_w + 1, belt_y + 1, C['gold_dk'])
    px(d, cx + 1, belt_y, C['red'])         # 玉佩
    px(d, cx + 1, belt_y + 1, C['red'])
    px(d, cx + 1, belt_y + 2, C['red_hi'])
    # 右衽交领：金色斜襟
    for i in range(6):
        px(d, cx + 4 - i, top + i, C['gold'])
        px(d, cx + 5 - i, top + i, C['gold_dk'])


def qin_sleeve_arm(d, sx, sy, hx, hy):
    """宽袖：从肩到手画渐窄袖筒，手部露肤"""
    steps = 4
    for i in range(steps + 1):
        t = i / steps
        x = sx + (hx - sx) * t
        y = sy + (hy - sy) * t
        hw = 4 - t * 2.4
        vline(d, x, y - hw, y + hw, C['robe'])
        px(d, x, y - hw, C['robe_hi'])
        px(d, x, y + hw, C['robe_dk'])
    rect(d, hx - 1, hy - 1, hx + 1, hy + 1, C['skin'])      # 手


def sword(d, hx, hy, ang_deg, length=26):
    """太阿剑：钢刃 + 青铜护手 + 红剑穗"""
    a = math.radians(ang_deg)
    dx, dy = math.cos(a), math.sin(a)
    # 剑穗（红缨，在剑柄后）
    tx, ty = hx - dx * 3, hy - dy * 3
    px(d, tx, ty, C['red']); px(d, tx - dy, ty + dx, C['red'])
    px(d, tx + dy, ty - dx, C['red_hi'])
    # 柄
    thick_line(d, hx - dx * 3, hy - dy * 3, hx + dx * 1, hy + dy * 1, C['bronze_dk'], 2)
    # 护手（垂直于剑身的小横档）
    gx, gy = hx + dx * 2, hy + dy * 2
    px(d, gx - dy * 2, gy + dx * 2, C['bronze'])
    px(d, gx + dy * 2, gy - dx * 2, C['bronze'])
    px(d, gx - dy, gy + dx, C['gold']); px(d, gx + dy, gy - dx, C['gold'])
    # 刃（双线：主刃 + 高光脊）
    bx, by = gx, gy
    ex, ey = bx + dx * length, by + dy * length
    thick_line(d, bx, by, ex, ey, C['steel'], 3)
    thick_line(d, bx, by, ex - dx * 2, ey - dy * 2, C['steel_hi'], 1)
    px(d, ex, ey, C['steel_hi'])            # 剑尖


def qin_feet(d, cx, y, phase):
    """袍下露出的靴尖，phase -1/0/1 控制前后错步"""
    rect(d, cx - 5 + phase * 3, y, cx - 1 + phase * 3, y + 2, C['boot'])
    rect(d, cx + 1 - phase * 3, y, cx + 6 - phase * 3, y + 2, C['boot'])


def draw_qin(pose):
    """组装秦始皇。pose: dict"""
    img = new_frame()
    d = ImageDraw.Draw(img)
    bob = pose.get('bob', 0)
    cx = 24 + pose.get('shift_x', 0)
    crown_y = 4 + bob
    head_y = crown_y + 8
    top = head_y + 8
    hem_y = 40 + bob + pose.get('hem_drop', 0)
    swing = pose.get('swing', 0)
    hem_hw = pose.get('hem_hw', 13)

    # 背后披风边（先画，垫底）
    if pose.get('cape', False):
        for y in range(top, hem_y):
            t = (y - top) / max(1, hem_y - top)
            px(d, cx - 8 - t * 3 + swing * t, y, C['red'])
            px(d, cx - 9 - t * 3 + swing * t, y, C['red'])

    qin_robe(d, cx, top, hem_y, hem_hw, swing)
    qin_crown(d, cx, crown_y)
    qin_head(d, cx, head_y)

    # 手臂 + 剑画在袍子之上（持剑手在身前）
    arm2 = pose.get('arm2')  # 左手（身后）
    if arm2:
        qin_sleeve_arm(d, cx - 4, top + 3, arm2[0], arm2[1])
    arm = pose.get('arm')  # (hx, hy) 手的位置
    if arm:
        hx, hy = arm
        qin_sleeve_arm(d, cx + 4, top + 3, hx, hy)
        if pose.get('sword_ang') is not None:
            sword(d, hx, hy, pose['sword_ang'], pose.get('sword_len', 26))

    qin_feet(d, cx, hem_y + 1, pose.get('leg_phase', 0))
    return img


def sheet(frames, name):
    img = Image.new('RGBA', (FW * len(frames), FH), TRAN)
    for i, f in enumerate(frames):
        img.paste(f, (FW * i, 0))
    img.save(os.path.join(OUT, name))
    print('生成', name, f'({len(frames)}帧)')


# ================= 秦始皇动画 =================

def gen_qin():
    # idle：持剑垂于身侧，呼吸起伏，旒微晃
    frames = []
    for i in range(4):
        bob = [0, 0, -1, 0][i]
        frames.append(draw_qin({
            'bob': bob, 'cape': True,
            'arm': (32, 26 + bob), 'sword_ang': 78, 'sword_len': 15,
            'leg_phase': 0,
        }))
    sheet(frames, 'qin_idle.png')

    # run：袍摆甩动 + 脚步交替 + 持剑后摆
    frames = []
    phases = [1, 1, 0, -1, -1, 0]
    for i in range(6):
        p = phases[i]
        frames.append(draw_qin({
            'bob': -1 if i % 2 == 0 else 0, 'cape': True,
            'swing': -3 if abs(p) == 1 else -1,
            'arm': (29, 25), 'sword_ang': 110, 'sword_len': 15,
            'leg_phase': p, 'shift_x': 1,
        }))
    sheet(frames, 'qin_run.png')

    # jump：上升(袍摆下坠) / 下落(袍摆上飘)
    frames = [
        draw_qin({'bob': 0, 'cape': True, 'swing': 2, 'hem_hw': 14,
                  'arm': (31, 25), 'sword_ang': 55, 'sword_len': 15, 'leg_phase': 0}),
        draw_qin({'bob': 0, 'cape': True, 'swing': -4, 'hem_hw': 15,
                  'arm': (31, 25), 'sword_ang': 85, 'sword_len': 15, 'leg_phase': 0}),
    ]
    sheet(frames, 'qin_jump.png')

    # attack1：横斩（背后蓄力 -> 平斩 -> 收势）剑光靠 fx_slash 表现
    a1 = [
        {'arm': (17, 20), 'sword_ang': -55, 'sword_len': 17, 'swing': -2, 'shift_x': -1},   # 蓄力
        {'arm': (30, 23), 'sword_ang': -12, 'sword_len': 17, 'swing': 1, 'shift_x': 1},     # 斩出
        {'arm': (31, 29), 'sword_ang': 38, 'sword_len': 18, 'swing': 2, 'shift_x': 2},      # 斩过
        {'arm': (30, 27), 'sword_ang': 72, 'sword_len': 15, 'swing': 0},                    # 收
    ]
    sheet([draw_qin({**p, 'cape': True}) for p in a1], 'qin_attack1.png')

    # attack2：回斩（反手，由下向上）
    a2 = [
        {'arm': (31, 31), 'sword_ang': 50, 'sword_len': 17, 'swing': 1, 'shift_x': 1},
        {'arm': (31, 26), 'sword_ang': -25, 'sword_len': 17, 'swing': 0, 'shift_x': 1},
        {'arm': (29, 18), 'sword_ang': -78, 'sword_len': 16, 'swing': -1, 'shift_x': 1},
        {'arm': (30, 27), 'sword_ang': 72, 'sword_len': 15, 'swing': 0},
    ]
    sheet([draw_qin({**p, 'cape': True}) for p in a2], 'qin_attack2.png')

    # attack3：举剑过顶 -> 力劈华山
    a3 = [
        {'arm': (25, 17), 'sword_ang': -85, 'sword_len': 15, 'swing': -2, 'shift_x': -1, 'bob': -1},
        {'arm': (27, 15), 'sword_ang': -65, 'sword_len': 15, 'swing': 0, 'shift_x': 0, 'bob': -1},
        {'arm': (31, 28), 'sword_ang': 48, 'sword_len': 22, 'swing': 3, 'shift_x': 2},
        {'arm': (30, 30), 'sword_ang': 62, 'sword_len': 22, 'swing': 2, 'shift_x': 2},
        {'arm': (30, 27), 'sword_ang': 72, 'sword_len': 15, 'swing': 0},
    ]
    sheet([draw_qin({**p, 'cape': True}) for p in a3], 'qin_attack3.png')

    # roll：收身成球滚动（用袍身压扁 + 冕冠偏移表现）
    frames = []
    for i in range(4):
        img = new_frame()
        d = ImageDraw.Draw(img)
        cy = 33 + [0, -2, 0, 2][i]
        cx = 24
        # 团身袍球
        for y in range(cy - 9, cy + 10):
            hw = int(math.sqrt(max(1, 81 - (y - cy) ** 2)))
            hline(d, cx - hw, cx + hw, y, C['robe'])
            px(d, cx - hw, y, C['robe_dk']); px(d, cx + hw, y, C['robe_hi'])
        hline(d, cx - 8, cx + 8, cy + 9, C['gold_dk'])
        # 冕冠随滚动转位
        ang = i * 90 - 20
        ax = cx + int(10 * math.cos(math.radians(ang)))
        ay = cy + int(9 * math.sin(math.radians(ang)))
        rect(d, ax - 4, ay - 2, ax + 4, ay + 1, C['hair'])
        hline(d, ax - 4, ax + 4, ay - 2, C['gold_dk'])
        px(d, ax + 5, ay, C['skin'])
        frames.append(img)
    sheet(frames, 'qin_roll.png')

    # 蓄力斩：收刀下沉聚气 -> 爆发横斩
    ch = [
        {'hem_drop': 2, 'swing': -1, 'arm': (19, 30), 'sword_ang': 105, 'sword_len': 15},
        {'hem_drop': 3, 'swing': -2, 'arm': (17, 31), 'sword_ang': 112, 'sword_len': 15, 'shift_x': -1},
        {'hem_drop': 3, 'swing': -2, 'arm': (17, 31), 'sword_ang': 112, 'sword_len': 15, 'shift_x': 1},
        {'arm': (30, 24), 'sword_ang': -18, 'sword_len': 18, 'swing': 2, 'shift_x': 2},
        {'arm': (32, 30), 'sword_ang': 32, 'sword_len': 18, 'swing': 3, 'shift_x': 3},
    ]
    sheet([draw_qin({**p, 'cape': True}) for p in ch], 'qin_charge.png')

    # 上挑/升龙：下蹲 -> 撩剑冲天
    la = [
        {'hem_drop': 4, 'swing': -2, 'arm': (28, 33), 'sword_ang': 45, 'sword_len': 16, 'shift_x': -1},
        {'bob': -1, 'swing': 0, 'arm': (26, 16), 'sword_ang': -105, 'sword_len': 17},
        {'bob': -1, 'swing': 1, 'arm': (30, 12), 'sword_ang': -82, 'sword_len': 17},
        {'arm': (30, 14), 'sword_ang': -70, 'sword_len': 17, 'swing': 1},
        {'arm': (30, 27), 'sword_ang': 72, 'sword_len': 15},
    ]
    sheet([draw_qin({**p, 'cape': True}) for p in la], 'qin_launcher.png')

    # 坠星下砸：收身 -> 剑朝下垂冲 -> 砸地蹲伏
    sl = [
        {'bob': -1, 'swing': -2, 'arm': (26, 27), 'sword_ang': 55, 'sword_len': 15},
        {'swing': 2, 'arm': (27, 32), 'sword_ang': 82, 'sword_len': 16, 'hem_hw': 15},
        {'swing': 2, 'arm': (27, 33), 'sword_ang': 86, 'sword_len': 16, 'hem_hw': 15},
        {'hem_drop': 6, 'swing': 4, 'hem_hw': 16, 'arm': (33, 36), 'sword_ang': 62, 'sword_len': 12},
    ]
    sheet([draw_qin({**p, 'cape': True}) for p in sl], 'qin_slam.png')

    # 冲刺斩：大幅前倾突刺
    da = [
        {'swing': 2, 'shift_x': 1, 'arm': (26, 24), 'sword_ang': -10, 'sword_len': 17},
        {'swing': 5, 'shift_x': 4, 'arm': (33, 26), 'sword_ang': -4, 'sword_len': 20},
        {'swing': 5, 'shift_x': 4, 'arm': (33, 27), 'sword_ang': 12, 'sword_len': 20},
        {'swing': 1, 'arm': (30, 27), 'sword_ang': 72, 'sword_len': 15},
    ]
    sheet([draw_qin({**p, 'cape': True}) for p in da], 'qin_dashatk.png')

    # 龙威：双臂展开震喝 + 举剑指天
    ro = [
        {'bob': 1, 'arm': (30, 30), 'sword_ang': 80, 'sword_len': 12, 'arm2': (17, 30), 'swing': -1},
        {'bob': -1, 'arm': (32, 16), 'sword_ang': -80, 'sword_len': 15, 'arm2': (16, 18), 'hem_hw': 15},
        {'bob': -1, 'arm': (32, 14), 'sword_ang': -82, 'sword_len': 15, 'arm2': (15, 17), 'hem_hw': 15, 'shift_x': -1},
        {'bob': -1, 'arm': (33, 14), 'sword_ang': -75, 'sword_len': 15, 'arm2': (14, 16), 'hem_hw': 15, 'shift_x': 1},
    ]
    sheet([draw_qin({**p, 'cape': True}) for p in ro], 'qin_roar.png')

    # hurt：后仰
    sheet([draw_qin({'bob': 0, 'cape': True, 'swing': -4, 'shift_x': -2,
                     'arm': (20, 20), 'sword_ang': -30, 'leg_phase': 0})],
          'qin_hurt.png')

    # death：踉跄 -> 跪倒 -> 伏地
    f1 = draw_qin({'bob': 2, 'cape': True, 'swing': -5, 'shift_x': -2,
                   'arm': (20, 24), 'sword_ang': 100})
    img2 = new_frame(); d2 = ImageDraw.Draw(img2)
    for y in range(28, 42):
        t = (y - 28) / 14
        hline(d2, 12 - t * 4, 34 + t * 3, y, C['robe'])
    hline(d2, 8, 37, 41, C['gold_dk'])
    rect(d2, 16, 20, 24, 27, C['skin']); rect(d2, 16, 20, 24, 21, C['hair'])
    rect(d2, 10, 16, 26, 19, C['hair']); hline(d2, 10, 26, 16, C['gold_dk'])
    for j in range(3):
        px(d2, 12, 20 + j * 2, C['gold_dk']); px(d2, 24, 20 + j * 2, C['gold_dk'])
    img3 = new_frame(); d3 = ImageDraw.Draw(img3)
    for y in range(34, 41):
        hline(d3, 10, 38, y, C['robe'])
    hline(d3, 10, 38, 40, C['gold_dk'])
    rect(d3, 34, 32, 41, 37, C['skin']); rect(d3, 34, 32, 41, 33, C['hair'])
    rect(d3, 38, 28, 45, 31, C['hair']); hline(d3, 38, 45, 28, C['gold_dk'])
    thick_line(d3, 12, 33, 30, 30, C['steel'], 2)   # 太阿剑脱手落地
    px(d3, 31, 30, C['bronze'])
    sheet([f1, img2, img3], 'qin_death.png')


# ================= 六国士兵 =================

def sold_helm(d, cx, y):
    """青铜胄 + 红缨"""
    rect(d, cx - 5, y, cx + 5, y + 4, C['helm'])
    hline(d, cx - 5, cx + 5, y, C['helm_dk'])
    hline(d, cx - 6, cx + 6, y + 4, C['helm_dk'])   # 盔檐
    px(d, cx, y - 1, C['plume']); px(d, cx, y - 2, C['plume'])  # 缨
    vline(d, cx - 5, y + 4, y + 7, C['helm_dk'])    # 护颊
    vline(d, cx + 5, y + 4, y + 7, C['helm_dk'])


def sold_head(d, cx, y):
    rect(d, cx - 3, y, cx + 3, y + 6, C['skin'])
    px(d, cx + 2, y + 3, C['hair'])
    rect(d, cx - 3, y + 5, cx + 3, y + 6, C['skin_dk'])


def sold_body(d, cx, top, leg_y):
    """皮甲：札甲横向甲片"""
    for y in range(top, leg_y):
        hw = 6 if y < top + 8 else 7
        hline(d, cx - hw, cx + hw, y, C['leather'])
        px(d, cx - hw, y, C['leather_dk'])
        px(d, cx + hw, y, C['leather_hi'])
        if (y - top) % 3 == 2:
            for x in range(cx - hw, cx + hw + 1, 2):
                px(d, x, y, C['leather_dk'])   # 甲片缝线
    hline(d, cx - 7, cx + 7, leg_y - 1, C['red'])  # 战裙红缘


def sold_legs(d, cx, y0, y1, phase):
    off = phase * 2
    vline(d, cx - 3 + off, y0, y1 - abs(off), C['pants'])
    vline(d, cx - 2 + off, y0, y1 - abs(off), C['pants'])
    vline(d, cx + 3 - off, y0, y1, C['pants'])
    vline(d, cx + 4 - off, y0, y1, C['pants'])
    rect(d, cx - 4 + off, y1 - abs(off), cx - 1 + off, y1 + 1, C['boot'])
    rect(d, cx + 2 - off, y1, cx + 5 - off, y1 + 1, C['boot'])


def spear(d, hx, hy, ang_deg, length=34):
    a = math.radians(ang_deg)
    dx, dy = math.cos(a), math.sin(a)
    bx, by = hx - dx * 6, hy - dy * 6
    ex, ey = hx + dx * length, hy + dy * length
    thick_line(d, bx, by, ex, ey, C['wood'], 2)
    tx, ty = ex + dx * 5, ey + dy * 5
    d.polygon([(ex, ey), (ex - dy * 2, ey + dx * 2), (tx, ty)], fill=C['steel'])
    px(d, tx, ty, C['steel_hi'])
    px(d, hx - dx * 7, hy - dy * 7, C['red'])  # 红缨


def draw_soldier(pose):
    img = new_frame()
    d = ImageDraw.Draw(img)
    bob = pose.get('bob', 0)
    cx = 24
    hy = 8 + bob
    sold_helm(d, cx, hy)
    sold_head(d, cx, hy + 6)
    top = hy + 14
    leg_y = top + 16
    sold_body(d, cx, top, leg_y)
    sold_legs(d, cx, leg_y, 42, pose.get('phase', 0))
    hx, hy2 = pose.get('arm', (30, 28))
    # 手臂
    thick_line(d, cx + 4, top + 3, hx, hy2, C['leather_hi'], 3)
    px(d, hx, hy2, C['skin']); px(d, hx + 1, hy2, C['skin'])
    spear(d, hx, hy2, pose.get('spear_ang', -80), pose.get('spear_len', 30))
    return img


def gen_soldier():
    sheet([draw_soldier({'bob': b}) for b in (0, 0, -1, 0)], 'soldier_idle.png')
    frames = []
    for i, p in enumerate([1, 0, -1, 0, 1, 0, -1, 0]):
        frames.append(draw_soldier({'phase': p, 'bob': -1 if i % 2 else 0}))
    sheet(frames, 'soldier_walk.png')
    a = [
        {'arm': (16, 26), 'spear_ang': -15, 'spear_len': 20},   # 收矛
        {'arm': (16, 26), 'spear_ang': -10, 'spear_len': 24},   # 蓄
        {'arm': (30, 27), 'spear_ang': 0, 'spear_len': 38},     # 突刺
        {'arm': (30, 27), 'spear_ang': 0, 'spear_len': 38},
        {'arm': (26, 27), 'spear_ang': -40, 'spear_len': 30},   # 收
    ]
    sheet([draw_soldier(p) for p in a], 'soldier_attack.png')
    sheet([draw_soldier({'bob': 1, 'arm': (18, 24), 'spear_ang': -60})], 'soldier_hurt.png')
    # death：仰倒
    img1 = draw_soldier({'bob': 2, 'arm': (16, 20), 'spear_ang': -45, 'spear_len': 24})
    img2 = new_frame(); d2 = ImageDraw.Draw(img2)
    for y in range(34, 42):
        hline(d2, 10, 36, y, C['leather'])
    hline(d2, 10, 36, 41, C['red'])
    rect(d2, 30, 30, 38, 35, C['helm']); hline(d2, 30, 38, 30, C['helm_dk'])
    px(d2, 34, 29, C['plume'])
    thick_line(d2, 8, 44, 40, 44, C['wood'], 2)
    d2.polygon([(40, 44), (44, 42), (44, 46)], fill=C['steel'])
    sheet([img1, img2], 'soldier_death.png')


# ================= 不死药灵（Boss）=================
# 胖黄灵兽：蛋形身体 + 浅肚皮 + 绿瞳 + 棕褐短肢

BY = {
    'body':    (255, 205, 66, 255),
    'body_dk': (232, 168, 40, 255),
    'body_hi': (255, 232, 130, 255),
    'belly':   (255, 240, 190, 255),
    'belly_dk':(238, 208, 140, 255),
    'eye':     (96, 200, 140, 255),
    'pupil':   (20, 30, 24, 255),
    'glint':   (255, 255, 255, 255),
    'mouth':   (120, 70, 30, 255),
    'limb':    (150, 96, 40, 255),
}

# 身体剖面 (t, 半宽比例)：顶窄 -> 中下鼓 -> 底收
_BOSS_PROF = [(0.0, 0.40), (0.10, 0.62), (0.24, 0.84), (0.38, 1.0),
              (0.58, 1.0), (0.76, 0.90), (0.90, 0.70), (1.0, 0.48)]


def _prof(t):
    for i in range(len(_BOSS_PROF) - 1):
        t0, w0 = _BOSS_PROF[i]; t1, w1 = _BOSS_PROF[i + 1]
        if t <= t1:
            return w0 + (w1 - w0) * (t - t0) / max(1e-6, t1 - t0)
    return _BOSS_PROF[-1][1]


def draw_boss(pose):
    """pose: h=体高 sx=横宽 lean=上端偏移 shift_x drop arm('hug'/'swing'/'out') eye('open'/'closed'/'x') mouth('line'/'open')"""
    img = new_frame()
    d = ImageDraw.Draw(img)
    cx = 24 + pose.get('shift_x', 0)
    base = 44 + pose.get('drop', 0)
    h = pose.get('h', 40)
    top = base - h
    sx = pose.get('sx', 1.0)
    lean = pose.get('lean', 0)

    for yy in range(round(top), round(base) + 1):
        t = (yy - top) / max(1, h)
        hwf = _prof(t) * 16.5 * sx
        lx = cx + lean * t
        hline(d, lx - hwf, lx + hwf, yy, BY['body'])
        px(d, lx - hwf, yy, BY['body_dk'])
        px(d, lx + hwf, yy, BY['body_hi'])
        # 肚皮：中下段浅色椭圆斑
        if 0.42 < t < 0.95:
            bw = hwf * 0.70
            hline(d, lx + 2 - bw, lx + 2 + bw, yy, BY['belly'])
        if 0.50 < t < 0.95:
            px(d, lx + 2 - hwf * 0.70, yy, BY['belly_dk'])

    ey = top + h * 0.18
    ex = cx + 7 * sx + lean * 0.18
    eye_mode = pose.get('eye', 'open')
    if eye_mode == 'open':
        rect(d, ex - 2, ey - 2, ex + 1, ey + 1, BY['eye'])
        rect(d, ex - 1, ey - 2, ex + 1, ey + 1, BY['pupil'])
        px(d, ex + 1, ey - 2, BY['glint'])
        px(d, ex - 6, ey - 1, BY['pupil'])   # 另一只小眼(远景)
    elif eye_mode == 'closed':
        hline(d, ex - 2, ex + 2, ey, BY['pupil'])
    else:  # 'x' 晕眼
        d.line([ex - 2, ey - 2, ex + 2, ey + 2], fill=BY['pupil'])
        d.line([ex - 2, ey + 2, ex + 2, ey - 2], fill=BY['pupil'])

    my = ey + 5
    if pose.get('mouth') == 'open':
        rect(d, ex - 1, my, ex + 3, my + 3, BY['mouth'])
        px(d, ex + 1, my + 1, (200, 80, 70, 255))
    else:
        hline(d, ex - 1, ex + 3, my, BY['mouth'])

    # 手臂
    arm = pose.get('arm', 'hug')
    ay = top + h * 0.55
    if arm == 'hug':      # 环抱肚皮
        rect(d, cx - 13 * sx + lean * .5, ay, cx - 10 * sx + lean * .5, ay + 6, BY['limb'])
        hline(d, cx - 13 * sx + lean * .5, cx - 10 * sx + lean * .5, ay, BY['body_dk'])   # 上缘阴影
        rect(d, cx + 10 * sx + lean * .5, ay + 2, cx + 13 * sx + lean * .5, ay + 7, BY['limb'])
        hline(d, cx + 10 * sx + lean * .5, cx + 13 * sx + lean * .5, ay + 2, BY['body_dk'])
    elif arm == 'swing':  # 横扫：右臂前伸拖影
        for i in range(3):
            rect(d, cx + 12 * sx + i * 4, ay - 2 + i, cx + 15 * sx + i * 4, ay + 2 + i, BY['body_dk'])
        rect(d, cx - 14 * sx + lean * .5, ay + 4, cx - 11 * sx + lean * .5, ay + 8, BY['body_dk'])
    else:                 # 'out' 张开
        rect(d, cx - 17 * sx + lean * .5, ay - 2, cx - 13 * sx + lean * .5, ay + 2, BY['body_dk'])
        rect(d, cx + 13 * sx + lean * .5, ay - 2, cx + 17 * sx + lean * .5, ay + 2, BY['body_dk'])

    # 脚（棕褐短足）
    ph = pose.get('phase', 0)
    rect(d, cx - 9 + ph * 2, base - 2, cx - 3 + ph * 2, base + 1, BY['limb'])
    rect(d, cx + 2 - ph * 2, base - 2, cx + 8 - ph * 2, base + 1, BY['limb'])
    return img


def gen_boss():
    sheet([draw_boss({'h': 40 + b, 'arm': 'hug'}) for b in (0, -1, 0, 1)], 'boss_idle.png')
    sheet([draw_boss({'lean': l, 'phase': p, 'arm': 'hug'})
           for l, p in [(3, 1), (1, 0), (-3, -1), (-1, 0)]], 'boss_walk.png')
    sheet([draw_boss({'lean': -5, 'arm': 'hug'}),                       # 蓄力后仰
           draw_boss({'lean': 2, 'arm': 'swing', 'sx': 1.05}),          # 挥出
           draw_boss({'lean': 5, 'arm': 'swing', 'sx': 1.08}),          # 挥过
           draw_boss({'lean': 0, 'arm': 'hug'})], 'boss_sweep.png')
    sheet([draw_boss({'h': 30, 'sx': 1.3, 'arm': 'hug', 'eye': 'closed'}),  # 下蹲蓄力
           draw_boss({'h': 42, 'sx': 0.95, 'arm': 'out'}),                  # 腾起
           draw_boss({'h': 28, 'sx': 1.45, 'arm': 'out', 'mouth': 'open'})],# 砸扁
          'boss_slam.png')
    sheet([draw_boss({'h': 32, 'sx': 1.25, 'arm': 'hug', 'eye': 'closed', 'lean': 2}),
           draw_boss({'h': 32, 'sx': 1.25, 'arm': 'hug', 'eye': 'closed', 'lean': -2})],
          'boss_charge.png')
    sheet([draw_boss({'sx': 1.12, 'h': 43, 'arm': 'out', 'mouth': 'open'}),
           draw_boss({'sx': 1.2, 'h': 44, 'arm': 'out', 'mouth': 'open'}),
           draw_boss({'sx': 1.12, 'h': 43, 'arm': 'out', 'mouth': 'open'})],
          'boss_roar.png')
    sheet([draw_boss({'lean': -6, 'sx': 1.06, 'arm': 'hug', 'mouth': 'open'}),  # 后仰吸气
           draw_boss({'lean': 4, 'sx': 0.94, 'arm': 'out', 'mouth': 'open'}),   # 前倾吐出
           draw_boss({'lean': 0, 'arm': 'hug'})], 'boss_spit.png')
    sheet([draw_boss({'lean': -4, 'sx': 1.06, 'eye': 'closed', 'arm': 'hug'})], 'boss_hurt.png')
    sheet([draw_boss({'h': 36, 'sx': 1.1, 'eye': 'x', 'mouth': 'open'}),    # 泄气
           draw_boss({'h': 24, 'sx': 1.4, 'eye': 'x', 'mouth': 'open'}),
           draw_boss({'h': 12, 'sx': 1.7, 'eye': 'x', 'mouth': 'open'})],   # 瘪了
          'boss_death.png')


def gen_boss_dart():
    """Boss 吐出的灵丹弹：16x16 金红丹丸 + 光晕"""
    img = Image.new('RGBA', (16, 16), TRAN)
    d = ImageDraw.Draw(img)
    for r, a in [(7, 36), (6, 64), (5, 100)]:          # 外发光晕
        d.ellipse([8 - r, 8 - r, 8 + r, 8 + r], fill=(255, 110, 50, a))
    d.ellipse([3, 3, 13, 13], fill=(190, 55, 35, 255))   # 丹体
    d.ellipse([4, 3, 12, 11], fill=(235, 95, 50, 255))
    d.ellipse([5, 4, 9, 7], fill=(255, 210, 130, 255))   # 高光
    d.point([(8, 9), (9, 10)], fill=(120, 30, 20, 255))
    img.save(os.path.join(OUT, 'boss_dart.png'))
    print('生成 boss_dart.png')


# ================= 图块 & 背景 & FX =================

def gen_tiles():
    """16x16 tiles: 0空 1地面顶 2地面填 3平台 4砖墙 5宫柱(装饰)"""
    T = 16
    img = Image.new('RGBA', (T * 6, T), TRAN)
    d = ImageDraw.Draw(img)

    def tile(i, fn):
        ox = i * T
        class W:
            def point(s, x, y, c): d.point((ox + x, y), fill=c)
            def rect(s, x0, y0, x1, y1, c): d.rectangle([ox + x0, y0, ox + x1, y1], fill=c)
            def hline(s, x0, x1, y, c): d.line([ox + x0, y, ox + x1, y], fill=c)
        fn(W())

    stone = (58, 58, 74, 255); stone_dk = (40, 40, 54, 255); stone_hi = (86, 86, 108, 255)
    gold_l = (176, 132, 40, 255)

    def floor_top(w):
        w.rect(0, 0, 15, 15, stone_dk)
        w.rect(0, 0, 15, 5, stone)
        w.hline(0, 15, 0, stone_hi)
        w.hline(0, 15, 1, stone_hi)
        w.point(4, 8, stone); w.point(11, 10, stone); w.point(7, 12, stone)
        w.hline(0, 15, 15, stone_dk)

    def floor_fill(w):
        w.rect(0, 0, 15, 15, stone_dk)
        w.point(3, 4, (48, 48, 62, 255)); w.point(9, 9, (48, 48, 62, 255))
        w.point(12, 3, (48, 48, 62, 255)); w.point(6, 13, (48, 48, 62, 255))
        w.hline(0, 15, 15, (30, 30, 42, 255))

    def platform(w):
        w.rect(0, 0, 15, 7, (112, 82, 46, 255))
        w.hline(0, 15, 0, (152, 116, 66, 255))
        w.hline(0, 15, 1, (132, 100, 56, 255))
        w.hline(0, 15, 7, (70, 50, 28, 255))
        w.point(0, 2, (70, 50, 28, 255)); w.point(15, 2, (70, 50, 28, 255))
        w.rect(3, 8, 4, 10, (70, 50, 28, 255)); w.rect(11, 8, 12, 10, (70, 50, 28, 255))

    def brick(w):
        w.rect(0, 0, 15, 15, (74, 46, 40, 255))
        w.hline(0, 15, 5, (52, 32, 28, 255)); w.hline(0, 15, 11, (52, 32, 28, 255))
        w.hline(0, 15, 15, (52, 32, 28, 255))
        for x in (7, 8):
            w.point(x, 2, (52, 32, 28, 255)); w.point(x, 3, (52, 32, 28, 255))
            w.point(x, 4, (52, 32, 28, 255))
        for x in (3, 4, 11, 12):
            w.point(x, 8, (52, 32, 28, 255)); w.point(x, 9, (52, 32, 28, 255))
        w.point(1, 1, (96, 62, 52, 255)); w.point(10, 7, (96, 62, 52, 255))

    def pillar(w):
        w.rect(4, 0, 11, 15, C['red'])
        w.rect(4, 0, 5, 15, C['red_hi'])
        w.rect(10, 0, 11, 15, (110, 18, 18, 255))
        w.hline(2, 13, 0, C['gold']); w.hline(2, 13, 15, C['gold'])
        w.point(3, 0, C['gold_dk']); w.point(12, 0, C['gold_dk'])

    def lantern(w):
        w.point(7, 0, (90, 90, 110, 255)); w.point(8, 0, (90, 90, 110, 255))
        w.hline(6, 9, 1, (90, 90, 110, 255))
        w.rect(4, 3, 11, 10, (200, 60, 40, 255))
        w.rect(5, 4, 10, 9, (240, 120, 60, 255))
        w.rect(6, 5, 9, 8, (250, 200, 110, 255))
        w.hline(4, 11, 2, C['gold_dk']); w.hline(4, 11, 11, C['gold_dk'])
        w.point(7, 12, C['gold']); w.point(8, 12, C['gold'])
        w.point(7, 13, C['red']); w.point(8, 13, C['red'])

    tile(0, floor_top); tile(1, floor_fill); tile(2, platform)
    tile(3, brick); tile(4, pillar); tile(5, lantern)
    img.save(os.path.join(OUT, 'tiles.png'))
    print('生成 tiles.png')


def gen_bg():
    """远景夜空 + 宫阙剪影（视差层）"""
    W2, H2 = 480, 270
    img = Image.new('RGBA', (W2, H2))
    d = ImageDraw.Draw(img)
    for y in range(H2):  # 夜空渐变
        t = y / H2
        r = int(10 + 16 * t); g = int(12 + 14 * t); b = int(30 + 30 * t)
        d.line([(0, y), (W2, y)], fill=(r, g, b, 255))
    # 星（局部 RNG，不污染全局随机状态）
    rng = random.Random(7)
    for _ in range(70):
        x, y = rng.randrange(W2), rng.randrange(140)
        b = rng.choice([(200, 200, 220), (160, 160, 190), (120, 120, 160)])
        d.point((x, y), fill=(*b, 255))
    # 月
    mx, my, mr = 380, 52, 22
    for y in range(my - mr, my + mr + 1):
        for x in range(mx - mr, mx + mr + 1):
            dd = math.hypot(x - mx, y - my)
            if dd <= mr:
                shade = int(240 - dd * 1.6)
                d.point((x, y), fill=(shade, shade - 10, shade - 60, 255))
            elif dd <= mr + 6:
                a = int(40 * (1 - (dd - mr) / 6))
                d.point((x, y), fill=(240, 230, 180, a))
    # 远宫殿剪影
    def roof(d, cx, base_y, w, tiers, c):
        for t in range(tiers):
            tw = w - t * (w * 0.28)
            ty = base_y - t * 10
            d.polygon([(cx - tw / 2, ty), (cx + tw / 2, ty),
                       (cx + tw / 2 - 6, ty - 5), (cx - tw / 2 + 6, ty - 5)], fill=c)
            d.line([(cx - tw / 2 - 4, ty - 2), (cx - tw / 2, ty)], fill=c)
            d.line([(cx + tw / 2 + 4, ty - 2), (cx + tw / 2, ty)], fill=c)
        d.rectangle([cx - w / 3, base_y, cx + w / 3, base_y + 40], fill=c)
    sil = (16, 18, 34, 255)
    roof(d, 90, 190, 120, 2, sil)
    roof(d, 250, 175, 150, 3, sil)
    roof(d, 430, 195, 110, 2, sil)
    d.rectangle([0, 230, W2, H2], fill=(14, 15, 28, 255))
    img.save(os.path.join(OUT, 'bg_far.png'))
    print('生成 bg_far.png')

    # 中层剪影带（透明底，视差近层）
    img2 = Image.new('RGBA', (W2, 96), TRAN)
    d2 = ImageDraw.Draw(img2)
    sil2 = (24, 22, 40, 255)
    def roof2(cx, base_y, w, tiers):
        for t in range(tiers):
            tw = w - t * (w * 0.3)
            ty = base_y - t * 8
            d2.polygon([(cx - tw / 2, ty), (cx + tw / 2, ty),
                        (cx + tw / 2 - 5, ty - 4), (cx - tw / 2 + 5, ty - 4)], fill=sil2)
            d2.line([(cx - tw / 2 - 3, ty - 1), (cx - tw / 2, ty)], fill=sil2)
            d2.line([(cx + tw / 2 + 3, ty - 1), (cx + tw / 2, ty)], fill=sil2)
        d2.rectangle([cx - w / 3, base_y, cx + w / 3, 96], fill=sil2)
    roof2(60, 60, 90, 2)
    roof2(180, 50, 120, 3)
    roof2(320, 66, 80, 2)
    roof2(430, 55, 100, 2)
    d2.rectangle([0, 78, W2, 96], fill=sil2)
    img2.save(os.path.join(OUT, 'bg_mid.png'))
    print('生成 bg_mid.png')


def gen_fx():
    # 剑光弧：4帧
    img = Image.new('RGBA', (FW * 4, FH), TRAN)
    d = ImageDraw.Draw(img)
    arc_frames = [(30, 60, 18), (15, 105, 24), (0, 150, 29), (0, 170, 29)]
    for i, (a0, a1, r) in enumerate(arc_frames):
        cx0 = i * FW + 10; cy0 = 30
        al = 230 - i * 50
        for ang in range(a0, a1, 2):
            for rr in range(r - 5, r + 1):
                x = cx0 + rr * math.cos(math.radians(ang - 90))
                y = cy0 + rr * math.sin(math.radians(ang - 90)) * 0.8
                col = (246, 205, 90, al) if rr < r - 2 else (255, 250, 230, al)
                if i * FW <= x < (i + 1) * FW and 0 <= y < FH:
                    d.point((x, y), fill=col)
    img.save(os.path.join(OUT, 'fx_slash.png'))
    print('生成 fx_slash.png')

    # 命中爆点：4帧
    img = Image.new('RGBA', (24 * 4, 24), TRAN)
    d = ImageDraw.Draw(img)
    for i in range(4):
        cx = i * 24 + 12; cy = 12
        r = [4, 8, 10, 9][i]
        al = [255, 255, 200, 120][i]
        for ang in range(0, 360, 45):
            for rr in range(2, r):
                x = cx + rr * math.cos(math.radians(ang))
                y = cy + rr * math.sin(math.radians(ang))
                d.point((x, y), fill=(255, 230, 140, al) if rr < r - 2 else (255, 140, 60, al))
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=(255, 255, 255, al))
    img.save(os.path.join(OUT, 'fx_hit.png'))
    print('生成 fx_hit.png')

    # 下砸冲击波：贴地扩散的金色涟漪（4帧）
    img = Image.new('RGBA', (FW * 4, FH), TRAN)
    d = ImageDraw.Draw(img)
    for i, (rx, ry, al) in enumerate([(10, 5, 245), (20, 8, 200), (33, 11, 150), (45, 13, 85)]):
        cx0, cy0 = i * FW + 24, 40
        for a in range(0, 360, 3):
            x = cx0 + rx * math.cos(math.radians(a))
            y = cy0 + ry * math.sin(math.radians(a)) * 0.45
            col = (255, 250, 230, al) if a % 12 < 3 else (246, 205, 90, al)
            if 0 <= x < (i + 1) * FW and x >= i * FW and 0 <= y < FH:
                d.point((x, y), fill=col)
    img.save(os.path.join(OUT, 'fx_wave.png'))
    print('生成 fx_wave.png')

    # 蓄力光环：绕身旋转的金色光点（3帧循环）
    img = Image.new('RGBA', (FW * 3, FH), TRAN)
    d = ImageDraw.Draw(img)
    for i in range(3):
        cx0, cy0 = i * FW + 24, 26
        for j in range(10):
            a = math.radians(j * 36 + i * 24)
            x = cx0 + 16 * math.cos(a)
            y = cy0 + 11 * math.sin(a)
            col = (255, 250, 230, 230) if j % 3 == 0 else (246, 205, 90, 200)
            d.point((x, y), fill=col)
            if j % 3 == 0:
                d.point((x, y - 1), fill=col)
        for j in range(4):  # 上升光尘
            d.point((cx0 + (j - 1.5) * 7, cy0 - 14 - i * 2 - j % 3 * 2),
                    fill=(246, 205, 90, 140))
    img.save(os.path.join(OUT, 'fx_aura.png'))
    print('生成 fx_aura.png')

    # 龙威金环：扩散圆环 96x96（4帧）
    img = Image.new('RGBA', (96 * 4, 96), TRAN)
    d = ImageDraw.Draw(img)
    for i, (r, al) in enumerate([(12, 240), (24, 200), (36, 150), (45, 80)]):
        cx0, cy0 = i * 96 + 48, 48
        for a in range(0, 360, 1):
            for dr in range(3):
                x = cx0 + (r + dr - 1) * math.cos(math.radians(a))
                y = cy0 + (r + dr - 1) * math.sin(math.radians(a))
                col = (255, 250, 230, al) if dr == 1 else (246, 205, 90, al)
                d.point((x, y), fill=col)
    img.save(os.path.join(OUT, 'fx_ring.png'))
    print('生成 fx_ring.png')

    # 火花粒子（8x8 亮点带光晕）
    img = Image.new('RGBA', (8, 8), TRAN)
    d = ImageDraw.Draw(img)
    for y in range(8):
        for x in range(8):
            dd = math.hypot(x - 3.5, y - 3.5)
            if dd <= 1.5:
                d.point((x, y), fill=(255, 255, 240, 255))
            elif dd <= 3:
                d.point((x, y), fill=(255, 210, 90, int(220 * (1 - (dd - 1.5) / 1.5))))
    img.save(os.path.join(OUT, 'fx_spark.png'))
    print('生成 fx_spark.png')

    # 仙丹（回血道具）
    img = Image.new('RGBA', (16, 16), TRAN)
    d = ImageDraw.Draw(img)
    for y in range(16):
        for x in range(16):
            dd = math.hypot(x - 7.5, y - 7.5)
            if dd <= 5:
                shade = int(255 - dd * 12)
                d.point((x, y), fill=(shade, int(shade * 0.78), 60, 255))
            elif dd <= 7:
                d.point((x, y), fill=(255, 220, 120, int(60 * (1 - (dd - 5) / 2))))
    d.point((6, 5), fill=(255, 255, 240, 255)); d.point((5, 6), fill=(255, 255, 240, 255))
    img.save(os.path.join(OUT, 'item_pill.png'))
    print('生成 item_pill.png')

    # 清版过关地砖（32x32 石板，顶部略深营造透视）
    img = Image.new('RGBA', (32, 32), TRAN)
    d = ImageDraw.Draw(img)
    base = (58, 52, 66)
    line = (40, 36, 48)
    for y in range(32):
        for x in range(32):
            v = int(10 * (y / 31))            # 越靠下（近）越亮
            d.point((x, y), fill=(base[0] + v, base[1] + v, base[2] + v, 255))
    for x in (0, 15, 31):                     # 竖缝
        for y in range(32):
            d.point((x, y), fill=(*line, 255))
    for y in (0, 15, 31):                     # 横缝
        for x in range(32):
            d.point((x, y), fill=(*line, 255))
    rng = random.Random(7)                    # 局部 RNG，确定性噪点
    for _ in range(24):                       # 噪点磨损
        x, y = rng.randrange(32), rng.randrange(32)
        d.point((x, y), fill=(base[0] - 10, base[1] - 10, base[2] - 10, 255))
    img.save(os.path.join(OUT, 'belt_floor.png'))
    print('生成 belt_floor.png')

    # 脚影（24x8 暗色椭圆）
    img = Image.new('RGBA', (24, 8), TRAN)
    d = ImageDraw.Draw(img)
    for y in range(8):
        for x in range(24):
            dx, dy = (x - 11.5) / 11.5, (y - 3.5) / 3.5
            dd = dx * dx + dy * dy
            if dd <= 1:
                d.point((x, y), fill=(0, 0, 0, int(110 * (1 - dd))))
    img.save(os.path.join(OUT, 'fx_shadow.png'))
    print('生成 fx_shadow.png')


if __name__ == '__main__':
    gen_qin()
    gen_soldier()
    gen_boss()
    gen_boss_dart()
    gen_tiles()
    gen_bg()
    gen_fx()
    print('\n全部素材已生成到 assets/sprites/')
