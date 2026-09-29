<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { rules, rulesConfig } from '../config/rules';
import type { AlbCategory, CkdStage, IntervalSpec, RiskLevel, Rule, SourceId } from '../core/types';
import { STAGES_ORDER } from '../core/types';
import { runSelfCheck, type CheckResult } from '../core/verification';
import Disclaimer from './Disclaimer.vue';
import GithubLink from './GithubLink.vue';
import { interval, num, risk, stage } from './format';

// ---------- самопроверка: выполняется в браузере тем же кодом, что и расчёт ----------
const checks = ref<CheckResult[]>([]);
const checkError = ref('');
const checkMs = ref(0);
const checkedAt = ref('');

function runChecks() {
  const t = performance.now();
  try {
    checks.value = runSelfCheck(rules);
    checkError.value = '';
  } catch (e) {
    checks.value = [];
    checkError.value = e instanceof Error ? e.message : String(e);
  }
  checkMs.value = performance.now() - t;
  checkedAt.value = new Date().toLocaleString('ru-RU');
}
onMounted(runChecks);

const passed = computed(() => checks.value.filter((c) => c.pass).length);
const allPass = computed(() => checks.value.length > 0 && passed.value === checks.value.length);
const checkGroups = computed(() => {
  const m = new Map<string, CheckResult[]>();
  for (const c of checks.value) m.set(c.group, [...(m.get(c.group) ?? []), c]);
  return [...m].map(([name, items]) => ({ name, items, ok: items.every((i) => i.pass) }));
});

// ---------- классификация: таблицы строятся из rules.json ----------
const bounds = rules.value<Record<Exclude<CkdStage, 'C5'>, number>>('stage.bounds');
const stageRows = STAGES_ORDER.map((s, i) => {
  if (s === 'C5') return { s, range: `< ${bounds.C4}` };
  const lo = bounds[s];
  const prev = STAGES_ORDER[i - 1] as Exclude<CkdStage, 'C5'> | undefined;
  return { s, range: prev ? `${lo}–${bounds[prev] - 1}` : `≥ ${lo}` };
});
const albG = rules.value<{ a2From: number; a3Above: number }>('albuminuria.mgG');
const albM = rules.value<{ a2From: number; a3Above: number }>('albuminuria.mgMmol');
const ALB: AlbCategory[] = ['A1', 'A2', 'A3'];
const riskMatrix = rules.value<Record<CkdStage, Record<AlbCategory, RiskLevel>>>('risk.matrix');
const monitoring = rules.value<({ stages: CkdStage[] } & Record<AlbCategory, IntervalSpec>)[]>('monitoring.nextTest');
const a = (c: AlbCategory) => c.replace('A', 'А');

// ---------- правила и источники ----------
const RULE_GROUPS: { title: string; prefixes: string[] }[] = [
  { title: 'Проверка ввода', prefixes: ['validation.'] },
  { title: 'Расчёт и классификация', prefixes: ['crcl.', 'stage.', 'ckd.', 'albuminuria.', 'risk.', 'monitoring.'] },
  { title: 'Правила для всех групп', prefixes: ['common.'] },
  { title: 'Хронический пиелонефрит', prefixes: ['pyelo.'] },
  { title: 'Сахарный диабет', prefixes: ['dm.'] },
  { title: 'Пневмония', prefixes: ['pneu.'] },
  { title: 'Динамика', prefixes: ['dynamics.'] },
];
const ruleGroups = RULE_GROUPS.map((g) => ({
  ...g,
  items: rulesConfig.rules.filter((r) => g.prefixes.some((p) => r.id.startsWith(p))),
}));
const totalRules = rulesConfig.rules.length;
const reviewRules = rulesConfig.rules.filter((r) => r.status === 'требует сверки').length;
const assumptions = rulesConfig.rules.filter((r) => r.note?.includes('Допущение:')).length;
const sources = Object.entries(rulesConfig.sources) as [SourceId, string][];
const rulesBySource = (id: SourceId) => rulesConfig.rules.filter((r) => r.source.includes(id)).length;

