#!/usr/bin/env python3
"""
Update test data in three HTML prototype files for 全省资源库 (Provincial Resource Library).
Uses real site data from Excel to populate realistic entries.
"""

import re
import random
import openpyxl

random.seed(42)

# === File paths ===
BASE = '/Users/chasenli/myccweb/provincial-resource'
EXCEL = '/Users/chasenli/Documents/work/内容中台/传播大脑/平台迭代/智能媒资库/全省资源库/全省资源库客户端清单.xlsx'

# === Region mapping ===
city_map = {
    '西湖区':'杭州市','萧山区':'杭州市','桐庐县':'杭州市','上城区':'杭州市','滨江区':'杭州市',
    '钱塘区':'杭州市','淳安县':'杭州市','临平区':'杭州市','临安区':'杭州市','富阳区':'杭州市',
    '余杭区':'杭州市','建德市':'杭州市','拱墅区':'杭州市',
    '吴兴区':'湖州市','南浔区':'湖州市','德清县':'湖州市','长兴县':'湖州市','安吉县':'湖州市',
    '海曙区':'宁波市','江北区':'宁波市','北仑区':'宁波市','鄞州区':'宁波市','镇海区':'宁波市',
    '奉化区':'宁波市','余姚市':'宁波市','慈溪市':'宁波市','宁海县':'宁波市','象山县':'宁波市',
    '鹿城区':'温州市','龙湾区':'温州市','瓯海区':'温州市','瑞安市':'温州市','乐清市':'温州市',
    '永嘉县':'温州市','平阳县':'温州市','苍南县':'温州市','文成县':'温州市','泰顺县':'温州市',
    '洞头区':'温州市','龙港市':'温州市',
    '南湖区':'嘉兴市','秀洲区':'嘉兴市','海宁市':'嘉兴市','桐乡市':'嘉兴市','平湖市':'嘉兴市',
    '嘉善县':'嘉兴市','海盐县':'嘉兴市',
    '越城区':'绍兴市','柯桥区':'绍兴市','上虞区':'绍兴市','诸暨市':'绍兴市','新昌县':'绍兴市',
    '嵊州市':'绍兴市',
    '婺城区':'金华市','金东区':'金华市','义乌市':'金华市','东阳市':'金华市','永康市':'金华市',
    '兰溪市':'金华市','武义县':'金华市','浦江县':'金华市','磐安县':'金华市',
    '柯城区':'衢州市','衢江区':'衢州市','江山市':'衢州市','常山县':'衢州市','开化县':'衢州市',
    '龙游县':'衢州市',
    '定海区':'舟山市','普陀区':'舟山市','岱山县':'舟山市','嵊泗县':'舟山市',
    '椒江区':'台州市','黄岩区':'台州市','路桥区':'台州市','温岭市':'台州市','临海市':'台州市',
    '玉环市':'台州市','三门县':'台州市','天台县':'台州市','仙居县':'台州市',
    '莲都区':'丽水市','龙泉市':'丽水市','青田县':'丽水市','云和县':'丽水市','庆元县':'丽水市',
    '缙云县':'丽水市','遂昌县':'丽水市','松阳县':'丽水市','景宁畲族自治县':'丽水市',
}
bendi_map = {
    '杭州市本级':'杭州市','宁波市本级':'宁波市','温州市本级':'温州市','嘉兴市本级':'嘉兴市',
    '绍兴市本级':'绍兴市','金华市本级':'金华市','衢州市本级':'衢州市','舟山市本级':'舟山市',
    '台州市本级':'台州市','丽水市本级':'丽水市','湖州市本级':'湖州市',
}

ALL_CITIES = ['省本级','杭州市','湖州市','宁波市','温州市','嘉兴市','绍兴市','金华市','衢州市','舟山市','台州市','丽水市']

# === 1. Read Excel ===
def read_sites():
    wb = openpyxl.load_workbook(EXCEL)
    ws = wb.active
    sites = []  # list of {client, channel, region_raw, media_unit, city, product}
    for row in ws.iter_rows(min_row=2, values_only=True):
        client, channel, region_raw, media_unit = row
        if not client:
            break
        # Map region to city
        if region_raw == '浙江省':
            city = '省本级'
        elif region_raw in bendi_map:
            city = bendi_map[region_raw]
        elif region_raw in city_map:
            city = city_map[region_raw]
        else:
            city = region_raw  # fallback
        product = client + '客户端' if not client.endswith('客户端') else client
        sites.append({
            'client': client,
            'channel': channel,
            'region_raw': region_raw,
            'media_unit': media_unit,
            'city': city,
            'product': product,
        })
    return sites

