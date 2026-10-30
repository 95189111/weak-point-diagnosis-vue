/** 薄弱知识点识别模块：与原后端 apps/diagnosis 业务规则一致（含核心识别算法） */
import { db } from '../db'
import { authUser } from '../auth'
import { clamp, failErr, nowText, ok, percent, round1, stampId, todayStr, toInt, trendOf, ymStamp } from '../utils'
import { writeLog } from './accounts'

const CAUSE_BY_COGNITIVE = {
  记忆: '基本结论记忆不牢，相近法则相互干扰',
  理解: '概念边界理解不清，条件与结论对应关系混淆',
  应用: '解题步骤跳步，规范书写与检验环节缺失',
  分析: '综合情境下信息提取不完整，分类讨论遗漏',
}

export function diagnosisDict(d) {
  return { ...d }
}

export function studentDict(s) {
  return { ...s }
}

function getSetting() {
  return db.list('settings')[0] || { weakThreshold: 60, warnThreshold: 70, reviewDays: 7 }
}

function classTrend(classId) {
  const rows = db.filter('scoreRecords', (s) => s.classId === classId)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const buckets = {}
  rows.forEach((item) => {
    if (!buckets[item.examId]) buckets[item.examId] = { date: item.date, scores: [] }
    buckets[item.examId].scores.push(item.score)
  })
  const ordered = Object.values(buckets).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  return trendOf(ordered.map((b) => b.scores.reduce((s, v) => s + v, 0) / b.scores.length))
}

/** 核心识别算法：掌握度 = 班级得分率×0.62 + 知识点基准×0.38 − 趋势罚分(下滑3分) */
export function detect(kpId, classId, examId = '', owner = '系统') {
  const kp = db.get('knowledgePoints', kpId)
  if (!kp) failErr('知识点不存在')
  const schoolClass = db.get('classes', classId)
  if (!schoolClass) failErr('班级不存在')
  let scores = db.filter('scoreRecords', (s) => s.classId === classId)
  let exam = null
  if (examId) {
    exam = db.get('exams', examId)
    if (!exam) failErr('考试批次不存在')
    scores = scores.filter((s) => s.examId === examId)
  }
  const avg = scores.length ? scores.reduce((s, r) => s + (r.score || 0), 0) / scores.length : 0
  const classRate = percent(avg, 120)
  const trend = classTrend(classId)
  const penalty = trend === '下降' ? 3.0 : 0.0
  const mastery = round1(clamp(classRate * 0.62 + Number(kp.classRate) * 0.38 - penalty, 15, 98))
  const cfg = getSetting()
  const level = mastery < cfg.weakThreshold ? '薄弱' : mastery < cfg.warnThreshold ? '临界' : '达标'
  if (level === '达标') failErr(`该知识点掌握度已达 ${mastery.toFixed(1)}%，无需生成诊断`)
  const cause = CAUSE_BY_COGNITIVE[kp.cognitive] || '知识点掌握不牢，错误集中在变式题'
  const suggestion = `重讲${kp.name}的核心结论并安排变式训练，结合面批纠正书写步骤`
  const stamp = nowText()
  const existing = db.find('diagnoses', (d) =>
    d.kpId === kpId && d.classId === classId && ['待复核', '已确认'].includes(d.status))
  if (existing) {
    Object.assign(existing, {
      mastery, classRate,
      normRate: Number(kp.classRate),
      gradeRate: Number(kp.classRate),
      trend, level, cause, suggestion,
      questionCount: kp.questionCount,
      createdAt: stamp.slice(0, 16),
    })
    return [diagnosisDict(existing), false]
  }
  const no = db.nextNo('diagnoses', 'no', 'ZD' + ymStamp())
  const row = db.insert('diagnoses', {
    id: 'D-' + stampId(),
    no,
    kpId: kp.id, kpName: kp.name, chapter: kp.chapter,
    classId: schoolClass.id, className: schoolClass.name,
    examId: exam ? exam.id : '', examName: exam ? exam.name : '',
    mastery, classRate,
    gradeRate: Number(kp.classRate),
    normRate: Number(kp.classRate),
    trend, level, cause, suggestion,
    status: '待复核', owner,
    createdAt: stamp.slice(0, 16), reviewedAt: '',
    questionCount: kp.questionCount,
  })
  return [diagnosisDict(row), true]
}

