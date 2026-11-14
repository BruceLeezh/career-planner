// 2026 版培养方案订正（金融学院 + 金融+法学双学位）。
// 幂等：每次服务启动时执行；同一 (college, major, grade) 只保留一份。
// 背景（联网核实）：
//  - 「金融学+法学」为 2026 年新增双学士学位项目（高考直接招生，双学士共 168 学分）。
//    此前 @(college,major='金融学+法学双学位',grade='') 的错误为空壳/拼凑课表，连法学课都没有 → 以真实「金融+法学」融合课表替换。
//  - 2026 级新生金融学院各专业数学统一由「高等数学」改为「微积分」（前几届仍为高等数学）→ 克隆生成 grade='2026' 版本，仅替换数学课名。
import { db } from './db.js';

const C = (code, name, credit, type, term) => ({
  code, name, credit: String(credit), type, core: type === '核心' ? 1 : 0,
  ...(term ? { term: String(term) } : {}),
});

/* 金融+法学 双学士学位 2026 版融合课表（金融核心 + 法学核心 + 交叉融合 + 通识思政） */
const FINANCE_LAW_2026 = [
  // 数学（2026 级为微积分）
  C('B0900471', '微积分（上）', 4, '通识', 1),
  C('B0900472', '微积分（下）', 4, '通识', 2),
  // 通识 / 思政 / 公共
  C('B2490050', '思想道德与法治', 2.5, '通识', 1),
  C('B2400055', '中国近现代史纲要', 2.5, '通识', 2),
  C('B2400015', '马克思主义基本原理概论', 2.5, '核心', 4),
  C('B2400080', '毛泽东思想和中国特色社会主义理论体系概论', 2.5, '通识', 3),
  C('B2400090', '习近平新时代中国特色社会主义思想概论', 3, '通识', 3),
  C('B2490130', '国家安全教育', 1, '通识', 1),
  C('B1100023', '大学英语（1）', 3, '通识', 1),
  C('B1100030', '大学英语（2）', 4, '通识', 2),
  C('B2090020', '军事理论', 2, '通识', 1),
  C('B2200010', '大学生心理健康', 2, '通识', 1),
  C('B1500010', '公共体育（1）', 1, '通识', 1),
  C('B1500020', '公共体育（2）', 1, '通识', 2),
  C('B1500030', '体育专项（1）', 1, '通识', 3),
  C('B1500040', '体育专项（2）', 1, '通识', 4),
  C('B2490090', '思想政治理论课实践', 2, '核心', 4),
  C('B1890120', '社会实践', 2, '通识', 6),
  C('B2090001', '军训', 2, '通识', 1),
  // 金融核心
  C('B0200193', '微观经济学', 3, '核心', 2),
  C('B0200133', '宏观经济学', 3, '核心', 3),
  C('B0300404', '货币金融学', 4, '核心', 4),
  C('B0300540', '金融市场学', 2, '核心', 4),
  C('B0800243', '会计学', 3, '核心', 3),
  C('B0700013', '财政学', 3, '核心', 4),
  C('B0800043', '财务管理学', 3, '核心', 5),
  C('B0900434', '概率论与数理统计（经管）', 4, '核心', 3),
  C('B0901323', '线性代数', 3, '通识', 3),
  C('B0901180', '统计学', 3, '核心', 4),
  C('B0300350', '国际金融（双语）', 3, '核心', 5),
  C('B0300633', '商业银行经营管理', 3, '核心', 5),
  C('B0300883', '证券投资学', 3, '通识', 5),
  C('B0300302', '公司金融', 2, '核心', 6),
  C('B0300470', '金融风险管理', 2, '核心', 6),
  C('B0301860', '数字金融', 2, '核心', 6),
  C('B0600270', '管理学通论', 2, '核心', 2),
  // 法学核心（2026 版 9 门主干：法理学/民法学总论/宪法学等按 3 学分）
  C('B0400150', '法学通论', 2, '核心', 1),
  C('B0401100', '法理学', 3, '核心', 2),
  C('B0401200', '宪法学', 3, '核心', 2),
  C('B0401300', '民法学总论', 3, '核心', 3),
  C('B0401400', '刑法学总论', 3, '核心', 3),
  C('B0401500', '民事诉讼法学', 3, '核心', 5),
  C('B0401600', '刑事诉讼法学', 3, '核心', 5),
  C('B0401700', '行政法与行政诉讼法学', 3, '核心', 4),
  C('B0401800', '经济法学', 3, '核心', 5),
  C('B0401900', '商法学', 3, '核心', 6),
  C('B0402000', '国际法学', 3, '核心', 6),
  C('B0402100', '法律职业伦理', 1, '核心', 4),
  // 三融课程（2026 新增，经法管交叉）
  C('B0402200', '法经济学', 2, '核心', 5),
  C('B0402300', '数字法学', 2, '核心', 6),
  C('B0402400', '法商管理', 2, '核心', 6),
  // 金融×法学融合方向
  C('B0300520', '金融监管学', 2, '核心', 6),
  C('B0402500', '证券法', 2, '通识', 7),
  C('B0402600', '银行法', 2, '通识', 7),
  C('B0402700', '保险法', 2, '通识', 7),
  C('B0402800', '国际金融法', 2, '通识', 7),
  C('B0402900', '法律数据分析基础与实践', 2, '核心', 7),
  C('B0403000', '证据科学实验', 2, '通识', 7),
  C('B0403100', '法律谈判与调解', 2, '通识', 7),
  // 实践 / 论文
  C('B1890010', '学年论文', 2, '核心', 7),
  C('B1890030', '毕业论文', 4, '核心', 8),
];

