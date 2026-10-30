/**
 * Mock API 客户端：保持与 HTTP 接口一致的调用语义（method + url + params/data），
 * 实际请求由 src/mock 内的路由表分发到前端内置的业务处理器，可直接静态部署。
 */
import { route } from '@/mock'
import { db } from '@/mock/db'

export class ApiError extends Error {
  constructor(code, msg) {
    super(msg)
    this.code = code
    this.msg = msg
  }
}

let _token = ''

export function setToken(token) {
  _token = token || ''
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function request(method, url, { params = {}, data = null } = {}) {
  await delay(90 + Math.round(Math.random() * 180))
  const res = route(method, url, params, data, _token)
  if (method.toUpperCase() !== 'GET') db.save()
  if (!res || res.code !== 0) {
    throw new ApiError(res?.code ?? 500, res?.msg ?? '服务异常')
  }
  return res.data
}

const api = {
  get: (url, params = {}) => request('GET', url, { params }),
  post: (url, data = {}) => request('POST', url, { data }),
  put: (url, data = {}) => request('PUT', url, { data }),
}

export default api
