/** 班级对比分析模块：与原后端 apps/analytics 业务规则一致 */
import { db } from '../db'
import { authUser } from '../auth'
import { clamp, failErr, nowText, ok, percent, round1, stampId, uid } from '../utils'
import { writeLog } from './accounts'

function classComparison(examId = '', chapter = '', classId = '') {
  let classes = db.list('classes')
  if (classId) classes = classes.filter((c) => c.id === classId)
  let exams = db.list('exams')
  if (examId) exams = exams.filter((e) => e.id === examId)
  const students = db.list('students')
  let diagnoses = db.list('diagnoses')
  if (chapter) diagnoses = diagnoses.filter((d) => d.chapter === chapter)
  const rows = []
  for (const c of classes) {
    const ownExams = exams.filter((e) => e.classId === c.id)
    const members = students.filter((s) => s.classId === c.id)
    const avgScore = ownExams.length ? ownExams.reduce((s, e) => s + (e.avgScore || 0), 0) / ownExams.length : 0
    const passRate = ownExams.length ? ownExams.reduce((s, e) => s + (e.passRate || 0), 0) / ownExams.length : 0
    const excellent = ownExams.length ? ownExams.reduce((s, e) => s + (e.excellentRate || 0), 0) / ownExams.length : 0
    const mastery = members.length ? members.reduce((s, m) => s + (m.mastery || 0), 0) / members.length : 0
    const weak = diagnoses.filter((d) => d.classId === c.id && d.level === '薄弱').length
    rows.push({
      id: c.id, name: c.name, teacher: c.headTeacher,
      students: members.length, avgScore: round1(avgScore),
      passRate: round1(passRate), excellentRate: round1(excellent),
      mastery: round1(mastery), weak,
    })
  }
  const baseline = rows.length ? rows.reduce((s, r) => s + r.mastery, 0) / rows.length : 0
  rows.forEach((r) => {
    r.diff = round1(r.mastery - baseline)
  })
  return rows
}

function distribution(examId = '', classId = '') {
  let rows = db.list('scoreRecords')
  if (examId) rows = rows.filter((s) => s.examId === examId)
  if (classId) rows = rows.filter((s) => s.classId === classId)
  const scores = rows.map((x) => x.score)
  const buckets = [
    ['108-120 分', 108, 121], ['96-107 分', 96, 108], ['84-95 分', 84, 96],
    ['72-83 分', 72, 84], ['60-71 分', 60, 72], ['60 分以下', 0, 60],
  ]
  return {
    items: buckets.map(([name, low, high]) => {
      const count = scores.filter((s) => s >= low && s < high).length
      return { name, count, rate: percent(count, scores.length) }
    }),
    total: scores.length,
  }
}

function trendData() {
  const exams = db.list('exams')
  const classes = db.list('classes')
  const names = [...new Set(exams.map((e) => e.name))]
  return names.map((name) => {
    const same = exams.filter((e) => e.name === name).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    return {
      name,
      date: same.length ? same[0].date : '',
      classes: classes.map((c) => {
        const hit = same.find((e) => e.classId === c.id)
        return { classId: c.id, name: c.name, avgScore: hit ? round1(hit.avgScore) : null }
      }),
    }
  })
}

function knowledgeComparison(chapter = '', classId = '') {
  let classes = db.list('classes')
  if (classId) classes = classes.filter((c) => c.id === classId)
  const students = db.list('students')
  const overall = students.length ? students.reduce((s, m) => s + m.mastery, 0) / students.length : 0
  const offsets = {}
  for (const c of classes) {
    const members = students.filter((s) => s.classId === c.id)
    offsets[c.id] = members.length ? members.reduce((s, m) => s + m.mastery, 0) / members.length - overall : 0
  }
  let kps = db.list('knowledgePoints')
  if (chapter) kps = kps.filter((k) => k.chapter === chapter)
  return kps.map((k) => {
    const values = classes.map((c) => ({
      classId: c.id,
      name: c.name,
      // 用班级整体掌握度偏移校正知识点得分率，补齐缺失的逐题数据
      rate: round1(clamp(Number(k.classRate) + (offsets[c.id] || 0), 18, 98)),
    }))
    const spread = values.length ? Math.max(...values.map((v) => v.rate)) - Math.min(...values.map((v) => v.rate)) : 0
    return {
      id: k.id, name: k.name, chapter: k.chapter, code: k.code, cognitive: k.cognitive,
      values, spread: round1(spread),
      judge: spread > 12 ? '差异显著' : spread > 6 ? '需关注' : '基本均衡',
    }
  })
}

function chapterSummary() {
  const kps = db.list('knowledgePoints')
  const diagnoses = db.list('diagnoses')
  const chapters = [...new Set(kps.map((k) => k.chapter))]
  return chapters.map((chapter) => {
    const points = kps.filter((k) => k.chapter === chapter)
    const avg = points.reduce((s, k) => s + (k.mastery || 0), 0) / (points.length || 1)
    const weak = points.filter((k) => k.level === '薄弱').length
    return {
      chapter,
      points: points.length,
      avgMastery: round1(avg),
      weak,
      diagnoses: diagnoses.filter((d) => d.chapter === chapter).length,
      questions: points.reduce((s, k) => s + (k.questionCount || 0), 0),
      judge: weak >= 2 ? '优先干预' : weak === 1 ? '持续观察' : '保持',
    }
  }).sort((a, b) => a.avgMastery - b.avgMastery)
}

function studentRanking(classId = '', limit = 10) {
  let students = db.list('students')
  if (classId) students = students.filter((s) => s.classId === classId)
  if (!students.length) return { top: [], bottom: [] }
  const sorted = [...students].sort((a, b) => b.mastery - a.mastery)
  const pick = (s) => ({ name: s.name, className: s.className, mastery: s.mastery, lastScore: s.lastScore, status: s.status })
  return {
    top: sorted.slice(0, limit).map(pick),
    bottom: sorted.slice(-limit).reverse().map(pick),
  }
}

