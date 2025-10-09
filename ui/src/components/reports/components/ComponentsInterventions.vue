<template>
  <v-container class="pa-6" fluid>
    <v-card class="elevation-3">
      <v-card-title class="d-flex justify-space-between align-center bg-primary">
        <span class="text-h5 font-weight-bold white--text">{{ $t('projectsOverviewTitle') }}</span>
        <v-btn
          color="white"
          :prepend-icon="$t('downloadIcon')"
          variant="text"
          @click="exportToExcel"
        >
          {{ $t('exportExcelButton') }}
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-expansion-panels v-model="panel" class="mb-6">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon left>{{ $t('filterIcon') }}</v-icon>
              <span class="font-weight-medium">{{ $t('filtersTitle') }}</span>
              <v-chip v-if="activeFilterCount > 0" class="ml-2" color="primary" size="small">
                {{ activeFilterCount }} {{ $t('activeFilters') }}
              </v-chip>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-row>
                <v-col cols="12" md="12">
                  <div class="text-subtitle-2 mt-3 mb-2">{{ $t('flagshipComponentsTitle') }}</div>
                  <v-card class="pa-2" style="max-height: 200px; overflow-y: auto;" variant="outlined">
                    <v-treeview
                      v-model="filters.components"
                      color="primary"
                      item-title="name"
                      item-value="id"
                      :items="hierarchies"
                      :load-children="loadChildren"
                      open-on-click
                      select-strategy="leaf"
                      selectable
                      @click:select="componentSelected"
                    />
                  </v-card>

                  <div v-if="filters.components.length" class="mt-3">
                    <div class="text-subtitle-2 mb-1">{{ $t('selectedComponentsTitle') }}:</div>
                    <v-chip
                      v-for="id in filters.components"
                      :key="id"
                      class="mr-2 mb-2"
                      closable
                      color="green"
                      size="small"
                      variant="elevated"
                      @click:close="removeComponent(id)"
                    >
                      {{ findComponentNameById(id) }}
                    </v-chip>
                  </div>
                </v-col>
              </v-row>

              <v-row class="mt-2">
                <v-col class="text-right" cols="12">
                  <v-btn
                    color="primary"
                    :prepend-icon="$t('filterIcon')"
                    @click="fetchProjects"
                  >
                    {{ $t('applyFiltersButton') }}
                  </v-btn>
                  <v-btn
                    class="ml-2"
                    color="secondary"
                    :prepend-icon="$t('closeIcon')"
                    variant="text"
                    @click="resetFilters"
                  >
                    {{ $t('clearAllButton') }}
                  </v-btn>
                </v-col>
              </v-row>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <v-data-table
          v-model:items-per-page="itemsPerPage"
          class="elevation-1 striped-table"
          density="comfortable"
          :headers="headers"
          item-value="id"
          :items="projects"
          :items-length="totalItems"
          :loading="loading"
          show-current-page
          show-first-last-page
          @update:page="handlePageChange"
        >
          <template #item.interventions="{ item }">
            <ul>
              <li v-for="intervention in item.interventions" :key="intervention.id">
                {{ intervention.name }}
              </li>
            </ul>
          </template>
          <template #bottom>
            <div class="d-flex justify-space-between align-center pa-2">
              <div class="text-caption">
                {{ $t('paginationText', { first: pageFirstItem, last: pageLastItem, total: totalItems }) }}
              </div>
              <v-pagination
                v-model="page"
                :length="pageCount"
                :total-visible="5"
                @update:model-value="handlePageChange"
              />
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import useProjectHierarchy from '../../settings/projectHierarchy';

  const { t } = useI18n()
  const { getHierarchyAsync, loadChildren, hierarchies } = useProjectHierarchy()

  const loading = ref(false)
  const projects = ref([])
  const totalItems = ref(0)
  const page = ref(1)
  const itemsPerPage = ref(10)
  const panel = ref([0])

  const filters = ref({
    components: [],
  })

  const activeFilterCount = computed(() => {
    return Object.values(filters.value).filter(v =>
      v !== '' && v !== null && (Array.isArray(v) ? v.length > 0 : true)
    ).length
  })

  const pageCount = computed(() => Math.ceil(totalItems.value / itemsPerPage.value))
  const pageFirstItem = computed(() => (page.value - 1) * itemsPerPage.value + 1)
  const pageLastItem = computed(() => {
    const last = page.value * itemsPerPage.value
    return last > totalItems.value ? totalItems.value : last
  })

  const headers = [
    { title: t('subComponentHeader'), key: 'name' },
    { title: t('interventionsHeader'), key: 'interventions' },
  ]

  const selectedComponent = ref([])

  const handlePageChange = newPage => {
    page.value = newPage
    fetchProjects()
  }

  const removeComponent = id => {
    const index = filters.value.components.indexOf(id)
    if (index > -1) filters.value.components.splice(index, 1)
    const idx = selectedComponent.value.findIndex(sc => sc.id === id)
    if(idx > -1) selectedComponent.value.splice(idx, 1)
  }

  const resetFilters = () => {
    filters.value = { component: '' }
  }

  function findComponentNameById (id) {
    const component = selectedComponent.value.find(sc => sc.id === id)
    return component ? component.name : ''
  }

  function componentSelected (item) {
    const area = hierarchies.value.find(h => h.id === item.path[0])
    const program = area.children.find(a => a.id === item.path[1])
    const component = program.children.find(c => c.id === item.path[2])
    if(item.value) {
      selectedComponent.value.push(component)
    } else {
      const index = selectedComponent.value.findIndex(sc => sc.id === component.id)
      if(index > -1) selectedComponent.value.splice(index, 1)
    }
  }

  const fetchProjects = async () => {
    loading.value = true
    try {
      let query = ''
      for(const filter in filters.value) {
        const value = Array.isArray(filters.value[filter]) || typeof filters.value[filter] === 'object'
          ? JSON.stringify(filters.value[filter])
          : filters.value[filter]
        if(query) query += '&'
        query += `${filter}=${value}`
      }
      query += `&page=${page.value}&limit=${itemsPerPage.value}`
      const response = await fetch(`/reports/componentInterventions?${query}`)
      const data = await response.json()
      projects.value = data.items || []
      totalItems.value = data.total || data.length || 0
    } catch (err) {
      console.error(t('fetchError'), err)
    } finally {
      loading.value = false
    }
  }

  const exportToExcel = async () => {
    let query = ''
    for(const filter in filters.value) {
      const value = Array.isArray(filters.value[filter]) || typeof filters.value[filter] === 'object'
        ? JSON.stringify(filters.value[filter])
        : filters.value[filter]
      if(query) query += '&'
      query += `${filter}=${value}`
    }
    query += '&export=true'

    try {
      const response = await fetch(`/reports/projectsOverview?${query}`)
      if (!response.ok) throw new Error(t('exportFailed'))

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = t('excelFileName')
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      alert(t('exportFailedAlert'))
    }
  }

  watch([page, itemsPerPage], fetchProjects)
  watch(itemsPerPage, () => {
    page.value = 1
    fetchProjects()
  })

  onMounted(() => {
    fetchProjects()
    getHierarchyAsync('component')
  })
</script>

<style scoped>
.v-card-title {
  padding: 16px 24px;
}

.v-data-table {
  border-radius: 4px;
}

.v-chip-group {
  flex-wrap: wrap;
  gap: 4px;
}

.v-expansion-panel-text__wrapper {
  padding: 16px 24px;
}

.striped-table :deep(.v-data-table__tr:nth-child(odd)) {
  background-color: #f9fafb;  /* Lightest gray */
}
.striped-table :deep(.v-data-table__tr:nth-child(even)) {
  background-color: white;
}
.striped-table :deep(.v-data-table__tr:hover) {
  background-color: #f3f4f6 !important;  /* Slightly darker gray */
}

/* Optional: Add animation to the hover effect */
.striped-table :deep(.v-data-table__tr) {
  transition: background-color 0.2s ease;
}

/* Optional: Add subtle border between rows */
.striped-table :deep(.v-data-table__tr:not(:last-child)) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}
</style>
