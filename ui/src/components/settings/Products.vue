<template>
  <v-container fluid>
    <!-- 🔍 FILTERS -->
    <v-card class="pa-4 mb-4">
      <v-row dense>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model="filters.search"
            label="Search Product Name"
            clearable
            append-inner-icon="mdi-close-circle"
            @click:append-inner="filters.search = ''"
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

    <!-- 🧾 TOTAL SUMMARY -->
    <v-alert type="info" class="mb-4" border="start" variant="outlined">
      <strong>Total Products:</strong> {{ totals.total_products || '0' }}
    </v-alert>

    <!-- 📋 HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h3>Products</h3>
      <v-btn color="primary" class="text-white" size="small" @click="activateAddDialog">
        <v-icon start>mdi-plus</v-icon> Add Product
      </v-btn>
    </div>

    <!-- LOADING BAR -->
    <v-progress-linear :active="loading" :indeterminate="loading" />

    <!-- TABLE -->
    <v-data-table
      class="elevation-1"
      dense
      :headers="headers"
      :items="values"
      :loading="loading"
      height="400"
    >
      <template #item.actions="{ item }">
        <v-icon color="primary" class="mr-2" @click="activateEditDialog(item)">
          mdi-square-edit-outline
        </v-icon>
        <v-icon color="green" @click="viewIngredients(item)">
          mdi-eye
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

    <!-- ADD / EDIT PRODUCT DIALOG -->
    <v-dialog v-model="dialog" transition="dialog-top-transition" max-width="900">
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg flex-wrap px-4" color="primary" flat>
          <div class="d-flex align-center flex-wrap">
            <v-icon class="mr-2 text-white">mdi-package-variant</v-icon>
            <span class="text-white font-weight-bold text-h6">
              {{ isEditing ? 'Edit Product' : 'Add Product' }}
            </span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="dialog = false" />
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="state.name"
                  label="Product Name"
                  bg-color="#E0E0E0"
                  required
                  :error-messages="v$.name.$errors.map(e => e.$message)"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="state.unit"
                  label="Unit (e.g. Loaf, Pack)"
                  bg-color="#E0E0E0"
                  required
                  :error-messages="v$.unit.$errors.map(e => e.$message)"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="state.description"
                  label="Description"
                  bg-color="#E0E0E0"
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="state.price"
                  label="Price"
                  type="number"
                  prefix="TSh "
                  bg-color="#E0E0E0"
                  required
                  :error-messages="v$.price.$errors.map(e => e.$message)"
                />
              </v-col>
            </v-row>

            <!-- 🧩 Product Items Section -->
            <v-divider class="my-4"></v-divider>
            <h4>Product Items (Ingredients)</h4>

            <v-alert
              v-if="v$.items.$error"
              type="error"
              class="mb-2"
              border="start"
              variant="outlined"
            >
              Each ingredient must have Item and Quantity.
            </v-alert>

            <v-row
              v-for="(it, index) in state.items"
              :key="index"
              dense
              align="center"
              class="mb-2"
            >
              <!-- Item selection -->
              <v-col cols="12" sm="6">
                <v-autocomplete
                  v-model="it.item_id"
                  :items="availableItems(index)"
                  item-title="name"
                  item-value="id"
                  label="Item"
                  dense
                  clearable
                  :error="v$.items.$dirty && !it.item_id"
                  :error-messages="v$.items.$dirty && !it.item_id ? ['Item required'] : []"
                  @update:modelValue="onItemChange(it)"
                />
              </v-col>

              <!-- Quantity per unit -->
              <v-col cols="12" sm="5">
                <v-text-field
                  v-model="it.quantity_per_unit"
                  type="number"
                  :label="`Item Quantity in ${it.unit || ''}`"
                  dense
                  :error="v$.items.$dirty && (!it.quantity_per_unit || it.quantity_per_unit <= 0)"
                  :error-messages="v$.items.$dirty && (!it.quantity_per_unit || it.quantity_per_unit <= 0) ? ['Quantity > 0 required'] : []"
                  @input="v$.items.$touch()"
                />
              </v-col>

              <v-col cols="12" sm="1" class="d-flex justify-end">
                <v-btn icon color="error" size="small" @click="removeItem(index)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </v-row>

            <!-- Add new ingredient -->
            <div class="d-flex justify-end mt-2">
              <v-btn color="primary" size="small" @click="addItem">
                <v-icon start>mdi-plus</v-icon> Add Ingredient
              </v-btn>
            </div>

            <!-- Colored summary -->
            <div
              class="mt-4 text-caption font-weight-medium d-flex align-center"
              :class="{
                'text-success': ingredientSummaryColor === 'success',
                'text-error': ingredientSummaryColor === 'error'
              }"
            >
              <v-icon size="small" :color="ingredientSummaryColor" class="mr-1">
                mdi-information
              </v-icon>
              {{ ingredientSummary }}
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end mt-2">
          <v-btn
            color="success"
            :loading="loading"
            :disabled="v$.$invalid"
            @click="saveProduct"
          >
            <v-icon start>mdi-content-save</v-icon>
            {{ isEditing ? 'Save Changes' : 'Add Product' }}
          </v-btn>
          <v-btn v-if="isEditing" color="error" @click="confirmDeleteDialog = true">
            <v-icon start>mdi-delete</v-icon> Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="viewDialog" max-width="550">
      <v-card border elevation="0" rounded="xl">
        <!-- Custom Header -->
        <div class="bg-primary pa-6 rounded-t-xl">
          <div class="d-flex align-center">
            <v-avatar color="white" size="48" class="mr-4">
              <v-icon icon="mdi-silverware-fork-knife" color="primary" size="24" />
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold text-white">
                {{ viewedProduct?.name }}
              </div>
              <div class="text-body-2 text-white mt-1">
                Ingredients Breakdown
              </div>
            </div>
            <v-spacer />
            <v-btn
              icon="mdi-close"
              variant="text"
              color="white"
              size="small"
              @click="viewDialog = false"
            />
          </div>
        </div>

        <v-card-text class="pa-0">
          <!-- Ingredients -->
          <div class="pa-4">
            <div v-if="!viewedProductItems?.length" class="text-center py-8">
              <v-icon icon="mdi-food-off" size="48" color="grey" class="mb-3" />
              <div class="text-h6 text-grey">No Ingredients</div>
              <div class="text-body-2 text-grey mt-1">
                Add ingredients to see them listed here
              </div>
            </div>

            <div v-else class="ingredients-grid">
              <v-card
                v-for="(ingredient, index) in viewedProductItems"
                :key="ingredient.id || index"
                variant="outlined"
                border
                class="mb-3 rounded-lg"
                hover
              >
                <v-card-text class="pa-4">
                  <div class="d-flex align-center">
                    <div class="flex-grow-1">
                      <div class="text-body-1 font-weight-medium">
                        {{ ingredient.item_name }}
                      </div>
                      <div class="d-flex align-center mt-2">
                        <v-chip
                          size="small"
                          color="primary"
                          variant="flat"
                          class="mr-2"
                        >
                          {{ ingredient.quantity_per_unit }} {{ ingredient.unit }}
                        </v-chip>
                        <v-icon icon="mdi-scale-balance" size="16" color="grey" class="mr-1" />
                        <span class="text-caption text-grey">Required</span>
                      </div>
                    </div>
                    <v-avatar color="primary" size="32" variant="tonal">
                      <span class="text-primary text-caption font-weight-bold">
                        {{ index + 1 }}
                      </span>
                    </v-avatar>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </div>
        </v-card-text>
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
          <v-btn color="error" @click="removeProduct">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useVuelidate } from '@vuelidate/core'
