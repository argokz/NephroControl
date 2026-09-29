// Кокрофт–Голт, мл/мин — для дозирования (ТЗ, раздел 5.3).
//
// CrCl = (140 − возраст) × масса / (72 × Scr) × 0,85 [ж]
// Идеальная масса (Devine): м = 50 + 0,9 × (рост − 152,4); ж = 45,5 + 0,9 × (рост − 152,4)
// Скорректированная масса = идеальная + factor × (фактическая − идеальная), factor = 0,4 (rules.json)
//
// Коэффициент 0,9 кг/см — округление исходного 2,3 кг на дюйм (≈ 0,9055 кг/см), как в ТЗ.

import type { Sex } from '../types';

export function cockcroftGault(scrMgDl: number, ageYears: number, weightKg: number, sex: Sex): number {
  return ((140 - ageYears) * weightKg) / (72 * scrMgDl) * (sex === 'female' ? 0.85 : 1);
}

export function bodyMassIndex(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function idealBodyWeightDevine(heightCm: number, sex: Sex): number {
  return (sex === 'female' ? 45.5 : 50) + 0.9 * (heightCm - 152.4);
}

export function adjustedBodyWeight(idealKg: number, actualKg: number, factor: number): number {
  return idealKg + factor * (actualKg - idealKg);
}
