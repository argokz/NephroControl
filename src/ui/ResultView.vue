<script setup lang="ts">
import { computed } from 'vue';
import type { Assessment, Severity, ValidationIssue } from '../core/types';
import Disclaimer from './Disclaimer.vue';
import FindingList from './FindingList.vue';
import { SEVERITY_LABELS, alb, date, dateTime, interval, num, risk, stage, weightBasis } from './format';

const props = defineProps<{
  assessment: Assessment;
  warnings: ValidationIssue[];
  canSave: boolean;
  saved: boolean;
}>();

defineEmits<{ save: [] }>();

const a = computed(() => props.assessment);
// Сводка по экстренным и важным предупреждениям — видна сразу, без прокрутки до списка.
const severityCounts = computed(() =>
  (['emergency', 'important'] as Severity[])
    .map((s) => ({ s, n: a.value.findings.filter((f) => f.severity === s).length }))
    .filter((x) => x.n > 0),
);
const extraCrcl = computed(() => a.value.crclVariants.filter((c) => c !== a.value.crcl));
const creatinineText = computed(() => {
  const c = a.value.input.creatinine;
  return c.unit === 'umol/L'
    ? `${num(c.value, 1)} мкмоль/л (${num(a.value.scrMgDl, 2)} мг/дл)`
    : `${num(c.value, 2)} мг/дл (${num(a.value.creatinineUmolL, 1)} мкмоль/л)`;
});
</script>

<template>
  <section class="card result" aria-live="polite" tabindex="-1">
    <header class="result-head">
      <h2>Результат расчёта</h2>
      <p class="muted">Анализ от {{ dateTime(a.input.sampledAt) }} · креатинин {{ creatinineText }}</p>
      <p v-if="severityCounts.length" class="sev-summary">
        <a v-for="x in severityCounts" :key="x.s" href="#findings" class="sev-pill" :class="`sev-pill-${x.s}`">
          {{ SEVERITY_LABELS[x.s] }}: {{ x.n }}
        </a>
      </p>
    </header>

    <div v-for="w in warnings" :key="w.ruleId" class="alert alert-important">{{ w.message }}</div>

    <div class="metrics">
      <article class="metric primary-metric">
        <p class="metric-label">СКФ — основная</p>
        <p class="metric-value">{{ num(a.egfr2009.rounded) }} <span class="unit">мл/мин/1,73 м²</span></p>
        <p class="formula">CKD-EPI 2009 [И1] · стадия {{ stage(a.stage) }}</p>
      </article>
      <article class="metric">
        <p class="metric-label">СКФ — справочно</p>
        <p class="metric-value">{{ num(a.egfr2021.rounded) }} <span class="unit">мл/мин/1,73 м²</span></p>
        <p class="formula">CKD-EPI 2021 [И8] · стадия {{ stage(a.stage2021) }}</p>
      </article>
      <article class="metric">
        <p class="metric-label">Клиренс креатинина — для дозирования</p>
        <p class="metric-value">{{ num(a.crcl.rounded) }} <span class="unit">мл/мин</span></p>
        <p class="formula">
          Кокрофт–Голт · {{ weightBasis(a.crcl.weightBasis) }} {{ num(a.crcl.weightKg, 1) }} кг
          <template v-if="a.crcl.idealWeightKg !== undefined">
            (идеальная по Devine {{ num(a.crcl.idealWeightKg, 1) }} кг)
          </template>
        </p>
        <p v-for="c in extraCrcl" :key="c.weightBasis" class="formula secondary">
          По {{ c.weightBasis === 'actual' ? 'фактической' : 'скорректированной' }} массе {{ num(c.weightKg, 1) }} кг:
          {{ num(c.rounded) }} мл/мин
        </p>
      </article>
    </div>

    <dl class="classification">
      <div>
        <dt>Стадия ХБП</dt>
        <dd><span class="stage-chip" :data-stage="a.stage">{{ stage(a.stage) }}</span> <small>по CKD-EPI 2009</small></dd>
      </div>
      <div>
        <dt>Альбуминурия</dt>
        <dd v-if="a.albuminuria">{{ alb(a.albuminuria) }} <small>САК {{ num(a.input.acr!.value, 1) }} {{ a.input.acr!.unit === 'mg/g' ? 'мг/г' : 'мг/ммоль' }}</small></dd>
        <dd v-else class="muted">САК не введено</dd>
      </div>
      <div>
        <dt>Риск (С × А)</dt>
        <dd v-if="a.risk" :data-risk="a.risk" class="risk">{{ risk(a.risk) }}</dd>
        <dd v-else class="muted">не определён</dd>
      </div>
      <div v-if="a.bmi !== undefined">
        <dt>ИМТ</dt>
        <dd>{{ num(a.bmi, 1) }} <small>кг/м²</small></dd>
      </div>
      <div>
        <dt>Следующий анализ</dt>
        <dd>
          через {{ interval(a.nextTest.interval) }}:
          <strong>{{ date(a.nextTest.dueFrom) }}<template v-if="a.nextTest.dueTo !== a.nextTest.dueFrom"> – {{ date(a.nextTest.dueTo) }}</template></strong>
          <small v-if="a.nextTest.note" class="block">{{ a.nextTest.note }}</small>
        </dd>
      </div>
    </dl>

    <h3 id="findings" class="section-title">Предупреждения</h3>
    <FindingList :findings="a.findings" />

    <div class="actions result-actions no-print">
      <button v-if="canSave" type="button" class="primary block-mobile" :disabled="saved" @click="$emit('save')">
        {{ saved ? 'Сохранено в историю' : 'Сохранить в историю пациента' }}
      </button>
      <span v-else class="muted">Выберите или создайте пациента, чтобы сохранить результат.</span>
    </div>

    <Disclaimer />
    <p class="muted small">Версия правил: {{ a.rulesVersion }}</p>
  </section>
</template>
