<template>
  <div class="ai-assistant">
    <el-badge :show-after="200" content="AI" placement="left">
      <el-button class="fab" type="primary" circle size="large" @click="open = true">
        <el-icon :size="22"><MagicStick /></el-icon>
      </el-button>
    </el-badge>

    <el-drawer v-model="open" title="AI 教学助手" size="440px" :append-to-body="true">
      <div class="chat-wrap">
        <div ref="listEl" class="chat-list">
          <div v-if="!messages.length" class="chat-empty">
            <el-icon :size="34" color="#0891B2"><ChatDotRound /></el-icon>
            <p>我是 AI 教学助手，基于系统内学情数据回答问题。</p>
            <div class="quick">
              <el-button v-for="q in quickPrompts" :key="q" size="small" round @click="send(q)">{{ q }}</el-button>
            </div>
          </div>
          <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
            <div v-if="m.role === 'user'" class="bubble user-bubble">{{ m.text }}</div>
            <div v-else class="bubble ai-bubble">
              <AiMarkdown :content="m.text" />
              <span v-if="m.streaming" class="ai-cursor" />
            </div>
          </div>
        </div>
        <div class="chat-input">
          <el-input
            v-model="draft"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="询问学情、薄弱点、干预建议…（Enter 发送）"
            @keydown.enter.exact.prevent="send()"
          />
          <div class="chat-actions">
            <el-button v-if="streaming" size="small" @click="stop">停止</el-button>
            <el-button v-else type="primary" size="small" :disabled="!draft.trim()" @click="send()">
              发送
            </el-button>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { aiStream } from '@/api/ai'
import AiMarkdown from './AiMarkdown.vue'

const open = ref(false)
const draft = ref('')
const messages = ref([])
const streaming = ref(false)
const listEl = ref(null)
let controller = null

const quickPrompts = [
  '本年级最薄弱的知识点是什么？',
  '各班学情对比情况如何？',
  '有哪些逾期未销号的干预任务？',
  '给我推荐一份靶向练习方案',
]

function scrollToBottom() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

async function send(preset) {
  const text = String(preset ?? draft.value).trim()
  if (!text || streaming.value) return
  draft.value = ''
  messages.value.push({ role: 'user', text })
  const reply = { role: 'assistant', text: '', streaming: true }
  messages.value.push(reply)
  scrollToBottom()
  streaming.value = true
  controller = new AbortController()
  try {
    await aiStream('/api/ai/chat', { message: text }, (chunk) => {
      reply.text += chunk
      scrollToBottom()
    }, controller.signal)
  } catch (err) {
    if (!err?.aborted) {
      reply.text = reply.text || '抱歉，服务暂时不可用，请稍后重试。'
      ElMessage.error(err?.msg || '生成失败')
    }
  } finally {
    reply.streaming = false
    streaming.value = false
    scrollToBottom()
  }
}

function stop() {
  if (controller) controller.abort()
  streaming.value = false
  const last = messages.value[messages.value.length - 1]
  if (last && last.role === 'assistant') last.streaming = false
}

onBeforeUnmount(() => stop())
</script>

<style scoped>
.fab {
  position: fixed;
  right: 28px;
  bottom: 32px;
  z-index: 2000;
  width: 52px;
  height: 52px;
  box-shadow: 0 6px 18px rgba(8, 145, 178, .35);
}
.chat-wrap { display: flex; flex-direction: column; height: 100%; }
.chat-list { flex: 1; overflow: auto; padding: 4px 2px 12px; }
.chat-empty { text-align: center; color: var(--color-muted); padding: 36px 12px; }
.chat-empty p { margin: 10px 0 14px; font-size: 13px; }
.quick { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.msg { display: flex; margin: 10px 0; }
.msg.user { justify-content: flex-end; }
.bubble { max-width: 88%; padding: 9px 12px; border-radius: 10px; font-size: 13px; line-height: 1.65; }
.user-bubble { background: var(--color-primary); color: #fff; border-bottom-right-radius: 2px; }
.ai-bubble { background: #f1fbfd; border: 1px solid var(--color-border); border-bottom-left-radius: 2px; }
.chat-input { border-top: 1px solid var(--color-border); padding-top: 10px; }
.chat-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
</style>
