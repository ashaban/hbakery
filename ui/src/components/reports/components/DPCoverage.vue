<template>
  <v-container grid-list-xs>
    <v-row>
      <v-col cols="2">
        {{ $t('organizationTypeLabel') }}
        <v-checkbox
          v-model="org_types"
          color="blue"
          density="compact"
          :label="$t('allLabel')"
          value="all"
        />
        <v-checkbox
          v-model="org_types"
          color="blue"
          density="compact"
          :label="$t('governmentLabel')"
          value="9"
        />
        <v-checkbox
          v-model="org_types"
          color="blue"
          density="compact"
          :label="$t('regionalLabel')"
          value="10"
        />
        <v-checkbox
          v-model="org_types"
          color="blue"
          density="compact"
          :label="$t('internationalLabel')"
          value="11"
        />
        <v-checkbox
          v-model="org_types"
          color="blue"
          density="compact"
          :label="$t('privateLabel')"
          value="12"
        />
        <v-btn color="blue" size="small" @click="loadMap">
          <v-icon start>mdi-refresh</v-icon>
          {{ $t('loadButton') }}
        </v-btn>
      </v-col>
      <v-col cols="10">
        <div id="coverage" class="chart" style="height: 600px" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
  import * as echarts from 'echarts/core';
  import tanzania from './Tanzania.json'
  import {
    GeoComponent,
    TitleComponent,
    ToolboxComponent,
    TooltipComponent,
    VisualMapComponent,
  } from 'echarts/components';
  import { MapChart } from 'echarts/charts';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([
    TitleComponent,
    ToolboxComponent,
    TooltipComponent,
    VisualMapComponent,
    GeoComponent,
    MapChart,
    CanvasRenderer,
  ]);

  export default {
    data () {
      return {
        org_types: ['all'],
      }
    },
    mounted () {
      this.loadMap()
    },
    methods: {
      loadMap () {
        const chartDom = document.getElementById('coverage');
        const myChart = echarts.init(chartDom);
        let option;
        myChart.showLoading();
        fetch('/project/getDPCoverageByDistrict?org_types=' + JSON.stringify(this.org_types)).then(response => {
          response.json().then(results => {
            myChart.hideLoading();
            echarts.registerMap('Tanzania', tanzania);
            option = {
              title: {
                text: this.$t('mapTitle'),
                left: 'center',
              },
              tooltip: {
                trigger: 'item',
                showDelay: 0,
                transitionDuration: 0.2,
              },
              visualMap: {
                left: 'right',
                min: results.min,
                max: results.max,
                inRange: {
                  color: [
                    '#a50026',
                    '#d73027',
                    '#f46d43',
                    '#fdae61',
                    '#fee090',
                    '#ffffbf',
                    '#e0f3f8',
                    '#C8E6C9',
                    '#81C784',
                    '#43A047',
                    '#1B5E20',
                  ],
                },
                text: [this.$t('highLabel'), this.$t('lowLabel')],
                calculable: true,
              },
              toolbox: {
                show: true,
                left: 'left',
                top: 'top',
                feature: {
                  dataView: { readOnly: false },
                  restore: {},
                  saveAsImage: {},
                },
              },
              series: [
                {
                  name: this.$t('mapSeriesName'),
                  type: 'map',
                  roam: true,
                  map: 'Tanzania',
                  emphasis: {
                    label: {
                      show: true,
                    },
                  },
                  label: {
                    show: true,
                    color: 'inherit',
                    formatter (param) {
                      return !param.data ? '' : param.data.value;
                    },
                  },
                  data: results.data,
                },
              ],
            };
            myChart.setOption(option);
          })
        })
      },
    },
  }
</script>
<style scoped>
.chart {
  height: 30vh;
}
</style>
