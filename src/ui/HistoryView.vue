<script setup lang="ts">
import { computed } from 'vue';
import { rules } from '../config/rules';
import { historyToCsv } from '../core/csv';
import { computeDynamics, type Delta, type Trend } from '../core/dynamics';
import type { HistoryRecord, Patient } from '../core/types';
import Disclaimer from './Disclaimer.vue';
import EgfrChart from './EgfrChart.vue';
import DeltaCell from './DeltaCell.vue';
import { GROUP_LABELS, alb, date, dateTime, num, signed, stage, weightBasis } from './format';

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
const time = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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
        <button type="button" class="with-icon" :disabled="!records.length" @click="exportCsv">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 14v2h12v-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Экспорт CSV
        </button>
        <button type="button" class="with-icon" :disabled="!records.length" @click="printPage">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path d="M6 8V3h8v5M6 14H4V8h12v6h-2M6 12h8v5H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
          </svg>
          Печать
        </button>
      </div>
    </header>

    <p v-if="!records.length" class="empty">В истории пока нет сохранённых анализов.</p>

    <template v-else>
      <div v-if="latest" class="summary">
        <div class="summary-main">
          <span class="muted">Последнее значение · CKD-EPI 2009</span>
          <span>
            <strong>{{ num(latest.egfr) }}</strong> <small class="muted">мл/мин/1,73 м²</small>
            <span class="stage-chip" :data-stage="latest.stage">{{ stage(latest.stage) }}</span>
          </span>
        </div>
        <div>
          <span class="muted">К предыдущему</span>
          <strong>{{ deltaText(latest.toPrevious) }}</strong>
        </div>
        <div>
          <span class="muted">К первому</span>
          <strong>{{ deltaText(latest.toFirst) }}</strong>
        </div>
        <div v-if="latest.trend" class="summary-trend">
          <span :class="`trend trend-${latest.trend}`">{{ TREND[latest.trend] }}</span>
        </div>
      </div>

      <EgfrChart :points="points" />

      <div class="table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Креатинин</th>
              <th title="CKD-EPI 2009, мл/мин/1,73 м²">СКФ 2009</th>
              <th title="CKD-EPI 2021, справочно">СКФ 2021<br /><small>справочно</small></th>
              <th title="Кокрофт–Голт, мл/мин">CrCl</th>
              <th>Стадия</th>
              <th>А</th>
              <th>Δ к пред.</th>
              <th>Δ к первому</th>
              <th>Динамика</th>
              <th>Правила</th>
              <th class="no-print"><span class="sr-only">Действия</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="{ p, r } in rows" :key="r.id">
              <td class="cell-date" data-label="Дата"><span class="nowrap">{{ date(r.sampledAt) }}</span> <span class="muted nowrap">{{ time(r.sampledAt) }}</span></td>
              <td data-label="Креатинин">{{ creatinineText(r) }}</td>
              <td class="num cell-egfr" data-label="СКФ 2009">{{ num(p.egfr) }}</td>
              <td class="num" data-label="СКФ 2021 (справочно)">{{ num(Math.round(r.egfr2021)) }}</td>
              <td class="num" data-label="CrCl, мл/мин" :title="`${weightBasis(r.crclWeightBasis)} ${num(r.crclWeightKg, 1)} кг`">
                {{ num(Math.round(r.crcl)) }}<small v-if="r.crclWeightBasis === 'adjusted'">*</small>
              </td>
              <td class="cell-stage" data-label="Стадия"><span class="stage-chip" :data-stage="p.stage">{{ stage(p.stage) }}</span></td>
              <td data-label="Альбуминурия">{{ r.albuminuria ? alb(r.albuminuria) : '—' }}</td>
              <td class="cell-delta" data-label="К предыдущему"><DeltaCell :d="p.toPrevious" /></td>
              <td class="cell-delta" data-label="К первому"><DeltaCell :d="p.toFirst" /></td>
              <td :class="{ 'cell-empty': !p.trend }" data-label="Динамика">
                <span v-if="p.trend" :class="`trend trend-${p.trend}`">{{ TREND[p.trend] }}</span>
              </td>
              <td class="cell-rules" data-label="Правила">
                <details class="rules-cell">
                  <summary>{{ r.firedRuleIds.length }} <span class="only-mobile">— показать</span></summary>
                  <ul>
                    <li v-for="id in r.firedRuleIds" :key="id"><code>{{ id }}</code></li>
                  </ul>
                  <small class="muted">rules.json v{{ r.rulesVersion }}</small>
                </details>
              </td>
              <td class="no-print cell-actions">
                <button type="button" class="icon danger" :aria-label="`Удалить анализ от ${dateTime(r.sampledAt)}`" @click="remove(r)">
                  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                    <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </button>
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
