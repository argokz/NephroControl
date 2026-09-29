// CKD-EPI 2021 [И8], мл/мин/1,73 м² — справочно.
//
// eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^(−1,200) × 0,9938^возраст × 1,012 [ж]
// κ = 0,7 (ж) / 0,9 (м); α = −0,241 (ж) / −0,302 (м)

import type { Sex } from '../types';

export function ckdEpi2021(scrMgDl: number, ageYears: number, sex: Sex): number {
  const female = sex === 'female';
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const ratio = scrMgDl / kappa;
  return (
    142 *
    Math.min(ratio, 1) ** alpha *
    Math.max(ratio, 1) ** -1.2 *
    0.9938 ** ageYears *
    (female ? 1.012 : 1)
  );
}
