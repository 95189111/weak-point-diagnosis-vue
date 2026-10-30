/**
 * AI 流式客户端：先调用 Mock 接口取回完整生成结果，
 * 再在前端以「打字机」节奏回放，模拟大模型 token 流式输出，支持中断。
 */
import api from './index'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function aiStream(url, data, onChunk, signal) {
  await sleep(600 + Math.random() * 700)
  const res = await api.post(url, data)
  const text = res?.markdown || res?.text || ''
  let i = 0
  while (i < text.length) {
    if (signal?.aborted) {
      const err = new Error('已停止生成')
      err.aborted = true
      throw err
    }
    const step = 2 + Math.floor(Math.random() * 5)
    onChunk(text.slice(i, i + step))
    i += step
    await sleep(10 + Math.random() * 22)
  }
  return res
}
