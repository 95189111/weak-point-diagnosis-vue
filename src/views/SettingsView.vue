<template>
  <div>
    <div class="page-head">
      <div>
        <h2>系统设置</h2>
        <div class="sub">诊断阈值、账号权限与操作审计</div>
      </div>
    </div>

    <el-tabs v-model="tab" class="settings-tabs">
      <el-tab-pane label="系统参数" name="params">
        <div class="card" style="max-width: 640px">
          <div class="card-hd"><h3>薄弱识别阈值</h3></div>
          <div class="card-bd">
            <el-form :model="setting" label-width="120px">
              <el-form-item label="薄弱阈值">
                <el-slider v-model="setting.weakThreshold" :min="30" :max="80" show-input />
              </el-form-item>
              <el-form-item label="临界阈值">
                <el-slider v-model="setting.warnThreshold" :min="40" :max="90" show-input />
              </el-form-item>
              <el-form-item label="复查周期">
                <el-input-number v-model="setting.reviewDays" :min="3" :max="30" />
                <span class="muted" style="margin-left: 8px">天（3-30 天）</span>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="saving" @click="saveSetting">保存参数</el-button>
              </el-form-item>
            </el-form>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="学期">{{ setting.term }}</el-descriptions-item>
              <el-descriptions-item label="学校">{{ setting.school }}</el-descriptions-item>
              <el-descriptions-item label="年级 / 科目">{{ setting.grade }} · {{ setting.subject }}</el-descriptions-item>
              <el-descriptions-item label="最近更新">{{ setting.updatedAt }}（{{ setting.updatedBy }}）</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="账号管理" name="users">
        <div class="card">
          <div class="card-hd">
            <h3>账号列表</h3>
            <div class="actions">
              <el-button type="primary" size="small" :icon="Plus" @click="openCreate">新增账号</el-button>
            </div>
          </div>
          <div class="card-bd tight">
            <el-table :data="users" size="small" stripe>
              <el-table-column prop="account" label="账号" width="120" />
              <el-table-column prop="name" label="姓名" width="100" />
              <el-table-column prop="role" label="角色" width="100" />
              <el-table-column prop="subject" label="学科" width="80" />
              <el-table-column prop="phone" label="手机号" width="130" />
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.status === '启用' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="创建时间" width="150" />
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button link size="small" :type="canManage ? 'warning' : 'info'" :disabled="!canManage" @click="toggleUser(row)">启停</el-button>
                  <el-button link size="small" :type="auth.user?.role === '管理员' ? 'danger' : 'info'" :disabled="auth.user?.role !== '管理员'" @click="openReset(row)">
                    重置密码
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
        <div class="card">
          <div class="card-hd"><h3>角色概览</h3></div>
          <div class="card-bd tight">
            <el-table :data="roleSummary" size="small">
              <el-table-column prop="role" label="角色" width="120" />
              <el-table-column prop="total" label="账号数" width="100" />
              <el-table-column prop="active" label="启用数" width="100" />
              <el-table-column label="启用率">
                <template #default="{ row }">
                  <el-progress :percentage="row.total ? Math.round(row.active / row.total * 100) : 0" :stroke-width="8" />
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="操作日志" name="logs">
        <div class="card">
          <div class="card-hd">
            <h3>操作日志</h3>
            <div class="filters">
              <el-input v-model="logKw" placeholder="搜索用户/动作/明细" clearable style="width: 200px" @keyup.enter="loadLogs" @clear="loadLogs" />
              <el-button :icon="Search" @click="loadLogs">查询</el-button>
            </div>
          </div>
          <div class="card-bd tight">
            <el-table :data="logs" size="small" max-height="520">
              <el-table-column prop="time" label="时间" width="170" />
              <el-table-column prop="user" label="操作人" width="110" />
              <el-table-column prop="action" label="动作" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.action.includes('失败') ? 'danger' : 'info'" size="small">{{ row.action }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="detail" label="明细" min-width="260" show-overflow-tooltip />
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="个人资料" name="profile">
        <div class="card" style="max-width: 520px">
          <div class="card-hd"><h3>个人资料</h3></div>
          <div class="card-bd">
            <el-form label-width="90px">
              <el-form-item label="账号"><el-input :model-value="auth.user?.account" disabled /></el-form-item>
              <el-form-item label="角色"><el-input :model-value="auth.user?.role" disabled /></el-form-item>
              <el-form-item label="姓名"><el-input v-model="profileForm.name" /></el-form-item>
              <el-form-item label="手机号"><el-input v-model="profileForm.phone" placeholder="11 位手机号" /></el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="saving" @click="saveProfile">保存</el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增账号 -->
    <el-dialog v-model="createOpen" title="新增账号" width="480px">
      <el-form label-width="90px">
        <el-form-item label="账号" required><el-input v-model.trim="userForm.account" placeholder="字母开头，4-16 位" /></el-form-item>
        <el-form-item label="姓名" required><el-input v-model.trim="userForm.name" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.role">
            <el-option v-for="r in ['教师', '教研组长', '学生', '管理员']" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="学科"><el-input v-model.trim="userForm.subject" /></el-form-item>
        <el-form-item label="初始密码" required><el-input v-model="userForm.password" placeholder="≥8 位，含字母与数字" show-password /></el-form-item>
        <el-form-item label="手机号"><el-input v-model.trim="userForm.phone" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createUser">创建</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetOpen" :title="`重置密码 · ${resetting?.account || ''}`" width="420px">
      <el-form label-width="90px">
        <el-form-item label="新密码" required>
          <el-input v-model="resetPassword" placeholder="≥8 位，含字母与数字" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="resetPwd">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const tab = ref('params')
