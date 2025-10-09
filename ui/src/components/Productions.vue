<template>
  <v-container fluid class="production-container">
    <!-- HEADER SECTION -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h4 font-weight-bold text-primary mb-2">
              Production Management
            </h1>
            <p class="text-body-1 text-grey">
              Manage production batches and assign staff teams
            </p>
          </div>
          <v-btn 
            color="primary" 
            size="large" 
            @click="openAddDialog"
            class="px-6"
            elevation="2"
          >
            <v-icon start size="20">mdi-plus-circle</v-icon>
            New Production
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- STATS CARDS -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" elevation="2" rounded="lg" border>
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar color="blue-lighten-5" size="48" class="mr-3">
                <v-icon color="blue" size="24">mdi-factory</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-blue">
                  {{ productions.length }}
                </div>
                <div class="text-caption text-grey">Total Productions</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" elevation="2" rounded="lg" border>
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar color="green-lighten-5" size="48" class="mr-3">
                <v-icon color="green" size="24">mdi-account-group</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-green">
                  {{ totalStaffAssignments }}
                </div>
                <div class="text-caption text-grey">Staff Assignments</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" elevation="2" rounded="lg" border>
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar color="orange-lighten-5" size="48" class="mr-3">
                <v-icon color="orange" size="24">mdi-chart-line</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-orange">
                  {{ totalUnits }}
                </div>
                <div class="text-caption text-grey">Total Units</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" elevation="2" rounded="lg" border>
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar color="purple-lighten-5" size="48" class="mr-3">
                <v-icon color="purple" size="24">mdi-cash-multiple</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-purple">
                  ${{ totalLaborCost }}
                </div>
                <div class="text-caption text-grey">Labor Cost</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- MAIN TABLE -->
    <v-card elevation="2" rounded="lg" class="mb-4">
      <v-card-text class="pa-0">
        <!-- Table Header -->
        <div class="d-flex align-center pa-4 bg-grey-lighten-4 rounded-t-lg">
          <v-icon color="primary" class="mr-2">mdi-table</v-icon>
          <h3 class="text-h6 font-weight-medium">Production Records</h3>
          <v-spacer />
          <v-text-field
            v-model="search"
            placeholder="Search productions..."
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            class="mr-4"
            style="max-width: 300px;"
          />
          <v-btn variant="outlined" color="primary" size="small">
            <v-icon start>mdi-filter</v-icon>
            Filter
          </v-btn>
        </div>

        <!-- Progress -->
        <v-progress-linear 
          :active="loading" 
          :indeterminate="loading" 
          color="primary"
          height="4"
        />

        <!-- Data Table -->
        <v-data-table
          :headers="enhancedHeaders"
          :items="productions"
          :loading="loading"
          :search="search"
          class="elevation-0"
          density="comfortable"
          hover
        >
          <template #loading>
            <v-skeleton-loader type="table-row@10" />
          </template>

          <template #item.product_name="{ item }">
            <div class="d-flex align-center">
              <v-avatar size="32" color="primary" variant="tonal" class="mr-3">
                <v-icon size="16" color="primary">mdi-package</v-icon>
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ item.product_name }}</div>
                <div class="text-caption text-grey">{{ item.mode }}</div>
              </div>
            </div>
          </template>

          <template #item.qty_product="{ item }">
            <v-chip size="small" color="green" variant="flat">
              <v-icon start size="16">mdi-counter</v-icon>
              {{ item.qty_product }}
            </v-chip>
          </template>

          <template #item.staff_count="{ item }">
            <div class="d-flex align-center">
              <v-avatar size="28" color="blue-lighten-5" class="mr-2">
                <v-icon size="14" color="blue">mdi-account-group</v-icon>
              </v-avatar>
              <span class="font-weight-medium">{{ item.staff_count || 0 }}</span>
            </div>
          </template>

          <template #item.produced_at="{ item }">
            <div class="text-no-wrap">
              {{ formatDate(item.produced_at) }}
            </div>
          </template>

          <template #item.produced_by_name="{ item }">
            <div class="d-flex align-center">
              <v-avatar size="28" color="blue-grey-lighten-5" class="mr-2">
                <v-icon size="14" color="blue-grey">mdi-account</v-icon>
              </v-avatar>
              <span class="font-weight-medium">{{ item.produced_by_name }}</span>
            </div>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex justify-end">
              <v-tooltip location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    color="blue"
                    @click="view(item)"
                  >
                    <v-icon>mdi-eye-outline</v-icon>
                  </v-btn>
                </template>
                <span>View Details</span>
              </v-tooltip>

              <v-tooltip location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    color="green"
                    @click="edit(item)"
                  >
                    <v-icon>mdi-pencil-outline</v-icon>
                  </v-btn>
                </template>
                <span>Edit Production</span>
              </v-tooltip>

              <v-tooltip location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    color="red"
                    @click="remove(item)"
                  >
                    <v-icon>mdi-delete-outline</v-icon>
                  </v-btn>
                </template>
                <span>Delete Production</span>
              </v-tooltip>
            </div>
          </template>

          <template #no-data>
            <div class="text-center py-8">
              <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-inbox</v-icon>
              <div class="text-h6 text-grey">No productions found</div>
              <div class="text-body-2 text-grey mt-2">
                Get started by creating your first production record
              </div>
              <v-btn color="primary" class="mt-4" @click="openAddDialog">
                <v-icon start>mdi-plus</v-icon>
                Create Production
              </v-btn>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- PAGINATION -->
    <v-card elevation="2" rounded="lg">
      <v-card-text class="pa-4">
        <div class="d-flex justify-space-between align-center">
          <div class="text-body-2 text-grey">
            Showing {{ productions.length }} of {{ totalItems }} records
          </div>
          <v-pagination
            v-model="page"
            :length="totalPages"
            :total-visible="7"
            color="primary"
            @update:modelValue="loadProductions"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- ADD/EDIT DIALOG -->
    <v-dialog v-model="dialog" max-width="1200" scrollable persistent>
      <v-card class="rounded-xl" elevation="16">
        <!-- Header -->
        <v-toolbar color="primary" density="comfortable" class="rounded-t-xl">
          <v-avatar size="36" color="white" class="mr-3">
            <v-icon color="primary" :icon="isEditing ? 'mdi-pencil' : 'mdi-plus'" />
          </v-avatar>
          <v-toolbar-title class="text-h5 font-weight-bold text-white">
            {{ isEditing ? 'Edit Production' : 'Create New Production' }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            @click="closeDialog"
          />
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="saveProduction">
            <!-- Basic Information -->
            <v-card variant="outlined" class="rounded-lg pa-4 mb-4">
              <div class="d-flex align-center mb-4">
                <v-icon color="primary" class="mr-2">mdi-information</v-icon>
                <h4 class="text-h6 font-weight-medium">Basic Information</h4>
              </div>
              <v-row dense>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.mode"
                    :items="modes"
                    item-title="label"
                    item-value="value"
                    label="Production Mode"
                    required
                    :disabled="isEditing"
                    variant="outlined"
                    color="primary"
                    prepend-inner-icon="mdi-cog"
                  />
                </v-col>

                <v-col cols="12" md="8">
                  <v-autocomplete
                    v-model="form.product_id"
                    :items="products"
                    item-title="name"
                    item-value="id"
                    label="Select Product"
                    required
                    :disabled="isEditing"
                    variant="outlined"
                    color="primary"
                    prepend-inner-icon="mdi-package-variant"
                    @update:modelValue="onProductChange"
                  />
                </v-col>
              </v-row>
            </v-card>

            <!-- Quantity Configuration -->
            <v-card variant="outlined" class="rounded-lg pa-4 mb-4">
              <div class="d-flex align-center mb-4">
                <v-icon color="primary" class="mr-2">mdi-scale</v-icon>
                <h4 class="text-h6 font-weight-medium">Quantity Configuration</h4>
              </div>
              
              <!-- By Product -->
              <v-row v-if="form.mode === 'by_product'" dense>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.qty_product"
                    type="number"
                    label="Quantity of Product"
                    required
                    :disabled="isEditing && !editEnabled"
                    variant="outlined"
                    color="primary"
                    prepend-inner-icon="mdi-numeric"
                    @input="recalc"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-alert type="info" variant="tonal" class="mt-2">
                    Enter the total number of product units to produce
                  </v-alert>
                </v-col>
              </v-row>

              <!-- By Ingredient -->
              <template v-if="form.mode === 'by_ingredient'">
                <v-row dense>
                  <v-col cols="12" md="6">
                    <v-autocomplete
                      v-model="form.base_ingredient_id"
                      :items="recipeItems"
                      item-title="item_name"
                      item-value="item_id"
                      label="Base Ingredient"
                      :disabled="!recipeItems.length || (isEditing && !editEnabled)"
                      variant="outlined"
                      color="primary"
                      prepend-inner-icon="mdi-ingredient"
                      @update:modelValue="recalc"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="form.base_ingredient_qty"
                      type="number"
                      :label="`Ingredient Quantity (${baseUnit || 'units'})`"
                      required
                      :disabled="!form.base_ingredient_id || (isEditing && !editEnabled)"
                      variant="outlined"
                      color="primary"
                      prepend-inner-icon="mdi-weight"
                      @input="recalc"
                    />
                  </v-col>
                </v-row>
              </template>
            </v-card>
            <v-card variant="outlined" class="rounded-lg pa-4 mb-4">
              <div class="d-flex align-center mb-4">
                <v-icon color="primary" class="mr-2">mdi-scale-balance</v-icon>
                <h4 class="text-h6 font-weight-medium">Actual Output & Discrepancies</h4>
              </div>

              <v-row dense>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.actual_qty"
                    type="number"
                    label="Actual Quantity Produced"
                    variant="outlined"
                    color="primary"
                    prepend-inner-icon="mdi-counter"
                    @input="checkDiscrepancy"
                  />
                </v-col>
                <v-col cols="12" md="6" v-if="showDiscrepancy">
                  <v-alert type="warning" variant="tonal" border="start" class="mt-2">
                    Discrepancy detected (Planned: {{ computedData.qty_product }} | Actual: {{ form.actual_qty }})
                  </v-alert>
                </v-col>
              </v-row>

              <template v-if="showDiscrepancy">
                <v-divider class="my-4" />
                <v-row v-for="(disc, i) in form.discrepancies" :key="i" class="align-center mb-3">
                  <v-col cols="12" md="5">
                    <v-select
                      v-model="disc.reason_id"
                      :items="discrepancyReasons"
                      item-title="name"
                      item-value="id"
                      label="Reason"
                      variant="outlined"
                      color="primary"
                      prepend-inner-icon="mdi-alert-circle-outline"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="12" md="5">
                    <v-text-field
                      v-model="disc.notes"
                      label="Notes"
                      variant="outlined"
                      color="primary"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="12" md="2" class="text-right">
                    <v-btn icon color="error" variant="text" @click="removeDiscrepancy(i)">
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </v-col>
                </v-row>

                <v-btn
                  color="primary"
                  variant="outlined"
                  size="small"
                  @click="addDiscrepancy"
                >
                  <v-icon start>mdi-plus</v-icon>
                  Add Reason
                </v-btn>
              </template>
            </v-card>

            <!-- Staff Assignment -->
            <v-card variant="outlined" class="rounded-lg pa-4 mb-4">
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center">
                  <v-icon color="primary" class="mr-2">mdi-account-group</v-icon>
                  <h4 class="text-h6 font-weight-medium">Staff Assignment</h4>
                </div>
                <div class="d-flex gap-2">
                  <v-btn
                    color="primary"
                    variant="outlined"
                    size="small"
                    @click="addStaffMember"
                    :disabled="!availableStaff.length"
                  >
                    <v-icon start>mdi-account-plus</v-icon>
                    Add Staff
                  </v-btn>
                  <v-btn
                    color="secondary"
                    variant="outlined"
                    size="small"
                    @click="clearAllStaff"
                    :disabled="!form.staff.length"
                  >
                    <v-icon start>mdi-account-remove</v-icon>
                    Clear All
                  </v-btn>
                </div>
              </div>
              {{ form.staff }}
              <v-data-table
                :headers="staffHeaders"
                :items="form.staff"
                class="elevation-1 rounded-lg"
                density="comfortable"
              >
                <template #item.staff_id="{ item, index }">
                  <v-autocomplete
                    v-model="item.staff_id"
                    :items="availableStaff"
                    item-title="name"
                    item-value="id"
                    density="compact"
                    variant="outlined"
                    placeholder="Select Staff"
                    hide-details
                    :disabled="!editEnabled"
                    return-object
                  />
                </template>

                <template #item.role="{ item }">
                  <v-select
                    v-model="item.role"
                    :items="['Team Leader', 'Assistant', 'Support']"
                    density="compact"
                    variant="outlined"
                    color="primary"
                    clearable
                    prepend-inner-icon="mdi-account-tie"
                    hide-details
                    :disabled="!editEnabled"
                  />
                </template>

                <template #item.notes="{ item }">
                  <v-text-field
                    v-model="item.notes"
                    density="compact"
                    variant="outlined"
                    hide-details
                    :disabled="!editEnabled"
                  />
                </template>

                <template #item.actions="{ item, index }">
                  <v-btn
                    icon
                    size="small"
                    variant="text"
                    color="error"
                    :disabled="!editEnabled"
                    @click="removeStaffMember(index)"
                  >
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </template>

                <template #no-data>
                  <div class="text-center py-4 text-grey">
                    No staff assigned. Click "Add Staff" to assign team members.
                  </div>
                </template>
              </v-data-table>

              <!-- Staff Summary -->
              <v-alert 
                v-if="form.staff.length" 
                type="info" 
                variant="tonal" 
                border="start"
                class="mt-4"
              >
                <div class="d-flex justify-space-between align-center">
                  <div>
                    <strong>Team Summary:</strong>
                    <v-chip size="small" color="primary" variant="flat" class="ml-2">
                      {{ form.staff.length }} staff members
                    </v-chip>
                  </div>
                  <div class="text-caption text-grey">
                    {{ assignedStaffCount }} of {{ availableStaff.length + assignedStaffCount }} staff assigned
                  </div>
                </div>
              </v-alert>
            </v-card>

            <!-- Ingredients Management -->
            <v-card variant="outlined" class="rounded-lg pa-4 mb-4">
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center">
                  <v-icon color="primary" class="mr-2">mdi-ingredient</v-icon>
                  <h4 class="text-h6 font-weight-medium">Ingredients Required</h4>
                </div>
                <v-switch
                  v-model="editEnabled"
                  :label="editEnabled ? 'Editing Enabled' : 'Editing Disabled'"
                  color="primary"
                  hide-details
                  inset
                />
              </div>

              <v-data-table
                :headers="ingredientHeaders"
                :items="computedData.ingredients"
                class="elevation-1 rounded-lg"
                density="comfortable"
              >
                <template #item.qty_required="{ item }">
                  <v-text-field
                    v-model.number="item.qty_required"
                    type="number"
                    density="compact"
                    variant="outlined"
                    :disabled="!editEnabled"
                    style="max-width: 120px;"
                    hide-details
                  />
                </template>

                <template #item.unit="{ item }">
                  <v-chip size="small" variant="outlined" color="blue-grey">
                    {{ item.unit }}
                  </v-chip>
                </template>

                <template #no-data>
                  <div class="text-center py-4 text-grey">
                    Select a product to view required ingredients
                  </div>
                </template>
              </v-data-table>

              <!-- Summary -->
              <v-alert 
                v-if="computedData.ingredients.length" 
                type="success" 
                variant="tonal" 
                border="start"
                class="mt-4"
              >
                <div class="d-flex justify-space-between align-center">
                  <div>
                    <strong>Total Product Units:</strong>
                    <v-chip size="small" color="success" variant="flat" class="ml-2">
                      {{ computedData.qty_product || 0 }}
                    </v-chip>
                  </div>
                  <div class="text-caption text-grey">
                    {{ computedData.ingredients.length }} ingredients required
                  </div>
                </div>
              </v-alert>
            </v-card>

            <!-- Notes -->
            <v-textarea
              v-model="form.notes"
              label="Additional Notes"
              rows="3"
              variant="outlined"
              color="primary"
              prepend-inner-icon="mdi-note-text"
              :disabled="!editEnabled && isEditing"
            />
          </v-form>
        </v-card-text>

        <!-- Actions -->
        <v-card-actions class="pa-6 bg-grey-lighten-4 rounded-b-xl">
          <v-spacer />
          <v-btn
            variant="outlined"
            color="grey"
            @click="closeDialog"
            class="px-6"
          >
            Cancel
          </v-btn>
          <v-btn
            color="success"
            :loading="saving"
            :disabled="!canSave"
            @click="saveProduction"
            class="px-6"
            elevation="2"
          >
            <v-icon start>mdi-content-save-check</v-icon>
            {{ isEditing ? 'Update Production' : 'Create Production' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- VIEW DIALOG -->
    <v-dialog v-model="viewDialog" max-width="900">
      <v-card class="rounded-xl" elevation="16">
        <v-toolbar color="primary" density="comfortable" class="rounded-t-xl">
          <v-avatar size="36" color="white" class="mr-3">
            <v-icon color="primary">mdi-eye</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h5 font-weight-bold text-white">
            Production Details
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            @click="viewDialog = false"
          />
        </v-toolbar>

        <v-card-text class="pa-6">
          <!-- Production Header -->
          <v-card variant="outlined" class="rounded-lg pa-4 mb-4">
            <v-row>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Production ID</div>
                <div class="text-h6 font-weight-bold">#{{ detail?.production?.id }}</div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Product</div>
                <div class="text-h6 font-weight-bold text-primary">
                  {{ detail?.production?.product_name }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Units Produced</div>
                <v-chip color="green" variant="flat" size="large">
                  <v-icon start>mdi-counter</v-icon>
                  {{ detail?.production?.qty_product }}
                </v-chip>
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-body-2 text-grey">Production Mode</div>
                <v-chip :color="detail?.production?.mode === 'by_product' ? 'blue' : 'orange'" variant="flat">
                  {{ detail?.production?.mode }}
                </v-chip>
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-body-2 text-grey">Team Size</div>
                <v-chip color="purple" variant="flat">
                  <v-icon start>mdi-account-group</v-icon>
                  {{ detail?.staff?.length || 0 }} members
                </v-chip>
              </v-col>
            </v-row>
          </v-card>

          <!-- Producer Info -->
          <v-card variant="outlined" class="rounded-lg pa-4 mb-4">
            <div class="d-flex align-center mb-3">
              <v-icon color="blue-grey" class="mr-2">mdi-account</v-icon>
              <h5 class="text-h6 font-weight-medium">Production Information</h5>
            </div>
            <v-row>
              <v-col cols="12" md="6">
                <div class="d-flex align-center">
                  <v-avatar size="40" color="blue-grey-lighten-5" class="mr-3">
                    <v-icon color="blue-grey">mdi-account</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-2 text-grey">Produced By</div>
                    <div class="text-body-1 font-weight-medium">
                      {{ detail?.production?.produced_by_name }}
                    </div>
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="d-flex align-center">
                  <v-avatar size="40" color="green-lighten-5" class="mr-3">
                    <v-icon color="green">mdi-clock</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-2 text-grey">Produced At</div>
                    <div class="text-body-1 font-weight-medium">
                      {{ formatDate(detail?.production?.produced_at) }}
                    </div>
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-card>

          <!-- Staff Assignment Section -->
          <v-card variant="outlined" class="rounded-lg mb-4" v-if="detail?.staff?.length">
            <v-card-title class="d-flex align-center">
              <v-icon color="primary" class="mr-2">mdi-account-group</v-icon>
              Assigned Staff Team
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list lines="two" class="pa-0">
                <v-list-item
                  v-for="(staff, index) in detail.staff"
                  :key="index"
                  class="px-4"
                  :class="{ 'bg-grey-lighten-4': index % 2 === 0 }"
                >
                  <template #prepend>
                    <v-avatar color="primary" size="40" variant="tonal" class="mr-3">
                      <v-icon color="white" size="20">mdi-account</v-icon>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ staff.name }}
                  </v-list-item-title>
                  
                  <v-list-item-subtitle class="mt-1">
                    <div class="d-flex flex-wrap gap-2 align-center">
                      <v-chip v-if="staff.role" size="small" color="blue" variant="outlined">
                        {{ staff.role }}
                      </v-chip>
                    </div>
                    <div v-if="staff.notes" class="text-caption text-grey mt-1">
                      {{ staff.notes }}
                    </div>
                  </v-list-item-subtitle>

                  <template #append>
                    <v-chip size="small" variant="flat" color="success">
                      Active
                    </v-chip>
                  </template>
                </v-list-item>
              </v-list>

              <!-- Staff Summary -->
              <v-divider />
              <div class="pa-4 bg-grey-lighten-4">
                <v-row dense>
                  <v-col cols="12" md="4" class="text-center">
                    <div class="text-h6 text-primary font-weight-bold">
                      {{ detail.staff.length }}
                    </div>
                    <div class="text-caption text-grey">Team Members</div>
                  </v-col>
                </v-row>
              </div>
            </v-card-text>
          </v-card>

          <!-- Ingredients List -->
          <v-card variant="outlined" class="rounded-lg">
            <v-card-title class="d-flex align-center">
              <v-icon color="primary" class="mr-2">mdi-ingredient</v-icon>
              Ingredients Used
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list lines="two" class="pa-0">
                <v-list-item
                  v-for="(ingredient, index) in detail?.items || []"
                  :key="index"
                  class="px-4"
                  :class="{ 'bg-grey-lighten-4': index % 2 === 0 }"
                >
                  <template #prepend>
                    <v-avatar color="primary" size="36" class="mr-3">
                      <span class="text-white text-caption font-weight-bold">
                        {{ index + 1 }}
                      </span>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ ingredient.item_name }}
                  </v-list-item-title>
                  
                  <v-list-item-subtitle class="mt-1">
                    <v-chip size="small" color="primary" variant="outlined" class="mr-2">
                      {{ ingredient.qty_required }} {{ ingredient.unit || '' }}
                    </v-chip>
                    <span class="text-grey">Required</span>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

