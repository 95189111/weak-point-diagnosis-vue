/**
 * Mock 路由表：把「METHOD + URL 模式」分发到对应处理器，
 * URL 模式支持 :param 占位（与后端 Django 路由风格保持一致）。
 */
import accounts from './handlers/accounts'
import knowledge from './handlers/knowledge'
import exams from './handlers/exams'
import diagnosis from './handlers/diagnosis'
import practice from './handlers/practice'
import analytics from './handlers/analytics'
import ai from './handlers/ai'

const table = []
for (const group of [accounts, knowledge, exams, diagnosis, practice, analytics, ai]) {
  for (const entry of group) table.push(entry)
}

function compile(pattern) {
  const keys = []
  const source = pattern
    .split('/')
    .map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1))
        return '([^/]+)'
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return { regex: new RegExp(`^${source}$`), keys }
}

const compiled = table.map((entry) => ({ ...entry, ...compile(entry.path) }))

export function route(method, url, params, data, token) {
  const path = String(url || '').split('?')[0].replace(/\/+$/, '') || '/'
  const upper = method.toUpperCase()
  const entry = compiled.find((e) => e.method === upper && e.regex.test(path))
  if (!entry) {
    return { code: 404, msg: `接口不存在：${upper} ${path}`, data: null }
  }
  const match = path.match(entry.regex)
  const pathParams = {}
  entry.keys.forEach((k, i) => {
    pathParams[k] = decodeURIComponent(match[i + 1])
  })
  try {
    return entry.handler({ params, data, token, path: pathParams })
  } catch (err) {
    if (err && typeof err.code === 'number' && typeof err.msg === 'string') {
      return { code: err.code, msg: err.msg, data: null }
    }
    console.error('[mock] handler error:', err)
    return { code: 500, msg: '服务内部异常', data: null }
  }
}
