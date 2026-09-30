"""探测 tdsheep 镜像站上「SWF 之外」的素材：XML 配置 / 静态图 / 音频 / 页面。

背景：目录列表被服务端禁掉（403），只能按候选路径一个个 HEAD。
基准目录是 https://tdsheep.tdsheepvillage.com/static/images/swf/（客户端根），
所以想探 /static/images/ 下的东西要写 '../xxx'，想探网站根就写绝对路径 '/xxx'。

用法：
  python tools/probe_mirror.py --text      # 抓页面/XML 只打印开头，不写盘
  python tools/probe_mirror.py --list      # 只列出「线上有、本地没有」的候选
  python tools/probe_mirror.py             # 下载命中的候选（本地已有则跳过）
  python tools/probe_mirror.py --force     # 全部重下
"""
import concurrent.futures as cf
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = 'https://tdsheep.tdsheepvillage.com/static/images/swf/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tdsheep_swf', 'extra')
UA = 'Mozilla/5.0 (compatible; tdsheep-asset-archiver/1.0)'


# ---------------------------------------------------------------- 候选清单

def xml_candidates():
    """xmlFile/ 下可能存在的配置。"""
    names = [
        'initXML', 'config', 'string_cn', 'string_tw', 'string_en',
        'guide', 'dream', 'loadingAD', 'loading', 'ad', 'adv',
        'activity', 'achieve', 'achievement', 'task', 'item', 'skill',
        'tower', 'wolf', 'wolfs', 'map', 'level', 'wave', 'shop',
        'sound', 'music', 'version', 'update', 'notice', 'gift',
        'server', 'boss', 'gem', 'daily', 'sign', 'mine', 'arena',
        'help', 'tips', 'error', 'pay', 'vip',
    ]
    return ['xmlFile/%s.xml' % n for n in names]


def swf_candidates():
    """还没抓过的 SWF：加载广告、gameImg、以及主包里内嵌引用到的资源名。"""
    out = []
    for i in range(1, 13):
        out.append('loadingAD_%03d.swf' % i)
    out += ['loadingAD.swf', 'loading.swf']
    for n in ['inviteFriends_tw2', 'ktyellow', 'logo', 'banner',
              'adv1', 'adv2', 'ad1', 'ad2']:
        out.append('gameImg/%s.swf' % n)
    for n in ['tower.node', 'help', 'tips', 'loading', 'loadingAD', 'ad',
              'string_cn', 'Font_num', 'Font_num_HYHHJ', 'sound', 'music',
              'dynamic/loadingAD_001', 'dynamic/loadingAD_002',
              'dynamic/loadingAD_003', 'dynamic/adv1', 'dynamic/adv2',
              # 大厅/世界地图的季节与版本变体（怀旧服有雪季插画，猜命名）
              'dynamic/TheStronghold2', 'dynamic/TheWorld2',
              'dynamic/TheStronghold_snow', 'dynamic/TheWorld_snow',
              'dynamic/TheStronghold_night', 'dynamic/TheStronghold_spring',
              'dynamic/TheStronghold_summer', 'dynamic/TheStronghold_autumn',
              'dynamic/TheStronghold_newyear', 'dynamic/TheStronghold_play',
              'dynamic/TheWorld2_1', 'dynamic/TheStronghold_tame2',
              'dynamic/TheStronghold_arena2',
              # 其它界面
              'skin', 'background', 'bg', 'hall', 'world', 'logo', 'star',
              'loadingAd', 'advertise', 'advert', 'banner', 'guide',
              'achieve', 'task', 'mail', 'notice', 'pay', 'shareui']:
        out.append('gameUI/%s.swf' % n)
    for n in ['TDSheep', 'loadingAD', 'game', 'index', 'main', 'TDSheepMain']:
        out.append('%s.swf' % n)
    return out


