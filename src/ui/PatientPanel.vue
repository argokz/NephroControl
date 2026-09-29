<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { Group, Patient, Sex } from '../core/types';
import { GROUPS, GROUP_LABELS } from './format';

const props = defineProps<{ patients: Patient[]; selectedId: string | null }>();
const emit = defineEmits<{
  select: [id: string | null];
  create: [patient: Omit<Patient, 'id' | 'createdAt'>];
  delete: [id: string];
}>();

// На узких экранах панель свёрнута до строки «текущий пациент»; на широких — всегда открыта.
const open = ref(false);
const creating = ref(false);
const form = reactive<{ label: string; sex: Sex | ''; groups: Group[] }>({ label: '', sex: '', groups: [] });
const error = ref('');

const current = computed(() => props.patients.find((p) => p.id === props.selectedId) ?? null);

function choose(id: string | null) {
  emit('select', id);
  open.value = false;
}

function toggleCreate() {
  creating.value = !creating.value;
  if (creating.value) open.value = true;
  error.value = '';
}

function create() {
  if (!form.label.trim()) return (error.value = 'Укажите псевдоним или номер карты');
  if (!form.sex) return (error.value = 'Укажите пол');
  if (!form.groups.length) return (error.value = 'Выберите хотя бы одну группу');
  emit('create', { label: form.label.trim(), sex: form.sex, groups: [...form.groups] });
  Object.assign(form, { label: '', sex: '', groups: [] });
  error.value = '';
  creating.value = false;
  open.value = false;
}

function remove(p: Patient) {
  if (confirm(`Удалить пациента «${p.label}» и всю его историю? Действие необратимо.`)) emit('delete', p.id);
}

const groupsText = (p: Patient) => p.groups.map((g) => GROUP_LABELS[g]).join(', ');
</script>

<template>
  <nav class="card patients" :class="{ open }" aria-label="Пациенты">
    <div class="patients-head">
      <h2>Пациенты</h2>
      <button
        type="button"
        class="patients-current"
        :aria-expanded="open"
        aria-controls="patients-body"
        @click="open = !open"
      >
        <span class="patients-current-text">
          <small>Пациент</small>
          <strong>{{ current ? current.label : 'Без пациента' }}</strong>
        </span>
        <svg class="chevron" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button type="button" class="small" :aria-pressed="creating" @click="toggleCreate">
        {{ creating ? 'Отмена' : '+ Новый' }}
      </button>
    </div>

    <div id="patients-body" class="patients-body">
      <form v-if="creating" class="new-patient" novalidate @submit.prevent="create">
        <label class="field">
          <span>Псевдоним или № карты</span>
          <input v-model="form.label" autocomplete="off" maxlength="60" placeholder="без ФИО" enterkeyhint="done" />
        </label>
        <fieldset class="field">
          <legend>Пол</legend>
          <div class="seg">
            <label><input v-model="form.sex" type="radio" value="male" /><span>Мужской</span></label>
            <label><input v-model="form.sex" type="radio" value="female" /><span>Женский</span></label>
          </div>
        </fieldset>
        <fieldset class="field">
          <legend>Группы</legend>
          <div class="chips">
            <label v-for="g in GROUPS" :key="g" class="chip">
              <input v-model="form.groups" type="checkbox" :value="g" /> {{ GROUP_LABELS[g] }}
            </label>
          </div>
        </fieldset>
        <small v-if="error" class="err" role="alert">{{ error }}</small>
        <button type="submit" class="primary">Создать</button>
      </form>

      <ul class="patient-list">
        <li>
          <button type="button" class="patient" :class="{ active: selectedId === null }" :aria-current="selectedId === null" @click="choose(null)">
            <strong>Без пациента</strong>
            <small>расчёт без сохранения</small>
          </button>
        </li>
        <li v-for="p in patients" :key="p.id" class="patient-row">
          <button type="button" class="patient" :class="{ active: selectedId === p.id }" :aria-current="selectedId === p.id" @click="choose(p.id)">
            <strong>{{ p.label }}</strong>
            <small>{{ p.sex === 'male' ? 'М' : 'Ж' }} · {{ groupsText(p) }}</small>
          </button>
          <button type="button" class="icon danger" :aria-label="`Удалить пациента ${p.label}`" @click="remove(p)">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </li>
      </ul>
      <p class="muted small">Данные хранятся только в этом браузере и никуда не отправляются.</p>
    </div>
  </nav>
</template>
