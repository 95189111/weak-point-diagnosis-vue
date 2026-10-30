<template>
  <div>
    <div class="page-head">
      <div>
        <h2>工作台</h2>
        <div class="sub">数据截至 {{ data?.updatedAt || '--' }} · {{ auth.user?.role }}视图</div>
      </div>
      <div class="actions">
        <el-button type="primary" :icon="MagicStick" @click="openBriefing">AI 今日教学简报</el-button>
        <el-button :icon="Refresh" @click="load">刷新</el-button>
      </div>
    </div>

    <div class="kpi-grid">
      <StatCard label="薄弱知识点" :value="kpi.weakPoints" suffix="个" icon="Warning" tone="danger" />
      <StatCard label="待复核诊断" :value="kpi.pending" suffix="单" icon="Tickets" tone="warning" />
      <StatCard label="进行中干预" :value="kpi.running" suffix="项" icon="Loading" tone="primary" />
      <StatCard label="逾期干预" :value="kpi.overdue" suffix="项" icon="AlarmClock" tone="dark" />
      <StatCard label="预警学生" :value="kpi.warning" suffix="名" icon="UserFilled" tone="success" />
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-hd">
          <h3>薄弱知识点排行</h3>
          <span class="meta">按掌握度升序 TOP7</span>
        </div>
        <div class="card-bd">
          <ChartBase v-if="weakRankOption" :option="weakRankOption" :height="320" />
          <el-empty v-else description="暂无数据" />
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>待复核诊断</h3>
          <el-link type="primary" :underline="false" @click="$router.push({ name: 'diagnosis' })">前往处理</el-link>
        </div>
        <div class="card-bd tight">
          <el-table :data="data?.pendingList || []" size="small" :show-header="true">
            <el-table-column prop="no" label="单号" width="120" />
            <el-table-column prop="kpName" label="知识点" min-width="130" show-overflow-tooltip />
            <el-table-column prop="className" label="班级" width="100" />
            <el-table-column label="掌握度" width="90">
              <template #default="{ row }"><span class="num">{{ row.mastery?.toFixed(1) }}%</span></template>
            </el-table-column>
            <el-table-column label="等级" width="80">
              <template #default="{ row }"><LevelTag :level="row.level" /></template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>干预待办</h3>
          <el-link type="primary" :underline="false" @click="$router.push({ name: 'intervention' })">前往跟踪</el-link>
        </div>
        <div class="card-bd">
          <el-timeline>
            <el-timeline-item
              v-for="t in data?.todo || []"
              :key="t.id"
              :timestamp="t.deadline"
              :type="t.status === '进行中' ? 'primary' : 'info'"
            >
              <div class="todo-item">
                <b>{{ t.kpName }}</b>
                <span class="muted">{{ t.className }} · {{ t.owner }} · {{ t.status }}</span>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-if="!(data?.todo || []).length" description="暂无待办" :image-size="60" />
        </div>
      </div>

      <div class="card">
        <div class="card-hd">
          <h3>班级掌握度概览</h3>
          <el-link type="primary" :underline="false" @click="$router.push({ name: 'analysis' })">班级对比</el-link>
        </div>
        <div class="card-bd tight">
          <el-table :data="data?.classes || []" size="small">
            <el-table-column prop="name" label="班级" min-width="110" />
            <el-table-column prop="teacher" label="班主任" width="90" />
            <el-table-column prop="students" label="学生" width="70" />
            <el-table-column label="平均掌握度" width="120">
              <template #default="{ row }">
                <el-progress :percentage="row.avgMastery" :stroke-width="8" :format="() => row.avgMastery.toFixed(1) + '%'" />
              </template>
            </el-table-column>
            <el-table-column prop="weak" label="薄弱点" width="80" />
            <el-table-column label="最新均分" width="90">
              <template #default="{ row }"><span class="num">{{ row.latestAvg }}</span></template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>

    <AiStreamDialog ref="briefingRef" title="AI 今日教学简报" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { MagicStick, Refresh } from '@element-plus/icons-vue'
import api from '@/api'
import { useAuthStore } from '@/stores/auth'
import StatCard from '@/components/StatCard.vue'
import LevelTag from '@/components/LevelTag.vue'
import ChartBase from '@/components/ChartBase.vue'
import AiStreamDialog from '@/components/AiStreamDialog.vue'

const auth = useAuthStore()
const data = ref(null)
const briefingRef = ref(null)
const kpi = computed(() => data.value?.kpi || {})

const weakRankOption = computed(() => {
  const rows = data.value?.weakRank || []
  if (!rows.length) return null
  const colorMap = { 薄弱: '#ef4444', 临界: '#f59e0b', 达标: '#10b981' }
  return {
    grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', data: rows.map((r) => r.name).reverse(), axisTick: { show: false } },
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}：${p[0].value}%` },
    series: [{
      type: 'bar',
      barWidth: 14,
      data: [...rows].reverse().map((r) => ({ value: r.mastery, itemStyle: { color: colorMap[r.level] || '#0891B2' } })),
      label: { show: true, position: 'right', formatter: '{c}%' },
    }],
  }
})

function openBriefing() {
  briefingRef.value.open('/api/ai/briefing', {})
}

async function load() {
  data.value = await api.get('/api/analytics/dashboard')
}

onMounted(load)
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
.todo-item { display: flex; flex-direction: column; }
.todo-item .muted { font-size: 12px; }
@media (max-width: 1100px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .grid-2 { grid-template-columns: 1fr; }
}
</style>
