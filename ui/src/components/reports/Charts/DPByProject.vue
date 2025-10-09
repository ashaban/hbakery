<template>
  <div class="partners-container">
    <div class="chart-wrapper">
      <v-chart autoresize class="treemap-chart" :option="chartOptions" />
    </div>
  </div>
</template>

<script setup>
  import { computed, ref } from 'vue';
  import { useI18n } from 'vue-i18n'
  const { t } = useI18n()
  import { use } from 'echarts/core';
  import VChart from 'vue-echarts';
  import { TreemapChart } from 'echarts/charts';
  import { CanvasRenderer } from 'echarts/renderers';
  import {
    TitleComponent,
    TooltipComponent,
    VisualMapComponent,
  } from 'echarts/components';

  use([CanvasRenderer, TreemapChart, TitleComponent, TooltipComponent, VisualMapComponent]);

  const props = defineProps({
    devPartners: {
      type: Array,
      required: true,
      default: () => [],
    },
  });

  const loading = ref(true);

  const formatCurrency = value => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const maxInvestment = computed(() => {
    return Math.max(...props.devPartners.map(p => p.total_investment || 0), 100000);
  });

  const chartOptions = computed(() => ({
    title: {
      text: t('devPartnersInvestment'),
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      formatter (info) {
        const data = info.data;
        return `
        <strong>${info.name}</strong><br/>
        ${t('investment')}: ${formatCurrency(info.value)}<br/>
        ${t('projects')}: ${data.project_count || 0}
      `;
      },
    },
    series: [
      {
        name: t('developmentPartners'),
        type: 'treemap',
        data: props.devPartners.map(p => ({
          name: p.abbreviation,
          value: p.total_investment || 0,
          project_count: p.project_count || 0,
        })),
        label: {
          show: true,
          formatter: '{b}',
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1,
        },
        breadcrumb: { show: false },
      },
    ],
    visualMap: {
      type: 'continuous',
      min: 0,
      max: maxInvestment.value,
      inRange: {
        color: ['#fac858', '#91cc75', '#5470c6'],
      },
      textStyle: {
        color: '#666',
      },
    },
  }));
</script>

<style scoped>
.dev-partners-container {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  height: 100%;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.filters select,
.filters input {
  padding: 0.5rem;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 180px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #666;
}

.spinner {
  border: 4px solid #eee;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.chart-wrapper {
  width: 100%;
  height: 600px;
}

.treemap-chart {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
  }
  .chart-wrapper {
    height: 400px;
  }
}
</style>