// Reactive state
const loading = ref(false)
const saving = ref(false)
const productions = ref([])
const page = ref(1)
const totalPages = ref(1)
const dialog = ref(false)
const viewDialog = ref(false)
const editEnabled = ref(true)
const isEditing = ref(false)
const detail = ref(null)
const search = ref('')

// Data collections
const products = ref([])
const staffList = ref([])
const recipeItems = ref([])
const baseUnit = ref('')

const discrepancyReasons = ref([])
const showDiscrepancy = ref(false)

// Form structure
const form = reactive({
  mode: '',
  product_id: '',
  qty_product: null,
  actual_qty: null,
  base_ingredient_id: '',
  base_ingredient_qty: null,
  notes: '',
  staff: [],
  discrepancies: []
})

// Computed data for ingredients
const computedData = reactive({
  qty_product: 0,
  ingredients: []
})

// Configuration
const modes = [
  { label: 'By Product', value: 'by_product' },
  { label: 'By Ingredient', value: 'by_ingredient' }
]

// Headers
const enhancedHeaders = [
  { 
    title: 'Product', 
    key: 'product_name',
    sortable: true,
    width: '250px'
  },
  { 
    title: 'Quantity', 
    key: 'qty_product',
    sortable: true,
    align: 'center'
  },
  { 
    title: 'Staffs', 
    key: 'staff_count',
    sortable: true,
    align: 'center'
  },
  { 
    title: 'Mode', 
    key: 'mode',
    sortable: true
  },
  { 
    title: 'Produced At', 
    key: 'produced_at',
    sortable: true,
    width: '150px'
  },
  { 
    title: 'Team Leader', 
    key: 'team_leader_name',
    sortable: true
  },
  { 
    title: 'Actions', 
    key: 'actions',
    sortable: false,
    align: 'end',
    width: '180px'
  }
]

