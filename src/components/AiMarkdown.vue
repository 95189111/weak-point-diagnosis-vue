<template>
  <div class="ai-markdown" v-html="html" />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  content: { type: String, default: '' },
})

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(s) {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

/** 轻量 Markdown 渲染：标题/列表/表格/引用/分隔线/行内样式 */
function render(md) {
  const lines = String(md || '').split('\n')
  const out = []
  let listMode = '' // ul | ol
  let tableBuf = []
  let quoteBuf = []

  const closeList = () => {
    if (listMode) {
      out.push(listMode === 'ul' ? '</ul>' : '</ol>')
      listMode = ''
    }
  }
  const closeTable = () => {
    if (tableBuf.length) {
      const rows = tableBuf.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r))
      const html = rows.map((r, i) => {
        const cells = r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())
        const tag = i === 0 ? 'th' : 'td'
        return `<tr>${cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('')}</tr>`
      })
      out.push(`<table><tbody>${html.join('')}</tbody></table>`)
      tableBuf = []
    }
  }
  const closeQuote = () => {
    if (quoteBuf.length) {
      out.push(`<blockquote>${quoteBuf.map((q) => inline(q)).join('<br>')}</blockquote>`)
      quoteBuf = []
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    const tableMatch = line.match(/^\s*\|.*\|\s*$/)
    if (tableMatch) {
      closeList()
      closeQuote()
      tableBuf.push(line)
      continue
    }
    closeTable()

    if (/^\s*>\s?/.test(line)) {
      closeList()
      quoteBuf.push(line.replace(/^\s*>\s?/, ''))
      continue
    }
    closeQuote()

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      closeList()
      out.push('<hr>')
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1].length + 1
      out.push(`<h${Math.min(level, 5)}>${inline(heading[2])}</h${Math.min(level, 5)}>`)
      continue
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    const ol = line.match(/^\s*(\d+)[.、]\s+(.*)$/)
    if (ul || ol) {
      const mode = ul ? 'ul' : 'ol'
      if (listMode !== mode) {
        closeList()
        out.push(mode === 'ul' ? '<ul>' : '<ol>')
        listMode = mode
      }
      out.push(`<li>${inline(ul ? ul[1] : ol[2])}</li>`)
      continue
    }
    closeList()

    if (!line.trim()) continue
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  closeTable()
  closeQuote()
  return out.join('')
}

const html = computed(() => render(props.content))
</script>