import { required, minValue, helpers } from '@vuelidate/validators'

const store = useStore()
const loading = ref(false)
const values = ref([])
const dialog = ref(false)
const confirmDeleteDialog = ref(false)
const viewDialog = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const viewedProduct = ref(null)
const viewedProductItems = ref([])
const items = ref([])
const page = ref(1)
const totalPages = ref(1)
const limit = 10
const totals = reactive({ total_products: '' })
const filters = reactive({ search: '' })

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Description', key: 'description' },
  { title: 'Unit', key: 'unit' },
  { title: 'Price', key: 'price' },
  { title: 'Actions', key: 'actions' }
]

const state = reactive({
  name: '',
  description: '',
  unit: '',
  price: '',
  items: []
})

// validation rules
const hasAtLeastOneItem = helpers.withMessage(
  'At least one ingredient is required',
  v => Array.isArray(v) && v.length > 0
)
const validItems = helpers.withMessage(
  'Each ingredient must have item and quantity',
  v => Array.isArray(v) && v.every(it => it.item_id && it.quantity_per_unit && Number(it.quantity_per_unit) > 0)
)
const rules = {
  name: { required },
  unit: { required },
  price: { required, minValue: minValue(1) },
  items: { hasAtLeastOneItem, validItems }
}
const v$ = useVuelidate(rules, state)