const ingredientHeaders = [
  { title: 'Ingredient', key: 'item_name', sortable: true },
  { title: 'Quantity Required', key: 'qty_required', sortable: true, align: 'center' },
  { title: 'Unit', key: 'unit', sortable: true, align: 'center' }
]

const staffHeaders = [
  { title: 'Staff Member', key: 'staff_id', width: '250px' },
  { title: 'Role', key: 'role', width: '240px' },
  { title: 'Notes', key: 'notes', width: '240px' },
  { title: 'Actions', key: 'actions', align: 'center', sortable: false }
]

// Computed properties
const availableStaff = computed(() => {
  // Extract the numeric IDs from selected staff
  const selectedIds = form.staff
    .map(s => s.staff_id?.id)
    .filter(id => !!id)

  // Return only staff not yet selected
  return staffList.value.filter(staff => !selectedIds.includes(staff.id))
})

const assignedStaffCount = computed(() => {
  return form.staff.filter(staff => staff.staff_id).length
})

const totalItems = computed(() => productions.value.length)
const totalUnits = computed(() => {
  return productions.value.reduce((sum, p) => sum + (p.qty_product || 0), 0)
})
const totalStaffAssignments = computed(() => {
  return productions.value.reduce((sum, p) => sum + (p.staff_count || 0), 0)
})
const totalLaborCost = computed(() => {
  return productions.value.reduce((sum, p) => sum + (p.total_pay || 0), 0).toFixed(2)
})