function valueText(r: Rule): string {
  const v = r.value as unknown;
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.length === 0 ? 'не заданы' : typeof v[0] === 'object' ? 'таблица' : v.join(', ');
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.some(([, x]) => typeof x === 'object')) return 'таблица';
    return entries.map(([k, x]) => `${k}: ${typeof x === 'number' ? num(x, 2) : String(x)}`).join('; ');
  }
  return typeof v === 'number' ? num(v, 2) : String(v);
}

const TOC = [
  ['about-purpose', 'Назначение'],
  ['about-flow', 'Как работает'],
  ['about-formulas', 'Формулы'],
  ['about-classification', 'Классификация'],
  ['about-rules', 'Правила'],
  ['about-sources', 'Источники'],
  ['about-verification', 'Проверка расчётов'],
  ['about-assumptions', 'Допущения'],
] as const;
</script>

<template>
  <article class="card about">
    <header class="about-head">
      <div>
        <h2>О программе</h2>
        <p class="muted">НефроКонтроль · версия правил {{ rulesConfig.version }} от {{ rulesConfig.updated }}</p>
      </div>
      <GithubLink label="Исходный код на GitHub" class="github-button" />
    </header>

    <nav class="toc" aria-label="Разделы страницы">
      <a v-for="[id, title] in TOC" :key="id" :href="`#${id}`">{{ title }}</a>
    </nav>

    <!-- 1 -->
    <section id="about-purpose" class="about-section">
      <h3>Назначение</h3>
      <p>
        НефроКонтроль — калькулятор скорости клубочковой фильтрации (СКФ) для контроля лечения взрослых пациентов с
        хроническим пиелонефритом, сахарным диабетом и пневмонией. Программа рассчитывает СКФ и клиренс креатинина,
        определяет стадию ХБП и категорию альбуминурии, подсказывает срок следующего анализа, показывает предупреждения со
        ссылками на клинические протоколы и отслеживает динамику по истории анализов пациента.
      </p>
      <div class="note-grid">
        <div class="note ok">
          <strong>Что делает</strong>
          <ul>
            <li>считает СКФ по CKD-EPI 2009 (основная) и 2021 (справочно), клиренс по Кокрофту–Голту;</li>
            <li>определяет стадию С1–С5, категорию А1–А3, риск и срок контроля;</li>
            <li>выводит предупреждения по правилам протоколов с источником и статусом;</li>
            <li>хранит историю анализов, строит график и экспортирует CSV.</li>
          </ul>
        </div>
        <div class="note stop">
          <strong>Чего не делает</strong>
          <ul>
            <li>не ставит диагноз: однократное измерение — оценка, а не диагноз ХБП;</li>
            <li>не рассчитывает дозы препаратов — только пороги СКФ и формулировки «коррекция дозы», «рассмотреть», «рекомендуется отмена»;</li>
            <li>не заменяет решение врача и не проходила клинической оценки;</li>
            <li>не считает для пациентов младше 18 лет.</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 2 -->
    <section id="about-flow" class="about-section">
      <h3>Как работает</h3>
      <ol class="steps">
        <li>
          <strong>Проверка ввода.</strong> Обязательны креатинин, возраст, масса, пол, группа и дата с временем анализа.
          Ошибки блокируют расчёт; нетипичное значение креатинина для выбранной единицы — только предупреждение.
        </li>
        <li>
          <strong>Расчёт.</strong> Креатинин переводится в мг/дл, считаются CKD-EPI 2009, CKD-EPI 2021 и Кокрофт–Голт.
          Промежуточные значения не округляются.
        </li>
        <li>
          <strong>Классификация.</strong> Стадия определяется по CKD-EPI 2009, округлённой до целого, — по тому же числу,
          которое показано на экране. Все пороги СКФ в правилах сравниваются с этим же значением.
        </li>
        <li>
          <strong>Правила.</strong> Проверяются общие правила (недостоверность формулы, госпитализация, ОПП), правила
          динамики и правила выбранных групп. Для правил, зависящих от прошлого (ОПП, удвоение креатинина, «впервые»),
          берутся анализы с датой забора раньше текущего — поэтому анализ можно внести задним числом.
        </li>
        <li>
          <strong>Результат и история.</strong> Предупреждения сортируются: экстренные → важные → информационные. При
          сохранении в историю записываются исходные данные, неокруглённые значения формул, стадия, сработавшие правила и
          версия правил.
        </li>
      </ol>
      <p class="muted small">
        Все пороги и тексты сообщений хранятся в одном файле правил (<code>rules.json</code>), а не в коде. У каждого
        правила — источник из списка И1–И8 и статус «проверено» или «требует сверки». Данные пациентов хранятся только в
        этом браузере (IndexedDB) и никуда не отправляются; пациент заводится под псевдонимом, без ФИО.
      </p>
    </section>

    <!-- 3 -->
    <section id="about-formulas" class="about-section">
      <h3>Формулы</h3>
      <p class="muted small">Scr — креатинин сыворотки в мг/дл; возраст — в годах; масса — в кг; рост — в см.</p>

      <div class="formula-card primary">
        <h4>CKD-EPI 2009 — основная <span class="src">[И1]</span></h4>
        <p class="eq">
          eGFR = 141 × min(Scr/κ, 1)<sup>α</sup> × max(Scr/κ, 1)<sup>−1,209</sup> × 0,993<sup>возраст</sup> × 1,018
          <span class="muted">[если женщина]</span>
        </p>
        <p class="coef">κ = 0,7 (ж) / 0,9 (м); α = −0,329 (ж) / −0,411 (м). Результат — мл/мин/1,73 м². По этой формуле определяется стадия.</p>
        <p class="muted small">
          Реализована общая формула; упрощённая таблица из текста [И1] не используется — в ней опечатки в коэффициентах для
          мужчин. Расовый коэффициент не применяется.
        </p>
      </div>

      <div class="formula-card">
        <h4>CKD-EPI 2021 — справочно <span class="src">[И8]</span></h4>
        <p class="eq">
          eGFR = 142 × min(Scr/κ, 1)<sup>α</sup> × max(Scr/κ, 1)<sup>−1,200</sup> × 0,9938<sup>возраст</sup> × 1,012
          <span class="muted">[если женщина]</span>
        </p>
        <p class="coef">κ = 0,7 (ж) / 0,9 (м); α = −0,241 (ж) / −0,302 (м). Если стадия по 2021 отличается от стадии по 2009, выводится пояснение.</p>
      </div>

      <div class="formula-card">
        <h4>Кокрофт–Голт — для дозирования</h4>
        <p class="eq">CrCl = (140 − возраст) × масса / (72 × Scr) × 0,85 <span class="muted">[если женщина]</span></p>
        <p class="coef">Результат — мл/мин. Если указан рост и ИМТ ≥ 30, основной CrCl считается по скорректированной массе, по фактической — дополнительно:</p>
        <p class="eq small-eq">идеальная масса (Devine): м = 50 + 0,9 × (рост − 152,4); ж = 45,5 + 0,9 × (рост − 152,4)</p>
        <p class="eq small-eq">скорректированная масса = идеальная + 0,4 × (фактическая − идеальная)</p>
        <p class="muted small">В интерфейсе всегда указано, какая масса использована.</p>
      </div>

      <div class="formula-card">
        <h4>Единицы и округление</h4>
        <ul class="plain">
          <li>1 мг/дл креатинина = 88,4 мкмоль/л;</li>
          <li>ИМТ = масса / рост² (м), округляется до 0,1;</li>
          <li>СКФ и CrCl округляются до целого только при выводе; стадия и пороги — по округлённому значению;</li>
          <li>САК классифицируется в тех единицах, в которых введено (мг/г или мг/ммоль), без пересчёта.</li>
        </ul>
      </div>
    </section>

    <!-- 4 -->
    <section id="about-classification" class="about-section">
      <h3>Классификация и контроль <span class="src">[И1]</span></h3>
      <p class="muted small">Таблицы ниже строятся из действующего файла правил — это те же значения, по которым идёт расчёт.</p>
      <div class="tables">
        <div class="table-wrap">
          <table>
            <caption>Стадии СКФ, мл/мин/1,73 м²</caption>
            <tbody>
              <tr v-for="r in stageRows" :key="r.s">
                <th scope="row"><span class="stage-chip" :data-stage="r.s">{{ stage(r.s) }}</span></th>
                <td class="num">{{ r.range }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-wrap">
          <table>
            <caption>Альбуминурия (САК)</caption>
            <thead><tr><th>Категория</th><th>мг/г</th><th>мг/ммоль</th></tr></thead>
            <tbody>
              <tr><th scope="row">А1</th><td>&lt; {{ albG.a2From }}</td><td>&lt; {{ num(albM.a2From) }}</td></tr>
              <tr><th scope="row">А2</th><td>{{ albG.a2From }}–{{ albG.a3Above }}</td><td>{{ num(albM.a2From) }}–{{ num(albM.a3Above) }}</td></tr>
              <tr><th scope="row">А3</th><td>&gt; {{ albG.a3Above }}</td><td>&gt; {{ num(albM.a3Above) }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="tables">
        <div class="table-wrap">
          <table>
            <caption>Риск по сочетанию стадии и альбуминурии</caption>
            <thead><tr><th>Стадия</th><th v-for="c in ALB" :key="c">{{ a(c) }}</th></tr></thead>
            <tbody>
              <tr v-for="s in STAGES_ORDER" :key="s">
                <th scope="row">{{ stage(s) }}</th>
                <td v-for="c in ALB" :key="c" class="risk" :data-risk="riskMatrix[s][c]">{{ risk(riskMatrix[s][c]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-wrap">
          <table>
            <caption>Срок следующего анализа</caption>
            <thead><tr><th>Стадия</th><th v-for="c in ALB" :key="c">{{ a(c) }}</th></tr></thead>
            <tbody>
              <tr v-for="row in monitoring" :key="row.stages.join()">
                <th scope="row">{{ row.stages.map(stage).join('–') }}</th>
                <td v-for="c in ALB" :key="c">{{ interval(row[c]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="muted small">
        Без САК срок считается по столбцу А1 с пометкой «без учёта альбуминурии», риск не определяется. Стадии С1–С2
        соответствуют ХБП только при наличии маркеров повреждения почек. Таблица риска — «требует сверки» с текстом [И1].
      </p>
    </section>

    <!-- 5 -->
    <section id="about-rules" class="about-section">
      <h3>Правила и предупреждения</h3>
      <ul class="plain rules-summary">
        <li><strong>Формула недостоверна</strong> [И1] — ИМТ &lt; 15 или &gt; 40, беременность, ампутации, бодибилдинг, миодистрофия, плегия, вегетарианство, трансплантат, токсичные препараты, решение о ЗПТ, ОПП, быстрое снижение функции → рекомендуется проба Реберга–Тареева.</li>
        <li><strong>Госпитализация</strong> [И1] — впервые СКФ &lt; 30; креатинин &gt; 250 (м) / &gt; 200 (ж) мкмоль/л; удвоение креатинина менее чем за 2 месяца — экстренно.</li>
        <li><strong>ОПП</strong> [И2, И5] — прирост ≥ 26,5 мкмоль/л за 48 ч или ≥ 1,5 раза от минимума за 7 суток.</li>
        <li><strong>Пиелонефрит</strong> — снижение СКФ к предыдущему анализу, напоминание о коррекции доз по CrCl.</li>
        <li><strong>Диабет</strong> [И6, И7] — пороги метформина 60 / 45 / 30, иНГЛТ-2 с СКФ ≥ 20, напоминание о САК и об ИМТ ≥ 30.</li>
        <li><strong>Пневмония</strong> [И3] — нестабильность креатинина, мочевина &gt; 7,0 ммоль/л, креатинин &gt; 176 мкмоль/л, обязательная проверка ОПП, CrCl для антибиотиков.</li>
        <li><strong>Динамика</strong> — «значимое ухудшение»: снижение ≥ 25 % от исходного со сменой стадии; «улучшение»: переход в более благоприятную стадию.</li>
      </ul>
      <p class="muted small">
        Всего правил: {{ totalRules }}, из них «требует сверки»: {{ reviewRules }} (в том числе допущений: {{ assumptions }}).
        Полный список с порогами, источниками и статусами:
      </p>
      <details v-for="g in ruleGroups" :key="g.title" class="rule-group">
        <summary>{{ g.title }} <span class="count">{{ g.items.length }}</span></summary>
        <ul class="rule-list">
          <li v-for="r in g.items" :key="r.id">
            <p class="msg">{{ r.message }}</p>
            <p class="meta">
              <code>{{ r.id }}</code>
              <span>значение: {{ valueText(r) }}<template v-if="r.unit"> {{ r.unit }}</template></span>
              <span>источник: {{ r.source.map((s) => `[${s}]`).join(', ') }}</span>
              <span :class="r.status === 'требует сверки' ? 'badge' : 'badge-ok'">{{ r.status }}</span>
            </p>
            <p v-if="r.note" class="rule-note">{{ r.note }}</p>
          </li>
        </ul>
      </details>
    </section>

    <!-- 6 -->
    <section id="about-sources" class="about-section">
      <h3>Источники</h3>
      <div class="table-wrap">
        <table class="sources">
          <thead><tr><th>№</th><th>Источник</th><th class="num">Правил</th></tr></thead>
          <tbody>
            <tr v-for="[id, title] in sources" :key="id">
              <th scope="row">{{ id }}</th>
              <td>{{ title }}</td>
              <td class="num">{{ rulesBySource(id) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">
        Используются только эти источники. При противоречии приоритет у клинических протоколов МЗ РК, затем KDIGO. [И4]
        имеет статус «требует сверки», поэтому все правила метформина, взятые из [И6] и [И7], также помечены «требует сверки».
      </p>
    </section>

    <!-- 7 -->
    <section id="about-verification" class="about-section">
      <h3>Проверка расчётов</h3>
      <p>
        Ниже — проверки, которые выполнены прямо сейчас в этом браузере тем же кодом, что и расчёт. Это эталонные значения и
        сценарии из технического задания, математические свойства формул и граничные значения порогов.
      </p>

      <div class="check-summary" :class="allPass ? 'pass' : 'fail'" role="status">
        <strong v-if="checkError">Самопроверка не выполнена: {{ checkError }}</strong>
        <strong v-else-if="allPass">Все проверки пройдены: {{ passed }} из {{ checks.length }}</strong>
        <strong v-else>Пройдено {{ passed }} из {{ checks.length }} — есть расхождения, расчётам доверять нельзя</strong>
        <span class="muted small">{{ checkedAt }} · {{ num(checkMs, 1) }} мс</span>
        <button type="button" class="small no-print" @click="runChecks">Повторить</button>
      </div>

      <details v-for="g in checkGroups" :key="g.name" class="check-group" :open="!g.ok">
        <summary>
          <span :class="g.ok ? 'mark-ok' : 'mark-fail'" aria-hidden="true">{{ g.ok ? '✓' : '✗' }}</span>
          {{ g.name }}
          <span class="count">{{ g.items.filter((i) => i.pass).length }}/{{ g.items.length }}</span>
        </summary>
        <div class="table-wrap">
          <table class="checks-table">
            <thead><tr><th>Проверка</th><th>Ожидается</th><th>Получено</th><th><span class="sr-only">Итог</span></th></tr></thead>
            <tbody>
              <tr v-for="c in g.items" :key="c.title" :class="{ failed: !c.pass }">
                <td>{{ c.title }}</td>
                <td>{{ c.expected }}</td>
                <td>{{ c.actual }}</td>
                <td :class="c.pass ? 'mark-ok' : 'mark-fail'" :aria-label="c.pass ? 'пройдено' : 'не пройдено'">{{ c.pass ? '✓' : '✗' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <h4>Как ещё проверяется программа</h4>
      <ul class="plain">
        <li>
          <strong>Автотесты.</strong> В репозитории — набор тестов Vitest (папка <code>tests/</code>): формулы и эталоны,
          пересчёт единиц, все границы стадий, альбуминурии, риска и сроков контроля, граничные значения каждого правила
          (ОПП ровно на 48 ч и на 7-е/8-е сутки, удвоение, госпитализация, метформин, иНГЛТ-2, пневмония), особые
          состояния, ввод задним числом, проверка ввода, экспорт CSV. Тексты сообщений в тестах берутся из файла правил.
        </li>
        <li>
          <strong>Проверка самих тестов.</strong> Пороги (граница С1, порог ОПП, женский множитель) намеренно искажались —
          тесты и самопроверка на этой странице падают. Значит, они действительно ловят ошибки, а не всегда «зелёные».
        </li>
        <li>
          <strong>Независимый пересчёт эталонов.</strong> Эталоны ТЗ пересчитаны отдельно по опубликованным формулам. Все
          совпали в пределах ±1; для эталона 2 CKD-EPI 2021 даёт 92,1 при табличных 93 — в пределах допуска, стадия С1 не
          меняется.
        </li>
        <li>
          <strong>Проверка файла правил.</strong> При каждом запуске программа проверяет, что для каждого правила в коде
          есть запись в файле, источники — только И1–И8, статус — одно из двух значений. Иначе программа не запускается.
        </li>
      </ul>
      <div class="note stop">
        <strong>Что эти проверки не доказывают</strong>
        <p>
          Они подтверждают, что программа считает по заявленным формулам и правилам без ошибок реализации. Они не
          подтверждают клиническую точность самих формул для конкретного пациента и не заменяют сверку правил со статусом
          «требует сверки» с текстами протоколов. Расчётная СКФ может быть недостоверна в ситуациях, перечисленных в
          правиле «Формула недостоверна».
        </p>
      </div>
      <p class="muted small">Проверить можно и самостоятельно: исходный код и тесты открыты — <GithubLink label="репозиторий на GitHub" class="inline-link" />, команда <code>npm test</code>.</p>
    </section>

    <!-- 8 -->
    <section id="about-assumptions" class="about-section">
      <h3>Допущения и расхождения с источниками</h3>
      <p class="muted small">Опечатки и неоднозначности не исправлены молча, а описаны здесь, в коде и в README.</p>
      <ol class="steps compact">
        <li><strong>Упрощённая таблица CKD-EPI 2009 в [И1]</strong> содержит опечатки в коэффициентах для мужчин — используется общая формула.</li>
        <li><strong>Расовый коэффициент</strong> (× 1,159) не реализован: в данных пациента нет и не должно быть признака расы; [И8] от коэффициента отказывается.</li>
        <li><strong>Граница С1:</strong> в тексте [И1] «&gt; 90», в ТЗ «≥ 90»; значение ровно 90 отнесено к С1 (требует сверки).</li>
        <li><strong>Округление:</strong> стадия и пороги — по округлённой до целого СКФ, чтобы при 89,6 на экране «90» и стадия совпадали.</li>
        <li><strong>Коэффициент Devine</strong> 0,9 кг/см — округление исходных 2,3 кг на дюйм (≈ 0,9055).</li>
        <li><strong>CrCl при ИМТ ≥ 30:</strong> основной — по скорректированной массе, по фактической — дополнительно.</li>
        <li><strong>Единицы САК:</strong> 3 мг/ммоль ≈ 26,5 мг/г, пороги не эквивалентны — классификация в единицах ввода.</li>
        <li><strong>Несколько групп</strong> у одного пациента (например, СД и пневмония) — срабатывают правила всех групп.</li>
        <li><strong>Дата анализа хранится с временем</strong> — правило ОПП использует окно 48 ч.</li>
        <li><strong>Хронический пиелонефрит:</strong> действующего взрослого протокола МЗ РК нет; функция почек оценивается по [И1], порог снижения СКФ не задан.</li>
        <li><strong>Антибиотики при пневмонии:</strong> в [И3] пороги CrCl для конкретных препаратов не приведены — раздел не заполнен.</li>
      </ol>
    </section>

    <Disclaimer />
    <footer class="about-foot muted small">
      <span>Правила {{ rulesConfig.version }} · {{ totalRules }} правил · источники И1–И8</span>
      <GithubLink class="inline-link" />
    </footer>
  </article>
</template>
