<template>
  <div>
    <div class="page-head">
      <div>
        <h2>干预跟踪</h2>
        <div class="sub">为薄弱诊断建立补救任务，复查达标后销号并联动关闭诊断单</div>
      </div>
      <div class="actions">
        <el-button type="primary" :icon="Plus" @click="openCreate">新建干预任务</el-button>
      </div>
    </div>

    <div class="kpi-grid">
      <StatCard label="干预任务" :value="stats.total" suffix="项" icon="Flag" tone="primary" />
      <StatCard label="进行中" :value="stats.running" suffix="项" icon="Loading" tone="warning" />
      <StatCard label="逾期未销号" :value="stats.overdue" suffix="项" icon="AlarmClock" tone="danger" />
      <StatCard label="干预有效率" :value="stats.effectiveRate" suffix="%" icon="CircleCheck" tone="success" />
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>干预任务列表</h3>
        <div class="filters">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 110px" @change="load">
            <el-option v-for="s in ['待开始', '进行中', '已复查', '已销号']" :key="s" :label="s" :value="s" />
          </el-select>
          <el-select v-model="filters.owner" placeholder="全部责任人" clearable filterable style="width: 130px" @change="load">
            <el-option v-for="o in owners" :key="o" :label="o" :value="o" />
          </el-select>
          <el-checkbox v-model="onlyOverdue" border @change="load">只看逾期</el-checkbox>
          <el-input v-model="filters.kw" placeholder="搜索编号/知识点" clearable style="width: 170px" @keyup.enter="load" @clear="load" />
          <el-button :icon="Search" @click="load">查询</el-button>
        </div>
      </div>
      <div class="card-bd tight">
        <el-table v-loading="loading" :data="rows" size="small" stripe
          :row-class-name="({ row }) => (isOverdue(row) ? 'overdue-row' : '')">
          <el-table-column prop="no" label="编号" width="130" />
          <el-table-column prop="kpName" label="知识点" min-width="130" show-overflow-tooltip />
          <el-table-column prop="className" label="班级" width="95" />
          <el-table-column prop="target" label="对象" width="70" />
          <el-table-column prop="measure" label="干预措施" min-width="170" show-overflow-tooltip />
          <el-table-column prop="owner" label="责任人" width="90" />
          <el-table-column prop="deadline" label="期限" width="100">
            <template #default="{ row }">
              <span :class="{ 'deadline-over': isOverdue(row) }">{{ row.deadline }}</span>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="120">
            <template #default="{ row }">
              <el-progress :percentage="row.progress" :stroke-width="8" :format="() => row.progress + '%'" />
            </template>
          </el-table-column>
          <el-table-column label="复查得分率" width="100">
            <template #default="{ row }">
              <span class="num">{{ row.checkScore ? row.checkScore.toFixed(1) + '%' : '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="result" label="效果" width="90">
            <template #default="{ row }"><LevelTag :level="row.result" /></template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }"><LevelTag :level="row.status" /></template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status !== '已销号'" link type="primary" size="small" @click="openUpdate(row)">更新</el-button>
              <span v-else class="muted">已闭环</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="card">
      <div class="card-hd"><h3>责任人工作量</h3><span class="meta">按任务总数排序</span></div>
      <div class="card-bd tight">
        <el-table :data="workload" size="small">
          <el-table-column prop="owner" label="责任人" width="140" />
          <el-table-column prop="total" label="任务总数" width="100" />
          <el-table-column prop="running" label="进行中" width="100" />
          <el-table-column prop="overdue" label="逾期" width="100">
            <template #default="{ row }">
              <span :class="{ 'bad-num': row.overdue > 0 }">{{ row.overdue }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="closed" label="已销号" width="100" />
          <el-table-column label="负荷">
            <template #default="{ row }">
              <el-progress :percentage="Math.min(100, Math.round(row.running / 5 * 100))"
                :stroke-width="8" :format="() => `${row.running} 项在办`" />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 新建干预 -->
    <el-dialog v-model="createOpen" title="新建干预任务" width="560px">
      <el-form label-width="110px">
        <el-form-item label="知识点" required>
          <el-select v-model="form.kpId" filterable placeholder="选择薄弱知识点">
            <el-option v-for="k in kps" :key="k.id" :label="`${k.name}（${k.chapter}）`" :value="k.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="干预班级" required>
          <el-select v-model="form.classId" placeholder="选择班级" @change="loadDiagnoses">
            <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联诊断单">
          <el-select v-model="form.diagnosisId" placeholder="自动匹配该班该知识点的诊断单" clearable>
            <el-option v-for="d in relatedDiagnoses" :key="d.id" :label="`${d.no} · ${d.level} · ${d.mastery.toFixed(1)}%`" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="干预对象">
          <el-radio-group v-model="form.target">
            <el-radio-button value="班级">班级</el-radio-button>
            <el-radio-button value="小组">小组</el-radio-button>
            <el-radio-button value="个人">个人</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.target !== '班级'" label="对象名称">
          <el-input v-model.trim="form.targetName" placeholder="如：第2小组 / 张三" />
        </el-form-item>
        <el-form-item label="干预措施" required>
          <el-input v-model="form.measure" type="textarea" :rows="3" placeholder="如：每周二课后集中讲评 + 变式训练，第4周复查" />
        </el-form-item>
        <el-form-item label="完成期限" required>
          <el-date-picker v-model="form.deadline" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="create">创建</el-button>
      </template>
    </el-dialog>

    <!-- 更新干预 -->
    <el-dialog v-model="updateOpen" title="更新干预任务" width="520px">
      <el-form label-width="110px">
        <el-form-item label="任务">{{ updating?.no }}（{{ updating?.kpName }}）</el-form-item>
        <el-form-item label="执行进度">
          <el-slider v-model="updateForm.progress" :max="100" show-input />
        </el-form-item>
        <el-form-item label="任务状态">
          <el-select v-model="updateForm.status">
            <el-option v-for="s in ['待开始', '进行中', '已复查', '已销号']" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="复查得分率">
          <el-input-number v-model="updateForm.checkScore" :min="0" :max="100" :precision="1" />
          <span class="muted" style="margin-left: 8px">置为已复查/已销号时必填</span>
        </el-form-item>
        <el-form-item label="效果判定">
          <el-radio-group v-model="updateForm.result">
            <el-radio-button value="待观察">待观察</el-radio-button>
            <el-radio-button value="有效">有效</el-radio-button>
            <el-radio-button value="无效">无效</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-alert v-if="['已复查', '已销号'].includes(updateForm.status)" type="info" :closable="false"
          title="销号后将自动尝试关闭关联诊断单（复查达标闭环）" />
      </el-form>
      <template #footer>
        <el-button @click="updateOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="update">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import StatCard from '@/components/StatCard.vue'
import LevelTag from '@/components/LevelTag.vue'

const rows = ref([])
const stats = ref({})
const workload = ref([])
const classes = ref([])
const kps = ref([])
const owners = ref([])
const relatedDiagnoses = ref([])
const loading = ref(false)
const saving = ref(false)
const filters = reactive({ kw: '', status: '', owner: '' })
const onlyOverdue = ref(false)

const createOpen = ref(false)
const form = reactive({ kpId: '', classId: '', diagnosisId: '', target: '班级', targetName: '', measure: '', deadline: '' })
const updateOpen = ref(false)
const updating = ref(null)
const updateForm = reactive({ progress: 0, status: '进行中', checkScore: 0, result: '待观察' })

const today = computed(() => new Date().toISOString().slice(0, 10))

function isOverdue(row) {
  return row.deadline < today.value && row.status !== '已销号'
}

async function load() {
  loading.value = true
  try {
    const [data, wl] = await Promise.all([
      api.get('/api/practice/interventions', { ...filters, overdue: onlyOverdue.value ? '1' : '' }),
      api.get('/api/practice/interventions/workload'),
    ])
    rows.value = data.list
    stats.value = data.stats
    workload.value = wl
    owners.value = wl.map((w) => w.owner)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, { kpId: '', classId: '', diagnosisId: '', target: '班级', targetName: '', measure: '', deadline: '' })
  relatedDiagnoses.value = []
  createOpen.value = true
}

async function loadDiagnoses() {
  form.diagnosisId = ''
  if (!form.classId) {
    relatedDiagnoses.value = []
    return
  }
  const data = await api.get('/api/diagnosis/classes/' + form.classId + '/weak-map')
  relatedDiagnoses.value = [...data.weak, ...data.critical]
}

async function create() {
  saving.value = true
  try {
    await api.post('/api/practice/interventions/create', { ...form })
    ElMessage.success('干预任务已创建')
    createOpen.value = false
    load()
  } catch (err) {
    ElMessage.error(err?.msg || '创建失败')
  } finally {
    saving.value = false
  }
}

function openUpdate(row) {
  updating.value = row
  Object.assign(updateForm, {
    progress: row.progress, status: row.status, checkScore: row.checkScore || 0, result: row.result,
  })
  updateOpen.value = true
}

async function update() {
  saving.value = true
  try {
    await api.put(`/api/practice/interventions/${updating.value.id}`, { ...updateForm })
    ElMessage.success('干预任务已更新')
    updateOpen.value = false
    load()
  } catch (err) {
    ElMessage.error(err?.msg || '更新失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const [c, k] = await Promise.all([
    api.get('/api/accounts/classes'),
    api.get('/api/knowledge/points'),
  ])
  classes.value = c
  kps.value = k.list
  load()
})
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
:deep(.overdue-row) { background: #fff7ed !important; }
.deadline-over { color: #ef4444; font-weight: 700; }
.bad-num { color: #ef4444; font-weight: 700; }
@media (max-width: 1000px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