// computed
const ingredientSummary = computed(() => {
  const total = state.items.length
  const incomplete = state.items.filter(it => !it.item_id || !it.quantity_per_unit).length
  if (total === 0) return 'No ingredients added yet.'
  if (incomplete > 0) return `${total} ingredient(s) added, ${incomplete} incomplete.`
  return `${total} ingredient(s) added and complete.`
})
const ingredientSummaryColor = computed(() => {
  const incomplete = state.items.some(it => !it.item_id || !it.quantity_per_unit)
  return incomplete ? 'error' : 'success'
})

// 🧩 Prevent duplicate items
function availableItems(index) {
  const selectedIds = state.items.map((it, i) => (i !== index ? it.item_id : null)).filter(Boolean)
  return items.value.filter(i => !selectedIds.includes(i.id))
}

// 🧩 Item selection
function onItemChange(it) {
  v$.value.items.$touch()
  const selected = items.value.find(i => i.id === it.item_id)
  it.unit = selected ? selected.unit : ''
}

// Manage ingredients
function addItem() {
  state.items.push({ item_id: '', quantity_per_unit: '', unit: '' })
  v$.value.items.$touch()
}
function removeItem(index) {
  state.items.splice(index, 1)
  v$.value.items.$touch()
}

// Data functions
async function loadItems() {
  const res = await fetch('/items')
  items.value = await res.json()
}
async function loadValues() {
  loading.value = true
  const params = new URLSearchParams({ page: page.value, limit })
  if (filters.search) params.append('search', filters.search)
  try {
    const res = await fetch(`/products?${params}`)
    const data = await res.json()
    values.value = data.data || []
    totalPages.value = data.totalPages || 1
    totals.total_products = data.totalRecords || 0
  } finally {
    loading.value = false
  }
}

// Filters
function applyFilters() {
  page.value = 1
  loadValues()
}
function resetFilters() {
  filters.search = ''
  page.value = 1
  loadValues()
}

// Dialog control
function activateAddDialog() {
  isEditing.value = false
  Object.assign(state, { name: '', description: '', unit: '', price: '', items: [] })
  dialog.value = true
  v$.value.$reset()
}

async function activateEditDialog(item) {
  isEditing.value = true
  editingId.value = item.id
  loading.value = true
  try {
    const res = await fetch(`/products/${item.id}`)
    const data = await res.json()
    const product = data.product || data
    Object.assign(state, {
      name: product.name,
      description: product.description,
      unit: product.unit,
      price: product.price,
      items: (data.items || product.items || []).map(i => ({
        item_id: i.item_id,
        quantity_per_unit: i.quantity_per_unit,
        unit: i.unit
      }))
    })
    dialog.value = true
  } finally {
    loading.value = false
  }
}

// 👁 View ingredients
async function viewIngredients(item) {
  viewedProduct.value = item
  const res = await fetch(`/products/${item.id}`)
  const data = await res.json()
  viewedProductItems.value = data.items || []
  viewDialog.value = true
}

// Save & delete
async function saveProduct() {
  v$.value.$touch()
  if (v$.value.$invalid) return

  loading.value = true
  const formData = new FormData()
  formData.append('name', state.name)
  formData.append('description', state.description)
  formData.append('unit', state.unit)
  formData.append('price', state.price)
  formData.append('items', JSON.stringify(state.items))

  const url = isEditing.value ? `/products/${editingId.value}` : '/products'
  const method = isEditing.value ? 'PUT' : 'POST'
  try {
    const res = await fetch(url, { method, body: formData })
    if (!res.ok) throw new Error('Failed to save')
    dialog.value = false
    loadValues()
    store.commit('setMessage', {
      type: 'success',
      text: isEditing.value ? 'Product updated!' : 'Product added!'
    })
  } catch {
    store.commit('setMessage', { type: 'error', text: 'Failed to save product' })
  } finally {
    loading.value = false
  }
}

async function removeProduct() {
  loading.value = true
  await fetch(`/products/${editingId.value}`, { method: 'DELETE' })
  confirmDeleteDialog.value = false
  dialog.value = false
  loadValues()
  store.commit('setMessage', { type: 'success', text: 'Product deleted!' })
  loading.value = false
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
