<script setup lang="ts">
import { pageUrl, type Citation } from '../config/evidence';

// Ссылка на страницу официального PDF источника: «И1, с. 6».
defineProps<{ c: Pick<Citation, 'source' | 'page' | 'differs'> }>();
</script>

<template>
  <a
    class="source-ref"
    :class="{ differs: c.differs }"
    :href="pageUrl(c)"
    target="_blank"
    rel="noopener noreferrer"
    :title="`Открыть ${c.source}, страница ${c.page} PDF${c.differs ? ' (расходится с реализацией)' : ''}`"
  >{{ c.source }}, с.&nbsp;{{ c.page }}</a>
</template>
