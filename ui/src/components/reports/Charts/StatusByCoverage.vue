<template>
  <div class="map-dashboard">
    <div class="map-header">
      <div class="breadcrumbs">
        <span v-if="currentLevel !== 'region'">
          <strong>Viewing all {{ currentLevel }}s</strong> of
          <strong>{{ currentParentName }}</strong>
        </span>
        <span v-else><strong>Viewing all regions</strong></span>
      </div>
      <div class="map-controls">
        <button
          class="control-button"
          :disabled="currentLevel === 'region'"
          @click="drillUp"
        >
          ◄ Back to {{ parentLevels[currentLevel] }}
        </button>
      </div>
    </div>
    <!-- <div v-if="hoveredLocation" class="map-overlay">
      <div class="location-card">
        <h3>{{ hoveredLocation.name }}</h3>


        <div class="status-breakdown">
          <div v-for="(count, status) in hoveredLocation.statuses" :key="status" class="status-item">
            <span class="status-dot" :style="{backgroundColor: statusColors[status] || '#999'}" />
            {{ status }}: {{ count }} ({{ ((count / hoveredLocation.total) * 100).toFixed(1) }}%)
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-item">
            <div class="metric-label">Total Projects</div>
            <div class="metric-value">{{ hoveredLocation.total }}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">Total Budget</div>
            <div class="metric-value">{{ formatCurrency(hoveredLocation.budget) }}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">Programs</div>
            <div class="metric-value">{{ hoveredLocation.program_count }}</div>
          </div>
        </div>

        <div class="beneficiaries-section">
          <h4>Beneficiaries</h4>
          <div class="beneficiaries-grid">
            <div class="beneficiary-type">
              <div class="beneficiary-label">Individuals</div>
              <div class="beneficiary-value">{{ hoveredLocation.beneficiaries.individual }}</div>
            </div>
            <div class="beneficiary-type">
              <div class="beneficiary-label">Groups</div>
              <div class="beneficiary-value">{{ hoveredLocation.beneficiaries.group }}</div>
            </div>
            <div class="beneficiary-type total">
              <div class="beneficiary-label">Total</div>
              <div class="beneficiary-value">{{ hoveredLocation.beneficiaries.total }}</div>
            </div>
          </div>
        </div>

        <div v-if="hoveredLocation.program_counts && Object.keys(hoveredLocation.program_counts).length" class="programs-section">
          <h4>Program Details</h4>
          <div class="programs-container">
            <div v-for="(count, programName) in hoveredLocation.program_counts" :key="programName" class="program-card">
              <div class="program-header">
                <span class="program-icon">
                  <i class="fas fa-project-diagram" />
                </span>
                <span class="program-title">{{ programName }}</span>
              </div>
              <div class="program-stats">
                <div class="program-stat">
                  <span class="stat-label">Projects</span>
                  <span class="stat-value">{{ count }}</span>
                </div>
                <div class="program-stat">
                  <span class="stat-label">Coverage</span>
                  <span class="stat-value">{{ ((count / hoveredLocation.total) * 100).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div> -->
    <v-card
      v-if="hoveredLocation"
      class="map-overlay-card mx-auto"
      elevation="10"
      width="800"
    >
      <!-- Header with Location Name -->
      <v-card-item class="location-header text-center">
        <v-card-title class="text-h5 font-weight-bold justify-center">
          <v-icon class="mr-2" color="primary" icon="mdi-map-marker" />
          {{ hoveredLocation.name }}
        </v-card-title>
      </v-card-item>

      <v-divider />
      <v-row>
        <v-col cols="6">
          <v-card-text class="status-section">
            <div class="text-subtitle-1 mb-2">Status Breakdown</div>
            <v-chip-group column>
              <v-chip
                v-for="(count, status) in hoveredLocation.statuses"
                :key="status"
                class="ma-1"
                :color="statusColors[status] || 'grey'"
                size="small"
                variant="outlined"
              >
                <v-avatar :color="statusColors[status] || 'grey'" start />
                {{ status }}: {{ count }} ({{ ((count / hoveredLocation.total) * 100).toFixed(1) }}%)
              </v-chip>
            </v-chip-group>
          </v-card-text>

          <v-divider />

          <!-- Key Metrics -->
          <v-card-text class="metrics-section">
            <div class="text-subtitle-1 mb-3">Key Metrics</div>
            <v-row dense>
              <v-col cols="4">
                <v-card color="grey-lighten-4" rounded="lg" variant="flat">
                  <v-card-text class="text-center">
                    <div class="text-caption text-grey-darken-1">Total Projects</div>
                    <div class="text-h5 font-weight-bold">{{ hoveredLocation.total }}</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="4">
                <v-card color="grey-lighten-4" rounded="lg" variant="flat">
                  <v-card-text class="text-center">
                    <div class="text-caption text-grey-darken-1">Total <br>Budget</div>
                    <div class="text-h5 font-weight-bold">{{ formatCurrency(hoveredLocation.budget) }}</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="4">
                <v-card color="grey-lighten-4" rounded="lg" variant="flat">
                  <v-card-text class="text-center">
                    <div class="text-caption text-grey-darken-1">Total Programs</div>
                    <div class="text-h5 font-weight-bold">{{ hoveredLocation.program_count }}</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />

          <!-- Beneficiaries -->
          <v-card-text class="beneficiaries-section">
            <div class="text-subtitle-1 mb-3">Beneficiaries</div>
            <v-row dense>
              <v-col cols="4">
                <v-card color="blue-lighten-5" rounded="lg" variant="flat">
                  <v-card-text class="text-center">
                    <div class="text-caption text-blue-darken-2">Individuals</div>
                    <div class="text-h5 font-weight-bold text-blue-darken-2">{{ hoveredLocation.beneficiaries.individual }}</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="4">
                <v-card color="green-lighten-5" rounded="lg" variant="flat">
                  <v-card-text class="text-center">
                    <div class="text-caption text-green-darken-2">Groups</div>
                    <div class="text-h5 font-weight-bold text-green-darken-2">{{ hoveredLocation.beneficiaries.group }}</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="4">
                <v-card color="primary-lighten-5" rounded="lg" variant="flat">
                  <v-card-text class="text-center">
                    <div class="text-caption text-primary-darken-2">Total</div>
                    <div class="text-h5 font-weight-bold text-primary-darken-2">{{ hoveredLocation.beneficiaries.total }}</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-col>
        <v-col cols="6">

          <!-- Program Breakdown -->
          <v-card-text v-if="hoveredLocation.program_counts && Object.keys(hoveredLocation.program_counts).length" class="programs-section">
            <div class="text-subtitle-1 mb-3">Flagship Programs Details</div>
            <v-row dense>
              <v-col
                v-for="(count, programName) in hoveredLocation.program_counts"
                :key="programName"
                cols="12"
              >
                <v-card rounded="lg" variant="outlined">
                  <v-card-text>
                    <v-row align="center">
                      <v-col cols="auto">
                        <v-icon color="indigo" icon="mdi-account-group" size="32" />
                      </v-col>
                      <v-col>
                        <div class="text-subtitle-2 font-weight-bold">{{ programName }}</div>
                        <v-row class="mt-1">
                          <v-col>
                            <div class="text-caption text-grey">Projects</div>
                            <div class="text-body-1 font-weight-medium">{{ count }}</div>
                          </v-col>
                          <v-col>
                            <div class="text-caption text-grey">Coverage</div>
                            <div class="text-body-1 font-weight-medium">{{ ((count / hoveredLocation.total) * 100).toFixed(1) }}%</div>
                          </v-col>
                        </v-row>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-col>
      </v-row>
    </v-card>

    <div class="map-wrapper">
      <div ref="mapChart" class="main-map" />

    </div>
  </div>
</template>

<script setup>
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import * as echarts from 'echarts';

  const LEVEL_CONFIG = {
    region: {
      api: '/reports/getProjectStatusByRegions',
      nextLevel: 'district',
    },
    district: {
      api: '/reports/getProjectStatusByDistricts',
      nextLevel: 'ward',
    },
    ward: {
      api: '/reports/getProjectStatusByWards',
      nextLevel: 'village',
    },
    village: {
      api: '/reports/getProjectStatusByVillages',
      nextLevel: null,
    },
  };

  const parentLevels = {
    district: 'Region',
    ward: 'District',
    village: 'Ward',
  };

  const statusColors = {
    'Ongoing': '#4CAF50',
    'Completed': '#2196F3',
    'Planned': '#FFC107',
    'On Hold': '#9E9E9E',
    'Pending': '#9C27B0',
    'Cancelled': '#F44336',
    '_default': '#607D8B',
  };

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
  });

  // Refs

  const mapChart = ref(null);
  const chartInstance = ref(null);
  const currentLevel = ref('region');
  const currentParentId = ref(null);
  const selectedLocations = ref([])
  const currentParentName = ref('');
  const geoJsonCache = ref({});
  const showMarkers = ref(true);
  const hoveredLocation = ref(null);
  const transformedData = ref({});

  // Initialize
  onMounted(() => {
    initChart();
    loadData();
    window.addEventListener('resize', handleResize);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    if (chartInstance.value) {
      chartInstance.value.dispose();
    }
  });

  watch(
    () => [props.reload],
    () => {
      let level = 'region'
      let parent = ''
      if(selectedLocations.value.length) {
        const current = selectedLocations.value.find(vl => {
          return vl.level === currentLevel.value
        })
        level = current.level
        parent = current.id
      }
      loadData(level, parent);
    },
    { deep: true }
  );

  const formatCurrency = value => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  // Core Functions
  const initChart = () => {
    chartInstance.value = echarts.init(mapChart.value);
  };

  const handleResize = () => {
    chartInstance.value?.resize();
  };

  const loadData = async (level = 'region', parentId = null) => {
    chartInstance.value.showLoading();
    try {
      currentLevel.value = level;
      let apiUrl = LEVEL_CONFIG[level].api;
      if (parentId) apiUrl += `/${parentId}`;
      apiUrl += `?start=${props.start}&end=${props.end}&status=${props.status?.id || ''}`
      const response = await fetch(apiUrl);
      transformedData.value = await response.json();
      await loadGeoJson(level);

      renderMap();
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const loadGeoJson = async level => {
    try {
      const response = await fetch(`/reports/geojson/${level}s?parent=${currentParentName.value}`);
      geoJsonCache.value[level] = await response.json();
    } catch (err) {
      console.error('Error fetching GeoJSON:', err);
    }
  };

  const renderMap = () => {
    chartInstance.value.hideLoading();
    if (!chartInstance.value) return;
    const geoJson = geoJsonCache.value[currentLevel.value];
    echarts.registerMap(currentLevel.value, geoJson);
    const series = [];

    // Base map series
    series.push({
      name: 'Regions',
      type: 'map',
      map: currentLevel.value,
      roam: true,
      zoom: 1.1,
      label: {
        show: true,
        position: ['50%', '50%'], // Center of the region
        distance: 0, // No offset
        align: 'center',
        verticalAlign: 'middle',
        color: 'blue',
        fontSize: 10,
        formatter: params => {
          // Only show names for regions larger than 2% of map area
          return params.data.value > 0 ? params.data.name : '';
        },
      },
      emphasis: {
        itemStyle: {
          areaColor: '#FF5722',
          borderWidth: 1,
        },
        label: {
          show: true,
          color: '#fff',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: [4, 8],
          borderRadius: 4,
        },
      },
      itemStyle: {
        borderWidth: 0.5,
        borderColor: '#fff',
        areaColor: '#e0e0e0',
      },
      data: Object.entries(transformedData.value).map(([name, data]) => ({
        name,
        value: data?.total || 0,
        budget: data?.budget || 0,
        id: data?.id || '',
        statuses: data?.statuses || {},
        beneficiaries: data?.beneficiaries || {},
        program_counts: data?.program_counts || {},
        program_count: data?.program_count || 0,
      })),
      universalTransition: { enabled: true },
    });

    // Location markers
    if (showMarkers.value) {
      series.push({
        name: 'Project Locations',
        type: 'scatter',
        coordinateSystem: 'geo',
        symbol: 'pin',
        symbolSize: [30, 40],
        itemStyle: {
          color: '#FF5722',
        },
        label: {
          show: true,
          formatter: params => {
            return `{b|${params.data.total}}`;
          },
          rich: {
            b: {
              color: '#fff',
              backgroundColor: '#FF5722',
              padding: [2, 5],
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 'bold',
            },
          },
          position: 'bottom',
        },
        data: Object.values(transformedData.value)
          .filter(item => item.total > 0)
          .map(item => ({
            name: item.name,
            total: item.total,
            budget: item.budget,
            statuses: item.statuses,
          })),
        zlevel: 10,
      });

      // Pulsing effect for active locations
      series.push({
        name: 'Active Locations',
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: Object.values(transformedData.value)
          .filter(item => item.total > 0)
          .map(item => ({
            name: item.name,
            total: item.total,
            budget: item.budget,
            beneficiaries: item.beneficiaries,
          })),
        symbolSize: 15,
        showEffectOn: 'render',
        rippleEffect: {
          brushType: 'stroke',
          scale: 6,
          period: 3,
        },
        itemStyle: {
          color: '#FF5722',
          shadowBlur: 10,
          shadowColor: '#FF5722',
        },
        zlevel: 1,
      });
    }

    const option = {
      backgroundColor: '#f5f7fa',
      title: {
        text: `Total Projects by Statuses`,
        left: 'center',
        top: 10,
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: '#333',
        },
      },
      // tooltip: {
      //   trigger: 'item',
      //   formatter: params => {
      //     if (params.seriesType === 'scatter' || params.seriesType === 'effectScatter') {
      //       return `<div style="font-weight:bold">${params.name}</div>
      //             <div>Total Projects: ${params.total}</div>
      //             <div>Total Budget: ${formatCurrency(params.data?.budget)}</div>`;
      //     }
      //     return `<div style="font-weight:bold"><b>${params.name}</b></div>
      //           <div>Total Projects: ${params.value || 0}</div>
      //           <div>Total Budget: ${formatCurrency(params.data?.budget)}</div>
      //           <div>Individual Beneficiaries: ${params.data?.beneficiaries?.individual}</div>
      //           <div>Group Beneficiaries: ${params.data?.beneficiaries?.group} </div>`;
      //   },
      // },
      visualMap: {
        min: 0,
        max: Math.max(...Object.values(transformedData.value).map(d => d.total)),
        text: ['High', 'Low'],
        inRange: {
          color: ['#e0f7fa', '#0097a7'],
        },
        calculable: true,
        right: 30,
        bottom: 30,
        textStyle: {
          color: '#333',
        },
      },
      series,
    };

    chartInstance.value.setOption(option, true);
    setupInteractions();
  };

  const setupInteractions = () => {
    // Clear previous event listeners
    chartInstance.value.off('mouseover');
    chartInstance.value.off('mouseout');
    chartInstance.value.off('click');

    // Hover effects for markers
    chartInstance.value.on('mouseover', { seriesType: 'scatter' }, params => {
      hoveredLocation.value = {
        name: params.name,
        total: params.data?.value || 0,
        budget: params.data?.budget || 0,
        statuses: params.data?.statuses || {},
        beneficiaries: params.data?.beneficiaries || {},
        program_counts: params.data?.program_counts || {},
        program_count: params.data?.program_count || 0,
      };
    });

    chartInstance.value.on('mouseout', { seriesType: 'scatter' }, () => {
      hoveredLocation.value = null;
    });

    // Drill-down click handler
    chartInstance.value.on('click', params => {
      if (params.seriesType === 'map') {
        const nextLevel = LEVEL_CONFIG[currentLevel.value].nextLevel;
        if (nextLevel && params.data) {
          if(!selectedLocations.value.find(vl => vl.id === params.data.id)) {
            const parent = selectedLocations.value.length ? selectedLocations.value[selectedLocations.value.length-1].id : null
            selectedLocations.value.push({
              id: params.data.id,
              name: params.data.name,
              parent,
              level: nextLevel,
            })
          }
          currentParentId.value = params.data.id;
          currentParentName.value = params.name;
          loadData(nextLevel, params.data.id);
        }
      }
    });
  };

  const drillUp = () => {
    if (currentLevel.value === 'region') return;

    const levels = Object.keys(LEVEL_CONFIG);
    const currentIndex = levels.indexOf(currentLevel.value);
    const parentLevel = levels[currentIndex - 1];

    const parentid = selectedLocations.value.find(vl => {
      return vl.level === currentLevel.value
    })?.parent

    if (parentLevel === 'region') {
      currentParentId.value = null;
      currentParentName.value = '';
    } else {
      const parent = selectedLocations.value.find(vl => {
        return vl.id === parentid
      })
      currentParentId.value = parent.id;
      currentParentName.value = parent.name;
    }

    loadData(parentLevel, parentid);
  };
</script>

<style scoped>
.map-dashboard {
  display: flex;
  flex-direction: column;
  height: 70vh;
  width: 100%;
  background: #f5f7fa;
  font-family: 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
}

.map-header {
  padding: 12px 20px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.map-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.4rem;
  font-weight: 600;
}

.map-controls {
  display: flex;
  gap: 15px;
  align-items: center;
}

.map-wrapper {
  flex: 1;
  padding: 0;
  min-height: 0;
  position: relative;
}

.main-map {
  width: 100%;
  height: 100%;
  background: #fff;
}

.map-overlay {
  position: absolute;
  top: 160px;
  right: 6px;
  background: whitesmoke;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  max-width: 800px;
  z-index: 100;
  pointer-events: none;
  transition: all 0.3s ease;
}

.location-card h3 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 18px;
}

