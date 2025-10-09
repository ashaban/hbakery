<template>
  <v-container fluid>
    <!-- 🔍 FILTERS -->
    <v-card class="pa-4 mb-4">
      <v-row dense>
        <v-col cols="12" sm="3">
          <v-autocomplete
            v-model="filters.item_id"
            :items="items"
            item-title="name"
            item-value="id"
            label="Filter by Item"
            clearable
          />
        </v-col>

        <v-col cols="12" sm="2">
          <v-select
            v-model="filters.date_operator"
            :items="dateOperators"
            item-title="label"
            item-value="value"
            label="Date Filter"
            clearable
          />
        </v-col>

        <v-col cols="12" sm="3" v-if="filters.date_operator && filters.date_operator !== 'in'">
          <VueDatePicker
            v-model="filters.date"
            auto-apply
            :teleport="true"
            class="rounded-lg border px-4 py-2"
            placeholder="Select Date"
            model-type="yyyy-MM-dd"
            format="dd-MM-yyyy"
          />
        </v-col>

        <v-col cols="12" sm="4" v-if="filters.date_operator === 'in'">
          <div class="d-flex align-center">
            <VueDatePicker
              v-model="filters.date_from"
              auto-apply
              :teleport="true"
              class="rounded-lg border px-4 py-2"
              placeholder="From Date"
              model-type="yyyy-MM-dd"
              format="dd-MM-yyyy"
            />
            <VueDatePicker
              v-model="filters.date_to"
              auto-apply
              :teleport="true"
              class="rounded-lg border px-4 py-2"
              placeholder="To Date"
              model-type="yyyy-MM-dd"
              format="dd-MM-yyyy"
            />
          </div>
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

    <!-- 🧾 TOTAL SUMMARY -->
    <v-alert type="info" class="mb-4" border="start" variant="outlined">
      <strong>Total Quantity:</strong> {{ totals.total_quantity || '0' }} |
      <strong>Total Amount:</strong> {{ totals.total_amount || '0.00' }}
    </v-alert>

    <!-- 📋 HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h3>Items Purchased</h3>
      <v-btn color="primary" class="text-white" size="small" @click="openAddDialog">
        <v-icon start>mdi-plus</v-icon> Add New
      </v-btn>
    </div>

    <!-- TABLE -->
    <v-progress-linear :active="loading" :indeterminate="loading" />
    <v-data-table
      class="elevation-1"
      dense
      :headers="headers"
      :items="values"
      :loading="loading"
      height="400"
    >
      <template #item.edit="{ item }">
        <v-icon color="primary" @click="openEditDialog(item)">mdi-square-edit-outline</v-icon>
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

    <!-- 🟢 ADD PURCHASE DIALOG -->
    <v-dialog v-model="addDialog" max-width="600" transition="dialog-top-transition">
      <v-card class="pa-4 rounded-xl" elevation="10">
        <v-toolbar color="primary" flat class="rounded-lg">
          <v-toolbar-title class="text-white font-weight-bold">
            <v-icon start class="mr-2 text-white">mdi-cart-plus</v-icon> Add Purchase
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" color="white" @click="addDialog = false" />
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <v-autocomplete
              v-model="form.item_id"
              :items="items"
              item-title="name"
              item-value="id"
              label="Item"
              bg-color="#E0E0E0"
              :error-messages="v$.item_id.$errors.map(e => e.$message)"
              @blur="v$.item_id.$touch"
            />

            <v-text-field
              v-model="form.quantity"
              label="Quantity"
              type="number"
              bg-color="#E0E0E0"
              :error-messages="v$.quantity.$errors.map(e => e.$message)"
              @blur="v$.quantity.$touch"
            />

            <v-text-field
              v-model="form.price"
              label="Unit Price"
              type="number"
              bg-color="#E0E0E0"
              :error-messages="v$.price.$errors.map(e => e.$message)"
              @blur="v$.price.$touch"
            />

            <v-text-field
              v-model="form.date"
              label="Purchase Date"
              type="date"
              bg-color="#E0E0E0"
              :error-messages="v$.date.$errors.map(e => e.$message)"
              @blur="v$.date.$touch"
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end">
          <v-btn color="grey" @click="addDialog = false">Cancel</v-btn>
          <v-btn color="success" :loading="saving" :disabled="v$.$invalid" @click="createPurchase">
            <v-icon start>mdi-plus</v-icon> Add
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 🟡 EDIT PURCHASE DIALOG -->
    <v-dialog v-model="editDialog" max-width="600" transition="dialog-top-transition">
      <v-card class="pa-4 rounded-xl" elevation="10">
        <v-toolbar color="primary" flat class="rounded-lg">
          <v-toolbar-title class="text-white font-weight-bold">
            <v-icon start class="mr-2 text-white">mdi-cart-edit</v-icon> Edit Purchase
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon="mdi-close" color="white" @click="editDialog = false" />
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <v-autocomplete
              v-model="form.item_id"
              :items="items"
              item-title="name"
              item-value="id"
              label="Item"
              bg-color="#E0E0E0"
              :error-messages="v$.item_id.$errors.map(e => e.$message)"
              @blur="v$.item_id.$touch"
            />
            <v-text-field
              v-model="form.quantity"
              label="Quantity"
              type="number"
              bg-color="#E0E0E0"
              :error-messages="v$.quantity.$errors.map(e => e.$message)"
              @blur="v$.quantity.$touch"
            />
            <v-text-field
              v-model="form.price"
              label="Unit Price"
              type="number"
              bg-color="#E0E0E0"
              :error-messages="v$.price.$errors.map(e => e.$message)"
              @blur="v$.price.$touch"
            />
            <v-text-field
              v-model="form.date"
              label="Purchase Date"
              type="date"
              bg-color="#E0E0E0"
              :error-messages="v$.date.$errors.map(e => e.$message)"
              @blur="v$.date.$touch"
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end">
          <v-btn color="error" @click="deletePurchase">
            <v-icon start>mdi-delete</v-icon> Delete
          </v-btn>
          <v-btn color="success" :loading="saving" :disabled="v$.$invalid" @click="updatePurchase">
            <v-icon start>mdi-content-save</v-icon> Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useVuelidate } from '@vuelidate/core'
