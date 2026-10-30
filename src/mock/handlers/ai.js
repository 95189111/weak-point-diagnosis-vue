/** AI 能力接口（Mock）：所有生成结果由 src/ai/engine 基于本地数据合成 */
import { authUser } from '../auth'
import { ok } from '../utils'
import {
  briefing, chat, explainDiagnosis, generateQuiz, reportComment, studentComment,
} from '@/ai/engine'

export default [
  {
    method: 'POST', path: '/api/ai/explain-diagnosis',
    handler({ token, data }) {
      authUser(token)
      return ok(explainDiagnosis(String(data.diagnosisId || '')))
    },
  },
  {
    method: 'POST', path: '/api/ai/student-comment',
    handler({ token, data }) {
      authUser(token)
      return ok(studentComment(String(data.studentId || '')))
    },
  },
  {
    method: 'POST', path: '/api/ai/generate-quiz',
    handler({ token, data }) {
      authUser(token)
      return ok(generateQuiz(
        String(data.kpId || ''),
        String(data.difficulty || '基础'),
        Math.min(20, Math.max(1, parseInt(data.count, 10) || 5)),
      ))
    },
  },
  {
    method: 'POST', path: '/api/ai/report-comment',
    handler({ token, data }) {
      authUser(token)
      return ok(reportComment(data || {}))
    },
  },
  {
    method: 'POST', path: '/api/ai/briefing',
    handler({ token }) {
      authUser(token)
      return ok(briefing())
    },
  },
  {
    method: 'POST', path: '/api/ai/chat',
    handler({ token, data }) {
      authUser(token)
      return ok(chat(data.message))
    },
  },
]