def get_sites_by_city(sites):
    by_city = {}
    for s in sites:
        c = s['city']
        if c not in by_city:
            by_city[c] = []
        by_city[c].append(s)
    return by_city

# === 2. Generate article data ===
def gen_articles(sites, by_city):
    # Realistic news titles about Zhejiang topics
    title_pool = {
        '省本级': [
            ('浙江省数字经济增加值突破4万亿元大关', '浙江省2026年一季度经济运行情况新闻发布会召开，数字经济核心产业增加值同比增长12.3%，成为推动全省经济高质量发展的重要引擎。'),
            ('潮新闻：浙江省共同富裕示范区建设取得阶段性成果', '浙江省共同富裕示范区建设推进会召开，发布首批最佳实践案例，涵盖收入分配、公共服务、精神文化等多个领域。'),
            ('中国蓝新闻报道：亚运场馆赛后利用成效显著', '杭州亚运会场馆赛后利用一周年评估报告发布，各场馆累计举办赛事活动超过500场，接待市民超过800万人次。'),
            ('浙江日报评论：以科技创新引领新质生产力发展', '科技创新是发展新质生产力的核心要素。浙江省持续加大研发投入，推进关键核心技术攻关，加快构建现代化产业体系。'),
        ],
        '杭州市': [
            ('上城区南宋文化节开幕 千年古城焕发新活力', '第十八届南宋文化节在上城区清河坊历史文化街区盛大开幕，活动将持续一周，涵盖文化展览、非遗体验、美食集市等丰富内容。'),
            ('余杭区未来科技城AI企业突破千家', '截至目前，余杭区未来科技城已集聚人工智能企业超过1000家，形成了从基础研究到应用落地的完整产业链。'),
            ('萧山发布：萧山国际机场T4航站楼全面启用', '杭州萧山国际机场T4航站楼全面投入运营，年旅客吞吐能力提升至9000万人次，成为长三角世界级机场群的重要枢纽。'),
        ],
        '湖州市': [
            ('南太湖号：湖州绿色发展指数连续五年全省第一', '湖州市绿色发展指数报告发布，湖州连续五年位居全省第一，生态优势正加速转化为发展优势。'),
            ('南浔区古镇保护与文旅融合并重焕发新活力', '南浔区持续加强古镇保护利用工作，推进文旅深度融合，今年一季度接待游客同比增长35%。'),
            ('德清县：地理信息小镇入选国家级特色小镇', '德清地理信息小镇成功入选新一轮国家级特色小镇名单，目前已集聚地理信息企业400余家。'),
        ],
        '宁波市': [
            ('甬派：宁波舟山港年集装箱吞吐量创新高', '宁波舟山港今年一季度完成集装箱吞吐量950万标准箱，同比增长8.2%，创下季度历史新高。'),
            ('鄞州区东部新城CBD建设全面提速', '鄞州区东部新城核心区建设进入加速期，多个重大项目集中开工，总投资超过200亿元。'),
            ('慈溪市：智能家电产业集群产值突破千亿', '慈溪市智能家电产业集群持续壮大，2025年产值首次突破千亿元大关，成为当地经济发展的重要支柱。'),
        ],
        '温州市': [
            ('温度新闻：温州民营经济高质量发展再上新台阶', '温州市召开民营经济高质量发展大会，发布支持民营经济发展十条新政，持续优化营商环境。'),
            ('乐清市电气产业集群升级路径探析', '乐清市全面推进电气产业智能化升级，培育国家级专精特新企业超过50家，产业集群竞争力显著增强。'),
            ('瑞安市：汽车零部件产业加速新能源转型', '瑞安市汽车零部件产业积极拥抱新能源变革，目前已有多家企业成为国内外知名新能源车企的核心供应商。'),
        ],
        '嘉兴市': [
            ('读嘉：嘉兴全面融入长三角一体化发展', '嘉兴市召开全面融入长三角一体化发展推进会，发布2026年行动计划，涵盖基础设施、产业协同、公共服务等领域。'),
            ('海宁市皮革时尚产业向数字化进军', '海宁市皮革城全面推进数字化转型，搭建产业互联网平台，助力传统皮革时尚产业焕发新生机。'),
            ('桐乡市：世界互联网大会永久举办地效应持续放大', '桐乡市持续放大世界互联网大会红利，数字经济核心产业增加值占GDP比重超过25%。'),
        ],
        '绍兴市': [
            ('越牛新闻：绍兴古城文旅融合开辟新路径', '绍兴市持续推进古城文旅深度融合，今年一季度旅游总收入同比增长28%，古城活化利用经验获全国推广。'),
            ('柯桥区：纺织产业绿色转型引领全国', '柯桥区纺织印染行业绿色转型取得显著成效，单位产值能耗下降15%，绿色纺织标准体系逐步建立。'),
            ('诸暨市：珍珠产业年产值超百亿走向世界', '诸暨山下湖珍珠产业持续壮大，年产值突破100亿元，产品远销全球50多个国家和地区。'),
        ],
        '金华市': [
            ('金彩云：金华数字贸易发展领跑全省', '金华市数字贸易发展推进会召开，今年一季度数字贸易进出口额同比增长22%，增速位居全省第一。'),
            ('义乌市小商品市场数字化转型纪实', '义乌国际商贸城全面推进数字化转型，Chinagoods平台注册采购商超过300万，数字贸易生态日趋完善。'),
            ('东阳市横店影视文化产业高质量发展', '东阳市横店影视文化产业实验区持续发展壮大，2025年接待剧组超过400个，营业收入突破200亿元。'),
        ],
        '衢州市': [
            ('三衢：衢州打造四省边际中心城市成效显著', '衢州市四省边际中心城市建设取得重要进展，交通、教育、医疗等领域辐射能力持续增强。'),
            ('江山市：省际边界城镇协同发展新样本', '江山市积极探索浙赣闽三省交界区域协同发展新模式，推动基础设施互联互通、产业优势互补。'),
            ('开化县：国家公园体制试点生态价值实现路径', '开化县钱江源国家公园体制试点深入推进，探索生态产品价值实现机制，绿水青山加速转化为金山银山。'),
        ],
        '舟山市': [
            ('竞舟：舟山江海联运服务中心能级持续提升', '舟山江海联运服务中心建设取得新突破，一季度江海联运量同比增长15%，服务长江经济带能力显著增强。'),
            ('定海区：海洋教育进校园活动正式启动', '定海区正式启动海洋教育进校园系列活动，将海洋知识纳入中小学课程体系，培养学生的海洋意识。'),
            ('岱山县：海洋牧场建设取得新突破', '岱山县国家级海洋牧场示范区建设取得新进展，累计投放人工鱼礁超过10万空方，海域生态持续改善。'),
        ],
        '台州市': [
            ('望潮：台州制造业数字化转型走在前列', '台州市制造业数字化转型三年行动计划成效显著，已建成智能工厂56家，数字化车间128个。'),
            ('温岭市鞋业创新驱动发展纪实', '温岭市鞋业产业加速转型升级，培育自主品牌超过200个，产品附加值提升30%以上。'),
            ('临海市：古城文化旅游品牌效应持续增强', '临海市古城文化旅游持续升温，台州府城文化旅游区获评5A级景区以来，年接待游客突破500万人次。'),
        ],
        '丽水市': [
            ('源新闻：丽水"绿水青山就是金山银山"实践再结硕果', '丽水市生态产品价值实现机制试点成果丰硕，GEP核算体系不断完善，生态旅游、生态农业等绿色产业蓬勃发展。'),
            ('龙泉市：剑瓷文化产业年产值超百亿', '龙泉市剑瓷文化产业持续壮大，年产值突破100亿元，非遗技艺传承与创新融合发展取得显著成效。'),
            ('青田县：华侨之乡的共同富裕新实践', '青田县发挥华侨资源优势，推动侨资回流、项目回归，走出一条具有侨乡特色的共同富裕新路子。'),
        ],
    }

    # Type distribution: 新闻60%, 评论15%, 专题15%, 图集10%
    types = ['新闻'] * 6 + ['评论'] * 2 + ['专题'] * 2 + ['图集']
    # Channel distribution: 客户端60%, 网站40%
    channels = ['客户端'] * 3 + ['网站'] * 2

    articles = []
    for city in ALL_CITIES:
        city_titles = title_pool.get(city, title_pool['省本级'])
        # 2-3 articles per city
        count = 3 if city in ['省本级', '杭州市', '温州市', '金华市'] else 2
        city_sites = by_city.get(city, [])
        if not city_sites:
            city_sites = [{'product': city + '客户端', 'media_unit': city + '新闻传媒中心', 'client': city.replace('市','')}]

        for j in range(count):
            idx = j % len(city_titles)
            title_info = city_titles[idx]
            title, content_body = title_info

            site = city_sites[j % len(city_sites)]

            article_type = random.choice(types)
            channel = random.choice(channels)
            wc = random.randint(600, 4000)

            # Generate time in 2026/05/01-05/07 range
            day = random.randint(1, 7)
            hour = random.randint(7, 22)
            minute = random.randint(0, 59)
            second = random.randint(0, 59)
            time_str = f'2026/05/{day:02d} {hour:02d}:{minute:02d}:{second:02d}'

            source = site['media_unit']
            product = site['product']

            content = f'<p>{content_body}</p><div class="source-note">来源：{product}</div>'

            articles.append({
                'title': title,
                'source': source,
                'region': city,
                'type': article_type,
                'wc': wc,
                'product': product,
                'time': time_str,
                'channel': channel,
                'content': content,
            })

    return articles


