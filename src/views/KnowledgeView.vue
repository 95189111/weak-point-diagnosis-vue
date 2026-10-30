<template>
  <div>
    <div class="page-head">
      <div>
        <h2>知识点管理</h2>
        <div class="sub">维护知识树：编码、章节、认知层级与题量，作为诊断与组卷的基础数据</div>
      </div>
      <div class="actions">
        <el-button type="primary" :icon="Plus" @click="openEdit(null)">新增知识点</el-button>
        <el-button :icon="DocumentAdd" @click="importOpen = true">批量导入</el-button>
      </div>
    </div>

    <div class="kpi-grid">
      <StatCard label="知识点总数" :value="stats.total" suffix="个" icon="Collection" tone="primary" />
      <StatCard label="薄弱知识点" :value="stats.weak" suffix="个" icon="Warning" tone="danger" />
      <StatCard label="临界知识点" :value="stats.warn" suffix="个" icon="WarningFilled" tone="warning" />
      <StatCard label="平均掌握度" :value="stats.avgMastery" suffix="%" icon="TrendCharts" tone="success" />
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>知识点清单</h3>
        <div class="filters">
          <el-select v-model="filters.chapter" placeholder="全部章节" clearable style="width: 130px" @change="load">
            <el-option v-for="c in chapters" :key="c.name" :label="c.name" :value="c.name" />
          </el-select>
          <el-select v-model="filters.level" placeholder="全部等级" clearable style="width: 110px" @change="load">
            <el-option label="薄弱" value="薄弱" /><el-option label="临界" value="临界" /><el-option label="达标" value="达标" />
          </el-select>
          <el-input v-model="filters.kw" placeholder="搜索编码/名称" clearable style="width: 180px" @keyup.enter="load" @clear="load" />
          <el-button :icon="Search" @click="load">查询</el-button>
        </div>
      </div>
      <div class="card-bd tight">
        <el-table v-loading="loading" :data="rows" size="small" stripe>
          <el-table-column prop="code" label="编码" width="90" />
          <el-table-column prop="name" label="知识点名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="chapter" label="章节" width="130" show-overflow-tooltip />
          <el-table-column prop="cognitive" label="认知层级" width="90" />
          <el-table-column prop="questionCount" label="关联题量" width="90" />
          <el-table-column label="班级得分率" width="110">
            <template #default="{ row }"><span class="num">{{ row.classRate?.toFixed(1) }}%</span></template>
          </el-table-column>
          <el-table-column label="掌握度" width="150">
            <template #default="{ row }">
              <el-progress :percentage="row.mastery" :stroke-width="8"
                :color="row.level === '薄弱' ? '#ef4444' : row.level === '临界' ? '#f59e0b' : '#10b981'"
                :format="() => row.mastery?.toFixed(1) + '%'" />
            </template>
          </el-table-column>
          <el-table-column label="等级" width="80">
            <template #default="{ row }"><LevelTag :level="row.level" /></template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === '启用' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button link :type="row.status === '启用' ? 'danger' : 'success'" size="small" @click="toggle(row)">
                {{ row.status === '启用' ? '停用' : '启用' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 新增/编辑 -->
    <el-dialog v-model="editOpen" :title="form.id ? '编辑知识点' : '新增知识点'" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="编码" required><el-input v-model.trim="form.code" placeholder="如 KP-TX-01" /></el-form-item>
        <el-form-item label="名称" required><el-input v-model.trim="form.name" /></el-form-item>
        <el-form-item label="所属章节" required>
          <el-select v-model="form.chapter" filterable allow-create placeholder="选择或输入新章节">
            <el-option v-for="c in chapters" :key="c.name" :label="c.name" :value="c.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="认知层级">
          <el-radio-group v-model="form.cognitive">
            <el-radio-button v-for="c in ['记忆', '理解', '应用', '分析']" :key="c" :value="c">{{ c }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="先修编码"><el-input v-model.trim="form.prevCode" placeholder="选填，需为已有编码" /></el-form-item>
        <el-form-item label="关联题量"><el-input-number v-model="form.questionCount" :min="0" :max="60" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入 -->
    <el-dialog v-model="importOpen" title="批量导入知识点" width="620px">
      <el-alert type="info" :closable="false" show-icon
        title="支持 JSON 数组，或每行一段：编码,名称,章节,认知层级,题量"
        style="margin-bottom: 10px" />
      <el-input v-model="importText" type="textarea" :rows="8"
        placeholder='[{"code":"KP-TX-05","name":"多边形内角和","chapter":"第十一章 三角形","cognitive":"理解","questionCount":12}]' />
      <template #footer>
        <el-button @click="importOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doImport">导入</el-button>
      </template>
    </el-dialog>

    <!-- 详情 -->
    <el-drawer v-model="detailOpen" title="知识点详情" size="480px">
      <template v-if="detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="编码">{{ detail.code }}</el-descriptions-item>
          <el-descriptions-item label="名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="章节">{{ detail.chapter }}</el-descriptions-item>
          <el-descriptions-item label="认知层级">{{ detail.cognitive }}</el-descriptions-item>
          <el-descriptions-item label="先修知识点">{{ detail.prevCode || '—' }}</el-descriptions-item>
          <el-descriptions-item label="关联题量">{{ detail.questionCount }} 题</el-descriptions-item>
          <el-descriptions-item label="班级得分率">{{ detail.classRate?.toFixed(1) }}%</el-descriptions-item>
          <el-descriptions-item label="掌握度">{{ detail.mastery?.toFixed(1) }}%（{{ detail.level }}）</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ detail.owner }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ detail.updatedAt }}</el-descriptions-item>
        </el-descriptions>
        <h4 style="margin: 16px 0 8px">关联诊断（{{ detail.related?.length || 0 }}）</h4>
        <el-table :data="detail.related || []" size="small">
          <el-table-column prop="no" label="单号" width="120" />
          <el-table-column prop="className" label="班级" width="90" />
          <el-table-column prop="mastery" label="掌握度" width="80">
            <template #default="{ row }"><span class="num">{{ row.mastery?.toFixed(1) }}%</span></template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }"><LevelTag :level="row.status" /></template>
          </el-table-column>
        </el-table>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { DocumentAdd, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import StatCard from '@/components/StatCard.vue'
import LevelTag from '@/components/LevelTag.vue'

const rows = ref([])
const stats = ref({})
const chapters = ref([])
const loading = ref(false)
const saving = ref(false)
const filters = reactive({ kw: '', chapter: '', level: '' })

const editOpen = ref(false)
const form = reactive({ id: '', code: '', name: '', chapter: '', cognitive: '理解', prevCode: '', questionCount: 10 })
const importOpen = ref(false)
const importText = ref('')
const detailOpen = ref(false)
const detail = ref(null)

async function load() {
  loading.value = true
  try {
    const data = await api.get('/api/knowledge/points', { ...filters })
    rows.value = data.list
    stats.value = data.stats
    chapters.value = data.chapters
  } finally {
    loading.value = false
  }
}

function openEdit(row) {
  Object.assign(form, row || { id: '', code: '', name: '', chapter: '', cognitive: '理解', prevCode: '', questionCount: 10 })
  editOpen.value = true
}

async function save() {
  saving.value = true
  try {
    if (form.id) {
      await api.put(`/api/knowledge/points/${form.id}`, { ...form })
      ElMessage.success('知识点已更新')
    } else {
      await api.post('/api/knowledge/points/create', { ...form })
      ElMessage.success('知识点已新增')
    }
    editOpen.value = false
    load()
  } catch (err) {
    ElMessage.error(err?.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggle(row) {
  await api.post(`/api/knowledge/points/${row.id}/toggle`)
  ElMessage.success('状态已更新')
  load()
}

async function openDetail(row) {
  detail.value = await api.get(`/api/knowledge/points/${row.id}`)
  detailOpen.value = true
}

function parseImport() {
  const text = importText.value.trim()
  if (!text) {
    ElMessage.warning('请粘贴待导入内容')
    return null
  }
  if (text.startsWith('[')) {
    try {
      return { items: JSON.parse(text) }
    } catch {
      ElMessage.error('JSON 格式不正确')
      return null
    }
  }
  const items = text.split('\n').filter(Boolean).map((line) => {
    const [code, name, chapter, cognitive, questionCount] = line.split(/[,，]/).map((s) => s.trim())
    return { code, name, chapter, cognitive: cognitive || '理解', questionCount: Number(questionCount) || 10 }
  })
  return { items }
}

async function doImport() {
  const payload = parseImport()
  if (!payload) return
  saving.value = true
  try {
    const res = await api.post('/api/knowledge/points/import', payload)
    ElMessage.success(`导入完成：新增 ${res.created}，跳过 ${res.skipped}，失败 ${res.failed}`)
    if (res.errors?.length) {
      ElMessageBox.alert(res.errors.map((e) => `第${e.line}行：${e.message}`).join('\n'), '失败明细', { type: 'warning' })
    }
    importOpen.value = false
    importText.value = ''
    load()
  } catch (err) {
    ElMessage.error(err?.msg || '导入失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
@media (max-width: 1000px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