.status-breakdown {
  margin-bottom: 12px;
}

.status-item {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.metric-item {
  background: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
  text-align: center;
}

.metric-label {
  font-size: 11px;
  color: #6c757d;
  margin-bottom: 4px;
}

.metric-value {
  font-weight: 600;
  font-size: 14px;
}

.beneficiaries-section h4, .programs-section h4 {
  margin: 12px 0 8px 0;
  font-size: 14px;
  color: #495057;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
}

.beneficiaries-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.beneficiary-type {
  background: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
  text-align: center;
}

.beneficiary-type.total {
  background: #e9f7ef;
}

.beneficiary-label {
  font-size: 11px;
  color: #6c757d;
}

.beneficiary-value {
  font-weight: 600;
  font-size: 14px;
}

.programs-list {
  max-height: 200px;
  overflow-y: auto;
}

.program-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #f1f1f1;
  font-size: 13px;
}

.program-item:last-child {
  border-bottom: none;
}

.program-name {
  color: #495057;
}

.program-count {
  font-weight: 500;
  color: #2c3e50;
}

.programs-container {
  display: grid;
  gap: 10px;
  margin-top: 8px;
}

.program-card {
  background: white;
  border-radius: 6px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  border-left: 3px solid #4e73df;
}

.program-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.program-icon {
  color: #4e73df;
  margin-right: 8px;
  font-size: 14px;
}

.program-title {
  font-weight: 600;
  font-size: 14px;
  color: #2c3e50;
}

.program-stats {
  display: flex;
  justify-content: space-between;
}

.program-stat {
  text-align: center;
  flex: 1;
}

.stat-label {
  font-size: 11px;
  color: #6c757d;
  display: block;
}

.stat-value {
  font-weight: 600;
  font-size: 13px;
  color: #2c3e50;
}

/* Add a nice scrollbar for many programs */
.programs-section {
  overflow-y: auto;
  padding-right: 5px;
}

/* Custom scrollbar */
.programs-section::-webkit-scrollbar {
  width: 5px;
}

.programs-section::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.programs-section::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 10px;
}

.programs-section::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.map-overlay-card {
  position: absolute;
  z-index: 1000;
  right: 20px;
  max-height: 80vh;
  overflow-y: auto;
}

.location-header {
  background-color: #f5f5f5;
  padding: 12px 16px;
}

.status-section .v-chip {
  margin: 2px;
}

.programs-section .v-card {
  margin-bottom: 8px;
}
</style>