# === 3. Generate image/video DATA entries ===
def gen_media_entries(sites, by_city, count=20, is_video=False):
    """Generate DATA entries for image.html or video.html.
    Returns list of dicts with: title, time, source, site, channel, region
    (and duration for video). The img field is NOT generated here - we preserve existing base64."""

    image_titles = [
        '西湖景区春日美景如画',
        '钱塘江大潮壮观景象',
        '千岛湖碧水青山全景航拍',
        '杭州城市天际线夜景',
        '余杭未来科技城全景',
        '宁波三江口夜景璀璨',
        '温州瓯江两岸城市风光',
        '嘉兴南湖红船雪景',
        '绍兴古城水乡风情',
        '金华双龙洞景区自然奇观',
        '衢州江郎山丹霞地貌',
        '舟山普陀山海天佛国',
        '台州神仙居云海奇观',
        '丽水梯田春耕美景',
        '湖州南浔古镇水乡晨曦',
        '义乌国际商贸城繁忙景象',
        '横店影视城古装拍摄现场',
        '杭州亚运场馆赛后利用场景',
        '温州雁荡山日出云海',
        '宁波舟山港巨轮靠泊',
        '萧山国际机场航站楼',
        '安吉竹海翠绿连绵',
        '德清莫干山民宿聚落',
        '桐乡乌镇互联网之光',
    ]

    video_titles = [
        '浙江高质量发展建设共同富裕示范区',
        '杭州亚运会场馆赛后利用一周年',
        '宁波舟山港智慧码头运行纪实',
        '温州民营经济转型升级之路',
        '嘉兴红船精神传承与发扬',
        '绍兴黄酒非遗技艺传承',
        '金华义乌小商品市场数字化转型',
        '衢州美丽大花园建设巡礼',
        '舟山海洋经济发展纪实',
        '台州智能制造产业集群探访',
        '丽水绿水青山就是金山银山',
        '湖州绿色发展先行区建设',
        '余杭未来科技城创新创业热潮',
        '浙江乡村振兴美丽画卷',
        '浙江数字化改革成果展示',
        '温州龙舟运动发展纪实',
        '绍兴古城保护与活化利用',
        '东阳横店影视产业发展',
        '浙江海上丝绸之路文化探源',
        '宁波慈溪智能家电产业崛起',
    ]

    titles = video_titles if is_video else image_titles

    entries = []
    for i in range(count):
        # Distribute across cities
        city = ALL_CITIES[i % len(ALL_CITIES)]
        city_sites = by_city.get(city, [])
        if not city_sites:
            city_sites = [{'product': city + '客户端', 'media_unit': city + '新闻传媒中心', 'client': city.replace('市',''), 'channel': '客户端'}]

        site = city_sites[i % len(city_sites)]

        day = (i % 7) + 1
        hour = random.randint(7, 22)
        minute = random.randint(0, 59)
        time_str = f'2026/05/{day:02d} {hour:02d}:{minute:02d}'

        entry = {
            'title': titles[i % len(titles)],
            'time': time_str,
            'source': site['media_unit'],
            'site': site['product'],
            'channel': site['channel'],
            'region': city,
        }
        if is_video:
            entry['duration'] = random.randint(30, 600)

        entries.append(entry)

    return entries


