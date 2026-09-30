<script setup lang="ts">
import { computed, ref } from 'vue';
import { rules } from '../config/rules';
import {
  LAB_CSV_TEMPLATE,
  LAB_FORMULAS,
  compareLab,
  labComparisonToCsv,
  parseLabCsv,
  type ComparedRow,
  type LabFormula,
  type ParsedLab,
} from '../core/labCompare';
import { STAGES_ORDER, type CreatinineUnit } from '../core/types';
import BlandAltmanChart from './BlandAltmanChart.vue';
import { num, signed, stage } from './format';

// Данные обрабатываются только в памяти браузера: ничего не сохраняется и не отправляется.
const unit = ref<CreatinineUnit>('umol/L');
const text = ref('');
const fileName = ref('');
const pasted = ref('');
const formula = ref<LabFormula>('2009');
const threshold = ref(5);
const SHOW_MAX = 200;

const parsed = computed<ParsedLab | null>(() =>
  text.value ? parseLabCsv(text.value, unit.value, rules.value<{ min: number; max: number }>('validation.age.range')) : null,
);
const comparison = computed(() => (parsed.value?.rows.length ? compareLab(parsed.value.rows, rules) : null));
const summary = computed(() => comparison.value?.summary[formula.value]);

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  fileName.value = f.name;
  text.value = await f.text();
  pickCloser();
}

function usePasted() {
  fileName.value = 'вставленный текст';
  text.value = pasted.value;
  pickCloser();
}

function reset() {
  text.value = '';
  fileName.value = '';
  pasted.value = '';
}

/** По умолчанию показываем формулу, ближе к значениям лаборатории. */
function pickCloser() {
  const c = comparison.value?.closer;
  if (c) formula.value = c;
}

function isDiscordant(r: ComparedRow): boolean {
  const f = formula.value;
  if (r.row.censored) return !r.consistent[f];
  return Math.abs(r.diff[f]!) > threshold.value || r.labStage !== r.ourStage[f];
}
const discordant = computed(() => comparison.value?.rows.filter(isDiscordant) ?? []);

const pct = (x: number) => (Number.isFinite(x) ? `${num(x * 100, 1)}%` : '—');
const n1 = (x: number) => (Number.isFinite(x) ? num(x, 1) : '—');
const s1 = (x: number) => (Number.isFinite(x) ? signed(x, 1) : '—');

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const downloadTemplate = () => download('nephrocontrol_lab_template.csv', LAB_CSV_TEMPLATE);
const downloadReport = () =>
  comparison.value && download(`nephrocontrol_lab_compare_${new Date().toISOString().slice(0, 10)}.csv`, labComparisonToCsv(comparison.value));
</script>

