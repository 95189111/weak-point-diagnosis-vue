/**
 * AI 能力引擎（Mock 实现）
 * 全部"生成"均基于本地种子数据 + 模板化自然语言合成，模拟大模型的输出形态：
 * 流式文本、Markdown 排版、结构化题目。业务数据完全真实，可放心演示。
 */
import { db } from '@/mock/db'
import { round1 } from '@/mock/utils'

const THINK_STEPS = ['正在读取学情数据…', '正在分析薄弱证据链…', '正在组织教学建议…']

function setting() {
  return db.list('settings')[0] || { weakThreshold: 60, warnThreshold: 70, reviewDays: 7 }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function fmt(v) {
  return Number(v || 0).toFixed(1)
}

function weakPoints(limit = 5) {
  return db.filter('knowledgePoints', (k) => k.level === '薄弱')
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit)
}

function classOverview() {
  const students = db.list('students')
  return db.list('classes').map((c) => {
    const members = students.filter((s) => s.classId === c.id)
    return {
      ...c,
      avgMastery: members.length ? members.reduce((s, m) => s + m.mastery, 0) / members.length : 0,
      warning: members.filter((m) => m.status === '预警').length,
    }
  }).sort((a, b) => a.avgMastery - b.avgMastery)
}

/* ---------------- 1. 诊断单 AI 解读 ---------------- */

export function explainDiagnosis(diagId) {
  const d = db.get('diagnoses', diagId)
  if (!d) throw { code: 404, msg: '诊断单不存在' }
  const cfg = setting()
  const gap = d.classRate - d.normRate
  const lines = []
  lines.push(`## 诊断解读：${d.kpName}`)
  lines.push(`> **结论**：${d.level}级薄弱风险 · 掌握度 ${fmt(d.mastery)}% · 班级 ${d.className} · 近三次趋势「${d.trend}」`)
  lines.push('')
  lines.push('### 一、数据证据')
  lines.push(`- 掌握度 **${fmt(d.mastery)}%**，${d.mastery < cfg.weakThreshold ? `低于薄弱阈值 ${cfg.weakThreshold}%，已进入薄弱区间` : `介于临界区间（${cfg.weakThreshold}%~${cfg.warnThreshold}%），需防止进一步下滑`}`)
  lines.push(`- 班级得分率 **${fmt(d.classRate)}%**，相对年级常模（${fmt(d.normRate)}%）${gap < -5 ? `低 ${fmt(Math.abs(gap))} 个百分点，**显著落后**` : gap < 0 ? `略低 ${fmt(Math.abs(gap))} 个百分点，属于正常波动边缘` : '高出常模，但掌握度仍需巩固'}`)
  lines.push(`- 关联样本 ${d.questionCount} 题，${d.questionCount >= 8 ? '样本量充足，判定可信' : '样本偏少，建议结合课堂观察佐证'}`)
  lines.push(`- 趋势判定「${d.trend}」：${d.trend === '下降' ? '连续测试均值下行，**已触发干预信号**' : '尚未出现连续下滑，保持观察即可'}`)
  lines.push('')
  lines.push('### 二、成因分析')
  lines.push(`${d.cause}。结合认知层级「${db.get('knowledgePoints', d.kpId)?.cognitive || '-'}」判断：`)
  lines.push('- 错误主要集中在该知识点的**核心变式**上，而非偶发失误；')
  lines.push('- 先修知识链条可能存在松动，建议在讲评时前置回顾先修结论；')
  lines.push('- 学生书写与检验环节的规范性需同步纠正。')
  lines.push('')
  lines.push('### 三、教学建议')
  lines.push(`1. **重讲**：用 1 个课时重讲「${d.kpName}」的核心结论与推导过程，配 2 道入门变式；`)
  lines.push(`2. **靶向练习**：从题库按该知识点组一套 ${Math.max(6, Math.min(12, d.questionCount))} 题的基础→提升梯度练习，一周内完成；`)
  lines.push('3. **面批面改**：对掌握度后 30% 的学生逐一面对面批改，纠正步骤跳漏；')
  lines.push('4. **同伴互助**：安排本班该知识点掌握度前 3 名学生结对辅导，两周后复查。')
  lines.push('')
  lines.push(`### 四、复查安排`)
  lines.push(`按系统设置，建议 **${cfg.reviewDays} 天后**通过复查测试回写掌握度；若届时掌握度仍低于 ${cfg.weakThreshold}%，升级为小组干预并通知教研组长督办。`)
  return { markdown: lines.join('\n') }
}

