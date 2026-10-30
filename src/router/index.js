import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { title: '登录' } },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '工作台' } },
      { path: 'knowledge', name: 'knowledge', component: () => import('@/views/KnowledgeView.vue'), meta: { title: '知识点管理' } },
      { path: 'dataimport', name: 'dataimport', component: () => import('@/views/DataImportView.vue'), meta: { title: '学情导入' } },
      { path: 'diagnosis', name: 'diagnosis', component: () => import('@/views/DiagnosisView.vue'), meta: { title: '薄弱诊断' } },
      { path: 'student', name: 'student', component: () => import('@/views/StudentView.vue'), meta: { title: '学生画像' } },
      { path: 'practice', name: 'practice', component: () => import('@/views/PracticeView.vue'), meta: { title: '靶向练习' } },
      { path: 'intervention', name: 'intervention', component: () => import('@/views/InterventionView.vue'), meta: { title: '干预跟踪' } },
      { path: 'analysis', name: 'analysis', component: () => import('@/views/AnalysisView.vue'), meta: { title: '班级对比' } },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: '系统设置' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.name !== 'login' && !auth.token) return { name: 'login' }
  if (to.name === 'login' && auth.token) return { name: 'dashboard' }
  document.title = to.meta.title ? `${to.meta.title} · 薄弱知识点识别系统` : '面向学情分析的学生薄弱知识点识别系统'
  return true
})

export default router
