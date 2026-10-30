/** 靶向练习与干预跟踪模块：与原后端 apps/practice 业务规则一致 */
import { db } from '../db'
import { authUser } from '../auth'
import { failErr, nowText, ok, percent, round1, stampId, todayStr, toFloat, toInt, ymStamp } from '../utils'
import { writeLog } from './accounts'
import { markPushed } from './diagnosis'

export function practiceDict(p) {
  return { ...p }
}

export function interventionDict(i) {
  return { ...i }
}

function closeDiagnosis(diagId) {
  const row = db.get('diagnoses', diagId)
  if (!row) failErr('诊断单不存在')
  if (['待复核', '已销号'].includes(row.status)) failErr('当前状态不允许复查销号')
  row.status = '已销号'
  row.reviewedAt = nowText().slice(0, 16)
  return row
}

export default [
  {
    method: 'GET', path: '/api/practice/practices',
    handler({ token, params }) {
      authUser(token)
      const kw = String(params.kw || '')
      const classId = String(params.classId || '')
      const status = String(params.status || '')
      let rows = db.list('practices')
      if (kw) rows = rows.filter((p) => p.name.includes(kw) || p.no.includes(kw))
      if (classId) rows = rows.filter((p) => p.classId === classId)
      if (status) rows = rows.filter((p) => p.status === status)
      const all = db.list('practices')
      const push = all.reduce((s, p) => s + (p.pushCount || 0), 0)
      const done = all.reduce((s, p) => s + (p.doneCount || 0), 0)
      const ended = all.filter((p) => p.status === '已结束' && p.secondRate > 0)
      return ok({
        list: rows.map(practiceDict),
        stats: {
          total: all.length,
          running: all.filter((p) => p.status === '进行中').length,
          doneRate: percent(done, push),
          secondRate: ended.length ? round1(ended.reduce((s, p) => s + p.secondRate, 0) / ended.length) : 0,
        },
      })
    },
  },
  {
    method: 'POST', path: '/api/practice/practices/create',
    handler({ token, data }) {
      const cur = authUser(token)
      const name = String(data.name || '').trim()
      const classId = String(data.classId || '').trim()
      const kpId = String(data.kpId || '').trim()
      const difficulty = String(data.difficulty || '基础').trim()
      const count = toInt(data.questionCount)
      const deadline = String(data.deadline || '').trim()
      const diagnosisId = String(data.diagnosisId || '').trim()
      if (!name) failErr('请填写练习名称')
      const schoolClass = db.get('classes', classId)
      if (!schoolClass) failErr('请选择推送班级')
      const kp = db.get('knowledgePoints', kpId)
      if (!kp) failErr('请选择知识点')
      if (!['基础', '提升', '综合'].includes(difficulty)) failErr('难度取值不合法')
      if (!(count >= 1 && count <= 30)) failErr('题目数量需在 1-30 之间')
      if (deadline.length !== 10) failErr('请选择完成期限')
      const pushCount = db.filter('students', (s) => s.classId === classId).length
      const no = db.nextNo('practices', 'no', 'LX' + ymStamp())
      const row = db.insert('practices', {
        id: 'P-' + stampId(),
        no, name, classId, className: schoolClass.name,
        kpNames: kp.name, difficulty, questionCount: count, deadline,
        status: '进行中', pushCount, doneCount: 0, secondRate: 0,
        owner: cur.name, createdAt: nowText().slice(0, 16),
      })
      if (diagnosisId) markPushed(diagnosisId)
      writeLog(cur.name, '推送练习', `向${schoolClass.name}推送练习 ${no}（${count}题）`)
      return ok(practiceDict(row), '练习已推送')
    },
  },
  {
    method: 'POST', path: '/api/practice/practices/:id/publish',
    handler({ token, path }) {
      const cur = authUser(token)
      const row = db.get('practices', path.id)
      if (!row) failErr('练习任务不存在', 404)
      if (row.status !== '草稿') failErr('仅草稿状态的练习可以发布')
      row.pushCount = row.pushCount || db.filter('students', (s) => s.classId === row.classId).length
      row.status = '进行中'
      writeLog(cur.name, '发布练习', `发布练习 ${row.no} 至${row.className}`)
      return ok(practiceDict(row), '练习已发布')
    },
  },
  {
    method: 'POST', path: '/api/practice/practices/:id/finish',
    handler({ token, path, data }) {
      const cur = authUser(token)
      const row = db.get('practices', path.id)
      if (!row) failErr('练习任务不存在', 404)
      if (row.status !== '进行中') failErr('仅进行中的练习可以结束')
      let secondRate = data.secondRate
      if (secondRate === null || secondRate === undefined || secondRate === '') {
        const completion = percent(row.doneCount, row.pushCount || 1)
        secondRate = Math.min(100, Math.max(0, 48 + completion * 0.35))
      }
      row.status = '已结束'
      row.secondRate = round1(secondRate)
      writeLog(cur.name, '结束练习', `结束练习 ${row.no}，二次正确率 ${row.secondRate}%`)
      return ok(practiceDict(row), '练习已结束')
    },
  },
  {
    method: 'PUT', path: '/api/practice/practices/:id/result',
    handler({ token, path, data }) {
      authUser(token)
      const row = db.get('practices', path.id)
      if (!row) failErr('练习任务不存在', 404)
      if (data.doneCount !== null && data.doneCount !== undefined && data.doneCount !== '') {
        row.doneCount = clamp(toInt(data.doneCount), 0, row.pushCount || toInt(data.doneCount))
      }
      if (data.secondRate !== null && data.secondRate !== undefined && data.secondRate !== '') {
        row.secondRate = round1(clamp(toFloat(data.secondRate), 0, 100))
      }
      return ok(practiceDict(row), '练习结果已更新')
    },
  },
  {
    method: 'GET', path: '/api/practice/practices/:id/completion',
    handler({ token, path }) {
      authUser(token)
      const row = db.get('practices', path.id)
      if (!row) failErr('练习任务不存在', 404)
      const members = db.filter('students', (s) => s.classId === row.classId)
      const total = members.length || row.pushCount
      const done = Math.min(row.doneCount, total)
      const buckets = {}
      members.forEach((item) => {
        if (!buckets[item.group]) buckets[item.group] = { group: item.group, total: 0 }
        buckets[item.group].total += 1
      })
      return ok({
        practiceId: row.id,
        name: row.name,
        className: row.className,
        pushCount: total,
        doneCount: done,
        remaining: Math.max(0, total - done),
        doneRate: percent(done, total),
        secondRate: row.secondRate,
        groups: Object.values(buckets),
        status: row.status,
      })
    },
  },
  {
    method: 'GET', path: '/api/practice/interventions',
    handler({ token, params }) {
      authUser(token)
      const kw = String(params.kw || '')
      const status = String(params.status || '')
      const owner = String(params.owner || '')
      const overdueOnly = params.overdue === '1'
      let rows = db.list('interventions')
      if (kw) rows = rows.filter((i) => i.no.includes(kw) || i.kpName.includes(kw))
      if (status) rows = rows.filter((i) => i.status === status)
      if (owner) rows = rows.filter((i) => i.owner === owner)
      let list = rows.map(interventionDict)
      if (overdueOnly) {
        list = list.filter((x) => x.status !== '已销号' && x.deadline < todayStr())
      }
      const all = db.list('interventions')
      const reviewed = all.filter((i) => ['已复查', '已销号'].includes(i.status))
      const effective = reviewed.filter((i) => i.result === '有效').length
      return ok({
        list,
        stats: {
          total: all.length,
          running: all.filter((i) => i.status === '进行中').length,
          overdue: all.filter((i) => i.deadline < todayStr() && i.status !== '已销号').length,
          effectiveRate: percent(effective, reviewed.length),
        },
      })
    },
  },
  {
    method: 'POST', path: '/api/practice/interventions/create',
    handler({ token, data }) {
      const cur = authUser(token)
      const kpId = String(data.kpId || '').trim()
      const classId = String(data.classId || '').trim()
      const measure = String(data.measure || '').trim()
      const deadline = String(data.deadline || '').trim()
      const target = String(data.target || '班级').trim()
      const targetName = String(data.targetName || '').trim()
      const diagnosisId = String(data.diagnosisId || '').trim()
      const schoolClass = db.get('classes', classId)
      if (!schoolClass) failErr('请选择干预班级')
      const kp = db.get('knowledgePoints', kpId)
      if (!kp) failErr('请选择知识点')
      if (!measure) failErr('请填写干预措施')
      if (deadline.length !== 10) failErr('请选择完成期限')
      if (!['班级', '小组', '个人'].includes(target)) failErr('干预对象不合法')
      let diagnosis = diagnosisId ? db.get('diagnoses', diagnosisId) : null
      if (!diagnosis) diagnosis = db.find('diagnoses', (d) => d.kpId === kp.id && d.classId === classId)
      const no = db.nextNo('interventions', 'no', 'GY' + ymStamp())
      const row = db.insert('interventions', {
        id: 'I-' + stampId(),
        no,
        diagnosisId: diagnosis ? diagnosis.id : '',
        diagnosisNo: diagnosis ? diagnosis.no : '',
        kpName: kp.name, classId, className: schoolClass.name,
        target, targetName: targetName || schoolClass.name,
        measure, owner: cur.name, deadline,
        progress: 0, status: '待开始', checkScore: 0, result: '待观察',
        createdAt: nowText().slice(0, 16),
      })
      writeLog(cur.name, '新建干预', `新建干预任务 ${no}（${kp.name}）`)
      return ok(interventionDict(row), '干预任务已创建')
    },
  },
  {
    method: 'PUT', path: '/api/practice/interventions/:id',
    handler({ token, path, data }) {
      const cur = authUser(token)
      const row = db.get('interventions', path.id)
      if (!row) failErr('干预任务不存在', 404)
      const progress = toInt(data.progress !== undefined ? data.progress : row.progress)
      const status = String(data.status || row.status).trim()
      const checkScore = toFloat(data.checkScore !== undefined ? data.checkScore : row.checkScore)
      const result = String(data.result || row.result).trim()
      if (!(progress >= 0 && progress <= 100)) failErr('进度需在 0-100 之间')
      if (!['待开始', '进行中', '已复查', '已销号'].includes(status)) failErr('任务状态不合法')
      if (!(checkScore >= 0 && checkScore <= 100)) failErr('复查得分率需在 0-100 之间')
      if (['已复查', '已销号'].includes(status) && !checkScore) failErr('复查状态需填写复查得分率')
      if (!['待观察', '有效', '无效'].includes(result)) failErr('效果判定不合法')
      row.progress = status === '已销号' ? 100 : progress
      row.status = status
      row.checkScore = round1(checkScore)
      row.result = result
      if (status === '已销号' && row.diagnosisId) {
        try {
          closeDiagnosis(row.diagnosisId)
        } catch {
          /* 诊断单状态不允许关闭时静默跳过，与原后端一致 */
        }
      }
      writeLog(cur.name, '更新干预', `任务 ${row.no} 状态更新为${status}，进度${row.progress}%`)
      return ok(interventionDict(row), '干预任务已更新')
    },
  },
  {
    method: 'GET', path: '/api/practice/interventions/overdue',
    handler({ token }) {
      authUser(token)
      const rows = db.filter('interventions', (i) => i.deadline < todayStr() && i.status !== '已销号')
      return ok(rows.map(interventionDict))
    },
  },
  {
    method: 'GET', path: '/api/practice/interventions/workload',
    handler({ token }) {
      authUser(token)
      const buckets = {}
      db.list('interventions').forEach((item) => {
        if (!buckets[item.owner]) {
          buckets[item.owner] = { owner: item.owner, total: 0, running: 0, overdue: 0, closed: 0 }
        }
        const b = buckets[item.owner]
        b.total += 1
        if (item.status === '进行中') b.running += 1
        if (item.status === '已销号') b.closed += 1
        if (item.status !== '已销号' && item.deadline < todayStr()) b.overdue += 1
      })
      const rows = Object.values(buckets)
      rows.sort((a, b) => b.total - a.total)
      return ok(rows)
    },
  },
]
