<template>
  <div>
    <div class="page-head">
      <div>
        <h2>班级对比分析</h2>
        <div class="sub">班级均分 / 分数段分布 / 趋势 / 知识点级差与章节概览，支撑讲评与决策</div>
      </div>
      <div class="actions">
        <el-button type="primary" :icon="MagicStick" @click="openAiReport">AI 生成讲评报告</el-button>
        <el-button :icon="Download" @click="exportSnapshot">导出数据快照</el-button>
        <el-button :icon="Plus" @click="reportOpen = true">登记分析报告</el-button>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>分析条件</h3>
        <div class="filters">
          <el-select v-model="filters.examId" placeholder="全部考试" clearable style="width: 200px" @change="loadAll">
            <el-option v-for="e in exams" :key="e.id" :label="`${e.className} · ${e.name}`" :value="e.id" />
          </el-select>
          <el-select v-model="filters.chapter" placeholder="全部章节" clearable style="width: 170px" @change="loadAll">
            <el-option v-for="c in chapterNames" :key="c" :label="c" :value="c" />
          </el-select>
          <el-select v-model="filters.classId" placeholder="全部班级" clearable style="width: 130px" @change="loadAll">
            <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </div>
      </div>
      <div class="card-bd tight">
        <el-table :data="comparison" size="small" stripe>
          <el-table-column prop="name" label="班级" width="110" />
          <el-table-column prop="teacher" label="任课教师" width="100" />
          <el-table-column prop="students" label="学生数" width="80" />
          <el-table-column prop="avgScore" label="平均分" width="90" />
          <el-table-column label="及格率" width="130">
            <template #default="{ row }">
              <el-progress :percentage="row.passRate" :stroke-width="8" :format="() => row.passRate.toFixed(1) + '%'" />
            </template>
          </el-table-column>
          <el-table-column label="优秀率" width="130">
            <template #default="{ row }">
              <el-progress :percentage="row.excellentRate" :stroke-width="8" color="#173b68" :format="() => row.excellentRate.toFixed(1) + '%'" />
            </template>
          </el-table-column>
          <el-table-column label="平均掌握度" width="130">
            <template #default="{ row }">
              <el-progress :percentage="row.mastery" :stroke-width="8"
                :color="row.mastery < 60 ? '#ef4444' : '#10b981'" :format="() => row.mastery.toFixed(1) + '%'" />
            </template>
          </el-table-column>
          <el-table-column prop="weak" label="薄弱点" width="80" />
          <el-table-column label="与基线差" width="110">
            <template #default="{ row }">
              <span class="num" :class="row.diff >= 0 ? 'up' : 'down'">
                {{ row.diff >= 0 ? '+' : '' }}{{ row.diff.toFixed(1) }}pp
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-hd"><h3>分数段分布</h3><span class="meta">样本 {{ distribution.total }} 条成绩记录</span></div>
        <div class="card-bd">
          <ChartBase v-if="distOption" :option="distOption" :height="280" />
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>历次考试均分趋势</h3></div>
        <div class="card-bd">
          <ChartBase v-if="trendOption" :option="trendOption" :height="280" />
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>知识点跨班对比</h3>
        <span class="meta">级差 > 12pp 差异显著，> 6pp 需关注</span>
      </div>
      <div class="card-bd">
        <ChartBase v-if="knowledgeOption" :option="knowledgeOption" :height="360" />
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-hd"><h3>章节掌握概览</h3></div>
        <div class="card-bd tight">
          <el-table :data="chapters" size="small">
            <el-table-column prop="chapter" label="章节" min-width="150" show-overflow-tooltip />
            <el-table-column prop="points" label="知识点" width="80" />
            <el-table-column label="平均掌握度" width="130">
              <template #default="{ row }"><span class="num">{{ row.avgMastery.toFixed(1) }}%</span></template>
            </el-table-column>
            <el-table-column prop="weak" label="薄弱点" width="80" />
            <el-table-column prop="diagnoses" label="诊断单" width="80" />
            <el-table-column label="研判" width="100">
              <template #default="{ row }">
                <el-tag :type="row.judge === '优先干预' ? 'danger' : row.judge === '持续观察' ? 'warning' : 'success'" size="small">
                  {{ row.judge }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div class="card">
        <div class="card-hd"><h3>学生掌握度红黑榜</h3></div>
        <div class="card-bd">
          <div class="rank-cols">
            <div>
              <h4 class="rank-title up">榜单前列</h4>
              <div v-for="(s, i) in ranking.top" :key="'t' + i" class="rank-row">
                <span class="rk">{{ i + 1 }}</span><b>{{ s.name }}</b>
                <span class="muted">{{ s.className }}</span>
                <span class="num score">{{ s.mastery.toFixed(1) }}%</span>
              </div>
            </div>
            <div>
              <h4 class="rank-title down">需重点帮扶</h4>
              <div v-for="(s, i) in ranking.bottom" :key="'b' + i" class="rank-row">
                <span class="rk">{{ i + 1 }}</span><b>{{ s.name }}</b>
                <span class="muted">{{ s.className }}</span>
                <span class="num score bad">{{ s.mastery.toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>分析报告</h3>
        <el-button size="small" @click="loadReports">刷新</el-button>
      </div>
      <div class="card-bd tight">
        <el-table :data="reports" size="small">
          <el-table-column prop="name" label="报告名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="scope" label="范围" width="80" />
          <el-table-column prop="examName" label="关联考试" min-width="160" show-overflow-tooltip />
          <el-table-column prop="createdBy" label="创建人" width="90" />
          <el-table-column prop="createdAt" label="创建时间" width="150" />
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openReport(row)">查看快照</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 登记报告 -->
    <el-dialog v-model="reportOpen" title="登记分析报告" width="500px">
      <el-form label-width="100px">
        <el-form-item label="报告名称" required><el-input v-model.trim="reportForm.name" placeholder="如：12月月考年级讲评" /></el-form-item>
        <el-form-item label="分析范围">
          <el-radio-group v-model="reportForm.scope">
            <el-radio-button value="年级">年级</el-radio-button>
            <el-radio-button value="班级">班级</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="关联考试">
          <el-select v-model="reportForm.examId" clearable placeholder="可选">
            <el-option v-for="e in exams" :key="e.id" :label="`${e.className} · ${e.name}`" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="reportForm.note" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reportOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveReport">保存</el-button>
      </template>
    </el-dialog>

    <!-- 报告快照 -->
    <el-drawer v-model="snapshotOpen" :title="`报告快照 · ${snapshot?.name || ''}`" size="720px">
      <template v-if="snapshot">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="分析范围">{{ snapshot.scope }}</el-descriptions-item>
          <el-descriptions-item label="关联考试">{{ snapshot.examName }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ snapshot.createdBy }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ snapshot.createdAt }}</el-descriptions-item>
          <el-descriptions-item v-if="snapshot.note" label="备注" :span="2">{{ snapshot.note }}</el-descriptions-item>
        </el-descriptions>

        <div class="ai-row">
          <el-button type="primary" :icon="MagicStick" @click="openAi">AI 讲评报告</el-button>
          <span class="muted">按当前快照数据生成讲评发言稿</span>
        </div>

        <h4 style="margin: 6px 0 8px">快照数据（生成于 {{ snapshot.snapshot?.generatedAt }}）</h4>
        <el-table :data="snapshot.snapshot?.classes || []" size="small">
          <el-table-column prop="name" label="班级" width="100" />
          <el-table-column prop="avgScore" label="平均分" width="80" />
          <el-table-column prop="mastery" label="掌握度" width="90">
            <template #default="{ row }"><span class="num">{{ row.mastery.toFixed(1) }}%</span></template>
          </el-table-column>
          <el-table-column prop="weak" label="薄弱点" width="80" />
          <el-table-column prop="diff" label="基线差" />
        </el-table>
      </template>
    </el-drawer>

    <AiStreamDialog ref="aiRef" title="AI 班级讲评报告" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Download, MagicStick, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import ChartBase from '@/components/ChartBase.vue'
import AiStreamDialog from '@/components/AiStreamDialog.vue'

const filters = reactive({ examId: '', chapter: '', classId: '' })
const comparison = ref([])
const distribution = ref({ items: [], total: 0 })
const trend = ref([])
const knowledge = ref([])
const chapters = ref([])
const ranking = ref({ top: [], bottom: [] })
const reports = ref([])
const classes = ref([])
const exams = ref([])
const saving = ref(false)

const reportOpen = ref(false)
const reportForm = reactive({ name: '', scope: '年级', examId: '', note: '' })
const snapshotOpen = ref(false)
const snapshot = ref(null)
const aiRef = ref(null)

const chapterNames = computed(() => [...new Set((knowledge.value || []).map((k) => k.chapter))])

const distOption = computed(() => ({
  grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br>人数：${p[0].value}（${p[0].data.rate}%）` },
  legend: { show: false },
  xAxis: { type: 'category', data: distribution.value.items?.map((i) => i.name) || [] },
  yAxis: { type: 'value' },
  series: [{
    type: 'bar', barWidth: 26,
    data: (distribution.value.items || []).map((i) => ({ value: i.count, rate: i.rate })),
    itemStyle: { borderRadius: [4, 4, 0, 0], color: '#0891B2' },
    label: { show: true, position: 'top' },
  }],
}))

const trendOption = computed(() => {
  if (!trend.value.length) return null
  const classNames = trend.value[0]?.classes.map((c) => c.name) || []
  return {
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: trend.value.map((t) => t.name), axisLabel: { interval: 0, fontSize: 10 } },
    yAxis: { type: 'value', max: 120 },
    series: classNames.map((name, idx) => ({
      name, type: 'line', smooth: true, symbolSize: 7,
      data: trend.value.map((t) => t.classes[idx]?.avgScore),
      lineStyle: { width: 3 },
    })),
  }
})

const knowledgeOption = computed(() => {
  const rows = knowledge.value.slice(0, 8)
  if (!rows.length) return null
  const classNames = rows[0]?.values.map((v) => v.name) || []
  return {
    grid: { left: 8, right: 24, top: 40, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v) => v + '%' },
    legend: { top: 0 },
    xAxis: { type: 'category', data: rows.map((k) => k.name), axisLabel: { interval: 0, fontSize: 10 } },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: classNames.map((name, idx) => ({
      name, type: 'bar', barMaxWidth: 16,
      data: rows.map((k) => k.values[idx]?.rate),
      itemStyle: { borderRadius: [3, 3, 0, 0] },
    })),
  }
})

async function loadAll() {
  const [comp, dist, tr, kn, ch, rk] = await Promise.all([
    api.get('/api/analytics/classes', { ...filters }),
    api.get('/api/analytics/distribution', { examId: filters.examId, classId: filters.classId }),
    api.get('/api/analytics/trend'),
    api.get('/api/analytics/knowledge', { chapter: filters.chapter, classId: filters.classId }),
    api.get('/api/analytics/chapters'),
    api.get('/api/analytics/ranking', { limit: 6 }),
  ])
  comparison.value = comp
  distribution.value = dist
  trend.value = tr
  knowledge.value = kn
  chapters.value = ch
  ranking.value = rk
}

async function loadReports() {
  reports.value = await api.get('/api/analytics/reports')
}

function openAiReport() {
  aiRef.value.open('/api/ai/report-comment', { ...filters })
}

function openAi() {
  aiRef.value.open('/api/ai/report-comment', { classId: filters.classId, chapter: filters.chapter })
}

async function saveReport() {
  saving.value = true
  try {
    await api.post('/api/analytics/reports', { ...reportForm })
    ElMessage.success('分析报告已登记')
    reportOpen.value = false
    loadReports()
  } catch (err) {
    ElMessage.error(err?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

async function openReport(row) {
  snapshot.value = await api.get(`/api/analytics/reports/${row.id}`)
  snapshotOpen.value = true
}

async function exportSnapshot() {
  const data = await api.get('/api/analytics/export', { ...filters })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `学情快照_${data.generatedAt.replace(/[-: ]/g, '')}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('快照已导出')
}

onMounted(async () => {
  const [c, e] = await Promise.all([
    api.get('/api/accounts/classes'),
    api.get('/api/exams/batches'),
  ])
  classes.value = c
  exams.value = e.list
  await loadAll()
  loadReports()
})
</script>

<style scoped>
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.up { color: #10b981; font-weight: 700; }
.down { color: #ef4444; font-weight: 700; }
.rank-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.rank-title { margin: 0 0 8px; font-size: 13px; }
.rank-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--color-border); font-size: 13px; }
.rank-row .rk { width: 20px; height: 20px; border-radius: 4px; background: var(--color-bg); border: 1px solid var(--color-border); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
.rank-row .score { margin-left: auto; }
.rank-row .score.bad { color: #ef4444; }
.ai-row { display: flex; align-items: center; gap: 12px; margin: 14px 0 4px; }
@media (max-width: 1000px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