const canSave = computed(() => {
  const hasValidStaff = form.staff.some(staff => staff.staff_id)
  const hasValidIngredients = computedData.ingredients.length > 0
  const hasValidQuantity = computedData.qty_product > 0
  const hasValidProduct = form.product_id
  
  return hasValidProduct && hasValidIngredients && hasValidQuantity && hasValidStaff
})

async function loadDiscrepancyReasons() {
  const res = await fetch('/productions/discrepancyReasons')
  const data = await res.json()
  discrepancyReasons.value = data.data || []
}

function checkDiscrepancy() {
  showDiscrepancy.value = !!(form.actual_qty && form.actual_qty !== computedData.qty_product)
  if (showDiscrepancy.value && !form.discrepancies.length) addDiscrepancy()
}

function addDiscrepancy() {
  form.discrepancies.push({ reason_id: null, notes: '' })
}

function removeDiscrepancy(index) {
  form.discrepancies.splice(index, 1)
}

// Methods
function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function addStaffMember() {
  form.staff.push({
    staff_id: '',
    role: '',
    notes: ''
  })
}

function removeStaffMember(index) {
  form.staff.splice(index, 1)
}

function clearAllStaff() {
  form.staff = []
}

function closeDialog() {
  dialog.value = false
  resetForm()
}

