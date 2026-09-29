<script setup lang="ts">
import type { Delta } from '../core/dynamics';
import { signed } from './format';

// Изменение СКФ: абсолютное значение и процент — в две строки, чтобы колонка оставалась узкой.
defineProps<{ d?: Delta }>();
</script>

<template>
  <span v-if="d" class="delta">
    <span class="nowrap">{{ signed(d.abs) }}</span>
    <small class="muted nowrap">{{ signed(d.percent, 1) }}%</small>
  </span>
  <span v-else class="muted">—</span>
</template>