function exportSnapshot(examId = '', chapter = '', classId = '') {
  return {
    generatedAt: nowText().slice(0, 16),
    examId,
    chapter: chapter || '全部章节',
    classId: classId || '全部班级',
    classes: classComparison(examId, chapter, classId),
    chapters: chapterSummary(),
    knowledge: knowledgeComparison(chapter, classId),
    distribution: distribution(examId, classId),
  }
}

export default [
  {
    method: 'GET', path: '/api/analytics/dashboard',
    handler({ token }) {
      authUser(token)
      const kps = db.list('knowledgePoints')
      const diagnoses = db.list('diagnoses')
      const interventions = db.list('interventions')
      const students = db.list('students')
      const classes = db.list('classes')
      const pending = diagnoses.filter((d) => d.status === '待复核')
      const running = interventions.filter((i) => i.status === '进行中')
      const overdue = interventions.filter((i) => i.status !== '已销号' && i.deadline < nowText().slice(0, 10))
      const weakRank = [...kps].sort((a, b) => a.mastery - b.mastery).slice(0, 7)
      const todo = interventions.filter((i) => i.status !== '已销号')
        .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
        .slice(0, 6)
      const classRows = classes.map((c) => {
        const members = students.filter((s) => s.classId === c.id)
        const latest = db.filter('exams', (e) => e.classId === c.id)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
        return {
          id: c.id, name: c.name, teacher: c.headTeacher,
          students: members.length,
          avgMastery: round1(members.length ? members.reduce((s, m) => s + m.mastery, 0) / members.length : 0),
          weak: diagnoses.filter((d) => d.classId === c.id && d.level === '薄弱').length,
          latestAvg: latest ? round1(latest.avgScore) : 0,
        }
      })
      return ok({
        kpi: {
          weakPoints: kps.filter((k) => k.level === '薄弱').length,
          pending: pending.length,
          running: running.length,
          overdue: overdue.length,
          warning: students.filter((s) => s.status === '预警').length,
        },
        pendingList: [...pending]
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .slice(0, 6)
          .map((d) => ({ id: d.id, no: d.no, className: d.className, kpName: d.kpName, mastery: d.mastery, level: d.level, trend: d.trend, status: d.status, createdAt: d.createdAt })),
        weakRank: weakRank.map((k) => ({ id: k.id, name: k.name, mastery: k.mastery, level: k.level })),
        todo: todo.map((i) => ({ id: i.id, no: i.no, kpName: i.kpName, className: i.className, measure: i.measure, owner: i.owner, deadline: i.deadline, status: i.status })),
        classes: classRows,
        updatedAt: nowText().slice(0, 16),
      })
    },
  },
  {
    method: 'GET', path: '/api/analytics/classes',
    handler({ token, params }) {
      authUser(token)
      return ok(classComparison(params.examId || '', params.chapter || '', params.classId || ''))
    },
  },
  {
    method: 'GET', path: '/api/analytics/distribution',
    handler({ token, params }) {
      authUser(token)
      return ok(distribution(params.examId || '', params.classId || ''))
    },
  },
  {
    method: 'GET', path: '/api/analytics/trend',
    handler({ token }) {
      authUser(token)
      return ok(trendData())
    },
  },
  {
    method: 'GET', path: '/api/analytics/knowledge',
    handler({ token, params }) {
      authUser(token)
      return ok(knowledgeComparison(params.chapter || '', params.classId || ''))
    },
  },
  {
    method: 'GET', path: '/api/analytics/reports',
    handler({ token }) {
      authUser(token)
      return ok(db.list('analysisReports').map((r) => ({ ...r })))
    },
  },
  {
    method: 'POST', path: '/api/analytics/reports',
    handler({ token, data }) {
      const cur = authUser(token)
      const name = String(data.name || '').trim()
      const scope = String(data.scope || '年级').trim()
      const examId = String(data.examId || '').trim()
      const note = String(data.note || '').trim()
      if (!name) failErr('请填写报告名称')
      if (!['年级', '班级'].includes(scope)) failErr('分析范围不合法')
      const exam = examId ? db.get('exams', examId) : null
      const row = db.insert('analysisReports', {
        id: 'R-' + stampId(),
        name, scope, examId: exam ? exam.id : '',
        examName: exam ? `${exam.className} · ${exam.name}` : '全部已归档考试',
        note, createdBy: cur.name, createdAt: nowText().slice(0, 16),
      })
      writeLog(cur.name, '生成分析报告', `生成${scope}分析报告《${name}》`)
      return ok({ ...row }, '分析报告已生成')
    },
  },
  {
    method: 'GET', path: '/api/analytics/reports/:id',
    handler({ token, path }) {
      authUser(token)
      const row = db.get('analysisReports', path.id)
      if (!row) failErr('分析报告不存在', 404)
      return ok({ ...row, snapshot: exportSnapshot(row.examId, '', '') })
    },
  },
  {
    method: 'GET', path: '/api/analytics/chapters',
    handler({ token }) {
      authUser(token)
      return ok(chapterSummary())
    },
  },
  {
    method: 'GET', path: '/api/analytics/ranking',
    handler({ token, params }) {
      authUser(token)
      return ok(studentRanking(params.classId || '', toInt(params.limit, 10) || 10))
    },
  },
  {
    method: 'GET', path: '/api/analytics/export',
    handler({ token, params }) {
      authUser(token)
      return ok(exportSnapshot(params.examId || '', params.chapter || '', params.classId || ''))
    },
  },
]

function toInt(v, d = 0) {
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? d : n
}