/* ---------------- 2. 学生学情 AI 评语 ---------------- */

export function studentComment(studentId) {
  const s = db.get('students', studentId)
  if (!s) throw { code: 404, msg: '学生不存在' }
  const scores = db.filter('scoreRecords', (r) => r.studentId === studentId)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const weak = db.filter('diagnoses', (d) => d.classId === s.classId && ['薄弱', '临界'].includes(d.level))
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3)
  const delta = scores.length >= 2 ? scores[scores.length - 1].score - scores[0].score : 0
  const trendText = delta >= 2 ? `较学期初提升 ${delta} 分，进步势头明显` : delta <= -2 ? `较学期初回落 ${Math.abs(delta)} 分，需要重点关注` : '成绩整体平稳，波动在正常范围'
  const lines = []
  lines.push(`## 学情画像解读：${s.name}（${s.className} · ${s.group}）`)
  lines.push('')
  lines.push('### 一、总体表现')
  lines.push(`- 综合掌握度 **${fmt(s.mastery)}%**，薄弱知识点 ${s.weakCount} 个，最近一次成绩 **${s.lastScore} 分**（班级第 ${s.classRank} 名）；`)
  lines.push(`- 成绩趋势：${trendText}；当前状态「${s.status}」${s.status === '预警' ? '，已达到预警线，建议尽快启动一对一辅导' : s.status === '关注' ? '，建议保持每周跟踪' : '，保持现有学习节奏'}`)
  lines.push('')
  if (scores.length) {
    lines.push('### 二、历次成绩走势')
    lines.push('| 考试 | 日期 | 得分 | 班级排名 |')
    lines.push('| --- | --- | --- | --- |')
    scores.forEach((r) => {
      lines.push(`| ${r.examName} | ${r.date} | ${r.score} | ${r.classRank} |`)
    })
    lines.push('')
  }
  lines.push('### 三、薄弱知识点')
  if (weak.length) {
    weak.forEach((d, i) => {
      lines.push(`${i + 1}. **${d.kpName}**（掌握度 ${fmt(d.mastery)}%，${d.level}）：${d.cause}`)
    })
  } else {
    lines.push('暂无突出的薄弱知识点，可适当提供拓展性练习保持学习张力。')
  }
  lines.push('')
  lines.push('### 四、个性化学习建议')
  lines.push(`1. 每天安排 15 分钟针对「${weak[0]?.kpName || '本章重点'}」的基础题训练，先保证正确率再提速；`)
  lines.push('2. 建立「错题重做本」，每周重做本周错题，二次正确率目标 80% 以上；')
  lines.push('3. 课堂上有意识地回答该模块的提问，用输出倒逼理解；')
  lines.push(`4. 家校配合：${s.trend === '下降' ? '近期成绩下滑，建议家长关注作业完成质量，并与任课老师每周沟通一次' : '保持当前的家庭作业监督节奏，多给予正向鼓励'}。`)
  lines.push('')
  lines.push(`> ${pick(['学习如登山，贵在坚持，你已经走在正确的路上。', '每弄懂一个薄弱点，就离目标近一步，加油！', '把不会的变成会的，把会的变成熟练的，这就是进步。'])}`)
  return { markdown: lines.join('\n') }
}

/* ---------------- 3. AI 智能组卷 ---------------- */

