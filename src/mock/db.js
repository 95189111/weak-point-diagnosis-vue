/**
 * 前端内置数据库：与原系统 seed 数据同源，持久化到 localStorage。
 * 提供 list/get/insert/update/remove 等与后端 ORM 语义一致的最小接口。
 */
import SEED from './seed'

const DB_KEY = 'APP_DB_V2'

function clone(v) {
  return JSON.parse(JSON.stringify(v))
}

function makeDb() {
  const d = clone(SEED)
  Object.keys(d).forEach((k) => {
    if (!Array.isArray(d[k])) d[k] = []
  })
  return d
}

let data = null

function load() {
  if (data) return data
  try {
    const raw = localStorage.getItem(DB_KEY)
    data = raw ? JSON.parse(raw) : makeDb()
  } catch {
    data = makeDb()
  }
  if (!data || typeof data !== 'object') data = makeDb()
  return data
}

function keyOf(rec) {
  return rec.id || rec.code || rec.no || ''
}

export const db = {
  raw() {
    return load()
  },
  list(name) {
    const d = load()
    if (!Array.isArray(d[name])) d[name] = []
    return d[name]
  },
  get(name, id) {
    return db.list(name).find((r) => keyOf(r) === id) || null
  },
  find(name, fn) {
    return db.list(name).find(fn) || null
  },
  filter(name, fn) {
    return db.list(name).filter(fn)
  },
  insert(name, rec) {
    db.list(name).unshift(rec)
    return rec
  },
  append(name, rec) {
    db.list(name).push(rec)
    return rec
  },
  update(name, id, patch) {
    const rec = db.get(name, id)
    if (rec) Object.assign(rec, patch)
    return rec
  },
  remove(name, id) {
    const d = load()
    const idx = db.list(name).findIndex((r) => keyOf(r) === id)
    if (idx >= 0) d[name].splice(idx, 1)
  },
  /** 依据现有记录的字段尾号推算下一个编号，如 LX202610-001 */
  nextNo(name, field, prefix) {
    let max = 0
    db.list(name).forEach((r) => {
      const m = String(r[field] || '').match(/(\d+)\s*$/)
      const val = m ? parseInt(m[1], 10) : 0
      if (String(r[field] || '').startsWith(prefix) && val > max) max = val
    })
    return `${prefix}-${String(max + 1).padStart(3, '0')}`
  },
  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(load()))
    } catch {
      /* 忽略隐私模式下的持久化失败 */
    }
  },
  reset() {
    data = makeDb()
    db.save()
    return data
  },
}
