<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { rules } from '../config/rules';
import { assess } from '../core/assess';
import type {
  AcrUnit,
  Assessment,
  CreatinineUnit,
  Group,
  HistoryRecord,
  MeasurementDraft,
  Patient,
  Sex,
  SpecialCondition,
  ValidationIssue,
} from '../core/types';
import { GROUPS, GROUP_LABELS, SPECIAL_CONDITION_OPTIONS, nowLocal, parseNum } from './format';

const props = defineProps<{
  patient: Patient | null;
  history: HistoryRecord[];
}>();

const emit = defineEmits<{
  computed: [assessment: Assessment, warnings: ValidationIssue[]];
  invalid: [];
}>();

interface FormState {
  creatinine: string;
  creatinineUnit: CreatinineUnit;
  age: string;
  weight: string;
  sex: Sex | '';
  groups: Group[];
  sampledAt: string;
  height: string;
  acr: string;
  acrUnit: AcrUnit;
  urea: string;
  special: SpecialCondition[];
}

const blank = (): FormState => ({
  creatinine: '',
  creatinineUnit: 'umol/L',
  age: '',
  weight: '',
  sex: '',
  groups: [],
  sampledAt: nowLocal(),
  height: '',
  acr: '',
  acrUnit: 'mg/g',
  urea: '',
  special: [],
});

const f = reactive<FormState>(blank());
const errors = ref<ValidationIssue[]>([]);
const warnings = ref<ValidationIssue[]>([]);
const showOptional = ref(false);

// При выборе пациента подставляем пол, группы и антропометрию из последнего анализа.
watch(
  () => props.patient?.id,
  () => {
    Object.assign(f, blank());
    errors.value = [];
    warnings.value = [];
    const p = props.patient;
    if (!p) return;
    f.sex = p.sex;
    f.groups = [...p.groups];
    const last = props.history.at(-1)?.input;
    if (last) {
      f.age = String(last.ageYears);
      f.weight = String(last.weightKg);
      if (last.heightCm !== undefined) f.height = String(last.heightCm);
      f.creatinineUnit = last.creatinine.unit;
    }
  },
  { immediate: true },
);

const errorFor = (field: string) => errors.value.find((e) => e.field === field)?.message;
const isMinor = computed(() => errors.value.some((e) => e.ruleId === 'validation.age.minor'));
const warningFor = (field: string) => warnings.value.find((e) => e.field === field)?.message;

const hasOptional = computed(() => !!(f.height || f.acr || f.urea || f.special.length));

function draft(): MeasurementDraft {
  const d: MeasurementDraft = {
    creatinine: { value: parseNum(f.creatinine) ?? Number.NaN, unit: f.creatinineUnit },
    ageYears: parseNum(f.age) ?? Number.NaN,
    weightKg: parseNum(f.weight) ?? Number.NaN,
    groups: [...f.groups],
    sampledAt: f.sampledAt,
    specialConditions: [...f.special],
  };
  if (f.sex) d.sex = f.sex;
  const h = parseNum(f.height);
  if (h !== undefined) d.heightCm = h;
  const a = parseNum(f.acr);
  if (a !== undefined) d.acr = { value: a, unit: f.acrUnit };
  const u = parseNum(f.urea);
  if (u !== undefined) d.ureaMmolL = u;
  return d;
}

function submit() {
  const r = assess(draft(), props.history, rules);
  warnings.value = r.warnings;
  if (!r.ok) {
    errors.value = r.errors;
    emit('invalid');
    return;
  }
  errors.value = [];
  emit('computed', r.assessment, r.warnings);
}
</script>

