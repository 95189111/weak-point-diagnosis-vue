/**
 * Mock 认证：与原后端一致的自制 Token（base64(payload) + 签名），TTL 8 小时。
 * 仅用于前端演示，签名算法为简化实现。
 */
import { failErr } from './utils'

const SECRET = 'xueqing-diagnosis-2026'
const TTL_SECONDS = 8 * 3600

function hash(raw) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/=/g, '')
}

function b64decode(str) {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

export function issueToken(user) {
  const payload = { account: user.account, name: user.name, role: user.role, ts: Math.floor(Date.now() / 1000) }
  const raw = JSON.stringify(payload)
  return `${b64encode(raw)}.${hash(raw + SECRET)}`
}

export function parseToken(token) {
  if (!token || !token.includes('.')) return null
  const idx = token.lastIndexOf('.')
  const body = token.slice(0, idx)
  const sign = token.slice(idx + 1)
  let raw
  try {
    raw = b64decode(body)
  } catch {
    return null
  }
  if (hash(raw + SECRET) !== sign) return null
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return null
  }
  if (Math.floor(Date.now() / 1000) - (payload.ts || 0) > TTL_SECONDS) return null
  return payload
}

/** 校验登录态，无效直接抛 401 */
export function authUser(token) {
  const payload = parseToken(token)
  if (!payload) failErr('登录状态已失效，请重新登录', 401)
  return payload
}

/** 角色校验（roles 为空数组时放行任意已登录角色） */
export function requireRole(token, roles) {
  const user = authUser(token)
  if (roles && roles.length && !roles.includes(user.role)) {
    failErr('当前角色无权执行该操作', 403)
  }
  return user
}