function resetForm() {
  Object.assign(form, {
    mode: '',
    product_id: '',
    qty_product: null,
    base_ingredient_id: '',
    base_ingredient_qty: null,
    notes: '',
    staff: []
  })
  computedData.qty_product = 0
  computedData.ingredients = []
}

async function loadProductions() {
  loading.value = true
  try {
    const res = await fetch(`/productions?page=${page.value}&limit=10`)
    const data = await res.json()
    productions.value = data.data || []
    totalPages.value = data.totalPages || 1
  } catch (error) {
    console.error('Failed to load productions:', error)
    productions.value = []
  } finally {
    loading.value = false
  }
}

async function loadProducts() {
  try {
    const res = await fetch('/products?limit=1000&page=1')
    const data = await res.json()
    products.value = data.data || []
  } catch (error) {
    console.error('Failed to load products:', error)
    products.value = []
  }
}

async function loadStaff() {
  try {
    const res = await fetch('/staffs?status=Active&limit=1000&page=1')
    const data = await res.json()
    staffList.value = data.data || []
  } catch (error) {
    console.error('Failed to load staff:', error)
    staffList.value = []
  }
}

async function onProductChange() {
  computedData.ingredients = []
  computedData.qty_product = 0
  baseUnit.value = ''
  
  if (!form.product_id) return
  
  try {
    const res = await fetch(`/products/${form.product_id}`)
    const data = await res.json()
    const items = data.items || []
    recipeItems.value = items.map(i => ({
      item_id: i.item_id,
      item_name: i.item_name || i.name,
      quantity_per_unit: Number(i.quantity_per_unit),
      unit_id: i.unit_id,
      unit: i.unit || i.unit_short
    }))
  } catch (error) {
    console.error('Failed to load product details:', error)
    recipeItems.value = []
  }
}