# === 4. Apply changes to files ===

def update_index_html(articles):
    """Replace the articles array in index.html."""
    filepath = f'{BASE}/index.html'
    with open(filepath, 'r') as f:
        content = f.read()

    # Find and replace articles array
    start_marker = '/* ========== Article Mock Data ========== */\nvar articles = ['
    start_idx = content.index(start_marker)
    # Find the closing ]; after the articles
    end_marker = '];'
    end_idx = content.index(end_marker, start_idx) + len(end_marker)

    # Build new articles JS
    lines = ['/* ========== Article Mock Data ========== */']
    lines.append('var articles = [')
    for a in articles:
        line = (f"  {{ title: '{a['title']}', source: '{a['source']}', region: '{a['region']}', "
                f"type: '{a['type']}', wc: {a['wc']}, product: '{a['product']}', "
                f"time: '{a['time']}', channel: '{a['channel']}', content: '{a['content']}' }},")
        lines.append(line)
    lines.append('];')
    new_articles = '\n'.join(lines)

    content = content[:start_idx] + new_articles + content[end_idx:]

    with open(filepath, 'w') as f:
        f.write(content)
    print(f'Updated index.html with {len(articles)} articles')


def update_media_html(filename, entries, is_video):
    """Update DATA entries in image.html or video.html.
    Preserve base64 img data, update other fields."""
    filepath = f'{BASE}/{filename}'
    with open(filepath, 'r') as f:
        content = f.read()

    # Find DATA array boundaries
    data_start_marker = 'var DATA = ['
    data_start_idx = content.index(data_start_marker)
    data_end_idx = content.index('];', data_start_idx) + 2

    # Extract existing DATA to get base64 images
    data_str = content[data_start_idx:data_end_idx]

    # Extract base64 images using regex
    img_pattern = re.compile(r"img: '(data:image/[^']+)'")
    img_matches = img_pattern.findall(data_str)

    if len(img_matches) != len(entries):
        print(f'WARNING: Found {len(img_matches)} images but have {len(entries)} entries in {filename}')
    if len(img_matches) < len(entries):
        entries = entries[:len(img_matches)]
        print(f'  Truncated entries to {len(entries)}')

    # For video, also extract duration values
    existing_durations = []
    if is_video:
        dur_pattern = re.compile(r'duration: (\d+)')
        existing_durations = dur_pattern.findall(data_str)

    # Build new DATA array
    lines = ['var DATA = [']
    for i, entry in enumerate(entries):
        img = img_matches[i] if i < len(img_matches) else ''
        line = f"  {{ img: '{img}', title: '{entry['title']}', time: '{entry['time']}', "
        line += f"source: '{entry['source']}', site: '{entry['site']}', channel: '{entry['channel']}', region: '{entry['region']}'"
        if is_video:
            dur = entry.get('duration', 120)
            line += f", duration: {dur}"
        line += ' },'
        lines.append(line)
    lines.append('];')
    new_data = '\n'.join(lines)

    content = content[:data_start_idx] + new_data + content[data_end_idx:]

    # === Update CSS: card-info and info-* ===
    old_css = ".card-info { padding: 6px 10px 10px; display: flex; align-items: center; justify-content: space-between; }\n        .info-time { font-size: 14px; color: var(--color-text4); line-height: 20px; }"
    new_css = """.card-info { display: flex; align-items: center; gap: 6px; margin-top: 4px; padding: 0 8px 10px; }
        .info-source { font-size: 12px; color: var(--color-text4); }
        .info-site { font-size: 12px; color: var(--color-text3); background: var(--color-primary-bg); padding: 1px 6px; border-radius: 3px; }
        .info-time { font-size: 12px; color: var(--color-text4); margin-left: auto; }"""

    if old_css in content:
        content = content.replace(old_css, new_css)
        print(f'  Updated CSS in {filename}')
    else:
        print(f'  WARNING: Could not find old CSS in {filename}')

    # === Update render function: card-info line ===
    old_render = "h += '<div class=\"card-info\"><span class=\"info-time\">' + item.time + '</span></div>';"
    new_render = """h += '<div class=\"card-info\">';
        h += '<span class=\"info-source\">' + (item.source || '') + '</span>';
        h += '<span class=\"info-site\">' + (item.site || '') + '</span>';
        h += '<span class=\"info-time\">' + item.time + '</span>';
        h += '</div>';"""

    if old_render in content:
        content = content.replace(old_render, new_render)
        print(f'  Updated render function in {filename}')
    else:
        print(f'  WARNING: Could not find old render line in {filename}')

    # === Update doSearch to include region filtering ===
    old_search = """function doSearch() {
    var kw = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!kw) { pgFilteredData = DATA; } else { pgFilteredData = DATA.filter(function(d){return d.title.toLowerCase().indexOf(kw)!==-1}); }
    pgCurrentPage = 1; renderPage();
}"""
    new_search = """function doSearch() {
    var kw = document.getElementById('searchInput').value.trim().toLowerCase();
    var filtered = DATA;
    if (kw) { filtered = filtered.filter(function(d){return d.title.toLowerCase().indexOf(kw)!==-1}); }
    var regions = getSelectedRegions();
    if (regions.length > 0) {
        filtered = filtered.filter(function(item) {
            return regions.indexOf(item.region) !== -1;
        });
    }
    pgFilteredData = filtered;
    pgCurrentPage = 1; renderPage();
}"""

    if old_search in content:
        content = content.replace(old_search, new_search)
        print(f'  Updated doSearch in {filename}')
    else:
        print(f'  WARNING: Could not find old doSearch in {filename}')

    # === Add regionMap + getSelectedRegions before pagination section ===
    region_logic = """/* ===== Region Filter Logic ===== */
var regionMap = { '省本级': '省本级', '浙报集团': '省本级' };
regionData.forEach(function(r) { r.children.forEach(function(c) { regionMap[c] = r.name; }); });
function getSelectedRegions() {
  var regions = [];
  var cbs = document.querySelectorAll('.sidebar input[type="checkbox"]:checked');
  cbs.forEach(function(cb) {
    var text = cb.parentElement.textContent.trim();
    if (regionMap[text]) { if (regions.indexOf(regionMap[text]) === -1) regions.push(regionMap[text]); }
    else if (regionData.some(function(r) { return r.name === text; })) { if (regions.indexOf(text) === -1) regions.push(text); }
  });
  return regions;
}

"""

    # Insert before /* ===== Pagination ===== */
    pagination_marker = '/* ===== Pagination ===== */'
    if 'var regionMap' not in content:
        if pagination_marker in content:
            content = content.replace(pagination_marker, region_logic + pagination_marker)
            print(f'  Added region filter logic in {filename}')
    else:
        print(f'  regionMap already exists in {filename}')

    # === Update DOMContentLoaded to use doSearch instead of direct DATA assignment ===
    old_init = "document.addEventListener('DOMContentLoaded', function(){ renderRegions(); pgFilteredData = DATA; renderPage(); });"
    new_init = "document.addEventListener('DOMContentLoaded', function(){ renderRegions(); doSearch(); });"

    if old_init in content:
        content = content.replace(old_init, new_init)
        print(f'  Updated DOMContentLoaded in {filename}')

    with open(filepath, 'w') as f:
        f.write(content)
    print(f'Updated {filename} with {len(entries)} entries')


# === Main ===
def main():
    print('Reading Excel data...')
    sites = read_sites()
    print(f'  Loaded {len(sites)} sites')
    by_city = get_sites_by_city(sites)
    for city in ALL_CITIES:
        count = len(by_city.get(city, []))
        print(f'  {city}: {count} sites')

    print('\nGenerating articles for index.html...')
    articles = gen_articles(sites, by_city)
    print(f'  Generated {len(articles)} articles')

    print('\nUpdating index.html...')
    update_index_html(articles)

    print('\nGenerating entries for image.html...')
    img_entries = gen_media_entries(sites, by_city, count=20, is_video=False)
    print(f'  Generated {len(img_entries)} image entries')

    print('\nUpdating image.html...')
    update_media_html('image.html', img_entries, is_video=False)

    print('\nGenerating entries for video.html...')
    vid_entries = gen_media_entries(sites, by_city, count=20, is_video=True)
    print(f'  Generated {len(vid_entries)} video entries')

    print('\nUpdating video.html...')
    update_media_html('video.html', vid_entries, is_video=True)

    print('\n=== Done! ===')


if __name__ == '__main__':
    main()