export function markPushed(diagId) {
  const row = db.get('diagnoses', diagId)
  if (row) {
    row.status = '已推送'
    row.reviewedAt = nowText().slice(0, 16)
  }
  return row
}

function evidence(row) {
  const gap = row.classRate - row.normRate
  return [
    { metric: '知识点掌握度', value: `${Number(row.mastery).toFixed(1)}%`, reference: '薄弱阈值 60%', judge: row.mastery < 60 ? '低于阈值' : '高于阈值' },
    { metric: '班级得分率', value: `${Number(row.classRate).toFixed(1)}%`, reference: `年级常模 ${Number(row.normRate).toFixed(1)}%`, judge: gap < -5 ? '显著低于常模' : gap < 0 ? '略低于常模' : '高于常模' },
    { metric: '班级与常模级差', value: `${gap.toFixed(1)} 个百分点`, reference: '±5 个百分点', judge: gap < -5 ? '超出容差' : '在容差内' },
    { metric: '连续趋势', value: row.trend, reference: '近三次考试', judge: row.trend === '下降' ? '需要干预' : '保持观察' },
    { metric: '关联题目', value: `${row.questionCount} 题`, reference: '章节题量 ≥ 8', judge: row.questionCount >= 8 ? '样本充足' : '样本偏少' },
  ]
}