const saving = ref(false)

const setting = reactive({ weakThreshold: 60, warnThreshold: 70, reviewDays: 7, term: '', school: '', grade: '', subject: '', updatedAt: '', updatedBy: '' })
const users = ref([])
const roleSummary = ref([])
const logs = ref([])
const logKw = ref('')
const canManage = computed(() => ['管理员', '教研组长'].includes(auth.user?.role))

const createOpen = ref(false)
const userForm = reactive({ account: '', name: '', role: '教师', subject: '数学', password: '', phone: '' })
const resetOpen = ref(false)
const resetting = ref(null)
const resetPassword = ref('')
const profileForm = reactive({ name: '', phone: '' })

async function loadSetting() {
  const data = await api.get('/api/accounts/settings')
  Object.assign(setting, data)
}

async function saveSetting() {
  saving.value = true
  try {
    const data = await api.put('/api/accounts/settings', { ...setting })
    Object.assign(setting, data)
    ElMessage.success('参数已保存，新诊断将按新阈值判定')
  } catch (err) {
    ElMessage.error(err?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

async function loadUsers() {
  users.value = await api.get('/api/accounts/users')
  roleSummary.value = await api.get('/api/accounts/roles/summary')
}

function openCreate() {
  Object.assign(userForm, { account: '', name: '', role: '教师', subject: '数学', password: '', phone: '' })
  createOpen.value = true
}

async function createUser() {
  saving.value = true
  try {
    await api.post('/api/accounts/users', { ...userForm })
    ElMessage.success('账号已创建')
    createOpen.value = false
    loadUsers()
  } catch (err) {
    ElMessage.error(err?.msg || '创建失败')
  } finally {
    saving.value = false
  }
}

async function toggleUser(row) {
  try {
    await api.post(`/api/accounts/users/${row.id}/toggle`)
    ElMessage.success('状态已更新')
    loadUsers()
  } catch (err) {
    ElMessage.error(err?.msg || '操作失败')
  }
}

function openReset(row) {
  resetting.value = row
  resetPassword.value = ''
  resetOpen.value = true
}

async function resetPwd() {
  saving.value = true
  try {
    await api.post(`/api/accounts/users/${resetting.value.id}/reset-password`, { password: resetPassword.value })
    ElMessage.success('密码已重置')
    resetOpen.value = false
  } catch (err) {
    ElMessage.error(err?.msg || '重置失败')
  } finally {
    saving.value = false
  }
}

async function loadLogs() {
  logs.value = await api.get('/api/accounts/logs', { kw: logKw.value })
}

async function saveProfile() {
  saving.value = true
  try {
    const data = await api.put('/api/accounts/profile', { ...profileForm })
    auth.user = { ...auth.user, ...data }
    localStorage.setItem('APP_USER', JSON.stringify(auth.user))
    ElMessage.success('个人资料已更新')
  } catch (err) {
    ElMessage.error(err?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  profileForm.name = auth.user?.name || ''
  profileForm.phone = ''
  loadSetting()
  loadUsers()
  loadLogs()
})
</script>

<style scoped>
.settings-tabs :deep(.el-tabs__item) { font-size: 14px; font-weight: 600; }
</style>
