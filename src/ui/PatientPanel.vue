<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { Group, Patient, Sex } from '../core/types';
import { GROUPS, GROUP_LABELS } from './format';

defineProps<{ patients: Patient[]; selectedId: string | null }>();
const emit = defineEmits<{
  select: [id: string | null];
  create: [patient: Omit<Patient, 'id' | 'createdAt'>];
  delete: [id: string];
}>();

const creating = ref(false);
const form = reactive<{ label: string; sex: Sex | ''; groups: Group[] }>({ label: '', sex: '', groups: [] });
const error = ref('');

function create() {
  if (!form.label.trim()) return (error.value = 'Укажите псевдоним или номер карты');
  if (!form.sex) return (error.value = 'Укажите пол');
  if (!form.groups.length) return (error.value = 'Выберите хотя бы одну группу');
  emit('create', { label: form.label.trim(), sex: form.sex, groups: [...form.groups] });
  Object.assign(form, { label: '', sex: '', groups: [] });
  error.value = '';
  creating.value = false;
}

function remove(p: Patient) {
  if (confirm(`Удалить пациента «${p.label}» и всю его историю? Действие необратимо.`)) emit('delete', p.id);
}

const groupsText = (p: Patient) => p.groups.map((g) => GROUP_LABELS[g]).join(', ');
</script>

<template>
  <nav class="card patients" aria-label="Пациенты">
    <div class="patients-head">
      <h2>Пациенты</h2>
      <button type="button" class="small" @click="creating = !creating">{{ creating ? 'Отмена' : '+ Новый' }}</button>
    </div>

    <form v-if="creating" class="new-patient" novalidate @submit.prevent="create">
      <label class="field">
        <span>Псевдоним или № карты</span>
        <input v-model="form.label" autocomplete="off" maxlength="60" placeholder="без ФИО" />
      </label>
      <div class="segmented">
        <label><input v-model="form.sex" type="radio" value="male" /> М</label>
        <label><input v-model="form.sex" type="radio" value="female" /> Ж</label>
      </div>
      <div class="checks">
        <label v-for="g in GROUPS" :key="g"><input v-model="form.groups" type="checkbox" :value="g" /> {{ GROUP_LABELS[g] }}</label>
      </div>
      <small v-if="error" class="err">{{ error }}</small>
      <button type="submit" class="primary">Создать</button>
    </form>

    <ul class="patient-list">
      <li>
        <button type="button" class="patient" :class="{ active: selectedId === null }" @click="emit('select', null)">
          <strong>Без пациента</strong>
          <small>расчёт без сохранения</small>
        </button>
      </li>
      <li v-for="p in patients" :key="p.id" class="patient-row">
        <button type="button" class="patient" :class="{ active: selectedId === p.id }" @click="emit('select', p.id)">
          <strong>{{ p.label }}</strong>
          <small>{{ p.sex === 'male' ? 'М' : 'Ж' }} · {{ groupsText(p) }}</small>
        </button>
        <button type="button" class="icon danger" :aria-label="`Удалить пациента ${p.label}`" @click="remove(p)">✕</button>
      </li>
    </ul>
    <p class="muted small">Данные хранятся только в этом браузере и никуда не отправляются.</p>
  </nav>
</template>