import { required, integer, numeric } from '@vuelidate/validators'

const store = useStore()
const loading = ref(false)
const saving = ref(false)
const values = ref([])
const items = ref([])
const addDialog = ref(false)
const editDialog = ref(false)
const editingId = ref(null)
const page = ref(1)
const totalPages = ref(1)
const limit = 10
const totals = reactive({ total_quantity: '', total_amount: '' })
const form = reactive({ item_id: '', quantity: '', price: '', date: '' })

const rules = {
  item_id: { required },
  quantity: { required, integer },
  price: { required, numeric },
  date: { required }
}
const v$ = useVuelidate(rules, form)

const dateOperators = [
  { label: 'Equals (=)', value: '=' },
  { label: 'Greater Than (>)', value: '>' },
  { label: 'Less Than (<)', value: '<' },
  { label: 'Greater or Equal (>=)', value: '>=' },
  { label: 'Less or Equal (<=)', value: '<=' },
  { label: 'In Range', value: 'in' }
]

const filters = reactive({
  item_id: '',
  date_operator: '',
  date: '',
  date_from: '',
  date_to: ''
})

const headers = [
  { title: 'Item', key: 'item_name' },
  { title: 'Quantity', key: 'quantity' },
  { title: 'Unit Price', key: 'price' },
  { title: 'Amount', key: 'total' },
  { title: 'Date', key: 'date' },
  { title: 'Edit', key: 'edit' }
]

function formatDate(value) {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  return `${d}-${m}-${y}`
}

// Load Purchases
async function loadValues() {
  loading.value = true
  const params = new URLSearchParams({ page: page.value, limit })
  if (filters.item_id) params.append('item_id', filters.item_id)
  if (filters.date_operator && filters.date_operator !== 'in' && filters.date) {
    const map = { '=': 'date', '>': 'date_gt', '<': 'date_lt', '>=': 'date_from', '<=': 'date_to' }
    params.append(map[filters.date_operator], filters.date)
  }
  if (filters.date_operator === 'in' && filters.date_from && filters.date_to) {
    params.append('date_from', filters.date_from)
    params.append('date_to', filters.date_to)
  }

  try {
    const res = await fetch(`/purchases?${params}`)
    const data = await res.json()
    values.value = data.data
    totalPages.value = data.totalPages
    totals.total_quantity = data.total_quantity
    totals.total_amount = data.total_amount
  } catch {
    store.commit('setMessage', { type: 'error', text: 'Failed to load purchases' })
  } finally {
    loading.value = false
  }
}

async function loadItems() {
  const res = await fetch('/items')
  items.value = await res.json()
}

function applyFilters() {
  page.value = 1
  loadValues()
}

function resetFilters() {
  Object.assign(filters, { item_id: '', date_operator: '', date: '', date_from: '', date_to: '' })
  page.value = 1
  loadValues()
}

function openAddDialog() {
  Object.assign(form, { item_id: '', quantity: '', price: '', date: '' })
  v$.value.$reset()
  addDialog.value = true
}

function openEditDialog(item) {
  Object.assign(form, {
    item_id: item.item_id,
    quantity: item.quantity.replace(/,/g, ''),
    price: item.price.replace(/,/g, ''),
    date: item?.date?.split('-')?.reverse()?.join('-')
  })
  editingId.value = item.id
  v$.value.$reset()
  editDialog.value = true
}

// ---- SUBMIT USING FORMDATA ----
async function createPurchase() {
  v$.value.$touch()
  if (v$.value.$invalid) return
  saving.value = true

  const fd = new FormData()
  fd.append('item_id', form.item_id)
  fd.append('quantity', form.quantity)
  fd.append('price', form.price)
  fd.append('date', form.date)

  try {
    await fetch('/purchases', { method: 'POST', body: fd })
    store.commit('setMessage', { type: 'success', text: 'Purchase added successfully!' })
    addDialog.value = false
    loadValues()
  } catch {
    store.commit('setMessage', { type: 'error', text: 'Failed to add purchase' })
  } finally {
    saving.value = false
  }
}

async function updatePurchase() {
  v$.value.$touch()
  if (v$.value.$invalid) return
  saving.value = true

  const fd = new FormData()
  fd.append('item_id', form.item_id)
  fd.append('quantity', form.quantity)
  fd.append('price', form.price)
  fd.append('date', form.date)

  try {
    await fetch(`/purchases/${editingId.value}`, { method: 'PUT', body: fd })
    store.commit('setMessage', { type: 'success', text: 'Purchase updated!' })
    editDialog.value = false
    loadValues()
  } catch {
    store.commit('setMessage', { type: 'error', text: 'Failed to update purchase' })
  } finally {
    saving.value = false
  }
}

async function deletePurchase() {
  if (!confirm('Are you sure you want to delete this purchase?')) return
  saving.value = true
  try {
    await fetch(`/purchases/${editingId.value}`, { method: 'DELETE' })
    store.commit('setMessage', { type: 'success', text: 'Purchase deleted!' })
    editDialog.value = false
    loadValues()
  } catch {
    store.commit('setMessage', { type: 'error', text: 'Failed to delete purchase' })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadValues()
  loadItems()
})
</script>

<style scoped>
.v-alert strong {
  font-weight: 600;
}
</style>