def image_candidates():
    """static/images/ 下的静态图（基准是 .../static/images/swf/，所以要 ../）。"""
    out = []
    for i in range(1, 41):
        out.append('../b_%02d.gif' % i)
        out.append('../b_%02d__.gif' % i)
    for i in range(1, 13):
        out.append('../dpicture%d.png' % i)
        out.append('../dpicture%d.jpg' % i)
    out += ['../nav.png', '../z_bottom.png', '../z_but.png',
            '../z_close.png', '../ztxbg.jpg', '../feed_weibo.jpg',
            '../first_install.jpg', '../first_install.png',
            '../loading.jpg', '../loading.png', '../loading.gif',
            '../logo.png', '../logo.gif', '../logo.jpg',
            '../bg.jpg', '../bg.png', '../background.jpg',
            '../index.jpg', '../main.jpg', '../default.jpg',
            './first_install.jpg']
    for n in ['logo', 'icon', 'bg', 'background', 'loading', 'load',
              'index', 'main', 'title', 'home', 'top', 'bottom', 'btn',
              'button', 'hd', 'head', 'ad', 'adv', 'banner', 'share']:
        for ext in ('.png', '.jpg', '.gif'):
            out.append('../%s%s' % (n, ext))
    for d in ('adv', 'ad', 'image', 'images', 'img', 'pic', 'scene', 'bg'):
        for n in ('1', '2', '3', 'logo', 'bg', 'loading'):
            for ext in ('.png', '.jpg'):
                out.append('../%s/%s%s' % (d, n, ext))
    return out


def audio_candidates(quick=False):
    """音频：镜像站上有没有留原作的音乐/音效。"""
    # 客户端 AS3 里 SoundManager 拼的是 '<base>/gameSound/<name>.mp3'，
    # 所以 gameSound/ 是最有希望的目录。
    if quick:
        dirs = ['gameSound/']
    else:
        dirs = ['gameSound/', '../gameSound/', '../sound/', '../snd/', '../audio/',
                '../music/', '../mp3/', '../../sound/', '../../audio/', '../../music/']
    # 下面这批名字是从 MainClass.swf 的 GlobalString 类里挖出来的
    # （SOUND_* / MUSIC_* 常量的字面值），比瞎猜靠谱得多。
    known = [
        # SOUND_*
        'sheep', 'teleport', 'wolfDie', 'wolfComing', 'passMap', 'miss',
        'smallFire', 'bigFire', 'magicFire', 'smallHit', 'bigHit', 'magicHit',
        'allAttack', 'lightning', 'burn', 'cold', 'poison', 'crit', 'beatBack',
        'buildUp', 'gem', 'button', 'countDown', 'gold', 'clamp', 'slow',
        'stab', 'blast', 'reward',
        # MUSIC_*
        'fight001', 'fight010', 'fight005', 'fight004', 'fight011', 'fight012',
    ]
    names = ['bg', 'bgm', 'bg1', 'bg2', 'bg3', 'bg4', 'main', 'login', 'hall',
             'village', 'battle', 'fight', 'fight1', 'fight2', 'map', 'map1',
             'map2', 'world', 'world1', 'theme', 'song', 'music', 'm1', 'm2',
             'm3', 'm4', 'click', 'btn', 'button', 'build', 'sell', 'buildTower',
             'upgrade', 'shoot', 'hit', 'boom', 'explode', 'win', 'lose', 'fail',
             'wolf', 'howl', 'laugh', 'loading', 'start', 'over', 'danger',
             'boss', 'bossCome', 'coin', 'error', 'newbie', 'guide', 'dream']
    names = known + [n for n in names if n not in known]
    if quick:
        names = known
    exts = ['.mp3', '.ogg', '.m4a', '.wav']
    out = []
    for d in dirs:
        for n in names:
            for e in exts:
                out.append(d + n + e)
    return out


def page_candidates():
    """站点页面 / 别的目录，摸清结构（只用于 --text）。"""
    return ['/robots.txt', '/crossdomain.xml', '/', '/index.html',
            '/index.php', '/game.html', '/static/', '/static/images/']


def candidates(all_=False, group=None, quick=False):
    out = {}
    if group in (None, 'xml', 'swf', 'image'):
        if group in (None, 'xml'):
            for c in xml_candidates():
                out.setdefault(c, 'xml')
        if group in (None, 'swf'):
            for c in swf_candidates():
                out.setdefault(c, 'swf')
        if group in (None, 'image'):
            for c in image_candidates():
                out.setdefault(c, 'image')
    if all_ or group == 'audio':
        for c in audio_candidates(quick=quick):
            out.setdefault(c, 'audio')
    return out


# ---------------------------------------------------------------- 网络

def url_of(path):
    return urllib.parse.urljoin(BASE, path)


