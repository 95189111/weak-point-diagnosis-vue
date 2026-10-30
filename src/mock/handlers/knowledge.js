/** 知识点管理模块：与原后端 apps/knowledge 业务规则一致 */
import { db } from '../db'
import { authUser } from '../auth'
import { failErr, nowText, ok, round1, toInt, uid } from '../utils'
import { writeLog } from './accounts'

const COGNITIVE = ['记忆', '理解', '应用', '分析']

export function pointDict(p) {
  return { ...p }
}

function validate(data, current = null) {
  const code = String(data.code || '').trim()
  const name = String(data.name || '').trim()
  const chapter = String(data.chapter || '').trim()
  const cognitive = String(data.cognitive || '理解').trim()
  const prevCode = String(data.prevCode || '').trim()
  const questions = toInt(data.questionCount)
  if (!code) failErr('请填写知识点编码')
  if (!name) failErr('请填写知识点名称')
  if (!chapter) failErr('请选择所属章节')
  if (!COGNITIVE.includes(cognitive)) failErr('认知层级不合法')
  if (!(questions >= 0 && questions <= 60)) failErr('关联题量需在 0-60 之间')
  if (prevCode && !db.find('knowledgePoints', (p) => p.code === prevCode)) failErr('先修知识点不存在')
  const dup = db.find('knowledgePoints', (p) => p.code === code && (!current || p.id !== current.id))
  if (dup) failErr('知识点编码已存在')
  return { code, name, chapter, cognitive, prevCode, questions }
}

export default [
  {
    method: 'GET', path: '/api/knowledge/points',
    handler({ token, params }) {
      authUser(token)
      const kw = String(params.kw || '')
      const chapter = String(params.chapter || '')
      const level = String(params.level || '')
      const status = String(params.status || '')
      let rows = db.list('knowledgePoints')
      if (kw) rows = rows.filter((p) => p.name.includes(kw) || p.code.includes(kw))
      if (chapter) rows = rows.filter((p) => p.chapter === chapter)
      if (level) rows = rows.filter((p) => p.level === level)
      if (status) rows = rows.filter((p) => p.status === status)
      const all = db.list('knowledgePoints')
      const avg = all.reduce((s, p) => s + (p.mastery || 0), 0) / (all.length || 1)
      const chapters = [...new Set(all.map((p) => p.chapter))].map((name) => ({
        name,
        total: all.filter((p) => p.chapter === name).length,
      }))
      return ok({
        list: rows.map(pointDict),
        stats: {
          total: all.length,
          weak: all.filter((p) => p.level === '薄弱').length,
          warn: all.filter((p) => p.level === '临界').length,
          avgMastery: round1(avg),
        },
        chapters,
      })
    },
  },
  {
    method: 'POST', path: '/api/knowledge/points/create',
    handler({ token, data }) {
      const cur = authUser(token)
      const v = validate(data)
      const row = db.insert('knowledgePoints', {
        id: uid('KP'),
        ...v,
        classRate: 0,
        mastery: 0,
        level: '临界',
        subject: '数学',
        grade: '八年级',
        version: '人教版2024',
        status: '启用',
        owner: cur.name,
        updatedAt: nowText().slice(0, 16),
      })
      writeLog(cur.name, '新增知识点', `新增知识点 ${row.code} ${row.name}`)
      return ok(pointDict(row), '知识点已新增')
    },
  },
  {
    method: 'POST', path: '/api/knowledge/points/import',
    handler({ token, data }) {
      const cur = authUser(token)
      const items = data.items
      if (!Array.isArray(items) || !items.length) failErr('请提供待导入的知识点清单')
      let created = 0
      let skipped = 0
      const errors = []
      items.forEach((item, index) => {
        try {
          const code = String(item.code || '').trim()
          const name = String(item.name || '').trim()
          const chapter = String(item.chapter || '').trim()
          const cognitive = String(item.cognitive || '理解').trim()
          const questions = toInt(item.questionCount, 10)
          if (!code || !name || !chapter) failErr('编码、名称与章节不能为空')
          if (!COGNITIVE.includes(cognitive)) failErr('认知层级不合法')
          if (!(questions >= 0 && questions <= 60)) failErr('题量需在 0-60 之间')
          if (db.find('knowledgePoints', (p) => p.code === code)) {
            skipped += 1
            return
          }
          db.insert('knowledgePoints', {
            id: uid('KP'),
            code, name, chapter, cognitive,
            prevCode: String(item.prevCode || '').trim(),
            questionCount: questions,
            classRate: 0, mastery: 0, level: '临界',
            subject: '数学', grade: '八年级',
            version: String(item.version || '人教版2024'),
            status: '启用', owner: cur.name, updatedAt: nowText().slice(0, 16),
          })
          created += 1
        } catch (err) {
          errors.push({ line: index + 1, message: err?.msg || String(err) })
        }
      })
      writeLog(cur.name, '导入知识点', `批量导入知识点：新增${created}，跳过${skipped}，失败${errors.length}`)
      return ok({ created, skipped, failed: errors.length, errors }, '知识点批量导入完成')
    },
  },
  {
    method: 'GET', path: '/api/knowledge/points/:id',
    handler({ token, path }) {
      authUser(token)
      const row = db.get('knowledgePoints', path.id)
      if (!row) failErr('知识点不存在', 404)
      const related = db.filter('diagnoses', (d) => d.kpId === path.id)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      return ok({ ...pointDict(row), related })
    },
  },
  {
    method: 'PUT', path: '/api/knowledge/points/:id',
    handler({ token, path, data }) {
      const cur = authUser(token)
      const row = db.get('knowledgePoints', path.id)
      if (!row) failErr('知识点不存在', 404)
      const v = validate(data, row)
      Object.assign(row, v, { updatedAt: nowText().slice(0, 16) })
      writeLog(cur.name, '编辑知识点', `更新知识点 ${row.code} ${row.name}`)
      return ok(pointDict(row), '知识点已更新')
    },
  },
  {
    method: 'POST', path: '/api/knowledge/points/:id/toggle',
    handler({ token, path }) {
      const cur = authUser(token)
      const row = db.get('knowledgePoints', path.id)
      if (!row) failErr('知识点不存在')
      row.status = row.status === '启用' ? '停用' : '启用'
      row.updatedAt = nowText().slice(0, 16)
      writeLog(cur.name, '状态调整', `知识点 ${row.code} 状态改为${row.status}`)
      return ok(pointDict(row), '知识点状态已更新')
    },
  },
]