<template>
  <section class="card lab-compare">
    <header class="history-head">
      <div>
        <h2>Сверка с лабораторией</h2>
        <p class="muted">
          Сравнение eGFR, рассчитанной приложением, со значением из бланка лаборатории на обезличенной выгрузке.
          Считаются обе формулы — CKD-EPI 2009 и 2021: по меньшему расхождению видно, какую использует лаборатория.
        </p>
      </div>
      <div class="actions no-print">
        <button type="button" @click="downloadTemplate">Шаблон CSV</button>
        <button v-if="comparison" type="button" @click="downloadReport">Отчёт CSV</button>
      </div>
    </header>

    <p class="alert alert-important">
      Загружайте только обезличенные данные: без ФИО, ИИН, дат рождения и номеров карт. Файл обрабатывается в этом
      браузере, никуда не отправляется и не сохраняется — после перезагрузки страницы его нужно выбрать заново.
    </p>

    <div class="lab-input">
      <div class="field">
        <span>Файл CSV</span>
        <input type="file" accept=".csv,.txt,text/csv,text/plain" @change="onFile" />
        <small class="hint">Колонки: Возраст, Пол (м/ж), Креатинин, Единица (необязательно), СКФ лаборатории; ID — по желанию.
          Разделитель «;», «,» или табуляция. Значения «&gt;90», «&gt;60» допускаются.</small>
      </div>
      <div class="field">
        <span>Единица креатинина, если колонки «Единица» нет</span>
        <div class="seg">
          <label><input v-model="unit" type="radio" value="umol/L" />мкмоль/л</label>
          <label><input v-model="unit" type="radio" value="mg/dL" />мг/дл</label>
        </div>
      </div>
      <details class="field span-2">
        <summary>Или вставить таблицу текстом (например, из Excel)</summary>
        <textarea v-model="pasted" rows="6" placeholder="Возраст;Пол;Креатинин;Единица;СКФ лаборатории"></textarea>
        <div class="actions">
          <button type="button" class="primary" :disabled="!pasted.trim()" @click="usePasted">Сравнить</button>
        </div>
      </details>
    </div>

    <template v-if="parsed">
      <div class="lab-status">
        <span>Источник: <strong>{{ fileName }}</strong></span>
        <span>разобрано строк: <strong>{{ parsed.rows.length }}</strong></span>
        <span v-if="parsed.errors.length" class="warn">пропущено: <strong>{{ parsed.errors.length }}</strong></span>
        <button type="button" class="link-button" @click="reset">Очистить</button>
      </div>
      <p v-if="parsed.missingColumns.length" class="alert alert-emergency">
        Не найдены колонки: {{ parsed.missingColumns.join(', ') }}. Проверьте заголовок первой строки (можно взять «Шаблон CSV»).
      </p>
      <details v-if="parsed.errors.length" class="lab-errors">
        <summary>Пропущенные строки ({{ parsed.errors.length }})</summary>
        <ul>
          <li v-for="e in parsed.errors.slice(0, SHOW_MAX)" :key="e.line">строка {{ e.line }}: {{ e.message }}</li>
        </ul>
      </details>
    </template>

    <template v-if="comparison && summary">
      <h3 class="section-title">Сводка</h3>
      <div class="table-wrap">
        <table class="lab-summary">
          <thead>
            <tr>
              <th>Показатель</th>
              <th v-for="f in LAB_FORMULAS" :key="f" :class="{ closer: comparison.closer === f }">
                CKD-EPI {{ f }}<small v-if="comparison.closer === f"> · ближе к лаборатории</small>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Строк с точным значением</td>
              <td v-for="f in LAB_FORMULAS" :key="f" class="num">{{ comparison.summary[f].n }}</td>
            </tr>
            <tr>
              <td>Средняя разница (приложение − лаборатория)</td>
              <td v-for="f in LAB_FORMULAS" :key="f" class="num">{{ s1(comparison.summary[f].meanDiff) }}</td>
            </tr>
            <tr>
              <td>Пределы согласия (± 1,96 SD)</td>
              <td v-for="f in LAB_FORMULAS" :key="f" class="num">
                {{ s1(comparison.summary[f].loaLow) }} … {{ s1(comparison.summary[f].loaHigh) }}
              </td>
            </tr>
            <tr>
              <td>Средний модуль разницы / максимум</td>
              <td v-for="f in LAB_FORMULAS" :key="f" class="num">
                {{ n1(comparison.summary[f].meanAbsDiff) }} / {{ n1(comparison.summary[f].maxAbsDiff) }}
              </td>
            </tr>
            <tr>
              <td>Разница в пределах ±1 / ±3 / ±5</td>
              <td v-for="f in LAB_FORMULAS" :key="f" class="num">
                {{ pct(comparison.summary[f].within[1]) }} / {{ pct(comparison.summary[f].within[3]) }} / {{ pct(comparison.summary[f].within[5]) }}
              </td>
            </tr>
            <tr>
              <td>Совпадение стадии С1–С5</td>
              <td v-for="f in LAB_FORMULAS" :key="f" class="num">{{ pct(comparison.summary[f].stageAgreement) }}</td>
            </tr>
            <tr>
              <td>Каппа Коэна по стадиям</td>
              <td v-for="f in LAB_FORMULAS" :key="f" class="num">
                {{ Number.isFinite(comparison.summary[f].kappa) ? num(comparison.summary[f].kappa, 3) : '—' }}
              </td>
            </tr>
            <tr v-if="summary.censoredN">
              <td>«&gt;N» в бланке: согласовано (приложение ≥ N)</td>
              <td v-for="f in LAB_FORMULAS" :key="f" class="num">
                {{ comparison.summary[f].censoredConsistent }} из {{ comparison.summary[f].censoredN }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="lab-formula">
        <span class="muted">Подробно для формулы:</span>
        <div class="seg">
          <label v-for="f in LAB_FORMULAS" :key="f"><input v-model="formula" type="radio" :value="f" />CKD-EPI {{ f }}</label>
        </div>
      </div>

      <template v-if="summary.n">
        <h3 class="section-title">График Бленда–Альтмана</h3>
        <BlandAltmanChart :rows="comparison.rows" :formula="formula" :summary="summary" />

        <h3 class="section-title">Стадии: лаборатория (строки) × приложение (столбцы)</h3>
        <div class="table-wrap">
          <table class="confusion">
            <thead>
              <tr>
                <th></th>
                <th v-for="s in STAGES_ORDER" :key="s" class="num">{{ stage(s) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in summary.confusion" :key="i">
                <th>{{ stage(STAGES_ORDER[i]!) }}</th>
                <td v-for="(v, j) in row" :key="j" class="num" :class="{ diag: i === j, off: i !== j && v > 0 }">{{ v || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <h3 class="section-title">Расхождения</h3>
      <div class="lab-formula">
        <label for="lab-threshold" class="muted">Показывать разницу больше, мл/мин/1,73 м²:</label>
        <input id="lab-threshold" v-model.number="threshold" type="number" min="0" step="1" class="threshold" />
        <span class="muted">а также несовпадение стадии и несогласованные «&gt;N»</span>
      </div>
      <p v-if="!discordant.length" class="empty">Расхождений нет.</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Строка</th><th>ID</th><th>Возраст</th><th>Пол</th><th>Креатинин</th>
              <th class="num">Лаборатория</th><th class="num">Приложение</th><th class="num">Разница</th><th>Стадия лаб. / прил.</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in discordant.slice(0, SHOW_MAX)" :key="r.row.line">
              <td>{{ r.row.line }}</td>
              <td>{{ r.row.id }}</td>
              <td>{{ r.row.ageYears }}</td>
              <td>{{ r.row.sex === 'male' ? 'м' : 'ж' }}</td>
              <td>{{ num(r.row.creatinine.value, r.row.creatinine.unit === 'mg/dL' ? 2 : 1) }} {{ r.row.creatinine.unit === 'umol/L' ? 'мкмоль/л' : 'мг/дл' }}</td>
              <td class="num">{{ r.row.censored ? '>' : '' }}{{ num(r.row.labEgfr) }}</td>
              <td class="num">{{ r.ours[formula] }}</td>
              <td class="num">{{ r.diff[formula] === null ? '—' : signed(r.diff[formula]!) }}</td>
              <td>{{ r.labStage ? stage(r.labStage) : '—' }} / {{ stage(r.ourStage[formula]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="discordant.length > SHOW_MAX" class="muted small">
        Показаны первые {{ SHOW_MAX }} из {{ discordant.length }}; полный список — в «Отчёт CSV».
      </p>

      <p class="disclaimer">
        Сверка показывает согласие расчёта с конкретной лабораторией, а не клиническую точность формулы.
        Частые причины расхождений: другая формула (2009 или 2021), коэффициент пересчёта единиц, округление
        креатинина в бланке, расовый коэффициент CKD-EPI 2009 в настройках лаборатории, ошибки выгрузки.
      </p>
    </template>
  </section>
</template>