def head(path, timeout=15):
    req = urllib.request.Request(url_of(path), method='HEAD',
                                 headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, int(r.headers.get('Content-Length') or 0), r.headers.get('Content-Type')
    except urllib.error.HTTPError as e:
        return e.code, 0, None
    except Exception:                                          # noqa: BLE001
        return 0, 0, None


def get(path, timeout=30):
    req = urllib.request.Request(url_of(path), headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read(), r.headers.get('Content-Type')


def local_path(path):
    """远端路径 → 本地路径。

    客户端根（.../static/images/swf/）下的东西沿用 tdsheep_swf/ 的扁平命名；
    这个根'之外'的（../xxx）放 tdsheep_swf/extra/ 下，保持可读。
    """
    if path.startswith('/'):
        rel = path.lstrip('/').replace('/', '_') or 'root'
        return os.path.join(OUT, 'site_' + rel)
    if path.startswith('../'):
        rel = path[3:].replace('/', '_')
        return os.path.join(OUT, 'img_' + rel)
    return os.path.join(ROOT, 'tdsheep_swf', path.replace('/', '_'))


# ---------------------------------------------------------------- 主流程

def main():
    args = sys.argv[1:]
    force = '--force' in args
    mode_list = '--list' in args
    mode_text = '--text' in args

    if mode_text:
        for p in page_candidates() + ['xmlFile/config.xml', 'xmlFile/string_cn.xml',
                                      'xmlFile/guide.xml']:
            try:
                _st, data, ctype = get(p, timeout=25)
            except Exception as e:                             # noqa: BLE001
                print('%-28s ERR %s' % (p, e))
                continue
            txt = data.decode('utf-8', 'replace')
            print('=' * 70)
            print('%s   (%s, %d bytes)' % (p, ctype, len(data)))
            print('-' * 70)
            print(txt[:1500])
        return

    group = None
    for g in ('xml', 'swf', 'image', 'audio'):
        if '--only-' + g in args:
            group = g
    if '--audio' in args:
        group = 'audio'
    # 指定了 --only-XXX 就只探那一组，别再把音频那 3000 多个候选也带上
    cand = candidates(all_=(group is None), group=group, quick='--quick' in args)
    todo = sorted(cand)
    print('候选 %d 个（本地已有 %d 个）'
          % (len(todo), sum(1 for p in todo if os.path.exists(local_path(p)))))
    with cf.ThreadPoolExecutor(12) as ex:
        res = list(ex.map(lambda p: (p,) + head(p), todo))
    hits = [r for r in res if r[1] == 200]
    print('线上存在 %d 个，共 %.2f MB' % (len(hits), sum(r[2] for r in hits) / 1048576))

    # 清单按 URL 合并写入（每次只探一组时不要把别的组的记录冲掉）
    manifest = os.path.join(OUT, 'mirror_manifest.json')
    os.makedirs(OUT, exist_ok=True)
    merged = {}
    if os.path.exists(manifest):
        try:
            with open(manifest, encoding='utf-8') as fh:
                for item in json.load(fh).get('found', []):
                    merged[item['url']] = item
        except Exception:                                      # noqa: BLE001
            pass
    for p, _st, s, ct in hits:
        merged[p] = {'url': p, 'bytes': s, 'type': ct,
                     'local': os.path.relpath(local_path(p), ROOT).replace('\\', '/')}
    with open(manifest, 'w', encoding='utf-8') as fh:
        json.dump({'base': BASE, 'found': sorted(merged.values(), key=lambda d: d['url'])},
                  fh, ensure_ascii=False, indent=1)
    print('清单（累计 %d 条）写入 %s' % (len(merged), os.path.relpath(manifest, ROOT)))

    fresh = [r for r in hits if not os.path.exists(local_path(r[0]))]
    print('其中本地没有的 %d 个：' % len(fresh))
    for p, _s, sz, ct in fresh:
        print('   %-46s %9d  %s  (%s)' % (p, sz, ct or '', cand[p]))
    if mode_list or not fresh:
        return

    ok = 0
    for p, _s, _sz, _ct in fresh:
        dst = local_path(p)
        try:
            st, data, _ct = get(p)
        except Exception as e:                                 # noqa: BLE001
            print('  下载失败 %-40s %s' % (p, e))
            continue
        if st != 200 or not data:
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, 'wb') as fh:
            fh.write(data)
        ok += 1
        print('  ok  %-46s %9d -> %s' % (p, len(data), os.path.relpath(dst, ROOT)))
    print('新下载 %d 个' % ok)



if __name__ == '__main__':
    main()
