<template>
  <el-tag :type="typeMap[level] || 'info'" size="small" effect="light" round>{{ level }}</el-tag>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  level: { type: String, default: '' },
})

const typeMap = {
  薄弱: 'danger',
  预警: 'danger',
  无效: 'danger',
  临界: 'warning',
  关注: 'warning',
  待复核: 'warning',
  已推送: 'warning',
  进行中: 'primary',
  已确认: 'primary',
  已复查: 'primary',
  达标: 'success',
  正常: 'success',
  有效: 'success',
  已销号: 'success',
  已结束: 'info',
  待开始: 'info',
  待观察: 'info',
  已归档: 'info',
  已解析: 'success',
  待解析: 'info',
  上升: 'success',
  下降: 'danger',
  持平: 'info',
  稳定: 'success',
  波动: 'warning',
}

const type = computed(() => typeMap[props.level] || 'info')
</script>