const QUIZ_TEMPLATES = {
  记忆: {
    stem: (kp) => `下列关于「${kp.name}」的结论中，正确的是（　）`,
    options: (kp) => [
      `「${kp.name}」的相关结论在任何情形下都无需验证即可使用`,
      `应用「${kp.name}」时必须先确认其成立的前提条件`,
      `「${kp.name}」与其先修知识没有任何关联`,
      `「${kp.name}」只出现在解答题中，选择题不会考查`,
    ],
    analysis: (kp) => `「${kp.name}」的结论有明确的适用前提，解题时应先核对条件再套用结论；同时它是建立在先修知识点基础上的，需要整体记忆形成知识链。`,
  },
  理解: {
    stem: (kp) => `关于「${kp.name}」的概念本质，下列理解正确的是（　）`,
    options: (kp) => [
      `只需记住「${kp.name}」的结论，不必理解其推导过程`,
      `「${kp.name}」是在${kp.prevCode ? `「${db.find('knowledgePoints', (k) => k.code === kp.prevCode)?.name || '先修知识'}」` : '已学知识'}的基础上拓展而来的`,
      `「${kp.name}」与同章节其他知识点完全独立、互不相关`,
      `判断「${kp.name}」的相关命题时不需要任何依据`,
    ],
    analysis: (kp) => `「${kp.name}」承继了先修知识的逻辑链条，理解推导过程才能在变式情境中正确迁移，概念辨析类题目正是考查这一层次。`,
  },
  应用: {
    stem: (kp) => `运用「${kp.name}」解决问题时，下列做法最规范的是（　）`,
    options: (kp) => [
      `读完题后直接写出最终答案，节省时间`,
      `先标注已知条件与求解目标，再选择「${kp.name}」的对应依据分步书写`,
      `跳过审题环节，凭印象套用公式`,
      `只检查计算结果，不检查推理步骤`,
    ],
    analysis: (kp) => `应用「${kp.name}」的标准流程：审题标注条件 → 选择判定/性质依据 → 分步推理书写 → 回代检验。步骤跳漏是本知识点失分的主因。`,
  },
  分析: {
    stem: (kp) => `综合题中同时出现「${kp.name}」与其他章节条件时，最合适的解题策略是（　）`,
    options: (kp) => [
      `只用与「${kp.name}」直接相关的条件，忽略其余条件`,
      `先把各条件按知识模块拆分归类，再建立「${kp.name}」与先修知识之间的联系`,
      `把所有条件混在一起同时计算`,
      `条件过多时直接放弃作答`,
    ],
    analysis: (kp) => `综合情境下应先做「条件归位」：把题设拆分到各知识模块，识别「${kp.name}」在其中的桥梁作用，再串联推理，避免分类讨论遗漏。`,
  },
}

export function generateQuiz(kpId, difficulty = '基础', count = 5) {
  const kp = db.get('knowledgePoints', kpId)
  if (!kp) throw { code: 404, msg: '知识点不存在' }
  if (!['基础', '提升', '综合'].includes(difficulty)) throw { code: 1, msg: '难度取值不合法' }
  const order = { 基础: ['记忆', '理解', '应用'], 提升: ['理解', '应用', '分析'], 综合: ['应用', '分析'] }
  const pool = order[difficulty]
  const prevName = kp.prevCode ? (db.find('knowledgePoints', (k) => k.code === kp.prevCode)?.name || '') : ''
  const questions = []
  for (let i = 0; i < count; i++) {
    const cognitive = pool[i % pool.length]
    const tpl = QUIZ_TEMPLATES[cognitive]
    const correctText = tpl.options(kp)[1]
    const wrongs = tpl.options(kp).filter((_, idx) => idx !== 1)
    const answerIdx = Math.floor(Math.random() * 4)
    const options = []
    let w = 0
    for (let j = 0; j < 4; j++) {
      options.push(j === answerIdx ? correctText : wrongs[w++])
    }
    const prefix = difficulty === '基础' ? '【基础巩固】' : difficulty === '提升' ? '【变式提升】' : '【综合应用】'
    questions.push({
      index: i + 1,
      stem: `${prefix}${tpl.stem(kp)}`,
      options,
      answer: 'ABCD'[answerIdx],
      analysis: tpl.analysis(kp) + (prevName ? `（先修关联：${prevName}）` : ''),
      difficulty,
      cognitive,
      kpName: kp.name,
    })
  }
  return { questions, kpName: kp.name, difficulty }
}

/* ---------------- 4. 班级讲评报告 ---------------- */

