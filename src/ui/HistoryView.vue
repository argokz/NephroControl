<script setup lang="ts">
import { computed } from 'vue';
import { rules } from '../config/rules';
import { historyToCsv } from '../core/csv';
import { computeDynamics, type Delta, type Trend } from '../core/dynamics';
import type { HistoryRecord, Patient } from '../core/types';
import Disclaimer from './Disclaimer.vue';
import EgfrChart from './EgfrChart.vue';
import { GROUP_LABELS, alb, dateTime, num, signed, stage, weightBasis } from './format';

const props = defineProps<{ patient: Patient; records: HistoryRecord[] }>();
const emit = defineEmits<{ delete: [id: string] }>();

const points = computed(() => computeDynamics(props.records, rules));
const rows = computed(() => {
  const byId = new Map(props.records.map((r) => [r.id, r]));
  return points.value.map((p) => ({ p, r: byId.get(p.recordId)! }));
});
const latest = computed(() => points.value.at(-1));

const TREND: Record<Trend, string> = { worsening: 'значимое ухудшение', improvement: 'улучшение' };
const deltaText = (d?: Delta) => (d ? `${signed(d.abs)} (${signed(d.percent, 1)}%)` : '—');
const creatinineText = (r: HistoryRecord) =>
  r.creatinine.unit === 'umol/L' ? `${num(r.creatinine.value, 1)} мкмоль/л` : `${num(r.creatinine.value, 2)} мг/дл`;

function exportCsv() {
  const csv = '﻿' + historyToCsv(props.records, rules);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  const safe = props.patient.label.replace(/[^\p{L}\p{N}_-]+/gu, '_');
  a.href = url;
  a.download = `nephrocontrol_${safe}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printPage() {
  window.print();
}

function remove(r: HistoryRecord) {
  if (confirm(`Удалить анализ от ${dateTime(r.sampledAt)}? Действие необратимо.`)) emit('delete', r.id);
}
</script>

<template>
  <section class="card history">
    <header class="history-head">
      <div>
        <h2>Динамика СКФ</h2>
        <p class="muted">
          {{ patient.label }} · {{ patient.sex === 'male' ? 'муж.' : 'жен.' }} ·
          {{ patient.groups.map((g) => GROUP_LABELS[g]).join(', ') }}
        </p>
      </div>
      <div class="actions no-print">
        <button type="button" :disabled="!records.length" @click="exportCsv">Экспорт CSV</button>
        <button type="button" :disabled="!records.length" @click="printPage">Печать</button>
      </div>
    </header>

    <p v-if="!records.length" class="empty">В истории пока нет сохранённых анализов.</p>

    <template v-else>
      <div v-if="latest" class="summary">
        <div>
          <span class="muted">Последнее значение</span>
          <strong>{{ num(latest.egfr) }}</strong> мл/мин/1,73 м² · {{ stage(latest.stage) }}
          <small class="muted">CKD-EPI 2009</small>
        </div>
        <div>
          <span class="muted">К предыдущему</span>
          <strong>{{ deltaText(latest.toPrevious) }}</strong>
        </div>
        <div>
          <span class="muted">К первому</span>
          <strong>{{ deltaText(latest.toFirst) }}</strong>
        </div>
        <div v-if="latest.trend" :class="`trend trend-${latest.trend}`">{{ TREND[latest.trend] }}</div>
      </div>

      <EgfrChart :points="points" />

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Креатинин</th>
              <th title="CKD-EPI 2009, мл/мин/1,73 м²">СКФ 2009</th>
              <th title="CKD-EPI 2021, справочно">СКФ 2021<br /><small>справочно</small></th>
              <th title="Кокрофт–Голт, мл/мин">CrCl</th>
              <th>Стадия</th>
              <th>А</th>
              <th>К предыдущему</th>
              <th>К первому</th>
              <th>Динамика</th>
              <th>Правила</th>
              <th class="no-print"><span class="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="{ p, r } in rows" :key="r.id">
              <td class="nowrap">{{ dateTime(r.sampledAt) }}</td>
              <td class="nowrap">{{ creatinineText(r) }}</td>
              <td class="num">{{ num(p.egfr) }}</td>
              <td class="num">{{ num(Math.round(r.egfr2021)) }}</td>
              <td class="num" :title="`${weightBasis(r.crclWeightBasis)} ${num(r.crclWeightKg, 1)} кг`">
                {{ num(Math.round(r.crcl)) }}<small v-if="r.crclWeightBasis === 'adjusted'">*</small>
              </td>
              <td><span class="stage-chip" :data-stage="p.stage">{{ stage(p.stage) }}</span></td>
              <td>{{ r.albuminuria ? alb(r.albuminuria) : '—' }}</td>
              <td class="nowrap">{{ deltaText(p.toPrevious) }}</td>
              <td class="nowrap">{{ deltaText(p.toFirst) }}</td>
              <td>
                <span v-if="p.trend" :class="`trend trend-${p.trend}`">{{ TREND[p.trend] }}</span>
              </td>
              <td>
                <details class="rules-cell">
                  <summary>{{ r.firedRuleIds.length }}</summary>
                  <ul>
                    <li v-for="id in r.firedRuleIds" :key="id"><code>{{ id }}</code></li>
                  </ul>
                  <small class="muted">rules.json v{{ r.rulesVersion }}</small>
                </details>
              </td>
              <td class="no-print">
                <button type="button" class="icon danger" :aria-label="`Удалить анализ от ${dateTime(r.sampledAt)}`" @click="remove(r)">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">
        СКФ — CKD-EPI 2009 (основная), мл/мин/1,73 м²; изменения — в мл/мин/1,73 м² и %. CrCl — Кокрофт–Голт, мл/мин;
        * — по скорректированной массе тела.
      </p>
    </template>

    <Disclaimer />
  </section>
</template>
