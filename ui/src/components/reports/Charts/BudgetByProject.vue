<template>
  <div class="budget-chart-container">
    <div class="chart-area">
      <div class="chart-wrapper">
        <v-chart autoresize class="chart" :option="barChartOptions" />
      </div>
      <div class="chart-wrapper">
        <v-chart autoresize class="chart" :option="pieChartOptions" />
      </div>
    </div>
  </div>
</template>

<script setup>
  import { computed } from 'vue';
  import { use } from 'echarts/core';
  import { CanvasRenderer } from 'echarts/renderers';
  import { BarChart, PieChart } from 'echarts/charts';
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n()
  import {
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
  } from 'echarts/components';
  import VChart from 'vue-echarts';

  use([
    CanvasRenderer,
    BarChart,
    PieChart,
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
  ]);

  const props = defineProps({
    projects: {
      type: Array,
      required: true,
      default: () => [],
    },
  });

  // Format currency
  const formatCurrency = value => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  // Bar chart options
  const barChartOptions = computed(() => {
    // Sort projects by budget (descending) and take top 20
    const sortedProjects = [...props.projects]
      .sort((a, b) => b.total_budget - a.total_budget)
      .slice(0, 20);

    return {
      title: {
        text: t('topProjectsByBudget'),
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: params => {
          const project = sortedProjects[params[0].dataIndex];
          return `
            <strong>${project.project_name}</strong><br/>
            ${t('budget')}: ${formatCurrency(project.total_budget)}<br/>
            ${t('status')}: ${project.project_status}<br/>
            ${t('dates')}: ${project.start} ${t('to')} ${project.end}<br/>
            ${t('devPartners')}: ${project.dev_partners || t('none')}<br/>
            ${t('mdas')}: ${project.mdas || t('none')}
          `;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: t('budget'),
        axisLabel: {
          formatter: value => formatCurrency(value),
        },
      },
      yAxis: {
        type: 'category',
        data: sortedProjects.map(p => p.total_budget),
        axisLabel: {
          interval: 0,
          rotate: 30,
        },
      },
      series: [{
        name: t('budget'),
        type: 'bar',
        data: sortedProjects.map(p => p.total_budget),
        itemStyle: {
          color: params => {
            // Color based on budget size
            const budget = params.value;
            if (budget > 1000000) return '#5470c6';
            if (budget > 500000) return '#91cc75';
            return '#fac858';
          },
        },
        label: {
          show: true,
          position: 'right',
          formatter: params => formatCurrency(params.value),
        },
      }],
    };
  });

  // Pie chart options (by status)
  const pieChartOptions = computed(() => {
    // Group by project status
    const statusGroups = {};
    props.projects.forEach(project => {
      const status = project.project_status || t('unknown');
      statusGroups[status] = (statusGroups[status] || 0) + (project.total_budget || 0);
    });

    const pieData = Object.entries(statusGroups).map(([name, value]) => ({
      name,
      value,
    }));

    return {
      title: {
        text: t('budgetDistributionByStatus'),
        left: 'center',
      },
      tooltip: {
        trigger: 'item',
        formatter: params => {
          return `
            <strong>${params.name}</strong><br/>
            ${t('totalBudget')}: ${formatCurrency(params.value)}<br/>
            ${t('percentage')}: ${params.percent}%
          `;
        },
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'center',
      },
      series: [{
        name: t('budgetByStatus'),
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}: {d}%',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '18',
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: true,
        },
        data: pieData,
      }],
    };
  });
</script>

<style scoped>
.budget-chart-container {
  width: 100%;
  height: 100%;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.filters {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filters select, .filters input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  min-width: 180px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #666;
}

.loading .spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.chart-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.chart-wrapper {
  height: 500px;
}

.chart {
  width: 100%;
  height: 100%;
}

@media (max-width: 1200px) {
  .chart-area {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
  }

  .filters select, .filters input {
    width: 100%;
  }

  .chart-wrapper {
    height: 400px;
  }
}
</style>
