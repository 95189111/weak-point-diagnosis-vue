<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="720px"
    top="6vh"
    destroy-on-close
    @closed="onClosed"
  >
    <div class="ai-stream">
      <div v-if="error" class="ai-error">
        <el-alert :title="error" type="error" :closable="false" show-icon />
      </div>
      <div v-else-if="!output && thinking" class="ai-thinking">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>{{ thinkText }}</span>
      </div>
      <div v-else class="ai-stream-body">
        <AiMarkdown :content="output" />
        <span v-if="streaming" class="ai-cursor" />
      </div>
    </div>
    <template #footer>
      <div class="ai-footer">
        <span class="muted">内容由系统 AI 基于 Mock 数据生成，仅供教学演示</span>
        <div>
          <el-button v-if="streaming" size="small" @click="stop">停止生成</el-button>
          <el-button v-else size="small" :disabled="!output" @click="regenerate">重新生成</el-button>
          <el-button size="small" :disabled="!output" @click="copy">复制</el-button>
          <el-button type="primary" size="small" @click="visible = false">关闭</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { aiStream } from '@/api/ai'
import AiMarkdown from './AiMarkdown.vue'

defineProps({
  title: { type: String, default: 'AI 生成' },
})

const visible = ref(false)
const output = ref('')
const streaming = ref(false)
const thinking = ref(false)
const thinkText = ref('正在思考…')
const error = ref('')
let controller = null
let lastReq = null
const THINK_STEPS = ['正在读取学情数据…', '正在分析证据链…', '正在组织语言…']

function run(url, payload) {
  lastReq = { url, payload }
  output.value = ''
  error.value = ''
  thinking.value = true
  streaming.value = true
  controller = new AbortController()
  let stepIdx = 0
  thinkText.value = THINK_STEPS[0]
  const timer = setInterval(() => {
    stepIdx = Math.min(stepIdx + 1, THINK_STEPS.length - 1)
    thinkText.value = THINK_STEPS[stepIdx]
  }, 500)
  aiStream(url, payload, (chunk) => {
    thinking.value = false
    output.value += chunk
  }, controller.signal)
    .catch((err) => {
      if (!err?.aborted) error.value = err?.msg || '生成失败，请稍后重试'
    })
    .finally(() => {
      clearInterval(timer)
      streaming.value = false
      thinking.value = false
    })
}

function open(url, payload) {
  visible.value = true
  run(url, payload)
}

function stop() {
  if (controller) controller.abort()
}

function regenerate() {
  if (lastReq) run(lastReq.url, lastReq.payload)
}

async function copy() {
  try {
    await navigator.clipboard.writeText(output.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('当前环境不支持复制')
  }
}

function onClosed() {
  stop()
}

onBeforeUnmount(() => stop())

defineExpose({ open })
</script>

<style scoped>
.ai-stream { min-height: 200px; max-height: 62vh; overflow: auto; }
.ai-thinking { display: flex; align-items: center; gap: 8px; color: var(--color-muted); padding: 24px 0; }
.ai-error { padding: 8px 0; }
.ai-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
</style>