export function reportComment(payload = {}) {
  const classes = classOverview()
  const worst = classes[0]
  const best = classes[classes.length - 1]
  const weak = weakPoints(3)
  const pending = db.filter('diagnoses', (d) => d.status === '待复核').length
  const lines = []
  lines.push(`## 班级学情讲评报告`)
  lines.push(`> 生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })} · 分析范围：${payload.classId ? (db.get('classes', payload.classId)?.name || '指定班级') : '全年级'}${payload.chapter ? ` · 章节：${payload.chapter}` : ''}`)
  lines.push('')
  lines.push('### 一、总体情况')
  lines.push(`全年级平均掌握度 ${fmt(classes.reduce((s, c) => s + c.avgMastery, 0) / (classes.length || 1))}%。`)
  lines.push(`- 掌握最佳：**${best.name}**（${fmt(best.avgMastery)}%）；需重点帮扶：**${worst.name}**（${fmt(worst.avgMastery)}%），两班级差 ${fmt(best.avgMastery - worst.avgMastery)} 个百分点。`)
  lines.push(`- 当前待复核诊断单 ${pending} 份，建议本周内完成复核，避免干预窗口后移。`)
  lines.push('')
  lines.push('### 二、薄弱知识点聚焦')
  weak.forEach((k, i) => {
    lines.push(`${i + 1}. **${k.name}**（${k.chapter}）：掌握度 ${fmt(k.mastery)}%，关联 ${k.questionCount} 题，${k.cognitive}层级`)
  })
  lines.push('')
  lines.push('### 三、分层教学建议')
  lines.push(`- **${best.name}**：保持节奏，布置综合变式题维持思维张力；`)
  lines.push(`- **中间班级**：针对上表薄弱点安排 ${setting().reviewDays} 天内的靶向小练习，讲评时优先覆盖；`)
  lines.push(`- **${worst.name}**：建议教研组介入，将薄弱点诊断单转为干预任务，明确责任人与期限。`)
  lines.push('')
  lines.push('### 四、讲评课安排建议')
  lines.push(`1. 用 10 分钟数据复盘（本报告图表投影）；`)
  lines.push(`2. 用 25 分钟精讲「${weak[0]?.name || '重点章节'}」典型错误；`)
  lines.push(`3. 用 10 分钟当堂变式检测，回收数据更新掌握度。`)
  return { markdown: lines.join('\n') }
}

/* ---------------- 5. 今日教学简报 ---------------- */

export function briefing() {
  const diagnoses = db.list('diagnoses')
  const pending = diagnoses.filter((d) => d.status === '待复核')
  const interventions = db.list('interventions')
  const today = new Date().toISOString().slice(0, 10)
  const overdue = interventions.filter((i) => i.status !== '已销号' && i.deadline < today)
  const students = db.list('students')
  const warning = students.filter((s) => s.status === '预警')
  const weak = weakPoints(3)
  const lines = []
  lines.push('## 今日教学简报')
  lines.push(`> 数据口径：${setting().term} · ${setting().school}`)
  lines.push('')
  lines.push('### 待办聚焦')
  lines.push(`- 待复核诊断单 **${pending.length}** 份${pending.length ? `，最早一份为「${pending[pending.length - 1]?.kpName || ''}」，建议今日优先复核` : ''}`)
  lines.push(`- 逾期干预任务 **${overdue.length}** 项${overdue.length ? `，涉及 ${[...new Set(overdue.map((i) => i.className))].join('、')}` : ''}`)
  lines.push(`- 预警学生 **${warning.length}** 名${warning.length ? `（${warning.slice(0, 3).map((s) => s.name).join('、')}${warning.length > 3 ? ' 等' : ''}）` : ''}`)
  lines.push('')
  lines.push('### 薄弱知识点雷达')
  weak.forEach((k) => {
    lines.push(`- ${k.name}：掌握度 ${fmt(k.mastery)}%（${k.chapter}）`)
  })
  lines.push('')
  lines.push('### 今日三条建议')
  lines.push(`1. 复核「${weak[0]?.name || '重点知识点'}」相关诊断单并推送靶向练习；`)
  lines.push(`2. 对逾期干预逐项确认措施与期限，必要时升级至教研组长；`)
  lines.push(`3. 利用课堂小测回收「${weak[0]?.chapter || '重点章节'}」数据，验证上次干预效果。`)
  return { markdown: lines.join('\n') }
}

/* ---------------- 6. 智能助手对话 ---------------- */

