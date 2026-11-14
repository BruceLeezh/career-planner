/**
 * 深造中心（保研 + 考研）数据源
 *
 * 与 studyPaths.js 同级：零迁移、硬编码、data-driven，便于集中维护。
 * - 保研：本校规则（可配置）、加分清单（关联现有证书/竞赛库）+ 院校分档
 * - 考研：按本科专业推荐方向、考试科目、参考书目、院校冲/稳/保分档
 *
 * 说明：规则/加分口径为「通识模板 + 以学校官方为准」；院校/书目为代表性示例，
 * 前端一律标注「示例，以官网为准」，不编造学校硬数据。
 */

/* ================= 保研 ================= */

export const BAOYAN_CENTER = {
  title: '保研（推荐免试研究生）',
  desc: '以高绩点 + 科研竞赛成果换取免统考的推免资格。第一轮拼成绩排名，第二轮拼加分与材料。',

  // 硬条件/规则（可配置项，前端标注"以学校官方为准"）
  rules: [
    {
      title: '门槛（硬条件）',
      items: [
        '成绩排名在本专业前列（通常要求专业前 X%，以当年文件为准）',
        '无挂科（必修/核心课，或按学校规定补考合格）',
        '无校级以上违纪 / 学术不端记录',
        '一般要求英语达线（如 CET-4 达标、CET-6 越高越稳，个别院校/专业单独要求）',
      ],
    },
    {
      title: '名额与排名',
      items: [
        '推免名额按学院/专业分配，比例以当年学校文件为准',
        '综合成绩 = 学业成绩（绩点/成绩排名） + 奖励加分（设上限）',
        '综合成绩在同专业内由高到低排名，择优推荐',
      ],
    },
    {
      title: '加分口径（以学校官方为准）',
      note: '以下为通用参考，不是硬性列表；具体项、等级与分值以学校当年《推免/综测实施细则》为准。',
    },
  ],

  // 常见加分清单：source=contest 关联竞赛库(category)，cert 关联证书库(name)，rule=校级规定
  bonusItems: [
    { name: '全国大学生数学建模竞赛（国家级/省级奖）', source: 'contest', kind: 'grad', tip: '综测/保研重点认可' },
    { name: '“互联网+”大学生创新创业大赛（国赛/省赛）', source: 'contest', kind: 'general', tip: '普遍认可' },
    { name: '“挑战杯”课外学术科技作品 / 创业计划竞赛', source: 'contest', kind: 'general', tip: '普遍认可' },
    { name: '蓝桥杯 / ACM / 软件类学科竞赛', source: 'contest', kind: 'general', tip: '计算机等工科常用' },
    { name: '全国大学生英语竞赛（大英赛）', source: 'cert', name: '全国大学生英语竞赛', tip: '语言类加分项' },
    { name: '国家级/省级大学生创新创业训练计划（大创）结项', source: 'rule', tip: '科研经历 + 加分' },
    { name: '发表学术论文（按期刊等级 / 署名次序计分）', source: 'rule', tip: '核心期刊权重高' },
    { name: '全国计算机等级考试 / 软考等证书', source: 'cert', type: 'general', tip: '可视加分参考' },
  ],

  // 本校官方推免奖励加分规则（依据《中南财经政法大学推荐优秀应届本科毕业生免试攻读硕士学位研究生工作管理办法》
  // 中南大教字〔2024〕16号 及信息工程学院 2026-06 公示的实施细则。奖励加分含「学校+学院」两类，总分上限 75+25=100 分，
  // 最终以本院当年实施细则与官方公示为准）。
  bonusRules: {
    formula: '综合评定成绩 = 1—6学期所有课程加权平均成绩×85% + 各类奖励总分×15%（各类奖励总分 = 学校奖励加分 + 学院奖励加分）',
    campusCap: '学校奖励加分上限 75 分，学院奖励加分上限 25 分',
    campus: [
      { module: '服役 / 国防', name: '退役大学生表现优异（含立功受奖分级）', score: '最高 40 分', cond: '人民武装部认定' },
      { module: '学科竞赛', name: 'A 类学科竞赛（中国国际大学生创新大赛、挑战杯等）＋全国大学生创新创业年会入选项', score: '最高 30 分', cond: '团委（创业学院）认定' },
      { module: '英语口语', name: '非英语专业：四六级口语 / 权威英语口语考试按等级', score: '最高 5 分', cond: '学院认定，详见附件4' },
      { module: '国际组织实习', name: '外交部/人社部/教育部平台所列国际组织实地实习≥1个月', score: '3 分（多项只取一项）', cond: '需录用通知+实习证明+背景调查' },
      { module: '体测', name: '《国家学生体质健康标准》测试', score: '最高 3 分', cond: '体育部认定' },
    ],
    college: [
      { module: '奖学金', name: '文澜奖学金 / 国家奖学金 / 国家励志奖学金', score: '20 / 15 / 10 分', cond: '校级一/二/三等奖 8 / 6 / 4 分；多项只取最高' },
      { module: '学科竞赛', name: '国家级竞赛个人一/二/三等奖', score: '20 / 15 / 12 分', cond: '团队：主持 15/12/10、成员 10/8/6' },
      { module: '学科竞赛', name: '省级竞赛个人一/二/三等奖', score: '10 / 8 / 6 分', cond: '团队：主持 8/6/4、成员 4/3/2' },
      { module: '学术论文', name: 'A 类期刊论文（A+/A/A-）', score: '独撰 25 分', cond: '合著：一作 70%，二作 30%，三作后不计' },
      { module: '学术论文', name: 'B 类期刊论文', score: '独撰 20 分', cond: '合著：一作 70%，二作 30%，三作后不计' },
      { module: '学术论文', name: 'C 类期刊论文', score: '独撰 15 分', cond: '合著：一作 70%，二作 30%，三作后不计' },
      { module: '专利', name: '发明专利（需正式证书+发明过程证明）', score: '独有 20 分', cond: '共有：一作 70%、二作 30%；软著不加分' },
      { module: '志愿服务', name: '国家级志愿服务赛个人一/二/三等奖', score: '10 / 8 / 6 分', cond: '团队：主持 8/6/4、成员 4/3/2' },
      { module: '志愿服务', name: '省级志愿服务赛个人一/二等奖', score: '8 / 6 分', cond: '团队：主持 6/4、成员 3/2' },
      { module: '特殊学术专长', name: '三名本专业教授联名推荐＋专家答辩鉴定', score: '分值由专家小组建议、学院审定', cond: '须公示；实行代表作评价' },
    ],
  },

  // 院校分档：示例，以官方推免系统为准
  colleges: [
    { tier: '冲', color: '#e5484d', note: '清北复交浙、人大等顶尖院校 / 强势学科' },
    { tier: '稳', color: '#2f6fe0', note: '中上游 985 / 211、区域强校，与本专业匹配度高' },
    { tier: '保', color: '#16a34a', note: '双一流特色校/目标专业有推免名额的院校，求稳上岸' },
  ],

  // 按成绩排名分段给出的「冲/稳/保」院校候选池（中南财大为 211 财经强校基准）。
  // 力争梯度可复现：模型只能从对应字段的候选里挑，杜绝三所全顶尖。
  tierByRank: [
    {
      rankMin: 1, rankMax: 5,
      Tier: { 冲: '清北复交、人大等最顶尖财经名校', 稳: '上财、央财、对外经贸等头部财经强校', 保: '普通 985 或强势 211（如厦大、武大、西财、中南财）' },
    },
    {
      rankMin: 6, rankMax: 15,
      Tier: { 冲: '上财、央财、对外经贸等头部财经，或武大、厦大等中上 985 财经', 稳: '西南财大、中南财大、暨南等强势 211 财经', 保: '普通 211 或省属重点财经（如海大、山财大）' },
    },
    {
      rankMin: 16, rankMax: 30,
      Tier: { 冲: '西南财大、中南财大、暨南等强势 211 财经', 稳: '普通 211 或省属重点财经', 保: '双一流特色校 / 本省财经强校' },
    },
    {
      rankMin: 31, rankMax: 60,
      Tier: { 冲: '普通 211', 稳: '省属重点 / 双一流特色校', 保: '本省一本，或建议同时准备考研' },
    },
    {
      rankMin: 61, rankMax: 100,
      Tier: { 冲: '末档 211 求稳推免', 稳: '本省一本 / 双一流特色校', 保: '建议主要走考研/就业' },
    },
  ],
};