function recalc() {
  if (!form.product_id || recipeItems.value.length === 0) return
  
  let multiplier = 0
  if (form.mode === 'by_product') {
    multiplier = Number(form.qty_product) || 0
  } else if (form.mode === 'by_ingredient') {
    const base = recipeItems.value.find(i => i.item_id === Number(form.base_ingredient_id))
    baseUnit.value = base?.unit || ''
    if (base && base.quantity_per_unit > 0 && form.base_ingredient_qty > 0) {
      multiplier = form.base_ingredient_qty / base.quantity_per_unit
    }
  }
  
  computedData.qty_product = multiplier
  computedData.ingredients = recipeItems.value.map(r => ({
    item_id: r.item_id,
    item_name: r.item_name,
    unit_id: r.unit_id,
    unit: r.unit,
    qty_required: +(r.quantity_per_unit * multiplier).toFixed(3)
  }))
}

function openAddDialog() {
  dialog.value = true
  isEditing.value = false
  editEnabled.value = true
  resetForm()
  addStaffMember() // Start with one staff member
}

async function edit(item) {
  isEditing.value = true
  dialog.value = true
  editEnabled.value = false
  
  try {
    const res = await fetch(`/productions/${item.id}`)
    const data = await res.json()
    
    Object.assign(form, {
      id: data.production.id,
      mode: data.production.mode,
      product_id: data.production.product_id,
      qty_product: data.production.qty_product,
      notes: data.production.notes,
      staff: data.staff.map(row => ({
        staff_id: {
          id: row.id,
          name: row.name
        },
        role: row.role || '',
        notes: row.notes || ''
      })) || []
    })
    
    computedData.qty_product = data.production.qty_product
    computedData.ingredients = data.items.map(i => ({
      item_id: i.item_id,
      item_name: i.item_name,
      unit_id: i.unit_id,
      unit: i.unit,
      qty_required: i.qty_required
    }))
  } catch (error) {
    console.error('Failed to load production for editing:', error)
  }
}