export function chat(message) {
  const text = String(message || '').trim()
  if (!text) throw { code: 1, msg: '请输入您的问题' }
  const lower = text.toLowerCase()
  if (/薄弱|薄弱点|薄弱知识/.test(text)) {
    const weak = weakPoints(5)
    const lines = ['当前共识别出 **' + weak.length + '** 个薄弱知识点（按掌握度升序）：', '', '| 知识点 | 章节 | 掌握度 | 关联题量 |', '| --- | --- | --- | --- |']
    weak.forEach((k) => lines.push(`| ${k.name} | ${k.chapter} | ${fmt(k.mastery)}% | ${k.questionCount} |`))
    lines.push('')
    lines.push(`建议优先处理「${weak[0]?.name}」：先复核其诊断单，再用「靶向练习 → AI 智能组卷」一键生成变式训练。`)
    return { markdown: lines.join('\n') }
  }
  if (/班级|对比|哪个班/.test(text)) {
    const classes = classOverview()
    const lines = ['各班掌握度概览（升序）：', '', '| 班级 | 学生数 | 平均掌握度 | 预警人数 |', '| --- | --- | --- | --- |']
    classes.forEach((c) => lines.push(`| ${c.name} | ${c.studentCount} | ${fmt(c.avgMastery)}% | ${c.warning} |`))
    lines.push('')
    lines.push(`「${classes[0].name}」当前最需要帮扶，可在「班级对比」页查看分数段分布与知识点级差，并一键生成讲评报告。`)
    return { markdown: lines.join('\n') }
  }
  const student = db.list('students').find((s) => text.includes(s.name))
  if (student && /学生|画像|怎么样|情况|成绩/.test(text)) {
    const weak = db.filter('diagnoses', (d) => d.classId === student.classId && ['薄弱', '临界'].includes(d.level))
      .sort((a, b) => a.mastery - b.mastery).slice(0, 3)
    const lines = [`**${student.name}**（${student.className} · ${student.group}）当前掌握度 ${fmt(student.mastery)}%，最近成绩 ${student.lastScore} 分（班级第 ${student.classRank} 名），状态「${student.status}」。`]
    if (weak.length) {
      lines.push('', '薄弱知识点：')
      weak.forEach((d) => lines.push(`- ${d.kpName}（${d.level}，${fmt(d.mastery)}%）`))
    }
    lines.push('', '可在「学生画像」页查看完整档案，并使用 AI 学情评语生成个性化辅导建议。')
    return { markdown: lines.join('\n') }
  }
  if (/干预|计划|辅导|逾期/.test(text)) {
    const today = new Date().toISOString().slice(0, 10)
    const running = db.filter('interventions', (i) => i.status === '进行中')
    const overdue = db.filter('interventions', (i) => i.status !== '已销号' && i.deadline < today)
    const lines = [`当前进行中的干预任务 **${running.length}** 项，逾期 **${overdue.length}** 项。`, '']
    if (overdue.length) {
      lines.push('逾期任务清单：')
      overdue.forEach((i) => lines.push(`- ${i.no}（${i.className} · ${i.kpName}）责任人 ${i.owner}，期限 ${i.deadline}`))
      lines.push('')
    }
    lines.push('建议：对逾期任务先确认卡点（学生配合度/复查成绩），必要时在「干预跟踪」页更新进度或升级责任人。')
    return { markdown: lines.join('\n') }
  }
  if (/练习|作业|出题|组卷|题目/.test(text)) {
    const running = db.filter('practices', (p) => p.status === '进行中')
    const weak = weakPoints(1)[0]
    return { markdown: ['当前进行中的练习 **' + running.length + '** 个。', '', weak ? `针对最薄弱的「${weak.name}」（掌握度 ${fmt(weak.mastery)}%），推荐在「靶向练习」页使用 **AI 智能组卷**：选择该知识点 + 难度「提升」+ 6 题，一键生成变式训练并推送至薄弱学生。` : '题库数据准备中。'].join('\n') }
  }
  if (/报告|总结|简报|讲评/.test(text)) {
    return briefing()
  }
  if (/趋势|进步|退步|变化/.test(text)) {
    const down = db.filter('diagnoses', (d) => d.trend === '下降')
    const lines = [`当前呈「下降」趋势的诊断 **${down.length}** 条：`, '']
    down.slice(0, 5).forEach((d) => lines.push(`- ${d.className} · ${d.kpName}：掌握度 ${fmt(d.mastery)}%`))
    lines.push('', '连续下滑的知识点已触发干预信号，建议本周内完成复核并启动干预。')
    return { markdown: lines.join('\n') }
  }
  return { markdown: ['我是本系统的 **AI 教学助手**，可以帮你：', '', '- 查询**薄弱知识点**与掌握度排名', '- 对比**班级**学情、生成讲评报告', '- 查询**学生**画像（直接输入学生姓名）', '- 跟踪**干预任务**与逾期情况', '- 推荐**靶向练习**与组卷方案', '', '试试问我：「本年级最薄弱的三个知识点是什么？」'].join('\n') }
}

export const AI_THINK_STEPS = THINK_STEPS
