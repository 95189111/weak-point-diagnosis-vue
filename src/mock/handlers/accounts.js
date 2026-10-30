/** 账号/参数/日志模块：与原后端 apps/accounts 业务规则一致 */
import { db } from '../db'
import { authUser, issueToken, requireRole } from '../auth'
import { failErr, maskPhone, nowText, ok, toInt, uid } from '../utils'

const ACCOUNT_RE = /^[A-Za-z][A-Za-z0-9]{3,15}$/
const PHONE_RE = /^1[3-9]\d{9}$/

export function writeLog(user, action, detail) {
  return db.append('logs', {
    id: 'LOG-' + uid('X').slice(2),
    time: nowText(),
    user,
    action,
    detail: String(detail).slice(0, 250),
  })
}

export function userDict(u) {
  return { id: u.id, account: u.account, name: u.name, role: u.role, subject: u.subject, phone: u.phone, status: u.status, createdAt: u.createdAt }
}

export function classDict(c) {
  return { ...c }
}

export function settingDict(s) {
  return { ...s }
}

function getSetting() {
  const row = db.list('settings')[0]
  if (row) return row
  return db.insert('settings', {
    id: 'CFG-001', weakThreshold: 60, warnThreshold: 70, reviewDays: 7,
    term: '2026-2027学年第一学期', school: '育才实验中学', grade: '八年级',
    subject: '数学', updatedAt: nowText().slice(0, 16), updatedBy: '系统管理员',
  })
}

function validatePassword(password) {
  if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    failErr('密码至少8位且包含字母与数字')
  }
}