// 以 (college, major, grade) 幂等写入/修正一份课程清单
async function upsertCurriculum(college, major, grade, courses, anchor, meta = {}) {
  const existing = await db.one(
    'SELECT id FROM curriculums WHERE college = ? AND major = ? AND grade = ?',
    college, major, grade || ''
  );
  const payload = {
    college, major, grade: grade || '', anchor: anchor || major, category: '培养方案',
    courses: JSON.stringify(courses),
    sourceDoc: meta.sourceDoc || '',
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    const set = Object.keys(payload).map((k) => `${k} = ?`).join(', ');
    await db.run(`UPDATE curriculums SET ${set} WHERE id = ?`, ...Object.values(payload), existing.id);
    return existing.id;
  }
  const keys = Object.keys(payload);
  const cols = keys.join(', ');
  const ph = keys.map(() => '?').join(', ');
  const info = await db.run(`INSERT INTO curriculums (${cols}) VALUES (${ph})`, ...Object.values(payload));
  return Number(info.lastInsertRowid);
}

// 修正「金融学+法学双学位」：先清理旧空壳行，再落真实的 2026 融合课表
async function fixFinanceLaw() {
  await db.run("DELETE FROM curriculums WHERE college = '金融学院' AND major = '金融学+法学双学位' AND grade != '2026'");
  await upsertCurriculum('金融学院', '金融学+法学双学位', '2026', FINANCE_LAW_2026, '金融学+法学双学位', {
    sourceDoc: '2026 新增双学士（金融学+法学）；金融核心+法学主干（含 2026 新增三融课程）融合课表（联网核实口径）',
  });
}

// 金融学院各专业：为 2026 级克隆一份「微积分」版本（前几届基准版保持高等数学不变）
async function add2026MathVariant() {
  const baseRows = await db.all(
    "SELECT id, college, major, anchor, courses FROM curriculums " +
    "WHERE college = '金融学院' AND grade = '' "
  );
  for (const r of baseRows) {
    const courses = (() => { try { return JSON.parse(r.courses || '[]'); } catch { return []; } })();
    const hasHighMath = courses.some((c) => /高等数学/.test(c.name));
    if (!hasHighMath) continue;
    const variant = courses.map((c) => {
      const n = c.name;
      if (n.includes('高等数学')) {
        return {
          ...c,
          name: n.includes('（下）') ? '微积分（下）' : '微积分（上）',
          core: 0, type: '通识',
        };
      }
      return c;
    });
    await upsertCurriculum('金融学院', r.major, '2026', variant, r.anchor, {
      sourceDoc: '2026 级数学由高等数学改为微积分（其余课程沿用培养方案基准版）',
    });
  }
}

/** 服务启动时执行 2026 版培养方案订正 */
export async function seedCurriculum2026() {
  await fixFinanceLaw();
  await add2026MathVariant();
}