<template>
  <form class="card form" novalidate @submit.prevent="submit">
    <h2>Данные анализа</h2>

    <div v-if="isMinor" class="alert alert-emergency" role="alert">
      {{ errorFor('ageYears') }}
    </div>

    <div class="grid">
      <label class="field span-2" :class="{ invalid: errorFor('creatinine') }">
        <span>Креатинин крови <b class="req">*</b></span>
        <div class="with-unit">
          <input v-model="f.creatinine" inputmode="decimal" autocomplete="off" placeholder="например, 106" />
          <select v-model="f.creatinineUnit" aria-label="Единица креатинина">
            <option value="umol/L">мкмоль/л</option>
            <option value="mg/dL">мг/дл</option>
          </select>
        </div>
        <small v-if="errorFor('creatinine')" class="err">{{ errorFor('creatinine') }}</small>
        <small v-else-if="warningFor('creatinine')" class="warn">{{ warningFor('creatinine') }}</small>
      </label>

      <label class="field" :class="{ invalid: errorFor('sampledAt') }">
        <span>Дата и время анализа <b class="req">*</b></span>
        <input v-model="f.sampledAt" type="datetime-local" />
        <small v-if="errorFor('sampledAt')" class="err">{{ errorFor('sampledAt') }}</small>
      </label>

      <label class="field" :class="{ invalid: errorFor('ageYears') }">
        <span>Возраст, лет <b class="req">*</b></span>
        <input v-model="f.age" inputmode="decimal" autocomplete="off" />
        <small v-if="errorFor('ageYears') && !isMinor" class="err">{{ errorFor('ageYears') }}</small>
      </label>

      <label class="field" :class="{ invalid: errorFor('weightKg') }">
        <span>Масса тела, кг <b class="req">*</b></span>
        <input v-model="f.weight" inputmode="decimal" autocomplete="off" />
        <small v-if="errorFor('weightKg')" class="err">{{ errorFor('weightKg') }}</small>
      </label>

      <fieldset class="field" :class="{ invalid: errorFor('sex') }">
        <legend>Пол <b class="req">*</b></legend>
        <div class="segmented">
          <label><input v-model="f.sex" type="radio" value="male" /> Мужской</label>
          <label><input v-model="f.sex" type="radio" value="female" /> Женский</label>
        </div>
        <small v-if="errorFor('sex')" class="err">{{ errorFor('sex') }}</small>
      </fieldset>
    </div>

    <fieldset class="field" :class="{ invalid: errorFor('groups') }">
      <legend>Группа пациента <b class="req">*</b> <span class="hint">можно выбрать несколько</span></legend>
      <div class="chips">
        <label v-for="g in GROUPS" :key="g" class="chip">
          <input v-model="f.groups" type="checkbox" :value="g" /> {{ GROUP_LABELS[g] }}
        </label>
      </div>
      <small v-if="errorFor('groups')" class="err">{{ errorFor('groups') }}</small>
    </fieldset>

    <details class="optional" :open="showOptional || hasOptional" @toggle="showOptional = ($event.target as HTMLDetailsElement).open">
      <summary>Необязательные данные и особые состояния</summary>
      <div class="grid">
        <label class="field" :class="{ invalid: errorFor('heightCm') }">
          <span>Рост, см</span>
          <input v-model="f.height" inputmode="decimal" autocomplete="off" />
          <small v-if="errorFor('heightCm')" class="err">{{ errorFor('heightCm') }}</small>
          <small v-else class="hint">нужен для ИМТ и скорректированной массы</small>
        </label>

        <label class="field" :class="{ invalid: errorFor('acr') }">
          <span>САК (альбумин/креатинин мочи)</span>
          <div class="with-unit">
            <input v-model="f.acr" inputmode="decimal" autocomplete="off" />
            <select v-model="f.acrUnit" aria-label="Единица САК">
              <option value="mg/g">мг/г</option>
              <option value="mg/mmol">мг/ммоль</option>
            </select>
          </div>
          <small v-if="errorFor('acr')" class="err">{{ errorFor('acr') }}</small>
        </label>

        <label class="field" :class="{ invalid: errorFor('ureaMmolL') }">
          <span>Мочевина крови, ммоль/л</span>
          <input v-model="f.urea" inputmode="decimal" autocomplete="off" />
          <small v-if="errorFor('ureaMmolL')" class="err">{{ errorFor('ureaMmolL') }}</small>
        </label>
      </div>

      <fieldset class="field">
        <legend>Особые состояния <span class="hint">снижают достоверность расчётной СКФ</span></legend>
        <div class="checks">
          <label v-for="o in SPECIAL_CONDITION_OPTIONS" :key="o.id">
            <input v-model="f.special" type="checkbox" :value="o.id" /> {{ o.label }}
          </label>
        </div>
      </fieldset>
    </details>

    <div class="actions">
      <button type="submit" class="primary">Рассчитать</button>
      <span v-if="errors.length" class="err">Исправьте отмеченные поля</span>
    </div>
  </form>
</template>