export default [
  {
    method: 'POST', path: '/api/accounts/login',
    handler({ data }) {
      const account = String(data.account || '').trim()
      const password = String(data.password || '')
      if (!account || !password) failErr('请输入账号和密码')
      const user = db.find('users', (u) => u.account === account)
      if (!user || user.password !== password) {
        writeLog(account, '登录失败', '账号或口令校验未通过')
        failErr('账号或密码错误，或账号已停用', 401)
      }
      if (user.status !== '启用') {
        writeLog(account, '登录失败', `账号状态为${user.status}`)
        failErr('账号已停用，请联系管理员', 401)
      }
      writeLog(user.name, '登录系统', `账号 ${account} 登录成功`)
      return ok({
        token: issueToken(user),
        user: userDict(user),
        classes: db.list('classes').map(classDict),
        setting: settingDict(getSetting()),
      }, '登录成功')
    },
  },
  {
    method: 'GET', path: '/api/accounts/me',
    handler({ token }) {
      const cur = authUser(token)
      const user = db.find('users', (u) => u.account === cur.account)
      if (!user) failErr('账号不存在', 404)
      return ok(userDict(user))
    },
  },
  {
    method: 'GET', path: '/api/accounts/users',
    handler({ token, params }) {
      authUser(token)
      const kw = String(params.kw || '')
      const role = String(params.role || '')
      let rows = db.list('users')
      if (kw) rows = rows.filter((u) => u.account.includes(kw) || u.name.includes(kw))
      if (role) rows = rows.filter((u) => u.role === role)
      return ok(rows.map(userDict))
    },
  },
  {
    method: 'POST', path: '/api/accounts/users',
    handler({ token, data }) {
      const cur = authUser(token)
      const account = String(data.account || '').trim()
      const name = String(data.name || '').trim()
      const role = String(data.role || '教师').trim()
      const subject = String(data.subject || '数学').trim()
      const password = String(data.password || '')
      const phone = String(data.phone || '').trim()
      if (!ACCOUNT_RE.test(account)) failErr('账号需字母开头，4-16位字母或数字')
      if (db.find('users', (u) => u.account === account)) failErr('账号已存在')
      if (!name) failErr('请填写姓名')
      if (!['教师', '教研组长', '学生', '管理员'].includes(role)) failErr('角色取值不合法')
      validatePassword(password)
      if (phone && !PHONE_RE.test(phone)) failErr('手机号格式不正确')
      const user = db.insert('users', {
        id: uid('U'),
        account, password, name, role, subject,
        phone: maskPhone(phone),
        status: '启用',
        createdAt: nowText().slice(0, 16),
      })
      writeLog(cur.name, '账号维护', `新增${role}账号 ${account}`)
      return ok(userDict(user), '账号已创建')
    },
  },
  {
    method: 'POST', path: '/api/accounts/users/:id/toggle',
    handler({ token, path }) {
      const cur = requireRole(token, ['管理员', '教研组长'])
      const user = db.get('users', path.id)
      if (!user) failErr('账号不存在')
      user.status = user.status === '启用' ? '停用' : '启用'
      writeLog(cur.name, '账号维护', `账号 ${user.account} 状态改为${user.status}`)
      return ok(userDict(user), '账号状态已更新')
    },
  },
  {
    method: 'POST', path: '/api/accounts/users/:id/reset-password',
    handler({ token, path, data }) {
      const cur = requireRole(token, ['管理员'])
      const user = db.get('users', path.id)
      if (!user) failErr('账号不存在')
      const password = String(data.password || '')
      validatePassword(password)
      user.password = password
      writeLog(cur.name, '账号维护', `重置账号 ${user.account} 的登录口令`)
      return ok({ account: user.account, resetAt: nowText().slice(0, 16) }, '登录口令已重置')
    },
  },
  {
    method: 'PUT', path: '/api/accounts/profile',
    handler({ token, data }) {
      const cur = authUser(token)
      const user = db.find('users', (u) => u.account === cur.account)
      if (!user) failErr('账号不存在')
      const name = String(data.name || '').trim()
      const phone = String(data.phone || '').trim()
      if (!name) failErr('请填写姓名')
      if (phone && !PHONE_RE.test(phone)) failErr('手机号格式不正确')
      user.name = name
      if (phone) user.phone = maskPhone(phone)
      writeLog(name, '资料维护', '更新个人联系方式')
      return ok(userDict(user), '个人资料已更新')
    },
  },
  {
    method: 'GET', path: '/api/accounts/roles/summary',
    handler({ token }) {
      authUser(token)
      const summary = []
      for (const role of ['教师', '教研组长', '学生', '管理员']) {
        const rows = db.filter('users', (u) => u.role === role)
        summary.push({ role, total: rows.length, active: rows.filter((u) => u.status === '启用').length })
      }
      return ok(summary)
    },
  },
  {
    method: 'GET', path: '/api/accounts/classes',
    handler({ token }) {
      authUser(token)
      return ok(db.list('classes').map(classDict))
    },
  },
  {
    method: 'GET', path: '/api/accounts/settings',
    handler({ token }) {
      authUser(token)
      return ok(settingDict(getSetting()))
    },
  },
  {
    method: 'PUT', path: '/api/accounts/settings',
    handler({ token, data }) {
      const cur = authUser(token)
      const row = getSetting()
      const weak = toInt(data.weakThreshold)
      const warn = toInt(data.warnThreshold)
      const days = toInt(data.reviewDays)
      if (!(weak >= 30 && weak <= 80)) failErr('薄弱阈值需在 30-80 之间')
      if (!(warn >= 40 && warn <= 90)) failErr('临界阈值需在 40-90 之间')
      if (warn <= weak) failErr('临界阈值需大于薄弱阈值')
      if (!(days >= 3 && days <= 30)) failErr('复查周期需在 3-30 天之间')
      row.weakThreshold = weak
      row.warnThreshold = warn
      row.reviewDays = days
      row.updatedAt = nowText().slice(0, 16)
      row.updatedBy = cur.name
      writeLog(cur.name, '参数调整', `薄弱阈值${weak}%，临界阈值${warn}%，复查周期${days}天`)
      return ok(settingDict(row), '参数已保存')
    },
  },
  {
    method: 'GET', path: '/api/accounts/logs',
    handler({ token, params }) {
      authUser(token)
      const kw = String(params.kw || '')
      let rows = db.list('logs')
      if (kw) rows = rows.filter((l) => l.user.includes(kw) || l.action.includes(kw) || l.detail.includes(kw))
      return ok(rows.map((l) => ({ ...l })))
    },
  },
]
