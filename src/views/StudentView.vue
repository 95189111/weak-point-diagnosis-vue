<template>
  <div>
    <div class="page-head">
      <div>
        <h2>学生画像</h2>
        <div class="sub">以学生为维度的成绩走势、薄弱知识点与预警状态，支撑一对一辅导</div>
      </div>
    </div>

    <div class="kpi-grid">
      <StatCard label="学生总数" :value="stats.total" suffix="名" icon="User" tone="primary" />
      <StatCard label="预警学生" :value="stats.warning" suffix="名" icon="Warning" tone="danger" />
      <StatCard label="平均掌握度" :value="stats.avgMastery" suffix="%" icon="Odometer" tone="success" />
      <StatCard label="人均薄弱点" :value="stats.weakAvg" suffix="个" icon="DataLine" tone="warning" />
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>学生档案</h3>
        <div class="filters">
          <el-select v-model="filters.classId" placeholder="全部班级" clearable style="width: 130px" @change="load">
            <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 110px" @change="load">
            <el-option label="正常" value="正常" /><el-option label="关注" value="关注" /><el-option label="预警" value="预警" />
          </el-select>
          <el-input v-model="filters.kw" placeholder="搜索学号/姓名" clearable style="width: 170px" @keyup.enter="load" @clear="load" />
          <el-button :icon="Search" @click="load">查询</el-button>
        </div>
      </div>
      <div class="card-bd tight">
        <el-table v-loading="loading" :data="rows" size="small" stripe>
          <el-table-column prop="no" label="学号" width="90" />
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="className" label="班级" width="100" />
          <el-table-column prop="group" label="小组" width="90" />
          <el-table-column label="综合掌握度" width="150">
            <template #default="{ row }">
              <el-progress :percentage="row.mastery" :stroke-width="8"
                :color="row.status === '预警' ? '#ef4444' : row.status === '关注' ? '#f59e0b' : '#10b981'"
                :format="() => row.mastery?.toFixed(1) + '%'" />
            </template>
          </el-table-column>
          <el-table-column prop="weakCount" label="薄弱点" width="80" />
          <el-table-column prop="lastScore" label="最近成绩" width="90" />
          <el-table-column prop="classRank" label="班级排名" width="90" />
          <el-table-column label="状态" width="80">
            <template #default="{ row }"><LevelTag :level="row.status" /></template>
          </el-table-column>
          <el-table-column prop="trend" label="趋势" width="80" />
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openProfile(row)">查看画像</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 学生画像抽屉 -->
    <el-drawer v-model="profileOpen" :title="`学生画像 · ${profile?.student?.name || ''}`" size="720px">
      <template v-if="profile">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="班级">{{ profile.student.className }}</el-descriptions-item>
          <el-descriptions-item label="小组">{{ profile.student.group }}</el-descriptions-item>
          <el-descriptions-item label="状态"><LevelTag :level="profile.student.status" /></el-descriptions-item>
          <el-descriptions-item label="综合掌握度">{{ profile.student.mastery?.toFixed(1) }}%</el-descriptions-item>
          <el-descriptions-item label="薄弱知识点">{{ profile.student.weakCount }} 个</el-descriptions-item>
          <el-descriptions-item label="最近成绩">{{ profile.student.lastScore }} 分（第 {{ profile.student.classRank }} 名）</el-descriptions-item>
        </el-descriptions>

        <div class="charts">
          <div class="chart-item">
            <h4>成绩走势</h4>
            <ChartBase v-if="trendOption" :option="trendOption" :height="220" />
          </div>
          <div class="chart-item">
            <h4>薄弱知识点掌握度</h4>
            <ChartBase v-if="radarOption" :option="radarOption" :height="220" />
            <el-empty v-else description="暂无薄弱点" :image-size="50" />
          </div>
        </div>

        <h4>历次成绩</h4>
        <el-table :data="profile.scores" size="small" max-height="220">
          <el-table-column prop="examName" label="考试" min-width="160" show-overflow-tooltip />
          <el-table-column prop="date" label="日期" width="100" />
          <el-table-column prop="score" label="得分" width="80" />
          <el-table-column prop="classRank" label="排名" width="80" />
        </el-table>

        <div class="ai-row">
          <el-button type="primary" :icon="MagicStick" @click="openAi">AI 学情评语</el-button>
          <span class="muted">生成个性化辅导建议，可直接用于家长会/评语手册</span>
        </div>
      </template>
    </el-drawer>

    <AiStreamDialog ref="aiRef" title="AI 学情评语" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { MagicStick, Search } from '@element-plus/icons-vue'
import api from '@/api'
import StatCard from '@/components/StatCard.vue'
import LevelTag from '@/components/LevelTag.vue'
import ChartBase from '@/components/ChartBase.vue'
import AiStreamDialog from '@/components/AiStreamDialog.vue'

const rows = ref([])
const stats = ref({})
const classes = ref([])
const loading = ref(false)
const filters = reactive({ kw: '', classId: '', status: '' })

const profileOpen = ref(false)
const profile = ref(null)
const aiRef = ref(null)

const trendOption = computed(() => {
  const scores = profile.value?.scores || []
  if (!scores.length) return null
  return {
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: scores.map((s) => s.examName), axisLabel: { interval: 0, fontSize: 10 } },
    yAxis: { type: 'value', max: 120 },
    series: [{
      type: 'line', smooth: true, symbolSize: 7,
      data: scores.map((s) => s.score),
      lineStyle: { width: 3, color: '#0891B2' },
      itemStyle: { color: '#0891B2' },
      areaStyle: { color: 'rgba(34,211,238,.15)' },
      label: { show: true, fontSize: 10 },
    }],
  }
})

const radarOption = computed(() => {
  const weak = profile.value?.weakPoints || []
  if (!weak.length) return null
  return {
    radar: {
      indicator: weak.map((d) => ({ name: d.kpName, max: 100 })),
      radius: '62%',
      axisName: { fontSize: 10, color: '#52647a' },
    },
    series: [{
      type: 'radar',
      data: [{
        value: weak.map((d) => d.mastery),
        name: '掌握度',
        areaStyle: { color: 'rgba(239,68,68,.2)' },
        lineStyle: { color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
      }],
    }],
  }
})

function openAi() {
  aiRef.value.open('/api/ai/student-comment', { studentId: profile.value.student.id })
}

async function openProfile(row) {
  profile.value = await api.get(`/api/diagnosis/students/${row.id}`)
  profileOpen.value = true
}

async function load() {
  loading.value = true
  try {
    const data = await api.get('/api/diagnosis/students', { ...filters })
    rows.value = data.list
    stats.value = data.stats
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  classes.value = await api.get('/api/accounts/classes')
  load()
})
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0 4px; }
.chart-item h4 { margin: 0 0 4px; }
.ai-row { display: flex; align-items: center; gap: 12px; margin: 16px 0 4px; }
@media (max-width: 1000px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .charts { grid-template-columns: 1fr; }
}
</style>
