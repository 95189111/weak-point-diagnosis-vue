/** Mock 处理器通用工具：响应包装、错误抛出、数值与时间工具（与原后端 utils 语义一致） */

export function ok(data = null, msg = 'ok') {
  return { code: 0, msg, data }
}

/** 业务失败：以异常形式抛出，由路由层统一捕获为 {code, msg} */
export function failErr(msg, code = 1) {
  throw { code, msg }
}

export function toInt(v, d = 0) {
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? d : n
}

export function toFloat(v, d = 0) {
  const n = parseFloat(v)
  return Number.isNaN(n) ? d : n
}

export function clamp(v, low, high) {
  return Math.max(low, Math.min(high, v))
}

export function round1(v) {
  return Math.round((Number(v) + 1e-9) * 10) / 10
}

export function percent(part, total, digits = 1) {
  if (!total) return 0
  return round1((Number(part) / Number(total)) * 100)
}

export function pad(n, w = 2) {
  return String(n).padStart(w, '0')
}

function padTime(v) {
  return String(v).padStart(2, '0')
}

export function nowText() {
  const d = new Date()
  return `${d.getFullYear()}-${padTime(d.getMonth() + 1)}-${padTime(d.getDate())} ` +
    `${padTime(d.getHours())}:${padTime(d.getMinutes())}:${padTime(d.getSeconds())}`
}

export function todayStr() {
  return nowText().slice(0, 10)
}

/** 紧凑时间戳，用于生成 id：YYYYMMDDHHmmSS 取后 8 位 */
export function stampId() {
  return nowText().replace(/[-: ]/g, '').slice(-8)
}

export function ymStamp() {
  const d = new Date()
  return `${String(d.getFullYear()).slice(2)}${padTime(d.getMonth() + 1)}`
}

let seq = Math.floor(Math.random() * 0xffff)
export function uid(prefix) {
  seq = (seq + 1) % 0xffffff
  return `${prefix}-${(Date.now().toString(36) + seq.toString(36)).toUpperCase().slice(-8)}`
}

/** 趋势判定：首尾差 ≤-2 下降 / ≥2 上升 / 持平（与原后端一致） */
export function trendOf(values) {
  const seqList = (values || []).filter((v) => v !== null && v !== undefined).map(Number)
  if (seqList.length < 2) return '持平'
  const delta = seqList[seqList.length - 1] - seqList[0]
  if (delta <= -2) return '下降'
  if (delta >= 2) return '上升'
  return '持平'
}

export function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length !== 11) return phone || ''
  return digits.slice(0, 3) + '****' + digits.slice(-4)
}
