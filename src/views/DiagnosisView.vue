<template>
  <div>
    <div class="page-head">
      <div>
        <h2>薄弱知识点诊断</h2>
        <div class="sub">核心算法：掌握度 = 班级得分率×62% + 知识点基准×38% − 趋势罚分，按阈值三档判定</div>
      </div>
      <div class="actions">
        <el-button type="primary" :icon="Aim" @click="detectOpen = true">生成诊断</el-button>
        <el-button :icon="Refresh" @click="recalcOpen = true">按批次重算</el-button>
      </div>
    </div>

    <div class="kpi-grid">
      <StatCard label="薄弱知识点" :value="stats.weakPoints" suffix="个" icon="Warning" tone="danger" />
      <StatCard label="待复核诊断" :value="stats.pending" suffix="单" icon="Tickets" tone="warning" />
      <StatCard label="平均掌握度" :value="stats.avgMastery" suffix="%" icon="Odometer" tone="primary" />
      <StatCard label="下滑趋势诊断" :value="stats.down" suffix="条" icon="Bottom" tone="dark" />
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>诊断单列表</h3>
        <div class="filters">
          <el-select v-model="filters.classId" placeholder="全部班级" clearable style="width: 130px" @change="load">
            <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <el-select v-model="filters.level" placeholder="全部等级" clearable style="width: 110px" @change="load">
            <el-option label="薄弱" value="薄弱" /><el-option label="临界" value="临界" />
          </el-select>
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 120px" @change="load">
            <el-option v-for="s in ['待复核', '已确认', '已推送', '已销号']" :key="s" :label="s" :value="s" />
          </el-select>
          <el-input v-model="filters.kw" placeholder="搜索单号/知识点" clearable style="width: 170px" @keyup.enter="load" @clear="load" />
          <el-button :icon="Search" @click="load">查询</el-button>
        </div>
      </div>
      <div class="card-bd tight">
        <el-table v-loading="loading" :data="rows" size="small" stripe>
          <el-table-column prop="no" label="单号" width="130" />
          <el-table-column prop="kpName" label="知识点" min-width="140" show-overflow-tooltip />
          <el-table-column prop="chapter" label="章节" width="120" show-overflow-tooltip />
          <el-table-column prop="className" label="班级" width="95" />
          <el-table-column label="掌握度" width="140">
            <template #default="{ row }">
              <el-progress :percentage="row.mastery" :stroke-width="8"
                :color="row.level === '薄弱' ? '#ef4444' : '#f59e0b'"
                :format="() => row.mastery?.toFixed(1) + '%'" />
            </template>
          </el-table-column>
          <el-table-column label="班级得分率" width="100">
            <template #default="{ row }"><span class="num">{{ row.classRate?.toFixed(1) }}%</span></template>
          </el-table-column>
          <el-table-column label="趋势" width="80">
            <template #default="{ row }">
              <span :class="['trend', row.trend === '下降' ? 'down' : row.trend === '上升' ? 'up' : '']">
                {{ row.trend === '下降' ? '↓' : row.trend === '上升' ? '↑' : '—' }} {{ row.trend }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="等级" width="80">
            <template #default="{ row }"><LevelTag :level="row.level" /></template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }"><LevelTag :level="row.status" /></template>
          </el-table-column>
          <el-table-column prop="createdAt" label="生成时间" width="150" />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
              <el-button v-if="row.status === '待复核'" link type="success" size="small" @click="confirm(row)">确认</el-button>
              <el-button v-if="['已确认', '已推送'].includes(row.status)" link type="warning" size="small" @click="close(row)">销号</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 生成诊断 -->
    <el-dialog v-model="detectOpen" title="生成薄弱诊断" width="520px">
      <el-form label-width="100px">
        <el-form-item label="知识点" required>
          <el-select v-model="detectForm.kpId" filterable placeholder="选择知识点">
            <el-option v-for="k in kps" :key="k.id" :label="`${k.name}（${k.chapter}）`" :value="k.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级" required>
          <el-select v-model="detectForm.classId" placeholder="选择班级">
            <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="考试批次">
          <el-select v-model="detectForm.examId" placeholder="默认取该班全部成绩" clearable>
            <el-option v-for="e in exams" :key="e.id" :label="`${e.className} · ${e.name}`" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-alert type="info" :closable="false" title="同知识点+班级若已有待复核/已确认诊断单，将刷新原单据（幂等）" />
      </el-form>
      <template #footer>
        <el-button @click="detectOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="detect">生成</el-button>
      </template>
    </el-dialog>

    <!-- 按批次重算 -->
    <el-dialog v-model="recalcOpen" title="按批次重算诊断" width="480px">
      <el-alert type="warning" :closable="false" title="将对所选班级的全部启用知识点重新执行识别算法（新增/刷新/跳过）" style="margin-bottom: 12px" />
      <el-select v-model="recalcExamId" placeholder="选择考试批次" style="width: 100%">
        <el-option v-for="e in exams" :key="e.id" :label="`${e.className} · ${e.name}（${e.date}）`" :value="e.id" />
      </el-select>
      <template #footer>
        <el-button @click="recalcOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="recalculate">开始重算</el-button>
      </template>
    </el-dialog>

    <!-- 诊断详情 -->
    <el-drawer v-model="detailOpen" :title="`诊断详情 · ${detail?.no || ''}`" size="640px">
      <template v-if="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="知识点" :span="2">{{ detail.kpName }}（{{ detail.chapter }}）</el-descriptions-item>
          <el-descriptions-item label="班级">{{ detail.className }}</el-descriptions-item>
          <el-descriptions-item label="关联考试">{{ detail.examName || '全部' }}</el-descriptions-item>
          <el-descriptions-item label="掌握度">{{ detail.mastery?.toFixed(1) }}%</el-descriptions-item>
          <el-descriptions-item label="等级"><LevelTag :level="detail.level" /></el-descriptions-item>
          <el-descriptions-item label="班级得分率">{{ detail.classRate?.toFixed(1) }}%</el-descriptions-item>
          <el-descriptions-item label="年级常模">{{ detail.normRate?.toFixed(1) }}%</el-descriptions-item>
          <el-descriptions-item label="状态"><LevelTag :level="detail.status" /></el-descriptions-item>
          <el-descriptions-item label="责任人">{{ detail.owner || '—' }}</el-descriptions-item>
          <el-descriptions-item label="成因" :span="2">{{ detail.cause }}</el-descriptions-item>
          <el-descriptions-item label="处置建议" :span="2">{{ detail.suggestion }}</el-descriptions-item>
        </el-descriptions>

        <div class="ai-row">
          <el-button type="primary" :icon="MagicStick" @click="openAi">AI 归因解读</el-button>
          <span class="muted">基于证据链与认知层级自动生成教学建议</span>
        </div>

        <h4 style="margin: 6px 0 10px">证据链（5 项）</h4>
        <el-table :data="detail.evidence || []" size="small">
          <el-table-column prop="metric" label="指标" width="130" />
          <el-table-column prop="value" label="取值" width="140" />
          <el-table-column prop="reference" label="参考标准" width="150" />
          <el-table-column prop="judge" label="判定">
            <template #default="{ row }">
              <el-tag :type="row.judge.includes('低于') || row.judge.includes('干预') || row.judge.includes('超出') ? 'danger' : 'success'" size="small">
                {{ row.judge }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>

    <AiStreamDialog ref="aiRef" title="AI 诊断归因解读" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Aim, MagicStick, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import StatCard from '@/components/StatCard.vue'
import LevelTag from '@/components/LevelTag.vue'
import AiStreamDialog from '@/components/AiStreamDialog.vue'

const rows = ref([])
const stats = ref({})
const classes = ref([])
const kps = ref([])
const exams = ref([])
const loading = ref(false)
const saving = ref(false)
const filters = reactive({ kw: '', classId: '', level: '', status: '' })

const detectOpen = ref(false)
const detectForm = reactive({ kpId: '', classId: '', examId: '' })
const recalcOpen = ref(false)
const recalcExamId = ref('')
const detailOpen = ref(false)
const detail = ref(null)
const aiRef = ref(null)

async function load() {
  loading.value = true
  try {
    const data = await api.get('/api/diagnosis/diagnoses', { ...filters })
    rows.value = data.list
    stats.value = data.stats
  } finally {
    loading.value = false
  }
}

async function detect() {
  saving.value = true
  try {
    const res = await api.post('/api/diagnosis/diagnoses/detect', { ...detectForm })
    ElMessage.success(`${res.msg}：${res.diagnosis.kpName}（${res.diagnosis.level} ${res.diagnosis.mastery.toFixed(1)}%）`)
    detectOpen.value = false
    load()
  } catch (err) {
    ElMessage.error(err?.msg || '生成失败')
  } finally {
    saving.value = false
  }
}

async function recalculate() {
  if (!recalcExamId.value) {
    ElMessage.warning('请选择考试批次')
    return
  }
  saving.value = true
  try {
    const res = await api.post('/api/diagnosis/diagnoses/recalculate', { examId: recalcExamId.value })
    ElMessageBox.alert(
      `班级：${res.className}\n新增：${res.created} · 刷新：${res.updated} · 跳过：${res.skipped}（达标/数据不足）`,
      '重算完成', { confirmButtonText: '知道了' },
    )
    recalcOpen.value = false
    load()
  } catch (err) {
    ElMessage.error(err?.msg || '重算失败')
  } finally {
    saving.value = false
  }
}

async function openDetail(row) {
  detail.value = await api.get(`/api/diagnosis/diagnoses/${row.id}`)
  detailOpen.value = true
}

function openAi() {
  aiRef.value.open('/api/ai/explain-diagnosis', { diagnosisId: detail.value.id })
}

async function confirm(row) {
  await api.post(`/api/diagnosis/diagnoses/${row.id}/confirm`)
  ElMessage.success('诊断已确认')
  load()
}

async function close(row) {
  await api.post(`/api/diagnosis/diagnoses/${row.id}/close`)
  ElMessage.success('诊断已销号')
  load()
}

onMounted(async () => {
  const [c, k, e] = await Promise.all([
    api.get('/api/accounts/classes'),
    api.get('/api/knowledge/points'),
    api.get('/api/exams/batches'),
  ])
  classes.value = c
  kps.value = k.list
  exams.value = e.list
  load()
})
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.trend.down { color: #ef4444; font-weight: 700; }
.trend.up { color: #10b981; font-weight: 700; }
.ai-row { display: flex; align-items: center; gap: 12px; margin: 14px 0 4px; }
@media (max-width: 1000px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
