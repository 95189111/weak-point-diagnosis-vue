/** 学情数据导入模块：与原后端 apps/exams 业务规则一致 */
import { db } from '../db'
import { authUser } from '../auth'
import { failErr, nowText, ok, percent, round1, stampId, toInt, ymStamp } from '../utils'
import { writeLog } from './accounts'

export function examDict(e) {
  return { ...e }
}

export function scoreDict(s) {
  return { ...s }
}

function getExam(id) {
  const row = db.get('exams', id)
  if (!row) failErr('导入批次不存在', 404)
  return row
}

export default [
  {
    method: 'GET', path: '/api/exams/batches',
    handler({ token, params }) {
      authUser(token)
      const kw = String(params.kw || '')
      const type = String(params.type || '')
      const status = String(params.status || '')
      let rows = db.list('exams')
      if (kw) rows = rows.filter((e) => e.name.includes(kw) || e.no.includes(kw))
      if (type) rows = rows.filter((e) => e.type === type)
      if (status) rows = rows.filter((e) => e.status === status)
      const all = db.list('exams')
      const rowsTotal = all.reduce((s, e) => s + (e.rowsCount || 0), 0)
      const matched = all.reduce((s, e) => s + (e.matched || 0), 0)
      const abnormal = all.reduce((s, e) => s + (e.abnormal || 0), 0)
      return ok({
        list: rows.map(examDict),
        stats: { batches: all.length, rows: rowsTotal, matched, abnormal, matchRate: percent(matched, rowsTotal) },
      })
    },
  },
  {
    method: 'POST', path: '/api/exams/batches/create',
    handler({ token, data }) {
      const cur = authUser(token)
      const name = String(data.name || '').trim()
      const classId = String(data.classId || '').trim()
      const type = String(data.type || '单元测').trim()
      const date = String(data.date || '').trim()
      const rowsCount = toInt(data.rowsCount)
      const fileName = String(data.fileName || '').trim()
      if (!name) failErr('请填写考试名称')
      const schoolClass = db.get('classes', classId)
      if (!schoolClass) failErr('请选择有效的班级')
      if (!['月考', '单元测', '期中'].includes(type)) failErr('考试类型不合法')
      if (date.length !== 10) failErr('请选择考试日期')
      if (!(rowsCount >= 1 && rowsCount <= 5000)) failErr('数据行数需在 1-5000 之间')
      if (!fileName) failErr('请填写原始文件名')
      const prefix = 'KS' + ymStamp()
      const suffix = classId.split('-').pop()
      const count = db.filter('exams', (e) => e.no.startsWith(prefix)).length + 1
      const row = db.insert('exams', {
        id: 'E-' + stampId(),
        no: `${prefix}-${suffix}-${String(count).padStart(2, '0')}`,
        name, classId, className: schoolClass.name,
        subject: schoolClass.subject, type, date,
        fullScore: 120, avgScore: 0, passRate: 0, excellentRate: 0,
        rowsCount, matched: 0, abnormal: 0,
        status: '待解析', fileName,
        uploadedAt: nowText().slice(0, 16), kpCount: 0, owner: cur.name,
      })
      writeLog(cur.name, '导入成绩', `导入${name}，共${rowsCount}行`)
      return ok(examDict(row), '批次已创建')
    },
  },
  {
    method: 'GET', path: '/api/exams/batches/:id',
    handler({ token, path }) {
      authUser(token)
      const row = getExam(path.id)
      return ok({
        ...examDict(row),
        issues: db.filter('importIssues', (i) => i.examId === path.id),
        scores: db.filter('scoreRecords', (s) => s.examId === path.id).map(scoreDict),
      })
    },
  },
  {
    method: 'POST', path: '/api/exams/batches/:id/reparse',
    handler({ token, path }) {
      const cur = authUser(token)
      const row = getExam(path.id)
      if (row.status === '已归档') failErr('已归档批次不能重新解析')
      const issueCount = db.filter('importIssues', (i) => i.examId === row.id).length
      const records = db.filter('scoreRecords', (s) => s.examId === row.id)
      const avg = records.length ? records.reduce((s, r) => s + (r.score || 0), 0) / records.length : 0
      row.matched = Math.max(0, row.rowsCount - issueCount)
      row.abnormal = issueCount
      row.status = '已解析'
      row.kpCount = row.kpCount || 12
      if (avg) row.avgScore = round1(avg)
      writeLog(cur.name, '重新解析', `批次 ${row.no} 重新解析完成`)
      return ok(examDict(row), '批次已重新解析')
    },
  },
  {
    method: 'POST', path: '/api/exams/batches/:id/archive',
    handler({ token, path }) {
      const cur = authUser(token)
      const row = getExam(path.id)
      row.status = '已归档'
      writeLog(cur.name, '归档批次', `批次 ${row.no} 已归档`)
      return ok(examDict(row), '批次已归档')
    },
  },
  {
    method: 'GET', path: '/api/exams/batches/:id/validation',
    handler({ token, path }) {
      authUser(token)
      const rows = db.filter('importIssues', (i) => i.examId === path.id)
      const exam = db.get('exams', path.id)
      if (!rows.length && !exam) failErr('导入批次不存在', 404)
      const buckets = {}
      rows.forEach((i) => {
        buckets[i.issueType] = (buckets[i.issueType] || 0) + 1
      })
      return ok({
        examId: path.id,
        total: rows.length,
        handled: rows.filter((i) => i.status === '已处理').length,
        types: Object.entries(buckets).map(([name, count]) => ({ name, count })),
      })
    },
  },
  {
    method: 'GET', path: '/api/exams/summary/types',
    handler({ token }) {
      authUser(token)
      const result = []
      for (const type of ['月考', '单元测', '期中']) {
        const rows = db.filter('exams', (e) => e.type === type)
        if (!rows.length) {
          result.push({ type, batches: 0, avgScore: 0, passRate: 0 })
          continue
        }
        const avgScore = rows.reduce((s, e) => s + (e.avgScore || 0), 0) / rows.length
        const passRate = rows.reduce((s, e) => s + (e.passRate || 0), 0) / rows.length
        result.push({ type, batches: rows.length, avgScore: round1(avgScore), passRate: round1(passRate) })
      }
      return ok(result)
    },
  },
  {
    method: 'GET', path: '/api/exams/classes/:id/scores',
    handler({ token, path }) {
      authUser(token)
      const rows = db.filter('scoreRecords', (s) => s.classId === path.id)
      const latest = {}
      rows.forEach((item) => {
        if (!latest[item.studentId] || String(item.date) > String(latest[item.studentId].date)) {
          latest[item.studentId] = item
        }
      })
      const listing = Object.values(latest).map((item) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        examName: item.examName,
        date: item.date,
        score: item.score,
        accuracy: percent(item.score, item.fullScore || 120),
        classRank: item.classRank,
      }))
      listing.sort((a, b) => b.score - a.score)
      listing.forEach((item, index) => {
        item.rank = index + 1
      })
      return ok(listing)
    },
  },
  {
    method: 'GET', path: '/api/exams/students/:id/progress',
    handler({ token, path }) {
      authUser(token)
      const rows = db.filter('scoreRecords', (s) => s.studentId === path.id)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      if (!rows.length) failErr('该学生暂无成绩记录', 404)
      const scores = rows.map((r) => r.score)
      const improvement = scores[scores.length - 1] - scores[0]
      const spread = Math.max(...scores) - Math.min(...scores)
      const stability = spread <= 6 ? '稳定' : spread <= 14 ? '波动' : '起伏较大'
      return ok({
        studentId: path.id,
        studentName: rows[0].studentName,
        exams: rows.length,
        latest: scores[scores.length - 1],
        average: round1(scores.reduce((s, v) => s + v, 0) / scores.length),
        improvement,
        stability,
        trend: improvement >= 2 ? '上升' : improvement <= -2 ? '下降' : '持平',
        records: rows.map(scoreDict),
      })
    },
  },
  {
    method: 'GET', path: '/api/exams/scores',
    handler({ token, params }) {
      authUser(token)
      let rows = db.list('scoreRecords')
      if (params.studentId) rows = rows.filter((s) => s.studentId === params.studentId)
      if (params.examId) rows = rows.filter((s) => s.examId === params.examId)
      return ok(rows.map(scoreDict))
    },
  },
]
