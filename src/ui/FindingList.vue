<script setup lang="ts">
import { computed } from 'vue';
import type { Finding, Severity } from '../core/types';
import { SEVERITY_LABELS, sourceTitle } from './format';

const props = defineProps<{ findings: Finding[] }>();

const ORDER: Severity[] = ['emergency', 'important', 'info'];
const groups = computed(() =>
  ORDER.map((s) => ({ severity: s, items: props.findings.filter((f) => f.severity === s) })).filter((g) => g.items.length),
);
</script>

<template>
  <section class="findings">
    <div v-for="g in groups" :key="g.severity" class="finding-group" :class="`sev-${g.severity}`">
      <h3>{{ SEVERITY_LABELS[g.severity] }} <span class="count">{{ g.items.length }}</span></h3>
      <ul>
        <li v-for="f in g.items" :key="f.ruleId + f.message">
          <p class="msg">{{ f.message }}</p>
          <ul v-if="f.details" class="details">
            <li v-for="d in f.details" :key="d">{{ d }}</li>
          </ul>
          <p class="meta">
            <span>
              Источник:
              <template v-for="(s, i) in f.source" :key="s"
                ><abbr :title="sourceTitle(s)">[{{ s }}]</abbr><template v-if="i < f.source.length - 1">, </template></template
              >
            </span>
            <span v-if="f.status === 'требует сверки'" class="badge" title="Правило требует сверки с источником">требует сверки</span>
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
