<template>
  <div class="login-body">
    <div class="login-wrap">
      <div class="login-brand">
        <div class="kicker">CHUANZHI CUP · 教育信息化</div>
        <h1>面向学情分析的<br>学生薄弱知识点识别系统</h1>
        <p>从测验与作业数据中定位薄弱知识点，形成可执行的补救方案，构建「测 · 诊 · 练 · 跟」教学闭环。</p>
        <div class="feats">
          <div class="feat"><i>测</i><b>学情数据导入</b><span>周测月考成绩逐条入库</span></div>
          <div class="feat"><i>诊</i><b>薄弱知识识别</b><span>得分率+趋势三档判定</span></div>
          <div class="feat"><i>练</i><b>靶向练习推送</b><span>AI 智能组卷定向辅导</span></div>
          <div class="feat"><i>跟</i><b>干预跟踪销号</b><span>复查成绩判定闭环</span></div>
        </div>
        <div class="ver">Vue3 重构版 V2.0 · Mock 内置 · 支持静态部署</div>
      </div>
      <div class="login-card">
        <h2>账号登录</h2>
        <div class="sub">使用系统账号进入工作台</div>
        <el-form @submit.prevent="submit">
          <el-form-item>
            <el-input v-model.trim="account" placeholder="账号" size="large" clearable>
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-input v-model="password" type="password" placeholder="密码" size="large" show-password @keyup.enter="submit">
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-button class="btn" type="primary" size="large" :loading="loading" @click="submit">登 录</el-button>
        </el-form>
        <el-divider>演示账号一键填入</el-divider>
        <div class="demo-accounts">
          <el-button v-for="a in demoAccounts" :key="a.account" size="small" plain @click="fill(a)">
            {{ a.role }}：{{ a.account }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const demoAccounts = [
  { role: '教研组长', account: 'leader01', password: 'Leader@2026' },
  { role: '管理员', account: 'admin', password: 'Admin@2026' },
]

const account = ref('')
const password = ref('')
const loading = ref(false)

function fill(a) {
  account.value = a.account
  password.value = a.password
}

async function submit() {
  if (!account.value || !password.value) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    const data = await auth.login(account.value, password.value)
    ElMessage.success(`欢迎回来，${data.user.name}`)
    router.push({ name: 'dashboard' })
  } catch (err) {
    ElMessage.error(err?.msg || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-body {
  min-height: 100vh;
  background:
    radial-gradient(1200px 500px at 85% -10%, rgba(34, 211, 238, .35), transparent 60%),
    radial-gradient(900px 420px at -10% 110%, rgba(8, 145, 178, .25), transparent 60%),
    var(--color-bg);
  display: flex; align-items: center; justify-content: center;
  padding: 32px 16px;
}
.login-wrap {
  display: grid; grid-template-columns: 1.15fr 1fr; gap: 40px;
  max-width: 1080px; width: 100%;
  align-items: center;
}
.login-brand { color: var(--color-primary-dark); }
.kicker { font-size: 12px; letter-spacing: 3px; color: var(--color-primary); font-weight: 700; }
.login-brand h1 { font-size: 34px; line-height: 1.35; margin: 10px 0 12px; font-weight: 900; }
.login-brand p { font-size: 14px; color: var(--color-muted); max-width: 460px; }
.feats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 22px; max-width: 520px; }
.feat { background: #fff; border: 1px solid var(--color-border); border-left: 4px solid var(--color-primary); border-radius: 6px; padding: 12px 14px; }
.feat i { font-style: normal; display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; background: var(--color-primary-dark); color: #fff; border-radius: 4px; font-weight: 800; margin-bottom: 6px; }
.feat b { display: block; font-size: 13.5px; }
.feat span { font-size: 12px; color: var(--color-muted); }
.ver { margin-top: 22px; font-size: 12px; color: var(--color-muted); }
.login-card {
  background: #fff; border: 1px solid var(--color-border); border-radius: 10px;
  padding: 30px 32px; box-shadow: 0 12px 40px rgba(8, 145, 178, .12);
}
.login-card h2 { margin: 0 0 4px; color: var(--color-primary-dark); }
.login-card .sub { font-size: 12px; color: var(--color-muted); margin-bottom: 18px; }
.btn { width: 100%; margin-top: 4px; letter-spacing: 6px; }
.demo-accounts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
@media (max-width: 860px) {
  .login-wrap { grid-template-columns: 1fr; }
  .login-brand { text-align: center; }
  .login-brand p { margin: 0 auto; }
  .feats { margin: 22px auto 0; }
}
</style>
