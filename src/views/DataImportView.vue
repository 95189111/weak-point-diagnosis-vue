<template>
  <div>
    <div class="page-head">
      <div>
        <h2>学情数据导入</h2>
        <div class="sub">周测 / 月考成绩批次管理：导入 → 解析 → 校验异常 → 归档</div>
      </div>
      <div class="actions">
        <el-button type="primary" :icon="UploadFilled" @click="openCreate">新建导入批次</el-button>
      </div>
    </div>

    <div class="kpi-grid">
      <StatCard label="导入批次" :value="stats.batches" suffix="个" icon="Files" tone="primary" />
      <StatCard label="累计数据行" :value="stats.rows" suffix="行" icon="Document" tone="dark" />
      <StatCard label="匹配成功" :value="stats.matched" suffix="行" icon="CircleCheck" tone="success" />
      <StatCard label="异常行" :value="stats.abnormal" suffix="行" icon="CircleClose" tone="danger" />
      <StatCard label="整体匹配率" :value="stats.matchRate" suffix="%" icon="Percent" tone="warning" />
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>导入批次</h3>
        <div class="filters">
          <el-select v-model="filters.type" placeholder="全部类型" clearable style="width: 110px" @change="load">
            <el-option label="月考" value="月考" /><el-option label="单元测" value="单元测" /><el-option label="期中" value="期中" />
          </el-select>
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 110px" @change="load">
            <el-option label="待解析" value="待解析" /><el-option label="已解析" value="已解析" /><el-option label="已归档" value="已归档" />
          </el-select>
          <el-input v-model="filters.kw" placeholder="搜索批次号/名称" clearable style="width: 180px" @keyup.enter="load" @clear="load" />
          <el-button :icon="Search" @click="load">查询</el-button>
        </div>
      </div>
      <div class="card-bd tight">
        <el-table v-loading="loading" :data="rows" size="small" stripe>
          <el-table-column prop="no" label="批次号" width="140" />
          <el-table-column prop="name" label="考试名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="className" label="班级" width="100" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="date" label="考试日期" width="100" />
          <el-table-column prop="rowsCount" label="数据行" width="80" />
          <el-table-column label="匹配/异常" width="100">
            <template #default="{ row }">
              <span class="num ok-num">{{ row.matched }}</span> / <span class="num bad-num">{{ row.abnormal }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }"><LevelTag :level="row.status" /></template>
          </el-table-column>
          <el-table-column label="操作" width="210" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openDetail(row)">明细</el-button>
              <el-button v-if="row.status !== '已归档'" link type="warning" size="small" @click="reparse(row)">重新解析</el-button>
              <el-button v-if="row.status !== '已归档'" link type="success" size="small" @click="archive(row)">归档</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="card">
      <div class="card-hd"><h3>考试类型汇总</h3></div>
      <div class="card-bd tight">
        <el-table :data="typeSummary" size="small">
          <el-table-column prop="type" label="类型" width="120" />
          <el-table-column prop="batches" label="批次数" width="100" />
          <el-table-column label="平均分" width="120">
            <template #default="{ row }"><span class="num">{{ row.avgScore }}</span></template>
          </el-table-column>
          <el-table-column label="及格率">
            <template #default="{ row }">
              <el-progress :percentage="row.passRate" :stroke-width="8" :format="() => row.passRate.toFixed(1) + '%'" />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 新建批次 -->
    <el-dialog v-model="createOpen" title="新建导入批次" width="520px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="考试名称" required><el-input v-model.trim="form.name" placeholder="如：12月月考" /></el-form-item>
        <el-form-item label="所属班级" required>
          <el-select v-model="form.classId" placeholder="选择班级">
            <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="考试类型">
          <el-radio-group v-model="form.type">
            <el-radio-button value="单元测">单元测</el-radio-button>
            <el-radio-button value="月考">月考</el-radio-button>
            <el-radio-button value="期中">期中</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="考试日期" required>
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="数据行数" required>
          <el-input-number v-model="form.rowsCount" :min="1" :max="5000" />
          <span class="muted" style="margin-left: 8px">1-5000 行</span>
        </el-form-item>
        <el-form-item label="原始文件名" required><el-input v-model.trim="form.fileName" placeholder="如：12月月考成绩.xlsx" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="create">创建批次</el-button>
      </template>
    </el-dialog>

    <!-- 批次明细 -->
    <el-drawer v-model="detailOpen" :title="`批次明细 · ${detail?.no || ''}`" size="780px">
      <template v-if="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="考试名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="班级">{{ detail.className }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ detail.type }}</el-descriptions-item>
          <el-descriptions-item label="日期">{{ detail.date }}</el-descriptions-item>
          <el-descriptions-item label="数据行数">{{ detail.rowsCount }}</el-descriptions-item>
          <el-descriptions-item label="匹配 / 异常">{{ detail.matched }} / {{ detail.abnormal }}</el-descriptions-item>
          <el-descriptions-item label="平均分">{{ detail.avgScore || '—' }}</el-descriptions-item>
          <el-descriptions-item label="状态"><LevelTag :level="detail.status" /></el-descriptions-item>
          <el-descriptions-item label="原始文件">{{ detail.fileName }}</el-descriptions-item>
          <el-descriptions-item label="上传时间">{{ detail.uploadedAt }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin: 16px 0 8px">校验异常（{{ detail.issues?.length || 0 }}）</h4>
        <el-table :data="detail.issues || []" size="small">
          <el-table-column prop="rowNo" label="行号" width="70" />
          <el-table-column prop="issueType" label="异常类型" width="120" />
          <el-table-column prop="detail" label="明细" min-width="220" show-overflow-tooltip />
          <el-table-column prop="status" label="处理状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === '已处理' ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <h4 style="margin: 16px 0 8px">成绩明细（{{ detail.scores?.length || 0 }}）</h4>
        <el-table :data="detail.scores || []" size="small" max-height="320">
          <el-table-column prop="studentNo" label="学号" width="90" />
          <el-table-column prop="studentName" label="姓名" width="90" />
          <el-table-column prop="score" label="得分" width="80" />
          <el-table-column label="得分率" width="120">
            <template #default="{ row }"><span class="num">{{ row.accuracy?.toFixed(1) }}%</span></template>
          </el-table-column>
          <el-table-column prop="classRank" label="班级排名" width="90" />
          <el-table-column prop="date" label="日期" />
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Search, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import StatCard from '@/components/StatCard.vue'
import LevelTag from '@/components/LevelTag.vue'

const rows = ref([])
const stats = ref({})
const typeSummary = ref([])
const classes = ref([])
const loading = ref(false)
const saving = ref(false)
const filters = reactive({ kw: '', type: '', status: '' })

const createOpen = ref(false)
const form = reactive({ name: '', classId: '', type: '单元测', date: '', rowsCount: 32, fileName: '' })
const detailOpen = ref(false)
const detail = ref(null)

async function load() {
  loading.value = true
  try {
    const [data, types] = await Promise.all([
      api.get('/api/exams/batches', { ...filters }),
      api.get('/api/exams/summary/types'),
    ])
    rows.value = data.list
    stats.value = data.stats
    typeSummary.value = types
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, { name: '', classId: classes.value[0]?.id || '', type: '单元测', date: '', rowsCount: 32, fileName: '' })
  createOpen.value = true
}

async function create() {
  saving.value = true
  try {
    await api.post('/api/exams/batches/create', { ...form })
    ElMessage.success('批次已创建，状态：待解析')
    createOpen.value = false
    load()
  } catch (err) {
    ElMessage.error(err?.msg || '创建失败')
  } finally {
    saving.value = false
  }
}

async function reparse(row) {
  await api.post(`/api/exams/batches/${row.id}/reparse`)
  ElMessage.success('已重新解析')
  load()
}

async function archive(row) {
  await api.post(`/api/exams/batches/${row.id}/archive`)
  ElMessage.success('已归档')
  load()
}

async function openDetail(row) {
  detail.value = await api.get(`/api/exams/batches/${row.id}`)
  detailOpen.value = true
}

onMounted(async () => {
  classes.value = await api.get('/api/accounts/classes')
  load()
})
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
.ok-num { color: #10b981; font-weight: 700; }
.bad-num { color: #ef4444; font-weight: 700; }
@media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
