<script setup lang="ts">
import { Chart, LinearScale, PointElement, ScatterController, Tooltip, type Plugin } from 'chart.js';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ComparedRow, FormulaSummary, LabFormula } from '../core/labCompare';
import { num, signed } from './format';

Chart.register(ScatterController, PointElement, LinearScale, Tooltip);

// График Бленда–Альтмана: по оси X — среднее (приложение + лаборатория) / 2,
// по оси Y — разница «приложение − лаборатория»; линии — средняя разница и пределы согласия.
const props = defineProps<{ rows: ComparedRow[]; formula: LabFormula; summary: FormulaSummary }>();
const canvas = ref<HTMLCanvasElement>();
let chart: Chart<'scatter', { x: number; y: number }[]> | undefined;

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const exact = () => props.rows.filter((r) => !r.row.censored);

function data() {
  return exact().map((r) => ({ x: (r.ours[props.formula] + r.row.labEgfr) / 2, y: r.diff[props.formula]! }));
}

const lines: Plugin<'scatter'> = {
  id: 'baLines',
  beforeDatasetsDraw(c) {
    const s = props.summary;
    const { ctx, chartArea, scales } = c;
    const y = scales.y!;
    const items: [number, string, boolean][] = [[0, '0', false], [s.meanDiff, `среднее ${signed(s.meanDiff, 1)}`, true]];
    if (Number.isFinite(s.loaLow)) {
      items.push([s.loaLow, `−1,96 SD ${signed(s.loaLow, 1)}`, true], [s.loaHigh, `+1,96 SD ${signed(s.loaHigh, 1)}`, true]);
    }
    ctx.save();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    for (const [v, label, dashed] of items) {
      const py = y.getPixelForValue(v);
      if (py < chartArea.top || py > chartArea.bottom) continue;
      ctx.strokeStyle = dashed ? css('--grid-strong') : css('--muted');
      ctx.setLineDash(dashed ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, py);
      ctx.lineTo(chartArea.right, py);
      ctx.stroke();
      if (dashed) {
        ctx.fillStyle = css('--muted');
        ctx.fillText(label, chartArea.right - 4, py - 2);
      }
    }
    ctx.restore();
  },
};

function yLimit() {
  const s = props.summary;
  const m = Math.max(5, ...data().map((p) => Math.abs(p.y)), Math.abs(s.loaLow) || 0, Math.abs(s.loaHigh) || 0);
  return Math.ceil((m + 1) / 5) * 5;
}

function build() {
  if (!canvas.value) return;
  const accent = css('--accent');
  const lim = yLimit();
  chart = new Chart(canvas.value, {
    type: 'scatter',
    data: { datasets: [{ label: 'Разница', data: data(), backgroundColor: accent, borderColor: accent, pointRadius: 3, pointHoverRadius: 5 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          title: { display: true, text: 'среднее (приложение + лаборатория) / 2, мл/мин/1,73 м²', color: css('--muted') },
          grid: { color: css('--grid') },
          ticks: { color: css('--muted') },
        },
        y: {
          min: -lim,
          max: lim,
          title: { display: true, text: 'приложение − лаборатория', color: css('--muted') },
          grid: { color: css('--grid') },
          ticks: { color: css('--muted') },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const r = exact()[item.dataIndex]!;
              return `ID ${r.row.id}: приложение ${r.ours[props.formula]}, лаборатория ${num(r.row.labEgfr)}, разница ${signed(r.diff[props.formula]!)}`;
            },
          },
        },
      },
    },
    plugins: [lines],
  });
}

const scheme = window.matchMedia('(prefers-color-scheme: dark)');
function rebuild() {
  chart?.destroy();
  chart = undefined;
  build();
}

onMounted(() => {
  build();
  scheme.addEventListener('change', rebuild);
});
onBeforeUnmount(() => {
  scheme.removeEventListener('change', rebuild);
  chart?.destroy();
});
watch(() => [props.rows, props.formula, props.summary], rebuild);
</script>

<template>
  <div class="chart-box">
    <canvas
      ref="canvas"
      role="img"
      :aria-label="`График Бленда–Альтмана: разница eGFR приложения (CKD-EPI ${formula}) и лаборатории`"
    ></canvas>
  </div>
</template>
