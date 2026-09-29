<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { toHistoryRecord } from './core/record';
import type { Assessment, HistoryRecord, Patient, ValidationIssue } from './core/types';
import * as store from './storage/db';
import AboutView from './ui/AboutView.vue';
import GithubLink from './ui/GithubLink.vue';
import HistoryView from './ui/HistoryView.vue';
import MeasurementForm from './ui/MeasurementForm.vue';
import PatientPanel from './ui/PatientPanel.vue';
import ResultView from './ui/ResultView.vue';

type Tab = 'calc' | 'history' | 'about';

const patients = ref<Patient[]>([]);
const selectedId = ref<string | null>(null);
const records = ref<HistoryRecord[]>([]);
// Страница «О программе» открывается и по ссылке с #about (например, из README).
const tab = ref<Tab>(location.hash.startsWith('#about') ? 'about' : 'calc');
watch(tab, (t) => {
  if (t === 'about') history.replaceState(null, '', '#about');
  else if (location.hash.startsWith('#about')) history.replaceState(null, '', location.pathname + location.search);
});
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#about')) tab.value = 'about';
});
const result = ref<{ assessment: Assessment; warnings: ValidationIssue[]; saved: boolean } | null>(null);
const storageError = ref('');

const patient = computed(() => patients.value.find((p) => p.id === selectedId.value) ?? null);

async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    storageError.value = '';
    return await fn();
  } catch (e) {
    storageError.value = `Ошибка локального хранилища: ${e instanceof Error ? e.message : String(e)}`;
    return undefined;
  }
}

async function reloadPatients() {
  patients.value = (await guard(store.listPatients)) ?? [];
}

async function select(id: string | null) {
  // История загружается до смены пациента — форма подставляет данные последнего анализа.
  records.value = id ? ((await guard(() => store.listRecords(id))) ?? []) : [];
  selectedId.value = id;
  result.value = null;
  if (!id && tab.value === 'history') tab.value = 'calc';
}

async function createPatient(p: Omit<Patient, 'id' | 'createdAt'>) {
  const full: Patient = { ...p, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await guard(() => store.savePatient(full));
  await reloadPatients();
  await select(full.id);
}

async function deletePatient(id: string) {
  await guard(() => store.deletePatient(id));
  await reloadPatients();
  if (selectedId.value === id) await select(null);
}

const resultEl = ref<InstanceType<typeof ResultView>>();

async function onComputed(assessment: Assessment, warnings: ValidationIssue[]) {
  result.value = { assessment, warnings, saved: false };
  // В одну колонку результат оказывается под формой — показываем его.
  if (window.matchMedia('(max-width: 1100px)').matches) {
    await nextTick();
    const el = resultEl.value?.$el as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  }
}

async function save() {
  const p = patient.value;
  const r = result.value;
  if (!p || !r || r.saved) return;
  const rec = toHistoryRecord(r.assessment, p.id, crypto.randomUUID(), new Date().toISOString());
  const ok = await guard(async () => {
    await store.saveRecord(rec);
    // Пол и группы пациента — по последнему сохранённому анализу.
    const { sex, groups } = r.assessment.input;
    if (sex !== p.sex || groups.join() !== p.groups.join()) await store.savePatient({ ...p, sex, groups });
    return true;
  });
  if (!ok) return;
  r.saved = true;
  await reloadPatients();
  records.value = (await guard(() => store.listRecords(p.id))) ?? [];
}

async function deleteRecord(id: string) {
  if (!patient.value) return;
  const pid = patient.value.id;
  await guard(() => store.deleteRecord(id));
  records.value = (await guard(() => store.listRecords(pid))) ?? [];
}

onMounted(reloadPatients);
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <span class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8.5 3C5.5 3 3 6 3 10.2c0 4.6 2.6 9.3 5.3 9.8 1.6.3 2.4-.9 2.4-2.6v-3.1c0-1-.6-1.6-1.3-2.2-.8-.6-.9-1.8-.2-2.5.9-.9.4-2.1-.4-2.6C8.1 6.6 9 5.2 10.2 5.6 11.1 4 10.1 3 8.5 3Zm7 0c-1.6 0-2.6 1-1.7 2.6 1.2-.4 2.1 1 1.4 1.4-.8.5-1.3 1.7-.4 2.6.7.7.6 1.9-.2 2.5-.7.6-1.3 1.2-1.3 2.2v3.1c0 1.7.8 2.9 2.4 2.6 2.7-.5 5.3-5.2 5.3-9.8C21 6 18.5 3 15.5 3Z"/></svg>
      </span>
      <div>
        <h1>НефроКонтроль</h1>
        <p>Калькулятор СКФ для контроля лечения</p>
      </div>
    </div>
    <div class="header-side">
      <p class="header-note">Поддержка решений · не заменяет решение врача</p>
      <GithubLink class="header-github no-print" />
    </div>
  </header>

  <div class="print-only print-head">
    <strong>НефроКонтроль — печатная форма</strong>
    <span>Дата печати: {{ new Date().toLocaleString('ru-RU') }}</span>
  </div>

  <div v-if="storageError" class="alert alert-emergency layout-alert">{{ storageError }}</div>

  <div class="layout">
    <PatientPanel
      class="no-print"
      :patients="patients"
      :selected-id="selectedId"
      @select="select"
      @create="createPatient"
      @delete="deletePatient"
    />

    <main>
      <div class="tabs no-print" role="tablist" aria-label="Разделы">
        <button type="button" role="tab" :aria-selected="tab === 'calc'" :class="{ active: tab === 'calc' }" @click="tab = 'calc'">
          Расчёт
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'history'"
          :class="{ active: tab === 'history' }"
          :disabled="!patient"
          :title="patient ? '' : 'Выберите пациента'"
          @click="tab = 'history'"
        >
          <span class="tab-long">История и динамика</span><span class="tab-short">История</span>
          <span v-if="patient" class="count">{{ records.length }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'about'"
          :class="{ active: tab === 'about' }"
          @click="tab = 'about'"
        >
          О программе
        </button>
        <span v-if="patient" class="current-patient">Пациент: <strong>{{ patient.label }}</strong></span>
      </div>

      <div v-show="tab === 'calc'" class="calc">
        <MeasurementForm :key="selectedId ?? 'none'" class="no-print" :patient="patient" :history="records" @computed="onComputed" @invalid="result = null" />
        <ResultView
          v-if="result"
          ref="resultEl"
          :assessment="result.assessment"
          :warnings="result.warnings"
          :can-save="!!patient"
          :saved="result.saved"
          @save="save"
        />
        <section v-else class="card placeholder no-print">
          <h2>Результат</h2>
          <p class="muted">Заполните обязательные поля и нажмите «Рассчитать». Будут показаны СКФ по CKD-EPI 2009
            (основная) и 2021 (справочно), клиренс креатинина по Кокрофту–Голту, стадия, категория альбуминурии,
            предупреждения и срок следующего анализа.</p>
        </section>
      </div>

      <AboutView v-if="tab === 'about'" />
      <HistoryView v-if="tab === 'history' && patient" :patient="patient" :records="records" @delete="deleteRecord" />
    </main>
  </div>
</template>
