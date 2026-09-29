<script setup lang="ts">
import {
  Chart,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type Plugin,
} from 'chart.js';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { rules } from '../config/rules';
import type { DynamicsPoint } from '../core/dynamics';
import type { CkdStage } from '../core/types';
import { date, num, stage } from './format';

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip);

const props = defineProps<{ points: DynamicsPoint[] }>();
const canvas = ref<HTMLCanvasElement>();
let chart: Chart<'line', { x: number; y: number }[]> | undefined;

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Горизонтальные границы стадий (rules.json → stage.bounds) с подписями стадий. */
const stageLines: Plugin<'line'> = {
  id: 'stageLines',
  beforeDatasetsDraw(c) {
    const bounds = rules.value<Record<Exclude<CkdStage, 'C5'>, number>>('stage.bounds');
    const { ctx, chartArea, scales } = c;
    const y = scales.y!;
    const entries = Object.entries(bounds) as [CkdStage, number][];
    ctx.save();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    entries.forEach(([s, v]) => {
      const py = y.getPixelForValue(v);
      if (py < chartArea.top || py > chartArea.bottom) return;
      ctx.strokeStyle = css('--grid-strong');
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, py);
      ctx.lineTo(chartArea.right, py);
      ctx.stroke();
      ctx.fillStyle = css('--muted');
      ctx.fillText(`${stage(s)} ≥ ${v}`, chartArea.right - 4, py - 2);
    });
    const c5y = y.getPixelForValue(bounds.C4);
    if (c5y < chartArea.bottom - 14) {
      ctx.fillStyle = css('--muted');
      ctx.fillText(`${stage('C5')} < ${bounds.C4}`, chartArea.right - 4, chartArea.bottom - 2);
    }
    ctx.restore();
  },
};

function data() {
  return props.points.map((p) => ({ x: new Date(p.sampledAt).getTime(), y: p.egfr }));
}

function yMax() {
  const max = Math.max(0, ...props.points.map((p) => p.egfr));
  return Math.max(120, Math.ceil((max + 10) / 10) * 10);
}

function build() {
  if (!canvas.value) return;
  const accent = css('--accent');
  chart = new Chart(canvas.value, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'СКФ CKD-EPI 2009',
          data: data(),
          borderColor: accent,
          backgroundColor: accent,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          type: 'linear',
          grid: { color: css('--grid') },
          ticks: { color: css('--muted'), maxTicksLimit: 6, callback: (v) => date(new Date(Number(v)).toISOString()) },
        },
        y: {
          min: 0,
          max: yMax(),
          title: { display: true, text: 'мл/мин/1,73 м²', color: css('--muted') },
          grid: { color: css('--grid') },
          ticks: { color: css('--muted'), stepSize: 15 },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => date(new Date(items[0]!.parsed.x as number).toISOString()),
            label: (item) => {
              const p = props.points[item.dataIndex]!;
              return `СКФ ${num(p.egfr)} (CKD-EPI 2009), стадия ${stage(p.stage)}`;
            },
          },
        },
      },
    },
    plugins: [stageLines],
  });
}

// Цвета берутся из CSS-переменных — при смене темы график перестраивается.
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
watch(
  () => props.points,
  () => {
    if (!chart) return build();
    chart.data.datasets[0]!.data = data();
    chart.options.scales!.y!.max = yMax();
    chart.update();
  },
  { deep: true },
);
</script>

<template>
  <div class="chart-box">
    <canvas ref="canvas" role="img" aria-label="График СКФ CKD-EPI 2009 во времени с границами стадий"></canvas>
  </div>
</template>
