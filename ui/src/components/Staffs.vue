<template>
  <v-container fluid>
    <!-- 🔍 FILTERS -->
    <v-card class="pa-4 mb-4">
      <v-row dense>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model="filters.search"
            label="Search Staff Name"
            clearable
            append-inner-icon="mdi-close-circle"
            @click:append-inner="filters.search = ''"
          />
        </v-col>
        <v-col cols="12" sm="3">
          <v-select
            v-model="filters.status"
            :items="['Active', 'Resigned', 'Terminated']"
            label="Filter by Status"
            clearable
          />
        </v-col>
        <v-col cols="12" class="d-flex justify-end">
          <v-btn color="primary" @click="applyFilters">
            <v-icon start>mdi-filter</v-icon> Apply
          </v-btn>
          <v-btn class="ml-2" color="grey" @click="resetFilters">
            <v-icon start>mdi-refresh</v-icon> Reset
          </v-btn>
        </v-col>
      </v-row>
    </v-card>

    <!-- 📊 HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h3>Staff Management</h3>
      <v-btn color="primary" class="text-white" size="small" @click="activateAddDialog">
        <v-icon start>mdi-plus</v-icon> Add Staff
      </v-btn>
    </div>

    <!-- LOADING BAR -->
    <v-progress-linear :active="loading" :indeterminate="loading" />

    <!-- STAFF TABLE -->
    <v-data-table
      class="elevation-1"
      dense
      :headers="headers"
      :items="values"
      :loading="loading"
      height="420"
    >
      <template #item.salary="{ item }">
        {{ formatCurrency(item.salary) }}
      </template>

      <template #item.status="{ item }">
        <v-chip
          :color="statusColor(item.status)"
          size="small"
          label
        >
          {{ item.status }}
        </v-chip>
      </template>

      <template #item.edit="{ item }">
        <v-icon color="primary" @click="activateEditDialog(item)">
          mdi-square-edit-outline
        </v-icon>
      </template>
    </v-data-table>

    <!-- PAGINATION -->
    <div class="d-flex justify-end align-center mt-4">
      <v-pagination
        v-model="page"
        :length="totalPages"
        total-visible="7"
        @update:modelValue="loadValues"
      />
    </div>

    <!-- ADD / EDIT DIALOG -->
    <v-dialog v-model="dialog" transition="dialog-top-transition" max-width="600">
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg flex-wrap px-4" color="primary" flat>
          <div class="d-flex align-center flex-wrap">
            <v-icon class="mr-2 text-white">mdi-account</v-icon>
            <span class="text-white font-weight-bold text-h6">
              {{ isEditing ? 'Edit Staff' : 'Add Staff' }}
            </span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="dialog = false" />
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <v-text-field
              v-model="state.name"
              label="Full Name"
              bg-color="#E0E0E0"
              required
              :error-messages="v$.name.$errors.map(e => e.$message)"
              @blur="v$.name.$touch"
            />

            <v-text-field
              v-model="state.phone"
              label="Phone Number"
              bg-color="#E0E0E0"
            />

            <v-text-field
              v-model="state.position"
              label="Position"
              bg-color="#E0E0E0"
            />

            <v-text-field
              v-model="state.salary"
              label="Salary (TSh)"
              type="number"
              bg-color="#E0E0E0"
              required
              :error-messages="v$.salary.$errors.map(e => e.$message)"
              @blur="v$.salary.$touch"
            />

            <v-select
              v-model="state.status"
              :items="['Active', 'Resigned', 'Terminated']"
              label="Status"
              bg-color="#E0E0E0"
              required
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end">
          <v-btn
            color="success"
            :loading="loading"
            :disabled="v$.$invalid"
            @click="saveStaff"
          >
            <v-icon start>mdi-content-save</v-icon>
            {{ isEditing ? 'Save Changes' : 'Add Staff' }}
          </v-btn>

          <v-btn
            v-if="isEditing"
            color="error"
            @click="confirmDeleteDialog = true"
          >
            <v-icon start>mdi-delete</v-icon> Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- CONFIRM DELETE -->
    <v-dialog v-model="confirmDeleteDialog" persistent width="400">
      <v-card>
        <v-toolbar color="warning" :title="'Confirm Deleting ' + state.name">
          <v-btn color="white" icon="mdi-close" @click="confirmDeleteDialog = false" />
        </v-toolbar>
        <v-card-text>Are you sure you want to delete {{ state.name }}?</v-card-text>
        <v-card-actions class="d-flex justify-end">
          <v-btn color="grey" @click="confirmDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="removeStaff">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useVuelidate } from '@vuelidate/core'
