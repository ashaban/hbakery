<template>
  <v-container class="pa-6" fluid>
    <v-dialog v-model="viewDialog" max-width="1000" scrollable>
      <view-project :project="selectedItem" />
    </v-dialog>
    <v-dialog v-model="viewAgroEnterDialog" max-width="1000" scrollable>
      <view-agriculture-enterprise :organization="selectedItem" />
    </v-dialog>
    <v-card class="elevation-3">
      <v-card-title class="d-flex justify-space-between align-center bg-primary">
        <span class="text-h5 font-weight-bold white--text">{{ $t(title) }}</span>
        <v-btn
          v-if="showActions"
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
                <v-col cols="12" md="4">
                  <v-select
                    v-model="filters.program"
                    clearable
                    density="comfortable"
                    item-title="name"
                    item-value="id"
                    :items="programs"
                    :label="$t('flagshipProgramLabel')"
                    variant="outlined"
                  />
                  <v-select
                    v-model="filters.status"
                    clearable
                    density="comfortable"
                    item-title="name"
                    item-value="id"
                    :items="statuses"
                    :label="$t('statusLabel')"
                    variant="outlined"
                  />

                  <v-select
                    v-model="filters.project_type"
                    class="mt-3"
                    clearable
                    density="comfortable"
                    item-title="name"
                    item-value="id"
                    :items="projectTypes"
                    :label="$t('projectTypeLabel')"
                    variant="outlined"
                  />

                  <v-autocomplete
                    v-model="filters.value_chain"
                    class="mt-3"
                    clearable
                    density="comfortable"
                    item-title="name"
                    item-value="id"
                    :items="valueChains"
                    :label="$t('valueChainLabel')"
                    variant="outlined"
                  />

                  <div class="mt-3">
                    <v-label>{{ $t('startYearLabel') }}</v-label>
                    <VueDatePicker
                      v-model="filters.start_date"
                      auto-apply
                      class="mt-1"
                      :placeholder="$t('selectPlaceholder')"
                      text-input
                      year-picker
                      :year-range="[$store.state.startYear, $store.state.endYear]"
                    />
                  </div>

                  <div class="mt-3">
                    <v-label>{{ $t('endYearLabel') }}</v-label>
                    <VueDatePicker
                      v-model="filters.end_date"
                      auto-apply
                      class="mt-1"
                      :placeholder="$t('selectPlaceholder')"
                      text-input
                      year-picker
                      :year-range="[$store.state.startYear, $store.state.endYear]"
                    />
                  </div>
                </v-col>

                <v-col cols="12" md="4">
                  <v-autocomplete
                    v-model="filters.project_owner"
                    clearable
                    density="comfortable"
                    item-title="abbrev"
                    item-value="id"
                    :items="implementing_partners"
                    :label="$t('projectOwnerLabel')"
                    variant="outlined"
                  />

                  <v-autocomplete
                    v-model="filters.implementing_partners"
                    chips
                    class="mt-3"
                    clearable
                    density="comfortable"
                    item-title="abbrev"
                    item-value="id"
                    :items="implementing_partners"
                    :label="$t('implementingPartnersLabel')"
                    multiple
                    variant="outlined"
                  />

                  <v-autocomplete
                    v-model="filters.collaborating_partners"
                    chips
                    class="mt-3"
                    clearable
                    density="comfortable"
                    item-title="abbrev"
                    item-value="id"
                    :items="implementing_partners"
                    :label="$t('collaboratingPartnersLabel')"
                    multiple
                    variant="outlined"
                  />

                  <v-select
                    v-model="filters.budget_type"
                    class="mt-3"
                    clearable
                    density="comfortable"
                    item-title="name"
                    item-value="id"
                    :items="budget_types"
                    :label="$t('budgetTypeLabel')"
                    variant="outlined"
                  />

                  <v-select
                    v-model="filters.budget_source"
                    class="mt-3"
                    clearable
                    density="comfortable"
                    item-title="name"
                    item-value="id"
                    :items="budget_sources"
                    :label="$t('budgetSourceLabel')"
                    variant="outlined"
                  />
                </v-col>

                <v-col cols="12" md="4">
                  <div class="text-subtitle-2 mb-2">{{ $t('coverageAreasLabel') }}</div>
                  <v-card class="pa-2" style="max-height: 200px; overflow-y: auto;" variant="outlined">
                    <v-treeview
                      v-model="filters.coverages"
                      color="primary"
                      item-title="name"
                      item-value="id"
                      :items="adminHierarchy"
                      :load-children="loadAdminChildren"
                      open-on-click
                      select-strategy="independent"
                      selectable
                      @click:select="coverageSelected"
                    />
                  </v-card>

                  <div v-if="filters.coverages.length" class="mt-3">
                    <div class="text-subtitle-2 mb-1">{{ $t('selectedCoverageLabel') }}:</div>
                    <v-chip
                      v-for="id in filters.coverages"
                      :key="id"
                      class="mr-2 mb-2"
                      closable
                      color="primary"
                      size="small"
                      variant="elevated"
                      @click:close="removeCoverage(id)"
                    >
                      {{ findCoverageNameById(id) }}
                    </v-chip>
                  </div>

                  <div class="text-subtitle-2 mt-3 mb-2">{{ $t('flagshipSubcomponentsLabel') }}</div>
                  <v-card class="pa-2" style="max-height: 200px; overflow-y: auto;" variant="outlined">
                    <v-treeview
                      v-model="filters.subcomponents"
                      color="primary"
                      item-title="name"
                      item-value="id"
                      :items="hierarchies"
                      :load-children="loadChildren"
                      open-on-click
                      select-strategy="leaf"
                      selectable
                      @click:select="subComponentSelected"
                    />
                  </v-card>

                  <div v-if="filters.subcomponents.length" class="mt-3">
                    <div class="text-subtitle-2 mb-1">{{ $t('selectedSubcomponentsLabel') }}:</div>
                    <v-chip
                      v-for="id in filters.subcomponents"
                      :key="id"
                      class="mr-2 mb-2"
                      closable
                      color="green"
                      size="small"
                      variant="elevated"
                      @click:close="removeSubcomponent(id)"
                    >
                      {{ findSubcomponentNameById(id) }}
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
          v-model="selectedProjects"
          v-model:items-per-page="itemsPerPage"
          class="elevation-1 striped-table"
          density="comfortable"
          :headers="headers"
          item-value="id"
          :items="parsedProjects"
          :items-length="totalItems"
          :loading="loading"
          show-current-page
          show-first-last-page
          :show-select="showCheckbox"
          @update:page="handlePageChange"
        >
          <template #item.implementing_partners="{ item }">
            <v-chip-group>
              <v-chip
                v-for="partner in item.implementing_partners"
                :key="partner.name"
                color="primary"
                size="small"
                variant="outlined"
              >
                {{ partner.name }}
              </v-chip>
            </v-chip-group>
          </template>

          <template #item.collaborating_partners="{ item }">
            <v-chip-group>
              <v-chip
                v-for="partner in item.collaborating_partners"
                :key="partner.name"
                color="secondary"
                size="small"
                variant="outlined"
              >
                {{ partner.name }}
              </v-chip>
            </v-chip-group>
          </template>

          <template #item.locations="{ item }">
            <v-chip-group>
              <v-chip
                v-for="loc in item.locations"
                :key="loc.name"
                color="info"
                size="small"
                variant="outlined"
              >
                {{ loc.name }} ({{ loc.type }})
              </v-chip>
            </v-chip-group>
          </template>

          <template #item.value_chains="{ item }">
            <v-chip-group>
              <v-chip
                v-for="chain in item.value_chains"
                :key="chain"
                color="success"
                size="small"
                variant="outlined"
              >
                {{ chain }}
              </v-chip>
            </v-chip-group>
          </template>

          <template #item.sub_components="{ item }">
            <v-chip-group>
              <v-chip
                v-for="subcomp in item.sub_components"
                :key="subcomp"
                color="warning"
                size="small"
                variant="outlined"
              >
                {{ subcomp }}
              </v-chip>
            </v-chip-group>
          </template>

          <template #item.actions="{ item }">
            <v-btn
              color="primary"
              icon="mdi-eye"
              size="small"
              variant="text"
              @click="activateViewDialog(item)"
            />
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
  const { t } = useI18n()
  import useProjectHierarchy from '../../settings/projectHierarchy';
  import ViewProject from '@/views/ViewProject.vue';
  import ViewAgricultureEnterprise from '@/views/ViewAgricultureEnterprise.vue';
  import VueDatePicker from '@vuepic/vue-datepicker';
  import '@vuepic/vue-datepicker/dist/main.css'

  const { getHierarchyAsync, loadChildren, hierarchies } = useProjectHierarchy()
  const props = defineProps({
    select: {
      type: Array,
      default: () => [],
    },
    showActions: {
      type: Boolean,
      default: true,
    },
    title: {
      type: String,
      default: 'projectsOverviewTitle',
    },
    showCheckbox: {
      type: Boolean,
      default: false,
    },
    expandFilters: {
      type: Array,
      default: () => [0],
    },
  })
  const emit = defineEmits(['project-selected'])
  const loading = ref(false)
  const projects = ref([])
  const selectedProjects = ref(props.select || [])
  const selectedItem = ref({})
  const viewDialog = ref(false)
  const viewAgroEnterDialog = ref(false)
  const selectedCoverages = ref([])
  const parsedProjects = ref([])
  const totalItems = ref(0)
  const page = ref(1)
  const itemsPerPage = ref(10)
  const panel = ref(props.expandFilters)

  const filters = ref({
    location: '',
    location_type: '',
    value_chain: '',
    sub_component: '',
    partner: '',
    project_type: '',
    status: '',
    start_date: '',
    end_date: '',
    coverages: [],
    implementing_partners: [],
    collaborating_partners: [],
    subcomponents: [],
    project_owner: '',
    budget_type: '',
    budget_source: '',
  })

  // Computed properties
  const activeFilterCount = computed(() => {
    return Object.values(filters.value).filter(v =>
      v !== '' && v !== null && (Array.isArray(v) ? v.length > 0 : true)
    ).length
  })

  const pageCount = computed(() => {
    return Math.ceil(totalItems.value / itemsPerPage.value)
  })

  const pageFirstItem = computed(() => {
    return (page.value - 1) * itemsPerPage.value + 1
  })

  const pageLastItem = computed(() => {
    const last = page.value * itemsPerPage.value
    return last > totalItems.value ? totalItems.value : last
  })

  watch(selectedProjects, () => {
    emit('project-selected', selectedProjects.value)
  })

  const handlePageChange = newPage => {
    page.value = newPage
    fetchProjects()
  }
  watch(itemsPerPage, () => {
    page.value = 1
    fetchProjects()
  })

  // Rest of your existing script setup...
  const statuses = ref([])
  const programs = ref([])
  const projectTypes = ref([])
  const valueChains = ref([])
  const adminHierarchy = ref([])
  const implementing_partners = ref([])
  const budget_types = ref([])
  const budget_sources = ref([])
  const selectedSubComponent = ref([])

  const headers = [
    { title: t('flagshipProgramHeader'), key: 'programs', width: '150px' },
    { title: t('projectOwnerHeader'), key: 'project_owner', width: '150px' },
    { title: t('budgetHeader'), key: 'total_budget', width: '120px', align: 'end' },
    { title: t('projectTypeHeader'), key: 'project_type', width: '150px' },
    { title: t('statusHeader'), key: 'status', width: '120px' },
    { title: t('startDateHeader'), key: 'start_date', width: '120px' },
    { title: t('endDateHeader'), key: 'end_date', width: '120px' },
    { title: t('implementingPartnersHeader'), key: 'implementing_partners', width: '200px' },
    { title: t('collaboratingPartnersHeader'), key: 'collaborating_partners', width: '200px' },
    { title: t('locationsHeader'), key: 'locations', width: '200px' },
    { title: t('valueChainsHeader'), key: 'value_chains', width: '150px' },
    { title: t('subComponentsHeader'), key: 'sub_components', width: '200px' },
    { title: t('actionsHeader'), key: 'actions', sortable: false, width: '80px' },
  ]

  // Methods
  const removeCoverage = id => {
    const index = filters.value.coverages.indexOf(id)
    if (index > -1) {
      filters.value.coverages.splice(index, 1)
    }
    const idx = selectedCoverages.value.findIndex(ld => ld.id === id)
    if(idx > -1) {
      selectedCoverages.value.splice(idx, 1)
    }
  }

  const removeSubcomponent = id => {
    const index = filters.value.subcomponents.indexOf(id)
    if (index > -1) {
      filters.value.subcomponents.splice(index, 1)
    }
    const idx = selectedSubComponent.value.findIndex(sc => sc.id === id)
    if(idx > -1) {
      selectedSubComponent.value.splice(idx, 1)
    }
  }

  const resetFilters = () => {
    filters.value = {
      location: '',
      location_type: '',
      value_chain: '',
      sub_component: '',
      partner: '',
      project_type: '',
      status: '',
      start_date: '',
      end_date: '',
      coverages: [],
      implementing_partners: [],
      collaborating_partners: [],
      subcomponents: [],
      project_owner: '',
      budget_type: '',
      budget_source: '',
    }
    selectedCoverages.value = []
    selectedSubComponent.value = []
  }

  // Rest of your existing methods...
  const loadAdminChildren = async item => {
    let queries = ''
    if(item.id) {
      const id = item.id.split('-')[1]
      queries = `?parentType=${item.type}&parentId=${id}`
    }
    const res = await fetch(`/adminLevels/getAdminHierarchyAsync${queries}`);
    const children = await res.json();
    if(item.id) {
      item.children = children;
    } else {
      adminHierarchy.value = children;
    }
  }

  function loadImplementingPartners () {
    loading.value = true
    fetch('/project/getPossibleImplementingPartners').then(response => {
      response.json().then(results => {
        loading.value = false
        implementing_partners.value = results
      }).catch(() => {
        loading.value = false
      })
    }).catch(() => {
      loading.value = false
    })
  }

  function loadBudgetType () {
    loading.value = true
    fetch('/settings/getBudgetType').then(response => {
      response.json().then(results => {
        loading.value = false
        budget_types.value = results
      }).catch(() => {
        loading.value = false
      })
    }).catch(() => {
      loading.value = false
    })
  }

  function loadBudgetSource () {
    loading.value = true
    fetch('/settings/getBudgetSource').then(response => {
      response.json().then(results => {
        loading.value = false
        budget_sources.value = results
      }).catch(() => {
        loading.value = false
      })
    }).catch(() => {
      loading.value = false
    })
  }

  function findCoverageNameById (id) {
    const coverage = selectedCoverages.value.find(loc => loc.id === id)
    if(!coverage) {
      return ''
    }
    return coverage.name
  }

  function coverageSelected (item) {
    let nodes = adminHierarchy.value.find(h => h.id === item.path[0])
    item.path.shift()
    if(item.path.length) {
      for(const path of item.path) {
        nodes = nodes.children.find(n => n.id === path)
      }
    }
    nodes = JSON.parse(JSON.stringify(nodes))
    delete nodes.children
    if(item.value) {
      selectedCoverages.value.push(nodes)
    } else {
      const index = selectedCoverages.value.findIndex(ld => ld.id === nodes.id)
      if(index > -1) {
        selectedCoverages.value.splice(index, 1)
      }
    }
  }

  function findSubcomponentNameById (id) {
    const subcomponent = selectedSubComponent.value.find(sc => sc.id === id)
    if(!subcomponent) {
      return ''
    }
    return subcomponent ? subcomponent.name : ''
  }

  function subComponentSelected (item) {
    const area = hierarchies.value.find(h => h.id === item.path[0])
    const program = area.children.find(a => a.id === item.path[1])
    const component = program.children.find(c => c.id === item.path[2])
    const subComp = component.children.find(s => s.id === item.path[3])
    if(item.value) {
      selectedSubComponent.value.push(subComp)
    } else {
      const index = selectedSubComponent.value.findIndex(sc => sc.id === subComp.id)
      if(index > -1) {
        selectedSubComponent.value.splice(index, 1)
      }
    }
  }

  const fetchProjects = async () => {
    loading.value = true
    try {
      let query = ''
      for(const filter in filters.value) {
        let value
        if(Array.isArray(filters.value[filter])) {
          value = JSON.stringify(filters.value[filter])
        } else if (typeof filters.value[filter] === 'object') {
          value = JSON.stringify(filters.value[filter])
        } else {
          value = filters.value[filter]
        }
        if(query) {
          query += '&'
        }
        query += `${filter}=${value}`
      }
      if(query) {
        query += '&'
      }
      query += `page=${page.value}&limit=${itemsPerPage.value}`
      const response = await fetch(`/reports/projectsOverview?${query}`)
      const data = await response.json()
      projects.value = data.items || []
      totalItems.value = data.total || data.length || 0
      parsedProjects.value = projects.value.map(project => ({
        ...project,
        implementing_partners: JSON.parse(project.implementing_partners || '[]'),
        collaborating_partners: JSON.parse(project.collaborating_partners || '[]'),
        locations: JSON.parse(project.locations || '[]'),
        sub_components: JSON.parse(project.sub_components || '[]'),
        value_chains: JSON.parse(project.value_chains || '[]'),
      }))
    } catch (err) {
      console.error(err)
    } finally {
      loading.value = false
    }
  }

  const exportToExcel = async () => {
    let query = ''

    for(const filter in filters.value) {
      let value
      if(Array.isArray(filters.value[filter])) {
        value = JSON.stringify(filters.value[filter])
      } else if (typeof filters.value[filter] === 'object') {
        value = JSON.stringify(filters.value[filter])
      } else {
        value = filters.value[filter]
      }
      if(query) {
        query += '&'
      }
      query += `${filter}=${value}`
    }
    if(query) {
      query += '&'
    }
    query += 'export=true'

    try {
      const response = await fetch(`/reports/projectsOverview?${query}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'projects-overview.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      alert('Failed to export Excel file.')
    }
  }

  function activateViewDialog (item) {
    loading.value = true
    fetch('/project/getEditingProject/' + item.id).then(response => {
      response.json().then(results => {
        selectedItem.value = {
          ...results[0],
          initiativesObjectives: JSON.parse(results[0].initiativesObjectives || '[]'),
          expenditures: JSON.parse(results[0].expenditures || '[]'),
          subcomponents: JSON.parse(results[0].subcomponents || '[]'),
          valuechains: JSON.parse(results[0].valuechains || '[]'),
          coverages: JSON.parse(results[0].coverages || '[]'),
          implementing_partners: JSON.parse(results[0].implementing_partners || '[]'),
          collaborating_partners: JSON.parse(results[0].collaborating_partners || '[]'),
          funders: JSON.parse(results[0].funders || '[]'),
          ton_capacity: JSON.parse(results[0].ton_capacity || '[]'),
          agrointerventions: JSON.parse(results[0].agrointerventions || '[]'),
          sector: JSON.parse(results[0].sector || '{}'),
          name: JSON.parse(results[0].name || '{}'),
          project_status: JSON.parse(results[0].project_status || '{}'),
          project_type: JSON.parse(results[0].project_type || '{}'),
          budget_type: JSON.parse(results[0].budget_type || '{}'),
          budget_source: JSON.parse(results[0].budget_source || '{}'),
        }
        loading.value = false
        if(selectedItem.value.project_type.id === '3B') {
          viewAgroEnterDialog.value = true
        } else {
          viewDialog.value = true
        }
      }).catch(() => {
        loading.value = false
      })
    }).catch(() => {
      loading.value = false
    })
  }

  const loadMeta = async () => {
    const [statusRes, typeRes, valueChainRes, programsRes] = await Promise.all([
      fetch('/settings/getProjectStatus').then(res => res.json()),
      fetch('/settings/getProjectType').then(res => res.json()),
      fetch('/settings/getOECDInterventionSubCat').then(res => res.json()),
      fetch('/settings/getProgram').then(res => res.json()),
    ])
    statuses.value = statusRes
    projectTypes.value = typeRes
    programs.value = programsRes
    valueChains.value = valueChainRes.map(vc => ({
      name: vc.name,
      id: vc.id,
    }))
  }

  watch([page, itemsPerPage], fetchProjects)

  onMounted(() => {
    loadMeta()
    fetchProjects()
    loadAdminChildren({})
    loadImplementingPartners()
    loadBudgetType()
    loadBudgetSource()
    getHierarchyAsync('subcomponent')
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