/* ================= 考研 ================= */

/** 公共课（初试） */
const PUBLIC_SUBJECTS = ['思想政治理论', '外国语（英语一/日语等）'];

/** 每专业：推荐方向 / 数学与专业课（初试）/ 复试 / 参考书目（示例）/ 院校冲稳保 */
export const KAOYAN_DIRECTIONS = [
  {
    key: 'cs',
    major: '计算机科学与技术',
    directions: ['本专业（CS）', '相关：软件/人工智能/大数据', '跨考：金融科技 / 管理科学'],
    math: '数学（一）',
    proCourse: '计算机学科专业基础综合（数据结构、操作系统、计算机组成、网络）',
    reExam: '机试/编程 + 专业面试 + 英语口语',
    books: [
      { name: '《数据结构》(C语言版)', author: '严蔚敏', publisher: '清华大学出版社', edition: 'C语言版' },
      { name: '《计算机网络》(第7版)', author: '谢希仁', publisher: '电子工业出版社', edition: '第7版' },
      { name: '《计算机操作系统》(第4版)', author: '汤小丹', publisher: '西安电子科技大学出版社', edition: '第4版' },
      { name: '《计算机组成原理》(第3版)', author: '唐朔飞', publisher: '高等教育出版社', edition: '第3版' },
      { name: '历年真题 + 王道考研系列', author: '王道', publisher: '电子工业出版社', edition: '当年版' },
    ],
    schools: {
      high: [{ n: '清华、浙大、上交、华科', tip: '统考名额少，看重基础与代码能力' }],
      mid: [{ n: '武大、川大、西电、北邮', tip: '计算机重点学科，难度适中偏上' }],
      base: [{ n: '省内 211 / 双一流特色高校', tip: '统考名额相对充足，求稳首选' }],
    },
  },
  {
    key: 'se',
    major: '软件工程',
    directions: ['本专业（软工）', '相关：人工智能 / 大数据', '跨考：信息管理 / 金融科技'],
    math: '数学（一/二）',
    proCourse: '软件工程基础 / 数据结构（各校不同，多为数据结构 + 程序设计）',
    reExam: '上机 + 项目答辩 + 英语听说',
    books: [
      { name: '《软件工程导论》(第6版)', author: '张海藩', publisher: '清华大学出版社', edition: '第6版' },
      { name: '《数据结构》(C语言版)', author: '严蔚敏', publisher: '清华大学出版社', edition: 'C语言版' },
      { name: '《数据库系统概论》(第5版)', author: '王珊', publisher: '高等教育出版社', edition: '第5版' },
    ],
    schools: {
      high: [{ n: '清华软件、北大软微、浙大', tip: '竞争激烈，重项目与代码' }],
      mid: [{ n: '华科、西电、北航软院', tip: '学科实力强，参考书面广' }],
      base: [{ n: '省内 211 / 双一流特色高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'ds',
    major: '数据科学与大数据技术',
    directions: ['本专业（数据科学）', '相关：统计 / 人工智能', '跨考：商业分析（BA）/ 金融科技'],
    math: '数学（一/三，随院校方向的定）',
    proCourse: '统计基础 / 机器学习 / 数据结构（各校不同）',
    reExam: '算法/统计笔试 + 科研与项目面试',
    books: [
      { name: '《概率论与数理统计》(第4版)', author: '盛骤', publisher: '高等教育出版社', edition: '第4版' },
      { name: '《统计学习方法》(第2版)', author: '李航', publisher: '清华大学出版社', edition: '第2版' },
      { name: '《数据结构》(C语言版)', author: '严蔚敏', publisher: '清华大学出版社', edition: 'C语言版' },
    ],
    schools: {
      high: [{ n: '清华、北大、上交、复旦', tip: '名校数据/AI 方向竞争激烈' }],
      mid: [{ n: '武大、厦大、西电、成电', tip: '大数据与统计交叉优势校' }],
      base: [{ n: '省内 211 / 财经类强校', tip: '求稳主力' }],
    },
  },
  {
    key: 'econ',
    major: '经济学',
    directions: ['本专业（经济学）', '相关：金融 / 统计 / 应用经济学', '跨考：公共管理 / 国际商务'],
    math: '数学（三）多数院校；部分院校考数二/自命题',
    proCourse: '西方经济学（宏微观）＋ 报考方向专业课（各校自命题）',
    reExam: '专业综合 + 英语口语',
    books: [
      { name: '《西方经济学（宏观+微观）》(第7版)', author: '高鸿业', publisher: '中国人民大学出版社', edition: '第7版' },
      { name: '《微观经济学：现代观点》(第9版)', author: '范里安', publisher: '格致出版社', edition: '第9版' },
      { name: '《宏观经济学》(第10版)', author: '曼昆', publisher: '中国人民大学出版社', edition: '第10版' },
    ],
    schools: {
      high: [{ n: '人大、北大、清华、复旦经济', tip: '统考高手林立，需高分' }],
      mid: [{ n: '武大、南开、厦大、南大', tip: '经济学强校，难度适中偏上' }],
      base: [{ n: '省内 211 / 财经类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'finance',
    major: '金融学',
    directions: ['本专业（金融）', '相关：应用经济学 / 金融科技', '跨考：会计/法律（法硕）'],
    math: '数学（三）或 396 联考（随院校）',
    proCourse: '金融学综合（货金、公司金融、投资学，各校自命题）或 431',
    reExam: '专业面试 + 英语口语',
    books: [
      { name: '《货币金融学》(第11版)', author: '米什金', publisher: '中国人民大学出版社', edition: '第11版' },
      { name: '《公司理财》(第11版)', author: '罗斯', publisher: '机械工业出版社', edition: '第11版' },
      { name: '《投资学》(第10版)', author: '博迪', publisher: '机械工业出版社', edition: '第10版' },
      { name: '历年 431 真题 + 目标院校参考书', author: '', publisher: '', edition: '以官网为准' },
    ],
    schools: {
      high: [{ n: '清北、人大、央财、上财', tip: '金融名校，数学与专业并重' }],
      mid: [{ n: '对外经贸、西南财大、中南财', tip: '财经强校，报录比高' }],
      base: [{ n: '省内 211 / 财经类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'account',
    major: '会计学',
    directions: ['本专业（会计/MPAcc）', '相关：审计 / 财务管理', '跨考：税务 / 金融'],
    math: 'MPAcc 初试为 199 管理类联考（不考数学三）+ 英语二',
    proCourse: 'MPAcc：管理类综合能力（数学逻辑写作）；学硕：会计学综合（各校自命题）',
    reExam: '专业课笔试（财务/审计）+ 综合面试',
    books: [
      { name: '《管理类联考数学高分指南 / 逻辑精点》', author: '各机构', publisher: '机械工业出版社', edition: '当年版' },
      { name: '《财务会计》(第3版)', author: '李子健等', publisher: '东北财经大学出版社', edition: '第3版' },
      { name: '《审计学》(第8版)', author: '秦荣生', publisher: '中国人民大学出版社', edition: '第8版' },
    ],
    schools: {
      high: [{ n: '清MPAcc、人大、央财、上财', tip: '会计顶级院校' }],
      mid: [{ n: '对外经贸、中南财、西南财', tip: '报录比高，稳扎稳打' }],
      base: [{ n: '省内财经 / 综合类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'law',
    major: '法学',
    directions: ['本专业（法学学硕）', '专业学位（法律硕士/JM）', '跨考：政治学 / 社会学'],
    math: '不考数学',
    proCourse: '法学综合（法理、宪法、刑法、民法等，按学硕/法硕分为 A/B 命题）＋ 目标方向',
    reExam: '专业面试 + 英语口语',
    books: [
      { name: '《法理学》(第4版)', author: '张文显', publisher: '高等教育出版社', edition: '第4版' },
      { name: '《宪法学》(第2版)', author: '周叶中', publisher: '高等教育出版社', edition: '第2版' },
      { name: '《刑法学》(第10版)', author: '高铭暄、马克昌', publisher: '北京大学出版社', edition: '第10版' },
      { name: '《民法学》(第6版)', author: '王利明', publisher: '中国人民大学出版社', edition: '第6版' },
    ],
    schools: {
      high: [{ n: '北大、人大、武大、中国政法', tip: '五院四系中顶级水平' }],
      mid: [{ n: '西南政法、华东政法、中南财经政法', tip: '法学强校，难度适中' }],
      base: [{ n: '省内 211 / 政法类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'stat',
    major: '统计学',
    directions: ['本专业（统计学/应用统计）', '相关：数据科学 / 精算', '跨考：金融 / 经济'],
    math: '数学（三）',
    proCourse: '统计学综合（概率论、数理统计、应用统计）或 432 应用统计',
    reExam: '统计 + 面试',
    books: [
      { name: '《概率论与数理统计》(第4版)', author: '盛骤', publisher: '高等教育出版社', edition: '第4版' },
      { name: '《统计学》(第7版)', author: '贾俊平', publisher: '中国人民大学出版社', edition: '第7版' },
      { name: '《数理统计教程》(第2版)', author: '王兆军等', publisher: '南开大学出版社', edition: '第2版' },
    ],
    schools: {
      high: [{ n: '北大、人大、上财统计', tip: '统计学科优势校' }],
      mid: [{ n: '厦大、南大、浙大', tip: '交叉方向多，可结合数据科学' }],
      base: [{ n: '省内 211 / 财经类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'admin',
    major: '行政管理',
    directions: ['本专业（公共管理）', '相关：MPA / 政治学', '跨考：社会学 / 马理论'],
    math: '多数不考数学（少数考数学三）',
    proCourse: '公共管理学 + 行政管理学（各校自命题）',
    reExam: '专业课面试 + 时政分析',
    books: [
      { name: '《公共管理学》(第3版)', author: '丁朝雄', publisher: '武汉大学出版社', edition: '第3版' },
      { name: '《行政管理学》(第6版)', author: '夏书章', publisher: '中山大学出版社', edition: '第6版' },
      { name: '《公共政策导论》(第3版)', author: '谢明', publisher: '中国人民大学出版社', edition: '第3版' },
    ],
    schools: {
      high: [{ n: '人大、北大、复旦公管', tip: '公共管理顶级院校' }],
      mid: [{ n: '武大、中山、南开', tip: '公管强校' }],
      base: [{ n: '省内 211 / 综合类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'management',
    major: '工商管理',
    directions: ['本专业（企业管理/MBA方向）', '相关：市场营销 / 人力资源 / 管理科学与工程', '跨考：金融 / 会计 / 公共管理'],
    math: '学硕多考数学（三）；专硕（MBA/MPAcc）走管理类联考（199）不考数学三',
    proCourse: '管理学原理 + 报考方向专业课（市场营销/人力资源/运筹，各校自命题）',
    reExam: '综合面试（案例分析）+ 英语听说',
    books: [
      { name: '《管理学：原理与方法》(第7版)', author: '周三多', publisher: '复旦大学出版社', edition: '第7版' },
      { name: '《市场营销学》(第6版)', author: '吴健安', publisher: '高等教育出版社', edition: '第6版' },
      { name: '《人力资源管理》(第3版)', author: '董克用', publisher: '中国人民大学出版社', edition: '第3版' },
    ],
    schools: {
      high: [{ n: '人大、北大光华、上交安泰', tip: '顶级商学与管理' }],
      mid: [{ n: '武大、中山、厦大管理学院', tip: '经管强校' }],
      base: [{ n: '省内 211 / 财经类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'foreign',
    major: '英语',
    directions: ['本专业（英语语言文学学硕）', '专业学位（翻译硕士 TJI：MTI）', '相关：国际商务 / 英语教学（TESOL）'],
    math: '不考数学',
    proCourse: '基础英语/翻译基础（院校自命题）+ 二外（部分学硕要求）',
    reExam: '口译/视译 + 综合面试 + 英语听说',
    books: [
      { name: '《高级英语》', author: '张汉熙', publisher: '外语教学与研究出版社', edition: '第3版' },
      { name: '《英汉翻译教程》', author: '张培基', publisher: '上海外语教育出版社', edition: '第4版' },
      { name: '《实用英语语法》', author: '张道真', publisher: '外语教学与研究出版社', edition: '修订版' },
    ],
    schools: {
      high: [{ n: '北外、上外、广外', tip: '外语顶尖院校' }],
      mid: [{ n: '西外、川外、对外经贸', tip: '外语强校 / 商务英语方向佳' }],
      base: [{ n: '省内 211 / 外国语类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'media',
    major: '新闻学',
    directions: ['本专业（新闻传播学学硕）', '专业学位（新闻与传播 MJC）', '相关：戏剧影视 / 出版 / 数字媒体'],
    math: '多不考数学（少数院校考数学三）',
    proCourse: '新闻传播史论 + 新闻实务（各校自命题）',
    reExam: '作品集/业务答辩 + 综合面试',
    books: [
      { name: '《新闻学概论》(第7版)', author: '李良荣', publisher: '复旦大学出版社', edition: '第7版' },
      { name: '《传播学教程》(第2版)', author: '郭庆光', publisher: '中国人民大学出版社', edition: '第2版' },
      { name: '《网络传播概论》(第5版)', author: '彭兰', publisher: '中国人民大学出版社', edition: '第5版' },
    ],
    schools: {
      high: [{ n: '人大、中传、复旦新闻', tip: '新闻传播顶级院校' }],
      mid: [{ n: '武大、华中科、暨大', tip: '新闻强校' }],
      base: [{ n: '省内 211 / 传媒类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'philosophy',
    major: '哲学',
    directions: ['本专业（哲学学硕）', '相关：社会学 / 政治学理论', '跨考：马克思理论 / 中共党史'],
    math: '不考数学',
    proCourse: '哲学基础（中西哲学史、马哲原理，各校自命题）',
    reExam: '专业面试 + 英语听说',
    books: [
      { name: '《西方哲学史》', author: '赵敦华', publisher: '北京大学出版社', edition: '第2版' },
      { name: '《中国哲学史》', author: '冯友兰', publisher: '北京大学出版社', edition: '修订版' },
      { name: '《马克思主义哲学原理》', author: '高教版', publisher: '高等教育出版社', edition: '通用' },
    ],
    schools: {
      high: [{ n: '北大、人大、复旦哲学', tip: '哲学学科头部' }],
      mid: [{ n: '武大、南大、华中师大', tip: '哲学与社科强校' }],
      base: [{ n: '省内 211 / 综合类高校', tip: '求稳主力' }],
    },
  },
  {
    key: 'engineer',
    major: '环境工程',
    directions: ['本专业（环境科学与工程学硕）', '专业学位（资源与环境/环境工程专硕）', '相关：给排水 / 能源与环境'],
    math: '数学（二）',
    proCourse: '环境工程基础（水/气/固，各校自命题）',
    reExam: '专业面试 + 实验/设计答辩 + 英语听说',
    books: [
      { name: '《环境工程学》(第3版)', author: '蒋展鹏', publisher: '高等教育出版社', edition: '第3版' },
      { name: '《水质工程学》(第3版)', author: '李圭白', publisher: '中国建筑工业出版社', edition: '第3版' },
    ],
    schools: {
      high: [{ n: '清华、同济、哈工大环境', tip: '环境学科头部' }],
      mid: [{ n: '华中科大、武汉理工、华南理工', tip: '工科环境强校' }],
      base: [{ n: '省内 211 / 理工类高校', tip: '求稳主力' }],
    },
  },
];

/** 本校 88 个本科专业 → 考研方向 key 的映射（据 schoolColleges.js 归纳，未命中走通用） */
export const MAJOR_FAMILY = {
  // 经济
  '经济学': 'econ', '经济学（卓越人才实验班）': 'econ', '数字经济': 'econ', '国际商务': 'econ',
  '经济管理试验班': 'econ', '人文科学试验班': 'econ', '数字经济（拔尖人才实验班）': 'econ',
  '国际经济与贸易': 'econ', '贸易经济': 'econ', '国际经济与贸易（卓越人才实验班）': 'econ',
  '国际经济与贸易+国际法（双学士学位）': 'econ',
  // 金融
  '金融学': 'finance', '金融工程': 'finance', '投资学': 'finance', '保险学': 'finance', '精算学': 'finance',
  '金融学（数字金融卓越人才实验班）': 'finance', '投资学（投资决策数智化卓越人才实验班）': 'finance',
  '金融学+计算机科学与技术双学位实验班': 'finance', '金融学+法学双学位': 'finance', '金融数学': 'finance',
  // 会计/财务/审计
  '会计学': 'account', '财务管理': 'account', '审计学': 'account', '会计学（卓越人才实验班）': 'account',
  // 法学与法科
  '法学': 'law', '法学（拔尖人才实验班）': 'law', '法学+经济学（双学士学位）': 'law',
  '治安学': 'law', '侦查学': 'law', '治安学（金融犯罪治理卓越人才实验班）': 'law',
  '纪检监察': 'law', '知识产权': 'law', '知识产权（卓越人才实验班）': 'law',
  '国际法': 'law', '国际法（拔尖人才实验班）': 'law', '网络与新媒体+法学（双学位实验班）': 'law',
  // 统计与数据
  '统计学': 'stat', '应用统计学': 'stat', '经济统计学': 'stat', '数据科学与大数据技术': 'ds',
  // 计算机与信息
  '计算机科学与技术': 'cs', '信息安全': 'cs', '信息管理与信息系统': 'cs', '大数据管理与应用': 'ds',
  '人工智能': 'cs', '人工智能（中外合作办学）': 'cs', '计算机科学与技术（卓越人才实验班）': 'cs',
  '大数据管理与应用+金融工程（双学位）': 'ds', '人工智能+会计学（双学位）': 'cs',
  // 公共管理
  '行政管理': 'admin', '公共事业管理': 'admin', '劳动与社会保障': 'admin', '城市管理': 'admin',
  '劳动关系': 'admin', '行政管理（数字治理卓越人才实验班）': 'admin', '劳动关系+人工智能（双学位）': 'admin',
  // 工商与运营
  '工商管理': 'management', '市场营销': 'management', '人力资源管理': 'management',
  '物流管理': 'management', '电子商务': 'management', '旅游管理': 'management',
  '供应链管理': 'management', '农林经济管理': 'management', '工商管理（卓越人才实验班）': 'management',
  // 外语
  '英语': 'foreign', '商务英语': 'foreign', '法语': 'foreign', '日语': 'foreign', '俄语': 'foreign',
  // 传媒 / 文学 / 影视
  '新闻学': 'media', '广播电视学': 'media', '网络与新媒体': 'media', '汉语言文学': 'media',
  '数字媒体艺术': 'media', '动画': 'media', '电影学': 'media',
  // 哲社
  '哲学': 'philosophy', '社会学': 'philosophy', '国际政治': 'philosophy',
  // 工科
  '环境工程': 'engineer', '工程造价': 'engineer',
};

/** 通用兜底：学校有但未单独归类的专业，给一条通用升学指引 */
const GENERIC_DIRECTION = {
  key: 'general',
  major: '通用（其他专业）',
  directions: ['本专业学硕', '相关交叉专业', '专硕（视学科而定）'],
  math: '视报考方向而定（理工多考数学，经管文选考，文社多不考）',
  proCourse: '以报考院校当年《专业目录/招生简章》为准',
  reExam: '专业综合面试 + 英语听说',
  books: [{ name: '报考院校官方参考书目', author: '', publisher: '', edition: '以官网为准' }],
  schools: {
    high: [{ n: '对应学科头部院校', tip: '结合学科评估选冲' }],
    mid: [{ n: '学科评估 B+/A 类院校', tip: '求稳之选' }],
    base: [{ n: '省内 211 / 区域强校', tip: '保障上岸' }],
  },
};

/** 按专业取考研方向：优先命中 MAJOR_FAMILY 精确映射，其次按名匹配，未命中返回通用指引 */
export function getKaoyanByMajor(major) {
  if (!major || !String(major).trim()) return KAOYAN_DIRECTIONS;
  const m = String(major).trim();
  const key = MAJOR_FAMILY[m];
  if (key) {
    const hit = KAOYAN_DIRECTIONS.filter((d) => d.key === key);
    return hit.length ? hit : [GENERIC_DIRECTION];
  }
  const hit = KAOYAN_DIRECTIONS.filter((d) => d.major.includes(m) || m.includes(d.major));
  return hit.length ? hit : [GENERIC_DIRECTION];
}

/* ============ 考公 & 选调 ============ */

export const KAOZHAO_CENTER = {
  note: '以下为通用通行口径；各岗位/省份/年份政策随时变动，请一律以本校招就处通知、学校官网及招录机关当年度公告为准。',
  types: [
    { key: 'guokao', name: '国考', cond: '应届生比例高；中央机关及直属机构职位', time: '约 10 月报名、11 月底笔试', note: '行测+申论（部分职位加试专业科目）' },
    { key: 'shengkao', name: '省考 / 多省联考', cond: '面向本省职位为主，少量不限户籍', time: '多在上半年（约 2-3 月报名、3-4 月笔试），部分省单招', note: '行测+申论（基层/政法岗可能有差异）' },
    { key: 'xuandiao', name: '定向选调', cond: '面向“双一流”等定向高校应届生，组织部门重点培养方向', time: '各省时间不一，多在应届秋冬季发布', note: '行测/职测+公基+申论（按各省）' },
    { key: 'putong', name: '普通选调', cond: '面向普通高校应届生（党校方向），常有党员/学生干部/成绩前置条件', time: '多在省考前后随公告', note: '行测+申论，部分省另设素质测试' },
  ],
  subjectNote: '笔试两科（行测 + 申论），部分岗位加试专业科目；面试多为结构化 / 结构化小组 / 无领导小组。',
  subjects: [
    { name: '行政职业能力测验', note: '常识、言语理解、数量关系、判断推理、资料分析五大模块' },
    { name: '申论', note: '概括、综合分析、对策、公文、大作文' },
    { name: '专业知识（部分岗位加试）', note: '公安、税务、法考衔接等' },
    { name: '面试', note: '结构化 / 结构化小组 / 无领导小组' },
  ],
  books: [
    { name: '《行政职业能力测验》', author: '华图 / 中公 教材', publisher: '机构官方教材', edition: '最新版' },
    { name: '《申论》', author: '华图 / 中公 教材', publisher: '机构官方教材', edition: '最新版' },
    { name: '《申论范文与时政热点》', author: '与时俱进', publisher: '结合当年时政', edition: '最新版' },
  ],
  timeline: [
    { node: '发布公告', time: '国考 10 月 / 省联考 2-3 月 / 定向选调依省', note: '关注国家公务员局官网、省人事考试网、本校招就处通知' },
    { node: '网上报名', time: '公告后约 1-2 周内', note: '选岗 → 报名 → 资格审查 → 缴费' },
    { node: '笔试', time: '公告后约 1-1.5 个月', note: '行测 + 申论，部分岗加试' },
    { node: '成绩与面试', time: '笔试后约 1-2 个月', note: '按 1:3 / 1:5 比例进面' },
    { node: '体检 / 政审 / 公示', time: '面试后约 1-2 个月', note: '通过即录用公示' },
  ],
  materials: [
    '应届毕业生报名推荐表', '党员/预备党员证明（选调另需）', '学生干部 / 奖学金 / 荣誉证书',
    '成绩单与专业排名证明', '身份证、报名照片、学籍在线验证报告', '基层经历 / 实习证明（如有则佳）',
  ],
};

export const KAOYAN_ACADEMIC = {
  title: '学术（读博 / 直博 / 硕转博）',
  mergedNote: '已并入考研中心：若目标是读博/科研，在择校时优先选择有博士点、导师带招博士的院校，并在硕士阶段尽早进组、产出论文，为后续读博/申请铺路。',
};

/* ============ 保研材料包 ============ */

export const STUDY_MATERIALS = [
  {
    key: 'ps', name: '个人陈述（PS）', goal: '夏令营/预推免申请的核心文书，讲清「我是谁 + 我做过什么 + 我为什么来」',
    outline: [
      '开篇：学业背景与成绩排名（呼应升学档案）',
      '正文：科研/竞赛/项目经历，用 STAR 讲清你的角色与成果',
      '动机：为什么选该方向/院校，与个人规划的匹配',
      '结尾：读研计划与对导师课题的兴趣',
    ],
    tip: '示例模板，具体以各校申请系统要求为准',
  },
  {
    key: 'resume', name: '学术简历', goal: '一页纸呈现 GPA、科研、竞赛与技能', goToResume: true,
    outline: [
      '教育背景与成绩排名',
      '科研项目 / 论文 / 专利',
      '竞赛获奖与荣誉',
      '学生工作、技能与证书',
    ],
    tip: '跳转简历工作台，可用 AI 生成草稿后导出/打印',
  },
  {
    key: 'recommend', name: '专家推荐信', goal: '通常 2 封，由任课老师/科研导师撰写，证明学术潜力',
    outline: [
      '提前联系任课老师/项目导师，说明申请意向',
      '提供成绩单、简历与个人陈述，方便老师写得具体',
      '建议 2-3 封不同侧重（课程表现 / 科研能力）',
      '留足时间，不要临近截止才开口',
    ],
    tip: '模板要点，正式推荐信由推荐人提交',
  },
  {
    key: 'letter', name: '联系导师自荐信', goal: '提前接触目标导师，展示匹配度，争取进组机会',
    outline: [
      '先读导师近 2-3 年论文与课题组主页，找到具体兴趣点',
      '首段表明来意与本科背景（专业 + 排名）',
      '中段讲匹配：做过什么项目、会什么技能、与导师方向的交集',
      '结尾附简历，说明可为读研/进组做的准备',
    ],
    tip: '简明、真诚、就事论事，避免群发模板',
  },
];

/* ============ 全年升学日历 ============ */

export const STUDY_CALENDAR = [
  // 保研（当月为主参考，前后可能浮动，以各校通知为准）
  { track: 'baoyan', month: 4, node: '各校发布夏令营招生通知', note: '关注目标院校研究生院/学院官网' },
  { track: 'baoyan', month: 5, node: '夏令营报名与材料投递', note: '个人陈述/简历/成绩单/推荐信' },
  { track: 'baoyan', month: 6, node: '夏令营入营名单公布', note: '未入营不必灰心，准备预推免' },
  { track: 'baoyan', month: 7, node: '夏令营考核（笔试/面试）', note: '争取「优秀营员」名额' },
  { track: 'baoyan', month: 8, node: '优营名单公布 / 预推免报名开启', note: '预推免是保研主战场' },
  { track: 'baoyan', month: 9, node: '预推免考核 / 本校推免资格评定', note: '综合成绩=学业排名+加分，留意本校名额' },
  { track: 'baoyan', month: 10, node: '推免系统填报与九推补录', note: '在「推免服务系统」填报志愿、确认待录取' },
  // 考研
  { track: 'kaoyan', month: 9, node: '考试大纲 / 招生简章发布', note: '核对初试科目是否变动' },
  { track: 'kaoyan', month: 10, node: '预报名 / 正式报名', note: '研招网网报，确定报考点' },
  { track: 'kaoyan', month: 11, node: '网上确认', note: '上传照片与材料，错过无法补报' },
  { track: 'kaoyan', month: 12, node: '初试笔试', note: '政治+外语+数学/专业课' },
  { track: 'kaoyan', month: 2, node: '初试成绩公布', note: '次年 2 月左右，估分准备复试/调剂' },
  { track: 'kaoyan', month: 3, node: '国家线 / 院校复试线公布', note: '过线即准备复试材料' },
  { track: 'kaoyan', month: 4, node: '复试与调剂', note: '调剂系统开放，黄金窗口期' },
  // 考公 & 选调
  { track: 'kaozhao', month: 1, node: '部分省份省考/选调公告发布', note: '关注省人事考试网' },
  { track: 'kaozhao', month: 2, node: '省考报名（多省联考）', note: '选岗→报名→资格审查→缴费' },
  { track: 'kaozhao', month: 3, node: '省考笔试', note: '行测 + 申论' },
  { track: 'kaozhao', month: 10, node: '国考公告发布与报名', note: '国家公务员局官网' },
  { track: 'kaozhao', month: 11, node: '国考笔试', note: '行测 + 申论，部分职位加试' },
  { track: 'kaozhao', month: 12, node: '各省定向选调公告密集发布', note: '应届秋冬季，面向定向高校' },
];

/* ============ 考公职位筛选向导 ============ */

export const KAOZHAO_WIZARD = {
  note: '以下为通用参考，各岗位具体条件以当年度官方职位表/公告为准；入口均为官方渠道。',
  majorFamilies: ['法学类', '经济金融类', '财会审计类', '计算机类', '统计类', '管理类', '新闻中文类', '外语类', '理工类', '不限专业'],
  degrees: ['本科', '硕士研究生'],
  politics: ['不限', '共青团员', '中共党员'],
  regions: ['不限', '本省', '一线城市', '省会/地级市', '县乡基层'],
  positions: [
    {
      key: 'admin', name: '综合管理岗（国考/省考）',
      majorFit: null, degreeFit: null, politicFit: null, regionFit: null,
      note: '招录量大、专业限制宽，多为按专业大类或专业不限，适合兜底',
      officialTips: '筛岗时先按专业全称精确匹配，再放宽到大类，最后看「专业不限」岗位',
      link: '国家公务员局考录专题（bm.scs.gov.cn）',
    },
    {
      key: 'tax', name: '税务 / 海关行政执法岗',
      majorFit: ['经济金融类', '财会审计类', '法学类', '计算机类', '统计类'],
      degreeFit: null, politicFit: null, regionFit: null,
      note: '经管政法计算机对口度高，税务系统招录量大，常有专业能力加试',
      officialTips: '注意职位表「专业能力测试」列，提前准备',
      link: '各省税务局官网 / 海关总署招录专题',
    },
    {
      key: 'lawcourt', name: '法检系统（法官助理 / 检察官助理）',
      majorFit: ['法学类'], degreeFit: null, politicFit: null, regionFit: null,
      note: '多要求法学类专业，部分岗位需法律职业资格（A 证）',
      officialTips: '核对「通过法律职业资格考试」硬条件，法院/检察院单独发布职位',
      link: '最高人民法院 / 最高人民检察院 招录公告',
    },
    {
      key: 'publicsecurity', name: '公安 / 狱警系统',
      majorFit: null, degreeFit: null, politicFit: null, regionFit: null,
      note: '专业限制宽，但需通过体能测试、政审严格，常有性别/视力等备注',
      officialTips: '逐条读备注（体测项目、最低服务年限），报名前自评达标',
      link: '公安部 / 司法部 招录专题',
    },
    {
      key: 'selected', name: '定向选调（党政机关储备）',
      majorFit: null, degreeFit: null, politicFit: ['中共党员', '共青团员'], regionFit: null,
      note: '面向“双一流”等定向高校应届生，组织部门重点培养，发展通道好',
      officialTips: '各省公告单独发布，注意本校是否在定向高校名单内',
      link: '各省组织部官网 / 本校就业网转发公告',
    },
    {
      key: 'ordinary-select', name: '普通选调',
      majorFit: null, degreeFit: null, politicFit: ['中共党员', '共青团员'], regionFit: null,
      note: '面向普通高校应届生，常要求党员/学生干部/成绩条件',
      officialTips: '关注本校招就处通知，前置条件逐条核对',
      link: '本校就业信息网',
    },
    {
      key: 'financial', name: '银保监 / 证监系统',
      majorFit: ['经济金融类', '法学类', '计算机类', '财会审计类'], degreeFit: null, politicFit: null, regionFit: null,
      note: '金融/法律/计算机专业对口，常有专业科目笔试',
      officialTips: '专业科目分数占比高，提前按考纲复习',
      link: '国家金融监督管理总局 / 中国证监会 招录专题',
    },
    {
      key: 'discipline', name: '纪委监委系统',
      majorFit: ['法学类', '财会审计类', '管理类'], degreeFit: null, politicFit: ['中共党员', '共青团员'], regionFit: null,
      note: '党员优先，法学/审计/财会对口，政审严格',
      officialTips: '关注政治面貌与工作经历要求',
      link: '中央纪委国家监委网站 招录公告',
    },
    {
      key: 'any', name: '专业不限岗位（兜底）',
      majorFit: ['不限专业'], degreeFit: null, politicFit: null, regionFit: null,
      note: '竞争通常最激烈，适合作为保底选项',
      officialTips: '结合地区与竞争比权衡，报名期间可参考实时报名人数',
      link: '当年职位表筛选「专业不限」',
    },
  ],
};

/** 判定某岗位在该维度是否与用户选择匹配 */
function fitPos(fitArr, sel) {
  if (!sel || sel === '不限' || sel === '不限专业') return true; // 用户未设限 → 全部通过
  if (!fitArr) return true;                                        // 岗位不限该维度 → 通过
  return fitArr.includes(sel);                                     // 岗位有限制 → 必须包含所选值
}

/** 职位筛选向导（纯函数）：按专业大类/学历/政治面貌/地区过滤可报岗位 */
export function filterKaozhaoPositions(picked = {}) {
  const { majorFamily, degree, politics, region } = picked;
  return KAOZHAO_WIZARD.positions.filter(
    (p) =>
      fitPos(p.majorFit, majorFamily) &&
      fitPos(p.degreeFit, degree) &&
      fitPos(p.politicFit, politics) &&
      fitPos(p.regionFit, region),
  );
}

/** 逾期判断（纯函数）：deadline 为 YYYY-MM-DD，早于今日视为逾期；空/非法返回 false */
export function isOverdue(deadlineStr) {
  if (!deadlineStr || typeof deadlineStr !== 'string') return false;
  const d = new Date(deadlineStr + 'T23:59:59');
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/* ============ 各学院推免奖励加分细则（按学院展示） ============ */

/**
 * 按学院区分的"学院奖励加分"细则（上限均 25 分，公式全校统一：
 * 综合评定成绩 = 加权平均成绩×85% + 各类奖励总分×15%）。
 * 学校统一加分（上限 75 分：退役≤40 / A类竞赛≤30 / 口试≤5 / 国际组织实习 3 / 体测≤3）见 BAOYAN_CENTER.bonusRules.campus，
 * 不再逐院重复。以下只列各学院"学院奖励加分"差异项。
 *
 * 说明：各学院分值整理自本校官网公示（来源见 source/notice，均为"中南财大 XX 学院推免实施细则"），
 * 少数学院未挂网完整分值表则置 unpub:true 并标注，避免臆造。
 */
export const BONUS_RULES_BY_COLLEGE = {
  '信息工程学院': {
    source: '信息工程学院 2026 届推免实施细则（2026-06 公示）',
    editable: [
      { module: '奖学金', name: '文澜 / 国家 / 国家励志奖学金', score: '20 / 15 / 10 分', cond: '校级一/二/三 8/6/4，多项取最高' },
      { module: '学科竞赛', name: '国家级竞赛个人一/二/三', score: '20 / 15 / 12 分', cond: '团队主持 15/12/10、成员 10/8/6' },
      { module: '学科竞赛', name: '省级竞赛个人一/二/三', score: '10 / 8 / 6 分', cond: '团队主持 8/6/4、成员 4/3/2' },
      { module: '学术论文', name: 'A/B/C 类期刊', score: '独撰 25 / 20 / 15 分', cond: '合著一作 70%、二作 30%' },
      { module: '专利', name: '发明专利（正式证书+发明过程证明）', score: '独有 20 分', cond: '共有一作 70%、二作 30%；软著不加分' },
      { module: '志愿服务', name: '国家级志愿服务赛个人一/二/三', score: '10 / 8 / 6 分', cond: '团队主持 8/6/4、成员 4/3/2' },
    ],
  },
  '金融学院': {
    source: '金融学院推免生遴选综合测评细则（PDF）',
    editable: [
      { module: '荣誉 / 奖学金', name: '文澜 / 国奖 / 励志 / 社会类', score: '6 / 3 / 1 / 1 分', cond: '校级一/二/三 2/1/0.5，多项取最高' },
      { module: '特殊学术专长', name: 'C 类期刊', score: '独撰 10 / 一作 8 分', cond: '按期刊等级计分' },
      { module: '特殊学术专长', name: 'B- / B / A- / A / A+ 类期刊', score: '×2 / ×3 / ×6 / ×9 / ×15 分', cond: '以硕士学位论文期刊分类为基础' },
    ],
  },
  '会计学院': {
    source: '会计学院推免实施细则',
    editable: [
      { module: '学术论文', name: '一类权威期刊', score: '100 分', cond: '独撰/一作；特等奖按一等 1.5 倍' },
      { module: '学术论文', name: '二类权威期刊', score: '75 分', cond: '独撰/一作' },
      { module: '学术论文', name: '会计研究 / 三类权威', score: '50 / 15 分', cond: '独撰/一作' },
      { module: '学术论文', name: 'CSSCI / 人大复印资料转载', score: '5 / 5 分', cond: '独撰/一作' },
      { module: '特殊学术专长', name: 'A- 类及以上期刊', score: '独立/一作方可认定', cond: '作为特殊专长申报' },
    ],
  },
  '刑事司法学院': {
    source: '刑事司法学院推免细则（2024-11 修订）',
    editable: [
      { module: '学术论文', name: '权威期刊', score: '独撰 20 分', cond: '合著一作 70%、二作 30%' },
      { module: '学术论文', name: '核心期刊', score: '独撰 10 分', cond: '合著一作 70%、二作 30%' },
    ],
  },
  '哲学院': {
    source: '哲学院推免细则（2025-03 修订）',
    editable: [
      { module: '学科竞赛', name: '挑战杯全国特等奖', score: '30 / 27 / 25 分', cond: '个人（或按团队分工）' },
      { module: '学科竞赛', name: '校级竞赛个人一/二/三', score: '3 / 2 / 1 分', cond: '团体 2/1/0.5' },
      { module: '学术活动', name: '国家级专业学术活动', score: '4 / 3 / 2 分', cond: '按获奖等级' },
      { module: '特殊学术专长', name: 'CSSCI（A/B 刊）', score: '独撰或一作方可认定', cond: '作为特殊专长申报' },
    ],
  },
  '公共管理学院': {
    source: '公共管理学院推免实施细则（PDF）',
    editable: [
      { module: '学科竞赛', name: '校级竞赛个人一/二/三', score: '3 / 2 / 1 分', cond: '团体 2/1/0.5' },
      { module: '科研成果', name: '省级科研成果一/二/三', score: '8 / 4 / 2 分', cond: '以主办单位级别认定' },
    ],
  },
  '外国语学院': {
    source: '外国语学院推免实施细则（含科研项目计分表）',
    editable: [
      { module: '科研项目', name: '主持项目结项（教育部 / 省级 / 校级）', score: '5 / 3 / 1 分', cond: '按立项级别与结项情况' },
    ],
  },
  '统计与数学学院': {
    source: '统计与数学学院推免实施细则',
    editable: [
      { module: '奖学金', name: '茂年奖学金', score: '另有学院设奖', cond: '细则见学院附件分表' },
    ],
  },
  '财政税务学院': {
    source: '财政税务学院推免实施细则（2025-04 修订）',
    editable: [
      { module: '荣誉 / 兵役 / 竞赛 / 口语', name: '荣誉、兵役(≤40)、学科竞赛(≤30)、英语口试等', score: '详见学院六类计分表', cond: '细则见学院附件' },
    ],
  },
  '工商管理学院': {
    source: '工商管理学院推免实施细则（2024-06 修订）',
    editable: [
      { module: '学院加分', name: '学院加分㈠-㈤类', score: '合计 ≤ 25 分', cond: '额外奖励㈥㈦由学校审核（退役40/A类竞赛30）' },
    ],
  },
  '经济学院': {
    source: '经济学院推免生奖励计分实施细则',
    editable: [
      { module: '奖励加分', name: '含 A 类竞赛、论文、退役等', score: '上限 25 分', cond: '具体分值见学院附件1.1' },
    ],
  },
  '法学院': {
    source: '法学院推免实施细则',
    editable: [
      { module: '奖励加分', name: '竞赛（法律技能/科研/志愿/外语）、论文、荣誉、奖学金', score: '合计 ≤ 25 分', cond: '学院额外奖励另算' },
    ],
  },
  '马克思主义学院': {
    unpub: true,
    source: '未检索到公开的学院奖励加分分值表（仅见接收推免招生办法）',
    editable: [],
  },
  '新闻与文化传播学院': {
    unpub: true,
    source: '有实施细则与报名通知，但加分分值表未公开',
    editable: [],
  },
};

/** 各学院官方细则来源链接（前端"原始链接"） */
export const COLLEGE_RULE_URLS = {
  '信息工程学院': 'https://xagx.zuel.edu.cn/2026/0610/c2091a432304/page.htm',
  '经济学院': 'https://jjxy.zuel.edu.cn/2026/0824/c2744a436972/page.htm',
  '金融学院': 'https://finance.zuel.edu.cn/_upload/article/files/f1/c5/1f9149ac4d1293d0f02e3bb59077/4152c4e9-46be-4fdb-9bb6-7a6a9db90ee8.pdf',
  '会计学院': 'https://kjxy.zuel.edu.cn/_t298/xzzx_15510/list.htm',
  '统计与数学学院': 'https://tsxy.zuel.edu.cn/_t409/2025/0106/c4801a383650/page.htm',
  '财政税务学院': 'https://csxy.zuel.edu.cn/_upload/article/files/08/72/e2642bc241abb6dcf93feea5afa3/c5235ced-560f-45d7-b326-6e62fcffdfa7.pdf',
  '工商管理学院': 'https://gsxy.zuel.edu.cn/2024/0820/c4121a370758/pagem.htm',
  '法学院': 'https://law.zuel.edu.cn/2024/0831/c17044a396524/page.htm',
  '刑事司法学院': 'https://cjs.zuel.edu.cn/2024/1231/c3114a383223/page.htm',
  '哲学院': 'https://zxy.zuel.edu.cn/2025/0901/c4567a404248/page.htm',
  '外国语学院': 'https://wgyxy.zuel.edu.cn/_t783/2024/0613/c11140a367671/pagem.htm',
  '公共管理学院': 'https://ggglxy.zuel.edu.cn/_upload/article/files/1b/1b/7c553fa34129ac797ee1d2b0d78c/f57542ff-4a43-4573-8aa1-ca34596a3b69.pdf',
};