import { required, minValue } from '@vuelidate/validators'
import { useStore } from 'vuex'

// store
const store = useStore()
const loading = ref(false)
const dialog = ref(false)
const confirmDeleteDialog = ref(false)
const isEditing = ref(false)
const editingId = ref(null)

// pagination & data
const page = ref(1)
const totalPages = ref(1)
const limit = 10
const values = ref([])
const totals = reactive({ total_staff: '' })

// filters
const filters = reactive({
  search: '',
  status: ''
})

// table headers
const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Phone', key: 'phone' },
  { title: 'Position', key: 'position' },
  { title: 'Salary', key: 'salary' },
  { title: 'Hired Date', key: 'hired_at' },
  { title: 'Status', key: 'status' },
  { title: 'Edit', key: 'edit' }
]

// form state
const state = reactive({
  name: '',
  phone: '',
  position: '',
  salary: '',
  status: 'Active'
})

// validation
const rules = {
  name: { required },
  salary: { required, minValue: minValue(0) }
}
const v$ = useVuelidate(rules, state)

// helpers
const formatCurrency = val =>
  val ? Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 }) + ' TSh' : '0 TSh'

const statusColor = status => {
  switch (status) {
    case 'Active': return 'green'
    case 'Resigned': return 'orange'
    case 'Terminated': return 'red'
    default: return 'grey'
  }
}

// load data
async function loadValues() {
  loading.value = true
  const params = new URLSearchParams({
    page: page.value,
    limit,
  })
  if (filters.search) params.append('search', filters.search)
  if (filters.status) params.append('status', filters.status)

  try {
    const res = await fetch(`/staffs?${params.toString()}`)
    const data = await res.json()
    values.value = data.data || []
    totalPages.value = data.totalPages || 1
    totals.total_staff = data.totalRecords || 0
  } catch (err) {
    console.error(err)
    store.commit('setMessage', { type: 'error', text: 'Failed to load staff' })
  } finally {
    loading.value = false
  }
}

// filter actions
function applyFilters() {
  page.value = 1
  loadValues()
}
function resetFilters() {
  filters.search = ''
  filters.status = ''
  page.value = 1
  loadValues()
}

// dialogs
function activateAddDialog() {
  isEditing.value = false
  Object.assign(state, { name: '', phone: '', position: '', salary: '', status: 'Active' })
  dialog.value = true
  v$.value.$reset()
}

function activateEditDialog(item) {
  isEditing.value = true
  editingId.value = item.id
  Object.assign(state, item)
  dialog.value = true
  v$.value.$reset()
}

// save
async function saveStaff() {
  v$.value.$touch()
  if (v$.value.$invalid) return

  loading.value = true
  const formData = new FormData()
  formData.append('name', state.name)
  formData.append('phone', state.phone)
  formData.append('position', state.position)
  formData.append('salary', state.salary)
  formData.append('status', state.status)

  const url = isEditing.value ? `/staffs/${editingId.value}` : '/staffs'
  const method = isEditing.value ? 'PUT' : 'POST'

  try {
    const res = await fetch(url, { method, body: formData })
    if (!res.ok) throw new Error('Failed to save')
    dialog.value = false
    loadValues()
    store.commit('setMessage', {
      type: 'success',
      text: isEditing.value ? 'Staff updated!' : 'Staff added!'
    })
  } catch {
    store.commit('setMessage', { type: 'error', text: 'Failed to save staff' })
  } finally {
    loading.value = false
  }
}

// delete
async function removeStaff() {
  loading.value = true
  try {
    await fetch(`/staffs/${editingId.value}`, { method: 'DELETE' })
    confirmDeleteDialog.value = false
    dialog.value = false
    loadValues()
    store.commit('setMessage', { type: 'success', text: 'Staff deleted!' })
  } catch {
    store.commit('setMessage', { type: 'error', text: 'Failed to delete staff' })
  } finally {
    loading.value = false
  }
}

onMounted(() => loadValues())
</script>

<style scoped>
.v-alert strong {
  font-weight: 600;
}
</style>
