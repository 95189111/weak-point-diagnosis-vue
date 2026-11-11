<template>
  <div class="app">
    <header class="topbar">
      <div class="crumb">
        <el-icon :size="22" color="#0891B2"><DataAnalysis /></el-icon>
        <span class="brand-name">析微 · 学生薄弱知识点识别系统</span>
        <span class="sep">/</span>
        <h1>{{ currentTitle }}</h1>
        <span class="hint">测 · 诊 · 练 · 跟 教学闭环</span>
      </div>
      <div class="userbox">
        <span class="clock num">{{ clock }}</span>
        <span class="who">{{ auth.user?.name || '-' }}</span>
        <span class="role">{{ auth.user?.role || '-' }}</span>
        <el-dropdown trigger="click">
          <el-avatar :size="32" class="avatar">{{ (auth.user?.name || '?').slice(0, 1) }}</el-avatar>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>{{ auth.user?.account }} · {{ auth.user?.subject }}</el-dropdown-item>
              <el-dropdown-item divided @click="onLogout">
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <nav class="menu">
      <router-link
        v-for="item in menus"
        :key="item.name"
        :to="{ name: item.name }"
        class="nav"
        :class="{ active: route.name === item.name }"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ item.title }}</span>
      </router-link>
    </nav>

    <main class="wrap">
      <router-view />
    </main>

    <AiAssistant />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AiAssistant from '@/components/AiAssistant.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

auth.restore()

const menus = [
  { name: 'dashboard', title: '工作台', icon: 'Odometer' },
  { name: 'knowledge', title: '知识点管理', icon: 'Collection' },
  { name: 'dataimport', title: '学情导入', icon: 'UploadFilled' },
  { name: 'diagnosis', title: '薄弱诊断', icon: 'Aim' },
  { name: 'student', title: '学生画像', icon: 'User' },
  { name: 'practice', title: '靶向练习', icon: 'Promotion' },
  { name: 'intervention', title: '干预跟踪', icon: 'Flag' },
  { name: 'analysis', title: '班级对比', icon: 'TrendCharts' },
  { name: 'settings', title: '系统设置', icon: 'Setting' },
]

const currentTitle = computed(() => route.meta.title || '')

const clock = ref('')
let timer = null
function tick() {
  clock.value = new Date().toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

function onLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.app { min-height: 100vh; display: flex; flex-direction: column; }
.topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  height: 60px; padding: 0 28px;
  background: var(--color-card); border-bottom: 4px solid var(--color-primary);
  position: sticky; top: 0; z-index: 30;
}
.crumb { display: flex; align-items: center; gap: 10px; min-width: 0; }
.brand-name { font-size: 16px; font-weight: 800; color: var(--color-primary-dark); letter-spacing: .5px; white-space: nowrap; }
.topbar h1 { font-size: 19px; margin: 0; font-weight: 700; color: var(--color-text); white-space: nowrap; }
.sep { color: var(--color-border); }
.hint { font-size: 12px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.userbox { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--color-muted); flex: 0 0 auto; }
.clock { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--color-primary-dark); background: var(--color-bg); border: 1px solid var(--color-border); padding: 4px 8px; border-radius: 4px; white-space: nowrap; }
.who { font-weight: 700; color: var(--color-text); white-space: nowrap; }
.role { background: var(--color-primary-dark); color: #fff; padding: 1px 8px; border-radius: 3px; font-size: 11px; white-space: nowrap; }
.avatar { background: var(--color-primary); font-weight: 700; cursor: pointer; }
.menu {
  display: flex; flex-wrap: wrap; gap: 2px; padding: 0 24px;
  background: #fff; border-bottom: 1px solid var(--color-border);
  position: sticky; top: 60px; z-index: 29;
}
.menu .nav {
  display: flex; align-items: center; gap: 5px;
  padding: 11px 16px; font-size: 13px; font-weight: 600; color: var(--color-muted);
  border-bottom: 3px solid transparent;
}
.menu .nav:hover { color: var(--color-primary); background: var(--color-bg); }
.menu .nav.active { color: #fff; background: var(--color-primary-dark); border-bottom-color: var(--color-primary); }
.wrap { width: 100%; max-width: 1600px; margin: 0 auto; padding: 22px 28px 60px; flex: 1; min-width: 0; }
@media (max-width: 900px) {
  .topbar { padding: 0 14px; }
  .hint, .clock { display: none; }
  .wrap { padding: 16px 14px 60px; }
}
</style>