async function saveProduction() {
  saving.value = true
  try {
    const payload = {
      product_id: form.product_id,
      base_ingredient_id: form.base_ingredient_id,
      base_ingredient_qty: form.base_ingredient_qty,
      mode: form.mode,
      qty_product: computedData.qty_product,
      notes: form.notes,
      ingredients: computedData.ingredients,
      staffs: form.staff.filter(staff => staff.staff_id)
    }
    
    const url = isEditing.value ? `/productions/${form.id}` : '/productions'
    const method = isEditing.value ? 'PUT' : 'POST'
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!res.ok) throw new Error('Save failed')
    
    dialog.value = false
    await loadProductions()
  } catch (error) {
    console.error('Failed to save production:', error)
    alert('Failed to save production. Please try again.')
  } finally {
    saving.value = false
  }
}

async function view(item) {
  try {
    const res = await fetch(`/productions/${item.id}`)
    detail.value = await res.json()
    viewDialog.value = true
  } catch (error) {
    console.error('Failed to load production details:', error)
  }
}

async function remove(item) {
  if (!confirm('Are you sure you want to delete this production?')) return
  
  try {
    await fetch(`/productions/${item.id}`, { method: 'DELETE' })
    await loadProductions()
  } catch (error) {
    console.error('Failed to delete production:', error)
    alert('Failed to delete production. Please try again.')
  }
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    loadStaff(),
    loadProducts(),
    loadProductions(),
    loadDiscrepancyReasons()
  ])
})
</script>

<style scoped>
.production-container {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.stat-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
}

:deep(.v-data-table) {
  border-radius: 8px;
}

:deep(.v-data-table .v-table__wrapper) {
  border-radius: 8px;
}

:deep(.v-btn) {
  text-transform: none;
  font-weight: 500;
}

:deep(.v-alert) {
  border: none;
}

.gap-2 {
  gap: 8px;
}
</style>