export default [
  {
    method: 'GET', path: '/api/diagnosis/diagnoses',
    handler({ token, params }) {
      authUser(token)
      const kw = String(params.kw || '')
      const classId = String(params.classId || '')
      const level = String(params.level || '')
      const status = String(params.status || '')
      let rows = db.list('diagnoses')
      if (kw) rows = rows.filter((d) => d.no.includes(kw) || d.kpName.includes(kw))
      if (classId) rows = rows.filter((d) => d.classId === classId)
      if (level) rows = rows.filter((d) => d.level === level)
      if (status) rows = rows.filter((d) => d.status === status)
      const all = db.list('diagnoses')
      const avgMastery = all.reduce((s, d) => s + (d.mastery || 0), 0) / (all.length || 1)
      return ok({
        list: rows.map(diagnosisDict),
        stats: {
          weakPoints: db.filter('knowledgePoints', (k) => k.level === '薄弱').length,
          pending: all.filter((d) => d.status === '待复核').length,
          avgMastery: round1(avgMastery),
          down: all.filter((d) => d.trend === '下降').length,
        },
      })
    },
  },
  {
    method: 'GET', path: '/api/diagnosis/diagnoses/:id',
    handler({ token, path }) {
      authUser(token)
      const row = db.get('diagnoses', path.id)
      if (!row) failErr('诊断单不存在', 404)
      return ok({ ...diagnosisDict(row), evidence: evidence(row) })
    },
  },
  {
    method: 'POST', path: '/api/diagnosis/diagnoses/detect',
    handler({ token, data }) {
      const cur = authUser(token)
      const [row, created] = detect(
        String(data.kpId || ''), String(data.classId || ''),
        String(data.examId || ''), cur.name)
      writeLog(cur.name, '生成诊断', `知识点 ${row.kpName} 生成${row.level}诊断 ${row.no}`)
      return ok({ diagnosis: row, created }, created ? '诊断单已生成' : '已有诊断单已刷新')
    },
  },
  {
    method: 'POST', path: '/api/diagnosis/diagnoses/recalculate',
    handler({ token, data }) {
      const cur = authUser(token)
      const exam = db.get('exams', String(data.examId || ''))
      if (!exam) failErr('考试批次不存在')
      let created = 0
      let updated = 0
      let skipped = 0
      db.filter('knowledgePoints', (k) => k.status === '启用').forEach((kp) => {
        try {
          const [, isNew] = detect(kp.id, exam.classId, exam.id, cur.name)
          isNew ? created += 1 : updated += 1
        } catch {
          skipped += 1
        }
      })
      writeLog(cur.name, '批量诊断', `重算${exam.className}知识点诊断：新增${created}，更新${updated}，跳过${skipped}`)
      return ok({ examId: exam.id, className: exam.className, created, updated, skipped, total: created + updated }, '诊断重算完成')
    },
  },
  {
    method: 'POST', path: '/api/diagnosis/diagnoses/:id/confirm',
    handler({ token, path }) {
      const cur = authUser(token)
      const row = db.get('diagnoses', path.id)
      if (!row) failErr('诊断单不存在', 404)
      if (row.status !== '待复核') failErr('仅待复核诊断可以确认')
      row.status = '已确认'
      row.reviewedAt = nowText().slice(0, 16)
      if (!row.owner) row.owner = cur.name
      writeLog(cur.name, '确认诊断', `确认诊断单 ${row.no}（${row.kpName}，${row.level}）`)
      return ok(diagnosisDict(row), '诊断已确认')
    },
  },
  {
    method: 'POST', path: '/api/diagnosis/diagnoses/:id/close',
    handler({ token, path }) {
      const cur = authUser(token)
      const row = db.get('diagnoses', path.id)
      if (!row) failErr('诊断单不存在', 404)
      if (['待复核', '已销号'].includes(row.status)) failErr('当前状态不允许复查销号')
      row.status = '已销号'
      row.reviewedAt = nowText().slice(0, 16)
      writeLog(cur.name, '诊断销号', `诊断单 ${row.no} 复查达标，状态改为已销号`)
      return ok(diagnosisDict(row), '诊断已销号')
    },
  },
  {
    method: 'GET', path: '/api/diagnosis/classes/:id/weak-map',
    handler({ token, path }) {
      authUser(token)
      const schoolClass = db.get('classes', path.id)
      if (!schoolClass) failErr('班级不存在', 404)
      const rows = db.filter('diagnoses', (d) => d.classId === path.id)
        .sort((a, b) => a.mastery - b.mastery)
      const weak = rows.filter((x) => x.level === '薄弱')
      const critical = rows.filter((x) => x.level === '临界')
      return ok({
        classId: path.id,
        className: schoolClass.name,
        weak: weak.map(diagnosisDict),
        critical: critical.map(diagnosisDict),
        summary: { weak: weak.length, critical: critical.length, closed: rows.filter((x) => x.status === '已销号').length, total: rows.length },
      })
    },
  },
  {
    method: 'GET', path: '/api/diagnosis/classes/:id/ranking',
    handler({ token, path }) {
      authUser(token)
      const rows = db.filter('students', (s) => s.classId === path.id)
        .sort((a, b) => b.mastery - a.mastery)
      if (!rows.length) return ok([])
      const average = rows.reduce((s, x) => s + x.mastery, 0) / rows.length
      return ok(rows.map((item, index) => ({
        ...studentDict(item),
        rank: index + 1,
        gap: round1(item.mastery - average),
      })))
    },
  },
  {
    method: 'GET', path: '/api/diagnosis/students',
    handler({ token, params }) {
      authUser(token)
      const kw = String(params.kw || '')
      const classId = String(params.classId || '')
      const status = String(params.status || '')
      let rows = db.list('students')
      if (kw) rows = rows.filter((s) => s.name.includes(kw) || s.no.includes(kw))
      if (classId) rows = rows.filter((s) => s.classId === classId)
      if (status) rows = rows.filter((s) => s.status === status)
      const total = rows.length
      const warning = rows.filter((x) => x.status === '预警').length
      const avg = rows.reduce((s, x) => s + (x.mastery || 0), 0) / (total || 1)
      const weakAvg = rows.reduce((s, x) => s + (x.weakCount || 0), 0) / (total || 1)
      return ok({
        list: rows.map(studentDict),
        stats: { total, warning, avgMastery: round1(avg), weakAvg: round1(weakAvg) },
      })
    },
  },
  {
    method: 'GET', path: '/api/diagnosis/students/:id',
    handler({ token, path }) {
      authUser(token)
      const row = db.get('students', path.id)
      if (!row) failErr('学生不存在', 404)
      const scores = db.filter('scoreRecords', (s) => s.studentId === path.id)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      const weak = db.filter('diagnoses', (d) => d.classId === row.classId && ['薄弱', '临界'].includes(d.level))
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 6)
      return ok({
        student: studentDict(row),
        scores: scores.map((s) => ({ examName: s.examName, date: s.date, score: s.score, classRank: s.classRank, accuracy: s.accuracy })),
        weakPoints: weak.map(diagnosisDict),
        checkedAt: todayStr(),
      })
    },
  },
]
