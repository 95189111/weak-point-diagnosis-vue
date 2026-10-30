<template>
  <div>
    <div class="page-head">
      <div>
        <h2>靶向练习</h2>
        <div class="sub">针对薄弱知识点组卷推送到班级，回收完成率与二次正确率验证效果</div>
      </div>
      <div class="actions">
        <el-button type="primary" :icon="Promotion" @click="openCreate">创建练习</el-button>
      </div>
    </div>

    <div class="kpi-grid">
      <StatCard label="练习总数" :value="stats.total" suffix="个" icon="Notebook" tone="primary" />
      <StatCard label="进行中" :value="stats.running" suffix="个" icon="Loading" tone="warning" />
      <StatCard label="整体完成率" :value="stats.doneRate" suffix="%" icon="CircleCheck" tone="success" />
      <StatCard label="平均二次正确率" :value="stats.secondRate" suffix="%" icon="TrendCharts" tone="dark" />
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>练习任务</h3>
        <div class="filters">
          <el-select v-model="filters.classId" placeholder="全部班级" clearable style="width: 130px" @change="load">
            <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 110px" @change="load">
            <el-option v-for="s in ['草稿', '进行中', '已结束']" :key="s" :label="s" :value="s" />
          </el-select>
          <el-input v-model="filters.kw" placeholder="搜索编号/名称" clearable style="width: 170px" @keyup.enter="load" @clear="load" />
          <el-button :icon="Search" @click="load">查询</el-button>
        </div>
      </div>
      <div class="card-bd tight">
        <el-table v-loading="loading" :data="rows" size="small" stripe>
          <el-table-column prop="no" label="编号" width="130" />
          <el-table-column prop="name" label="练习名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="className" label="班级" width="95" />
          <el-table-column prop="kpNames" label="知识点" min-width="130" show-overflow-tooltip />
          <el-table-column prop="difficulty" label="难度" width="80">
            <template #default="{ row }">
              <el-tag :type="row.difficulty === '基础' ? 'success' : row.difficulty === '提升' ? 'warning' : 'danger'" size="small">
                {{ row.difficulty }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="questionCount" label="题量" width="70" />
          <el-table-column label="完成进度" width="140">
            <template #default="{ row }">
              <el-progress :percentage="row.pushCount ? Math.round(row.doneCount / row.pushCount * 100) : 0"
                :stroke-width="8" :format="() => `${row.doneCount}/${row.pushCount}`" />
            </template>
          </el-table-column>
          <el-table-column label="二次正确率" width="100">
            <template #default="{ row }">
              <span class="num">{{ row.secondRate ? row.secondRate.toFixed(1) + '%' : '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="deadline" label="期限" width="100" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }"><LevelTag :level="row.status" /></template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openCompletion(row)">完成情况</el-button>
              <el-button v-if="row.status === '草稿'" link type="success" size="small" @click="publish(row)">发布</el-button>
              <el-button v-if="row.status === '进行中'" link type="warning" size="small" @click="openFinish(row)">结束</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 创建练习（手动 / AI 组卷） -->
    <el-dialog v-model="createOpen" title="创建靶向练习" width="760px">
      <el-tabs v-model="mode">
        <el-tab-pane label="手动创建" name="manual" />
        <el-tab-pane label="AI 智能组卷" name="ai" />
      </el-tabs>

      <div class="create-grid">
        <el-form label-width="100px" style="min-width: 300px">
          <el-form-item label="练习名称" required><el-input v-model.trim="form.name" placeholder="如：全等三角形巩固练习" /></el-form-item>
          <el-form-item label="知识点" required>
            <el-select v-model="form.kpId" filterable placeholder="选择薄弱知识点" @change="onKpChange">
              <el-option v-for="k in kps" :key="k.id" :label="`${k.name}（${k.chapter}）`" :value="k.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="推送班级" required>
            <el-select v-model="form.classId" placeholder="选择班级">
              <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="难度">
            <el-radio-group v-model="form.difficulty">
              <el-radio-button value="基础">基础</el-radio-button>
              <el-radio-button value="提升">提升</el-radio-button>
              <el-radio-button value="综合">综合</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="题目数量">
            <el-input-number v-model="form.questionCount" :min="1" :max="20" @change="onCountChange" />
          </el-form-item>
          <el-form-item label="完成期限" required>
            <el-date-picker v-model="form.deadline" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </el-form>

        <div v-if="mode === 'ai'" class="quiz-panel">
          <div class="quiz-head">
            <el-button type="primary" size="small" :icon="MagicStick" :loading="quizLoading" @click="genQuiz">
              生成题目
            </el-button>
            <span class="muted">{{ quiz ? `已生成 ${quiz.questions.length} 题（${quiz.difficulty}）` : '将按认知层级自动生成' }}</span>
          </div>
          <div class="quiz-list">
            <el-collapse v-if="quiz">
              <el-collapse-item v-for="q in quiz.questions" :key="q.index" :name="q.index">
                <template #title>
                  <span class="q-title">{{ q.index }}. {{ q.stem }}</span>
                </template>
                <div class="q-opts">
                  <div v-for="(opt, i) in q.options" :key="i" :class="{ correct: 'ABCD'[i] === q.answer }">
                    {{ 'ABCD'[i] }}. {{ opt }}
                  </div>
                </div>
                <div class="q-analysis"><b>答案：{{ q.answer }}</b>　解析：{{ q.analysis }}</div>
              </el-collapse-item>
            </el-collapse>
            <el-empty v-else description="点击「生成题目」体验 AI 组卷" :image-size="60" />
          </div>
        </div>
        <div v-else class="quiz-panel">
          <el-alert type="info" :closable="false"
            title="手动模式下题目由教师从题库自行指定，系统记录数量与完成情况" />
        </div>
      </div>

      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="mode === 'ai' && !quiz" @click="create">
          {{ mode === 'ai' ? '使用 AI 组卷创建' : '创建练习' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 结束练习 -->
    <el-dialog v-model="finishOpen" title="结束练习" width="460px">
      <el-form label-width="110px">
        <el-form-item label="练习">{{ finishing?.name }}</el-form-item>
        <el-form-item label="完成情况">{{ finishing?.doneCount }}/{{ finishing?.pushCount }}</el-form-item>
        <el-form-item label="二次正确率">
          <el-input-number v-model="finishRate" :min="0" :max="100" :precision="1" />
          <span class="muted" style="margin-left: 8px">留空将按完成率自动估算（48 + 完成率×0.35）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="finishOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="finish">确认结束</el-button>
      </template>
    </el-dialog>

    <!-- 完成情况 -->
    <el-drawer v-model="completionOpen" title="练习完成情况" size="460px">
      <template v-if="completion">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="练习名称" :span="2">{{ completion.name }}</el-descriptions-item>
          <el-descriptions-item label="班级">{{ completion.className }}</el-descriptions-item>
          <el-descriptions-item label="状态"><LevelTag :level="completion.status" /></el-descriptions-item>
          <el-descriptions-item label="推送人数">{{ completion.pushCount }}</el-descriptions-item>
          <el-descriptions-item label="已完成">{{ completion.doneCount }}（{{ completion.doneRate }}%）</el-descriptions-item>
          <el-descriptions-item label="未完成">{{ completion.remaining }}</el-descriptions-item>
          <el-descriptions-item label="二次正确率">{{ completion.secondRate || '—' }}</el-descriptions-item>
        </el-descriptions>
        <h4 style="margin: 16px 0 8px">各小组完成度</h4>
        <div v-for="g in completion.groups" :key="g.group" class="group-row">
          <span>{{ g.group }}</span>
          <el-progress :percentage="Math.round(g.total / (completion.pushCount || 1) * 100)" :stroke-width="10"
            :format="() => `${g.total} 人`" style="flex: 1" />
        </div>
        <div class="muted" style="margin-top: 8px">
          提示：更新完成人数与二次正确率，可在练习列表结束任务后自动归档。
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { MagicStick, Promotion, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import StatCard from '@/components/StatCard.vue'
import LevelTag from '@/components/LevelTag.vue'

const rows = ref([])
const stats = ref({})
const classes = ref([])
const kps = ref([])
const loading = ref(false)
const saving = ref(false)
const filters = reactive({ kw: '', classId: '', status: '' })

const createOpen = ref(false)
const mode = ref('manual')
const form = reactive({ name: '', kpId: '', classId: '', difficulty: '基础', questionCount: 6, deadline: '' })
const quizLoading = ref(false)
const quiz = ref(null)

const finishOpen = ref(false)
const finishing = ref(null)
const finishRate = ref(undefined)

const completionOpen = ref(false)
const completion = ref(null)

async function load() {
  loading.value = true
  try {
    const data = await api.get('/api/practice/practices', { ...filters })
    rows.value = data.list
    stats.value = data.stats
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, { name: '', kpId: '', classId: '', difficulty: '基础', questionCount: 6, deadline: '' })
  quiz.value = null
  mode.value = 'manual'
  createOpen.value = true
}

function onKpChange() {
  quiz.value = null
}

function onCountChange() {
  quiz.value = null
}

async function genQuiz() {
  if (!form.kpId) {
    ElMessage.warning('请先选择知识点')
    return
  }
  quizLoading.value = true
  try {
    quiz.value = await api.post('/api/ai/generate-quiz', {
      kpId: form.kpId, difficulty: form.difficulty, count: form.questionCount,
    })
    ElMessage.success(`AI 已生成 ${quiz.value.questions.length} 道题目`)
  } catch (err) {
    ElMessage.error(err?.msg || '生成失败')
  } finally {
    quizLoading.value = false
  }
}

async function create() {
  saving.value = true
  try {
    await api.post('/api/practice/practices/create', {
      ...form,
      questionCount: quiz.value ? quiz.value.questions.length : form.questionCount,
      name: quiz.value && !form.name ? `${quiz.value.kpName}AI 组卷练习` : form.name,
    })
    ElMessage.success('练习已创建并推送至班级')
    createOpen.value = false
    load()
  } catch (err) {
    ElMessage.error(err?.msg || '创建失败')
  } finally {
    saving.value = false
  }
}

function openFinish(row) {
  finishing.value = row
  finishRate.value = undefined
  finishOpen.value = true
}

async function finish() {
  saving.value = true
  try {
    await api.post(`/api/practice/practices/${finishing.value.id}/finish`, { secondRate: finishRate.value ?? '' })
    ElMessage.success('练习已结束')
    finishOpen.value = false
    load()
  } catch (err) {
    ElMessage.error(err?.msg || '操作失败')
  } finally {
    saving.value = false
  }
}

async function publish(row) {
  await api.post(`/api/practice/practices/${row.id}/publish`)
  ElMessage.success('练习已发布')
  load()
}

async function openCompletion(row) {
  completion.value = await api.get(`/api/practice/practices/${row.id}/completion`)
  completionOpen.value = true
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
.create-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.quiz-panel { border: 1px dashed var(--color-border); border-radius: 6px; padding: 10px; max-height: 420px; display: flex; flex-direction: column; }
.quiz-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.quiz-list { overflow: auto; flex: 1; }
.q-title { font-size: 12.5px; }
.q-opts div { padding: 2px 0; font-size: 12.5px; }
.q-opts .correct { color: #10b981; font-weight: 700; }
.q-analysis { font-size: 12px; color: var(--color-muted); margin-top: 6px; background: var(--color-bg); padding: 6px 8px; border-radius: 4px; }
.group-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.group-row > span { width: 80px; font-size: 13px; }
@media (max-width: 1000px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .create-grid { grid-template-columns: 1fr; }
}
</style>
