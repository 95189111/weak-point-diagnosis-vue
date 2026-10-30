<template>
  <div class="stat-card" :class="`tone-${tone}`">
    <div class="icon-box">
      <el-icon :size="22"><component :is="icon" /></el-icon>
    </div>
    <div class="stat-info">
      <div class="stat-value num">{{ displayValue }}<span v-if="suffix" class="suffix">{{ suffix }}</span></div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [Number, String], default: 0 },
  suffix: { type: String, default: '' },
  icon: { type: String, default: 'DataLine' },
  tone: { type: String, default: 'primary' },
})

const displayValue = computed(() => {
  if (typeof props.value === 'number') {
    return Number.isInteger(props.value) ? props.value : props.value.toFixed(1)
  }
  return props.value
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(8, 145, 178, .06);
}
.icon-box {
  width: 44px; height: 44px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  flex: 0 0 auto;
}
.tone-primary .icon-box { background: linear-gradient(135deg, #0891B2, #22D3EE); }
.tone-danger .icon-box { background: linear-gradient(135deg, #ef4444, #f97316); }
.tone-warning .icon-box { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
.tone-success .icon-box { background: linear-gradient(135deg, #10b981, #34d399); }
.tone-dark .icon-box { background: linear-gradient(135deg, #173b68, #3b82a0); }
.stat-value { font-size: 24px; font-weight: 800; color: var(--color-primary-dark); line-height: 1.2; }
.stat-value .suffix { font-size: 13px; font-weight: 600; margin-left: 2px; color: var(--color-muted); }
.stat-label { font-size: 12px; color: var(--color-muted); }
</style>
