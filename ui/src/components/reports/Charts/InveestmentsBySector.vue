<template>
  <v-card>
    <v-card-title>Investment Distribution by Sector</v-card-title>
    <v-card-subtitle>Total investment allocated per sector</v-card-subtitle>

    <v-card-text>
      <div class="mt-4">
        <v-radio-group v-model="chartType" inline>
          <v-radio label="Bar Chart" value="bar" />
          <v-radio label="Pie Chart" value="pie" />
          <v-radio label="Treemap" value="treemap" />
        </v-radio-group>
      </div>
      <v-chart
        autoresize
        :option="chartOption"
        style="height: 500px; width: 100%;"
      />
    </v-card-text>
  </v-card>
</template>

<script setup>
  import { onMounted, ref, watch } from 'vue';
  import VChart from 'vue-echarts';
  import { use } from 'echarts/core';
  import {
    BarChart,
    PieChart,
    TreemapChart,
  } from 'echarts/charts';
  import {
    GridComponent,
    LegendComponent,
    TitleComponent,
    TooltipComponent,
    VisualMapComponent,
  } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  use([
    CanvasRenderer,
    BarChart,
    PieChart,
    TreemapChart,
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    VisualMapComponent,
  ]);

  const props = defineProps({
    status: {
      type: Object,
    },
    start: {
      type: String,
    },
    end: {
      type: String,
    },
    reload: {
      type: Number,
    },
    coverage: {
      type: Object,
      default: () => ({}),
    },
  });

  watch(
    () => [props.reload],
    () => {
      fetchData();
    },
    { deep: true }
  );
  const loading = ref(false);

  const chartType = ref('bar');
  const chartData = ref([]);
  const chartOption = ref({});

  const fetchData = async () => {
    loading.value = true;
    try {
      let url = `/project/getInvestmentBySector`
      url += `?start=${props.start}&end=${props.end}&status=${props.status?.id || ''}&coverage=${JSON.stringify(props.coverage)}`
      const response = await fetch(url);
      const data = await response.json();
      chartData.value = data;
      updateChart();
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      loading.value = false;
    }
  };

  const updateChart = () => {
    const data = chartData.value.map(item => ({
      name: item.sector_name,
      value: item.total_investments,
      project_count: item.project_count,
    }));

    const series = (() => {
      if (chartType.value === 'pie') {
        return [{
          name: 'Investment by Sector',
          type: 'pie',
          radius: ['40%', '70%'],
          label: { formatter: '{b}: {d}%' },
          data,
        }];
      }
      if (chartType.value === 'treemap') {
        return [{
          name: 'Investment by Sector',
          type: 'treemap',
          data,
          breadcrumb: { show: false },
        }];
      }
      return [{
        name: 'Investment by Sector',
        type: 'bar',
        data,
        label: {
          show: true,
          position: 'top',
          formatter: p => formatCurrency(p.value),
        },
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
        },
      }];
    })();

    chartOption.value = {
      tooltip: {
        trigger: 'item',
        formatter: p => `
        <strong>${p.name}</strong><br/>
        Total Investments: ${formatCurrency(p.value)}<br/>
        Projects: ${p.data.project_count}
      `,
      },
      xAxis: chartType.value === 'bar' ? { type: 'category', data: data.map(d => d.name) } : undefined,
      yAxis: chartType.value === 'bar' ? {
        type: 'value', axisLabel: {
          formatter: value => formatCurrency(value),
        } } : undefined,
      series,
    };
  };

  const formatCurrency = value => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  onMounted(fetchData);
  watch(chartType, updateChart);
</script>

<style scoped>
.chart-container {
  margin-top: 20px;
}
</style>
