<template>
  <v-container class="production-container" fluid>
    <v-alert
      v-if="form.damaged_qty > 0 || form.reject_qty > 0"
      border="start"
      class="mt-2"
      type="warning"
      variant="tonal"
    >
      Some quantities were marked as damaged or reject — please ensure they're
      tracked in the ledger.
    </v-alert>

    <!-- HEADER SECTION -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h4 font-weight-bold text-primary mb-2">
              Production Management
            </h1>
            <p class="text-body-1 text-grey">
              Manage production batches and individual productions
            </p>
          </div>
          <div class="d-flex gap-2">
            <v-btn
              v-if="$store.getters.hasTask('can_schedule_production')"
              class="px-6"
              color="primary"
              elevation="2"
              size="large"
              @click="openAddDialog"
            >
              <v-icon size="20" start>mdi-plus-circle</v-icon>
              New Production
            </v-btn>
            <v-btn
              class="px-6"
              color="secondary"
              elevation="2"
              size="large"
              @click="switchView"
            >
              <v-icon size="20" start>mdi-view-grid</v-icon>
              {{ showBatches ? "Show Individual" : "Show Batches" }}
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- STATS CARDS -->
    <v-row class="mb-6">
      <v-col cols="12" md="3" sm="6">
        <v-card border class="stat-card" elevation="2" rounded="lg">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="blue-lighten-5" size="48">
                <v-icon color="blue" size="24">mdi-factory</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-blue">
                  {{ showBatches ? batches.length : productions.length }}
                </div>
                <div class="text-caption text-grey">
                  {{ showBatches ? "Total Batches" : "Total Productions" }}
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card border class="stat-card" elevation="2" rounded="lg">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="green-lighten-5" size="48">
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
      <v-col cols="12" md="3" sm="6">
        <v-card border class="stat-card" elevation="2" rounded="lg">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="orange-lighten-5" size="48">
                <v-icon color="orange" size="24">mdi-chart-line</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-orange">
                  {{ totalUnits }}
                </div>
                <div class="text-caption text-grey">Total Units (Planned)</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card border class="stat-card" elevation="2" rounded="lg">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="purple-lighten-5" size="48">
                <v-icon color="purple" size="24">mdi-cash-multiple</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-purple">
                  {{ totalLaborCost }}
                </div>
                <div class="text-caption text-grey">Labor Cost</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- BATCHES VIEW -->
    <template v-if="showBatches">
      <!-- BATCHES TABLE + FILTERS -->
      <v-card class="mb-4" elevation="2" rounded="lg">
        <v-card-text class="pa-0">
          <!-- Table Header -->
          <div class="d-flex align-center pa-4 bg-grey-lighten-4 rounded-t-lg">
            <v-icon class="mr-2" color="primary">mdi-view-grid</v-icon>
            <h3 class="text-h6 font-weight-medium">Production Batches</h3>
          </div>

          <!-- Batch Filters -->
          <v-card border class="pa-6 mb-6" elevation="3" rounded="lg">
            <div class="d-flex align-center mb-4">
              <v-avatar class="mr-3" color="primary" size="40" variant="tonal">
                <v-icon color="primary">mdi-filter</v-icon>
              </v-avatar>
              <div>
                <h3 class="text-h6 font-weight-bold text-primary">
                  Batch Filters
                </h3>
                <p class="text-caption text-grey mt-1">
                  Refine your batch records
                </p>
              </div>
              <v-spacer />
              <v-chip class="mr-2" color="primary" size="small" variant="flat">
                {{ batchActiveFilterCount }} Active
              </v-chip>
            </div>

            <v-divider class="mb-6" />

            <v-row class="align-start" dense>
              <!-- Product Filter -->
              <v-col cols="12" lg="3" md="4" sm="6">
                <v-card border class="rounded-lg h-100" variant="outlined">
                  <v-card-text class="pa-3">
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-2" color="primary" size="18"
                        >mdi-package-variant</v-icon
                      >
                      <label
                        class="text-caption font-weight-medium text-primary"
                        >Product</label
                      >
                    </div>
                    <v-autocomplete
                      v-model="batchFilters.product_id"
                      clearable
                      color="primary"
                      density="compact"
                      hide-details
                      item-title="name"
                      item-value="id"
                      :items="products"
                      placeholder="All Products"
                      variant="underlined"
                    />
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Status Filter -->
              <v-col cols="12" lg="3" md="4" sm="6">
                <v-card border class="rounded-lg h-100" variant="outlined">
                  <v-card-text class="pa-3">
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-2" color="blue" size="18"
                        >mdi-progress-clock</v-icon
                      >
                      <label
                        class="text-caption font-weight-medium text-primary"
                        >Status</label
                      >
                    </div>
                    <v-select
                      v-model="batchFilters.status"
                      color="primary"
                      density="compact"
                      hide-details
                      :items="batchStatusItems"
                      placeholder="Select Status"
                      variant="underlined"
                    >
                      <template #item="{ item, props }">
                        <v-list-item v-bind="props">
                          <template #prepend>
                            <v-icon :color="item.raw.color || 'grey'">
                              {{ item.raw.icon }}
                            </v-icon>
                          </template>
                        </v-list-item>
                      </template>
                      <template #selection="{ item }">
                        <div class="d-flex align-center">
                          <v-icon
                            class="mr-2"
                            :color="item.raw.color || 'grey'"
                            size="16"
                          >
                            {{ item.raw.icon }}
                          </v-icon>
                          <span>{{ item.title }}</span>
                        </div>
                      </template>
                    </v-select>
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Team Leader -->
              <v-col cols="12" lg="3" md="4" sm="6">
                <v-card border class="rounded-lg h-100" variant="outlined">
                  <v-card-text class="pa-3">
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-2" color="purple" size="18"
                        >mdi-account-tie</v-icon
                      >
                      <label
                        class="text-caption font-weight-medium text-primary"
                        >Team Leader</label
                      >
                    </div>
                    <v-autocomplete
                      v-model="batchFilters.team_leader"
                      clearable
                      color="primary"
                      density="compact"
                      hide-details
                      item-title="name"
                      item-value="id"
                      :items="staffList"
                      placeholder="All Leaders"
                      variant="underlined"
                    />
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Planned Date Range -->
              <v-col cols="12" lg="6" md="8">
                <v-card border class="rounded-lg" variant="outlined">
                  <v-card-text class="pa-3">
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-2" color="green" size="18"
                        >mdi-calendar-clock</v-icon
                      >
                      <label
                        class="text-caption font-weight-medium text-primary"
                        >Planned Date Range</label
                      >
                    </div>
                    <v-row class="align-center" dense>
                      <v-col cols="12" sm="4">
                        <v-select
                          v-model="batchFilters.planned_at_op"
                          color="primary"
                          density="compact"
                          hide-details
                          :items="dateOperators"
                          variant="underlined"
                        />
                      </v-col>
                      <v-col cols="12" sm="4">
                        <VueDatePicker
                          v-model="batchFilters.planned_at"
                          auto-apply
                          format="dd-MM-yyyy"
                          model-type="format"
                          placeholder="Start Date"
                          :teleport="true"
                        />
                      </v-col>
                      <v-col
                        v-if="batchFilters.planned_at_op === 'in'"
                        cols="12"
                        sm="4"
                      >
                        <VueDatePicker
                          v-model="batchFilters.planned_end"
                          auto-apply
                          format="dd-MM-yyyy"
                          model-type="format"
                          placeholder="End Date"
                          :teleport="true"
                        />
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <v-divider class="mt-4 mb-4" />
            <div class="d-flex justify-space-between align-center">
              <div class="text-caption text-grey">
                <v-icon class="mr-1" size="14">mdi-information</v-icon>
                Use filters to find specific batch records
              </div>
              <div class="d-flex gap-2">
                <v-btn
                  class="px-4"
                  color="grey"
                  variant="outlined"
                  @click="resetBatchFilters"
                >
                  <v-icon size="18" start>mdi-refresh</v-icon>
                  Reset All
                </v-btn>
                <v-btn
                  class="px-4"
                  color="primary"
                  elevation="2"
                  @click="applyBatchFilters"
                >
                  <v-icon size="18" start>mdi-filter-check</v-icon>
                  Apply Filters
                </v-btn>
              </div>
            </div>
          </v-card>

          <!-- Progress -->
          <v-progress-linear
            :active="loading"
            color="primary"
            height="4"
            :indeterminate="loading"
          />

          <!-- Data Table -->
          <v-data-table
            class="elevation-0"
            density="comfortable"
            :headers="batchHeaders"
            hover
            :items="batches"
            :loading="loading"
            :search="search"
          >
            <template #loading>
              <v-skeleton-loader type="table-row@10" />
            </template>

            <template #item.status="{ item }">
              <v-chip
                class="font-weight-bold text-uppercase"
                :color="getBatchStatusColor(item.status)"
                size="small"
                variant="flat"
              >
                {{ getBatchStatusText(item.status) }}
              </v-chip>
            </template>

            <template #item.batch_code="{ item }">
              <div class="d-flex align-center">
                <v-avatar
                  class="mr-3"
                  color="primary"
                  size="32"
                  variant="tonal"
                >
                  <v-icon color="primary" size="16">mdi-package-variant</v-icon>
                </v-avatar>
                <div>
                  <div class="font-weight-medium">
                    {{ item.batch_code }}
                  </div>
                  <div class="text-caption text-grey">
                    {{ item.total_products }} products
                  </div>
                </div>
              </div>
            </template>

            <!-- <template #item.production_stats="{ item }">
              <div class="d-flex flex-column gap-1">
                <div class="d-flex align-center">
                  <v-chip color="green" size="x-small" variant="flat">
                    {{ item.produced_count }} produced
                  </v-chip>
                  <v-chip
                    v-if="item.unproduced_count > 0"
                    class="ml-1"
                    color="orange"
                    size="x-small"
                    variant="flat"
                  >
                    {{ item.unproduced_count }} pending
                  </v-chip>
                </div>
                <div class="text-caption text-grey">
                  {{ item.total_good_qty }} good •
                  {{ item.total_damaged_qty }} damaged •
                  {{ item.total_reject_qty }} reject
                </div>
              </div>
            </template> -->
            <template #item.production_stats="{ item }">
              <div class="text-caption">
                <v-chip
                  class="mr-1 mb-1"
                  color="green"
                  size="x-small"
                  variant="outlined"
                >
                  {{ item.total_good_qty || 0 }} good
                </v-chip>
                <v-chip
                  class="mr-1 mb-1"
                  color="orange"
                  size="x-small"
                  variant="outlined"
                >
                  {{ item.total_damaged_qty || 0 }} damaged
                </v-chip>
                <v-chip
                  class="mb-1"
                  color="red"
                  size="x-small"
                  variant="outlined"
                >
                  {{ item.total_reject_qty || 0 }} reject
                </v-chip>
              </div>
            </template>

            <template #item.planned_at="{ item }">
              <div class="text-no-wrap">
                {{ formatDate(item.planned_at) }}
              </div>
            </template>

            <template #item.produced_at="{ item }">
              <div class="text-no-wrap">
                {{ formatDate(item.produced_at) || "Not completed" }}
              </div>
            </template>

            <template #item.team_leader_name="{ item }">
              <div class="d-flex align-center">
                <v-avatar class="mr-2" color="blue-grey-lighten-5" size="28">
                  <v-icon color="blue-grey" size="14">mdi-account-tie</v-icon>
                </v-avatar>
                <span class="font-weight-medium">
                  {{ item.team_leader_name }}
                </span>
              </div>
            </template>

            <template #item.actions="{ item }">
              <div class="d-flex justify-end">
                <v-menu
                  :close-on-content-click="false"
                  location="bottom end"
                  transition="scale-transition"
                >
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      class="action-menu-btn"
                      color="primary"
                      icon
                      size="small"
                      variant="text"
                    >
                      <v-icon>mdi-dots-vertical</v-icon>
                    </v-btn>
                  </template>

                  <v-card elevation="8" min-width="240" rounded="lg">
                    <v-card-text
                      class="pa-4"
                      :class="getBatchStatusClass(item.status)"
                    >
                      <div class="d-flex align-center justify-space-between">
                        <div class="d-flex align-center">
                          <v-avatar
                            class="mr-3"
                            color="white"
                            size="32"
                            variant="tonal"
                          >
                            <v-icon color="primary" size="18">
                              mdi-package-variant
                            </v-icon>
                          </v-avatar>
                          <div>
                            <div
                              class="text-white text-body-2 font-weight-bold"
                            >
                              Batch Actions
                            </div>
                            <div class="text-white text-caption opacity-75">
                              {{ item.batch_code }}
                            </div>
                          </div>
                        </div>
                        <v-chip color="white" size="small" variant="flat">
                          {{ item.status }}
                        </v-chip>
                      </div>
                    </v-card-text>

                    <v-list class="pa-2" density="compact">
                      <v-list-item
                        v-if="$store.getters.hasTask('can_see_production')"
                        class="rounded-lg mb-1 action-item"
                        @click="viewBatch(item)"
                      >
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="blue-lighten-5"
                            size="36"
                            variant="flat"
                          >
                            <v-icon color="blue" size="18">
                              mdi-eye-outline
                            </v-icon>
                          </v-avatar>
                        </template>
                        <v-list-item-title
                          class="text-body-2 font-weight-medium"
                        >
                          View Batch Details
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-blue">
                          Complete batch information
                        </v-list-item-subtitle>
                      </v-list-item>

                      <v-list-item
                        v-if="
                          (item.produced_count > 0 &&
                            $store.getters.hasTask(
                              'can_edit_actual_production',
                            )) ||
                          (item.produced_count <= 0 &&
                            $store.getters.hasTask('can_add_actual_production'))
                        "
                        class="rounded-lg mb-1 action-item"
                        @click="addBatchActualProduction(item)"
                      >
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="green-lighten-5"
                            size="36"
                            variant="flat"
                          >
                            <v-icon color="green" size="18">
                              mdi-plus-circle
                            </v-icon>
                          </v-avatar>
                        </template>
                        <template v-if="item.produced_count > 0">
                          <v-list-item-title
                            class="text-body-2 font-weight-medium"
                          >
                            Edit Actual Production
                          </v-list-item-title>
                          <v-list-item-subtitle class="text-caption text-green">
                            Edit Recorded output for all products
                          </v-list-item-subtitle>
                        </template>
                        <template v-else>
                          <v-list-item-title
                            class="text-body-2 font-weight-medium"
                          >
                            Add Actual Production
                          </v-list-item-title>
                          <v-list-item-subtitle class="text-caption text-green">
                            Record output for all products
                          </v-list-item-subtitle>
                        </template>
                      </v-list-item>

                      <v-list-item
                        v-if="$store.getters.hasTask('can_edit_production')"
                        class="rounded-lg mb-1 action-item"
                        @click="activateBatchEditing(item)"
                      >
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="orange-lighten-5"
                            size="36"
                            variant="flat"
                          >
                            <v-icon color="orange" size="18">
                              mdi-pencil-outline
                            </v-icon>
                          </v-avatar>
                        </template>
                        <v-list-item-title
                          class="text-body-2 font-weight-medium"
                        >
                          Edit Batch
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-orange">
                          Modify batch products &amp; staff
                        </v-list-item-subtitle>
                      </v-list-item>

                      <v-list-item
                        class="rounded-lg mb-1 action-item"
                        @click="viewBatchProducts(item)"
                      >
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="purple-lighten-5"
                            size="36"
                            variant="flat"
                          >
                            <v-icon color="purple" size="18">
                              mdi-format-list-bulleted
                            </v-icon>
                          </v-avatar>
                        </template>
                        <v-list-item-title
                          class="text-body-2 font-weight-medium"
                        >
                          View Products
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-purple">
                          See all products in batch
                        </v-list-item-subtitle>
                      </v-list-item>

                      <v-divider class="my-2" />

                      <v-list-item
                        v-if="$store.getters.hasTask('can_delete_production')"
                        class="rounded-lg action-item text-error"
                        @click="deleteBatch(item)"
                      >
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="red-lighten-5"
                            size="36"
                            variant="flat"
                          >
                            <v-icon color="red" size="18">
                              mdi-delete-outline
                            </v-icon>
                          </v-avatar>
                        </template>
                        <v-list-item-title
                          class="text-body-2 font-weight-medium text-error"
                        >
                          Delete Batch
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-red">
                          Remove permanently
                        </v-list-item-subtitle>
                      </v-list-item>
                    </v-list>
                  </v-card>
                </v-menu>
              </div>
            </template>

            <template #no-data>
              <div class="text-center py-8">
                <v-icon class="mb-4" color="grey-lighten-2" size="64">
                  mdi-inbox
                </v-icon>
                <div class="text-h6 text-grey">No batches found</div>
                <div class="text-body-2 text-grey mt-2">
                  Get started by creating your first production batch
                </div>
                <v-btn class="mt-4" color="primary" @click="openAddDialog">
                  <v-icon start>mdi-plus</v-icon>
                  Create Production
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </template>

    <!-- INDIVIDUAL PRODUCTIONS VIEW -->
    <template v-else>
      <!-- MAIN TABLE + FILTERS -->
      <v-card class="mb-4" elevation="2" rounded="lg">
        <v-card-text class="pa-0">
          <!-- Table Header -->
          <div class="d-flex align-center pa-4 bg-grey-lighten-4 rounded-t-lg">
            <v-icon class="mr-2" color="primary">mdi-table</v-icon>
            <h3 class="text-h6 font-weight-medium">Production Records</h3>
          </div>

          <!-- Filters -->
          <v-card border class="pa-6 mb-6" elevation="3" rounded="lg">
            <div class="d-flex align-center mb-4">
              <v-avatar class="mr-3" color="primary" size="40" variant="tonal">
                <v-icon color="primary">mdi-filter</v-icon>
              </v-avatar>
              <div>
                <h3 class="text-h6 font-weight-bold text-primary">
                  Production Filters
                </h3>
                <p class="text-caption text-grey mt-1">
                  Refine your production records
                </p>
              </div>
              <v-spacer />
              <v-chip class="mr-2" color="primary" size="small" variant="flat">
                {{ activeFilterCount }} Active
              </v-chip>
            </div>

            <v-divider class="mb-6" />

            <v-row class="align-start" dense>
              <!-- Product Filter -->
              <v-col cols="12" lg="3" md="4" sm="6">
                <v-card border class="rounded-lg h-100" variant="outlined">
                  <v-card-text class="pa-3">
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-2" color="primary" size="18"
                        >mdi-package-variant</v-icon
                      >
                      <label
                        class="text-caption font-weight-medium text-primary"
                        >Product</label
                      >
                    </div>
                    <v-autocomplete
                      v-model="filters.product_id"
                      clearable
                      color="primary"
                      density="compact"
                      hide-details
                      item-title="name"
                      item-value="id"
                      :items="products"
                      placeholder="All Products"
                      variant="underlined"
                    />
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Status Filter -->
              <v-col cols="12" lg="3" md="4" sm="6">
                <v-card border class="rounded-lg h-100" variant="outlined">
                  <v-card-text class="pa-3">
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-2" color="blue" size="18"
                        >mdi-progress-clock</v-icon
                      >
                      <label
                        class="text-caption font-weight-medium text-primary"
                        >Status</label
                      >
                    </div>
                    <v-select
                      v-model="filters.status"
                      color="primary"
                      density="compact"
                      hide-details
                      :items="statusItems"
                      placeholder="Select Status"
                      variant="underlined"
                    >
                      <template #item="{ item, props }">
                        <v-list-item v-bind="props">
                          <template #prepend>
                            <v-icon :color="item.raw.color || 'grey'">
                              {{ item.raw.icon }}
                            </v-icon>
                          </template>
                        </v-list-item>
                      </template>
                      <template #selection="{ item }">
                        <div class="d-flex align-center">
                          <v-icon
                            class="mr-2"
                            :color="item.raw.color || 'grey'"
                            size="16"
                          >
                            {{ item.raw.icon }}
                          </v-icon>
                          <span>{{ item.title }}</span>
                        </div>
                      </template>
                    </v-select>
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Team Leader -->
              <v-col cols="12" lg="3" md="4" sm="6">
                <v-card border class="rounded-lg h-100" variant="outlined">
                  <v-card-text class="pa-3">
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-2" color="purple" size="18"
                        >mdi-account-tie</v-icon
                      >
                      <label
                        class="text-caption font-weight-medium text-primary"
                        >Team Leader</label
                      >
                    </div>
                    <v-autocomplete
                      v-model="filters.team_leader"
                      clearable
                      color="primary"
                      density="compact"
                      hide-details
                      item-title="name"
                      item-value="id"
                      :items="staffList"
                      placeholder="All Leaders"
                      variant="underlined"
                    />
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Planned Date Range -->
              <v-col cols="12" lg="6" md="8">
                <v-card border class="rounded-lg" variant="outlined">
                  <v-card-text class="pa-3">
                    <div class="d-flex align-center mb-2">
                      <v-icon class="mr-2" color="green" size="18"
                        >mdi-calendar-clock</v-icon
                      >
                      <label
                        class="text-caption font-weight-medium text-primary"
                        >Planned Date Range</label
                      >
                    </div>
                    <v-row class="align-center" dense>
                      <v-col cols="12" sm="4">
                        <v-select
                          v-model="filters.planned_at_op"
                          color="primary"
                          density="compact"
                          hide-details
                          :items="dateOperators"
                          variant="underlined"
                        />
                      </v-col>
                      <v-col cols="12" sm="4">
                        <VueDatePicker
                          v-model="filters.planned_at"
                          auto-apply
                          format="dd-MM-yyyy"
                          model-type="format"
                          placeholder="Start Date"
                          :teleport="true"
                        />
                      </v-col>
                      <v-col
                        v-if="filters.planned_at_op === 'in'"
                        cols="12"
                        sm="4"
                      >
                        <VueDatePicker
                          v-model="filters.planned_end"
                          auto-apply
                          format="dd-MM-yyyy"
                          model-type="format"
                          placeholder="End Date"
                          :teleport="true"
                        />
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <v-divider class="mt-4 mb-4" />
            <div class="d-flex justify-space-between align-center">
              <div class="text-caption text-grey">
                <v-icon class="mr-1" size="14">mdi-information</v-icon>
                Use filters to find specific production records
              </div>
              <div class="d-flex gap-2">
                <v-btn
                  class="px-4"
                  color="grey"
                  variant="outlined"
                  @click="resetFilters"
                >
                  <v-icon size="18" start>mdi-refresh</v-icon>
                  Reset All
                </v-btn>
                <v-btn
                  class="px-4"
                  color="primary"
                  elevation="2"
                  @click="applyFilters"
                >
                  <v-icon size="18" start>mdi-filter-check</v-icon>
                  Apply Filters
                </v-btn>
              </div>
            </div>
          </v-card>

          <!-- Progress -->
          <v-progress-linear
            :active="loading"
            color="primary"
            height="4"
            :indeterminate="loading"
          />

          <!-- Data Table -->
          <v-data-table
            class="elevation-0"
            density="comfortable"
            :headers="productionHeaders"
            hover
            :items="productions"
            :loading="loading"
            :search="search"
          >
            <template #loading>
              <v-skeleton-loader type="table-row@10" />
            </template>

            <template #item.status="{ item }">
              <v-chip
                class="font-weight-bold text-uppercase"
                :color="item.produced_at ? 'green' : 'red'"
                size="small"
                variant="flat"
              >
                {{ item.produced_at ? "Completed" : "Pending" }}
              </v-chip>
            </template>

            <template #item.product_name="{ item }">
              <div class="d-flex align-center">
                <v-avatar
                  class="mr-3"
                  color="primary"
                  size="32"
                  variant="tonal"
                >
                  <v-icon color="primary" size="16">mdi-package</v-icon>
                </v-avatar>
                <div>
                  <div class="font-weight-medium">
                    {{ item.product_name || item.batch_label }}
                  </div>
                  <div class="text-caption text-grey">
                    {{ item.mode || "Multiple Products" }}
                  </div>
                </div>
              </div>
            </template>

            <template #item.qty_product="{ item }">
              <v-chip color="green" size="small" variant="flat">
                <v-icon size="16" start>mdi-counter</v-icon>
                {{ parseFloat(item.qty_product || item.total_qty || 0) }}
              </v-chip>
            </template>

            <template #item.staff_count="{ item }">
              <div class="d-flex align-center">
                <v-avatar class="mr-2" color="blue-lighten-5" size="28">
                  <v-icon color="blue" size="14">mdi-account-group</v-icon>
                </v-avatar>
                <span class="font-weight-medium">
                  {{ item.staff_count || 0 }}
                </span>
              </div>
            </template>

            <template #item.planned_at="{ item }">
              <div class="text-no-wrap">
                {{ item.planned_at }}
              </div>
            </template>

            <template #item.produced_at="{ item }">
              <div class="text-no-wrap">
                {{ item.produced_at }}
              </div>
            </template>

            <template #item.produced_by_name="{ item }">
              <div class="d-flex align-center">
                <v-avatar class="mr-2" color="blue-grey-lighten-5" size="28">
                  <v-icon color="blue-grey" size="14">mdi-account</v-icon>
                </v-avatar>
                <span class="font-weight-medium">
                  {{ item.produced_by_name }}
                </span>
              </div>
            </template>

            <template #item.actions="{ item }">
              <div class="d-flex justify-end">
                <v-menu
                  :close-on-content-click="false"
                  location="bottom end"
                  transition="scale-transition"
                >
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      class="action-menu-btn"
                      color="primary"
                      icon
                      size="small"
                      variant="text"
                    >
                      <v-badge
                        v-if="!item.produced_at"
                        color="orange"
                        dot
                        location="top end"
                        offset-x="2"
                        offset-y="2"
                      >
                        <v-icon>mdi-dots-vertical</v-icon>
                      </v-badge>
                      <v-icon v-else>mdi-dots-vertical</v-icon>
                    </v-btn>
                  </template>

                  <v-card elevation="8" min-width="240" rounded="lg">
                    <v-card-text
                      class="pa-4"
                      :class="
                        getStatusColor(
                          item.produced_at ? 'completed' : 'pending',
                        )
                      "
                    >
                      <div class="d-flex align-center justify-space-between">
                        <div class="d-flex align-center">
                          <v-avatar
                            class="mr-3"
                            color="white"
                            size="32"
                            variant="tonal"
                          >
                            <v-icon color="primary" size="18">
                              mdi-factory
                            </v-icon>
                          </v-avatar>
                          <div>
                            <div
                              class="text-white text-body-2 font-weight-bold"
                            >
                              Production Actions
                            </div>
                            <div class="text-white text-caption opacity-75">
                              {{ item.product_name || "Batch" }}
                            </div>
                          </div>
                        </div>
                        <v-chip color="white" size="small" variant="flat">
                          {{ item.produced_at ? "completed" : "pending" }}
                        </v-chip>
                      </div>
                    </v-card-text>

                    <v-list class="pa-2" density="compact">
                      <v-list-item
                        class="rounded-lg mb-1 action-item"
                        @click="view(item)"
                      >
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="blue-lighten-5"
                            size="36"
                            variant="flat"
                          >
                            <v-icon color="blue" size="18">
                              mdi-eye-outline
                            </v-icon>
                          </v-avatar>
                        </template>
                        <v-list-item-title
                          class="text-body-2 font-weight-medium"
                        >
                          View Details
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-blue">
                          Complete information
                        </v-list-item-subtitle>
                      </v-list-item>

                      <!-- <v-list-item
                        class="rounded-lg mb-1 action-item"
                        :disabled="item.produced_at"
                        @click="edit(item, 'actual')"
                      >
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="green-lighten-5"
                            size="36"
                            variant="flat"
                          >
                            <v-icon color="green" size="18">
                              mdi-plus-circle
                            </v-icon>
                          </v-avatar>
                        </template>
                        <v-list-item-title
                          class="text-body-2 font-weight-medium"
                        >
                          Add Actual Production
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-green">
                          Record actual output
                        </v-list-item-subtitle>
                      </v-list-item>

                      <v-list-item
                        class="rounded-lg mb-1 action-item"
                        @click="edit(item)"
                      >
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="orange-lighten-5"
                            size="36"
                            variant="flat"
                          >
                            <v-icon color="orange" size="18">
                              mdi-pencil-outline
                            </v-icon>
                          </v-avatar>
                        </template>
                        <v-list-item-title
                          class="text-body-2 font-weight-medium"
                        >
                          Edit Production
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-orange">
                          Modify details
                        </v-list-item-subtitle>
                      </v-list-item>

                      <v-divider class="my-2" />

                      <v-list-item
                        class="rounded-lg action-item text-error"
                        @click="remove(item)"
                      >
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="red-lighten-5"
                            size="36"
                            variant="flat"
                          >
                            <v-icon color="red" size="18">
                              mdi-delete-outline
                            </v-icon>
                          </v-avatar>
                        </template>
                        <v-list-item-title
                          class="text-body-2 font-weight-medium text-error"
                        >
                          Delete Production
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption text-red">
                          Remove permanently
                        </v-list-item-subtitle>
                      </v-list-item> -->
                    </v-list>
                  </v-card>
                </v-menu>
              </div>
            </template>

            <template #no-data>
              <div class="text-center py-8">
                <v-icon class="mb-4" color="grey-lighten-2" size="64">
                  mdi-inbox
                </v-icon>
                <div class="text-h6 text-grey">No productions found</div>
                <div class="text-body-2 text-grey mt-2">
                  Get started by creating your first production record
                </div>
                <v-btn class="mt-4" color="primary" @click="openAddDialog">
                  <v-icon start>mdi-plus</v-icon>
                  Create Production
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </template>

    <!-- PAGINATION -->
    <v-card elevation="2" rounded="lg">
      <v-card-text class="pa-4">
        <div class="d-flex justify-space-between align-center">
          <div class="text-body-2 text-grey">
            Showing {{ showBatches ? batches.length : productions.length }} of
            {{ totalItems }} records
          </div>
          <v-pagination
            v-model="page"
            color="primary"
            :length="totalPages"
            :total-visible="7"
            @update:model-value="loadData"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- BATCH VIEW DIALOG -->
    <v-dialog
      v-model="batchViewDialog"
      max-width="1200"
      scrollable
      transition="dialog-bottom-transition"
    >
      <v-card class="rounded-xl" elevation="16">
        <v-toolbar class="rounded-t-xl" color="primary" density="comfortable">
          <v-avatar class="mr-3" color="white" size="36">
            <v-icon color="primary">mdi-package-variant</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h5 font-weight-bold text-white">
            Batch Details - {{ selectedBatch?.batch_code }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            color="white"
            icon="mdi-close"
            variant="text"
            @click="batchViewDialog = false"
          />
        </v-toolbar>

        <v-card-text class="pa-6">
          <!-- Batch Information -->
          <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
            <v-row>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Batch Code</div>
                <div class="text-h6 font-weight-bold">
                  {{ selectedBatch?.batch_code }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Status</div>
                <v-chip
                  class="mt-1"
                  :color="getBatchStatusColor(selectedBatch?.status)"
                  size="small"
                >
                  {{ getBatchStatusText(selectedBatch?.status) }}
                </v-chip>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Created By</div>
                <div class="text-body-1 font-weight-medium">
                  {{ selectedBatch?.created_by_name }}
                </div>
              </v-col>
            </v-row>

            <v-row class="mt-2">
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Planned At</div>
                <div class="text-body-1 font-weight-medium">
                  {{ formatDate(selectedBatch?.planned_at) }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Produced At</div>
                <div class="text-body-1 font-weight-medium">
                  {{
                    formatDate(selectedBatch?.produced_at) || "Not completed"
                  }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Team Leader</div>
                <div class="text-body-1 font-weight-medium">
                  {{ selectedBatch?.team_leader_name }}
                </div>
              </v-col>
            </v-row>

            <!-- Batch Statistics -->
            <v-row class="mt-4">
              <v-col cols="12" md="3">
                <v-card border class="text-center" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 font-weight-bold text-green">
                      {{ selectedBatch?.total_good_qty || 0 }}
                    </div>
                    <div class="text-caption text-grey">Good Quantity</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="3">
                <v-card border class="text-center" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 font-weight-bold text-orange">
                      {{ selectedBatch?.total_damaged_qty || 0 }}
                    </div>
                    <div class="text-caption text-grey">Damaged</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="3">
                <v-card border class="text-center" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 font-weight-bold text-red">
                      {{ selectedBatch?.total_reject_qty || 0 }}
                    </div>
                    <div class="text-caption text-grey">Reject</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="3">
                <v-card border class="text-center" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 font-weight-bold text-primary">
                      {{ selectedBatch?.total_products || 0 }}
                    </div>
                    <div class="text-caption text-grey">Total Products</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card>

          <!-- Products in Batch -->
          <v-card class="rounded-lg" variant="outlined">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="primary"
                >mdi-format-list-bulleted</v-icon
              >
              Products in Batch
            </v-card-title>
            <v-card-text class="pa-0">
              <v-data-table
                class="elevation-0"
                :headers="batchProductHeaders"
                :items="selectedBatch?.products || []"
              >
                <template #item.product_name="{ item }">
                  <div class="d-flex align-center">
                    <v-avatar
                      class="mr-3"
                      color="primary"
                      size="32"
                      variant="tonal"
                    >
                      <v-icon color="primary" size="16">mdi-package</v-icon>
                    </v-avatar>
                    <div>
                      <div class="font-weight-medium">
                        {{ item.product_name }}
                      </div>
                      <div class="text-caption text-grey">
                        Planned: {{ item.qty_product }} units
                      </div>
                    </div>
                  </div>
                </template>

                <template #item.produced="{ item }">
                  <v-chip
                    :color="item.produced_at ? 'green' : 'orange'"
                    size="small"
                    variant="flat"
                  >
                    {{ item.produced_at ? "Produced" : "Pending" }}
                  </v-chip>
                </template>

                <template #item.good_qty="{ item }">
                  <div v-if="item.produced_at" class="d-flex flex-column">
                    <span class="font-weight-medium text-green"
                      >{{ item.good_qty || 0 }} good</span
                    >
                    <span class="text-caption text-orange"
                      >{{ item.damaged_qty || 0 }} damaged</span
                    >
                    <span class="text-caption text-red"
                      >{{ item.reject_qty || 0 }} reject</span
                    >
                  </div>
                  <span v-else class="text-grey">Not produced</span>
                </template>

                <template #item.actions="{ item }">
                  <v-btn
                    v-if="item.production_id"
                    color="primary"
                    size="small"
                    variant="text"
                    @click="viewProduction(item.production_id)"
                  >
                    <v-icon size="16">mdi-eye</v-icon>
                    View
                  </v-btn>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
          <v-card
            v-if="selectedBatch?.staff?.length"
            class="rounded-lg mb-4"
            variant="outlined"
          >
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="blue">mdi-account-group</v-icon>
              Staff Assignments
              <v-chip class="ml-2" color="blue" size="small" variant="flat">
                {{ selectedBatch.staff.length }} staff
              </v-chip>
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list class="pa-0" lines="two">
                <v-list-item
                  v-for="(staff, index) in selectedBatch.staff"
                  :key="staff.staff_id"
                  class="px-4"
                  :class="{ 'bg-grey-lighten-4': index % 2 === 0 }"
                >
                  <template #prepend>
                    <v-avatar class="mr-3" color="blue" size="36">
                      <span class="text-white text-caption font-weight-bold">
                        {{ index + 1 }}
                      </span>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ staff.staff_name }}
                    <v-chip
                      class="ml-2"
                      :color="getRoleColor(staff.role)"
                      size="x-small"
                      variant="flat"
                    >
                      {{ staff.role }}
                    </v-chip>
                  </v-list-item-title>

                  <v-list-item-subtitle class="mt-1">
                    <span v-if="staff.notes" class="text-caption">
                      {{ staff.notes }}
                    </span>
                    <span v-else class="text-caption text-grey">
                      No notes
                    </span>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- BATCH ACTUAL PRODUCTION DIALOG -->
    <v-dialog
      v-model="batchActualDialog"
      max-width="1000"
      persistent
      scrollable
    >
      <v-card class="rounded-xl" elevation="16">
        <v-toolbar class="rounded-t-xl" color="primary" density="comfortable">
          <v-avatar class="mr-3" color="white" size="36">
            <v-icon color="primary">mdi-plus-circle</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h5 font-weight-bold text-white">
            Add Actual Production - {{ selectedBatch?.batch_code }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            color="white"
            icon="mdi-close"
            variant="text"
            @click="closeBatchActualDialog"
          />
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="saveBatchActualProduction">
            <!-- Production Date -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center mb-4">
                <v-icon class="mr-2" color="primary">mdi-calendar-clock</v-icon>
                <h4 class="text-h6 font-weight-medium">
                  Production Information
                </h4>
              </div>
              <v-row dense>
                <v-col cols="12" md="6">
                  <div class="position-relative w-100">
                    <span
                      v-if="batchActualForm.produced_at"
                      class="datepicker-label"
                    >
                      Actual Production Date &amp; Time
                    </span>
                    <VueDatePicker
                      v-model="batchActualForm.produced_at"
                      auto-apply
                      class="rounded-lg border px-4 py-2 w-100"
                      :enable-time-picker="true"
                      format="dd-MM-yyyy HH:mm"
                      model-type="format"
                      placeholder="Select Actual Production Date & Time"
                      :teleport="true"
                    />
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="batchActualForm.notes"
                    color="primary"
                    label="Production Notes (optional)"
                    prepend-inner-icon="mdi-note-text"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </v-card>

            <!-- Products Actual Quantities -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center mb-4">
                <v-icon class="mr-2" color="primary">mdi-scale-balance</v-icon>
                <h4 class="text-h6 font-weight-medium">
                  Actual Production Quantities
                </h4>
              </div>

              <v-alert
                v-if="batchActualForm.products.some((p) => p.hasDiscrepancy)"
                border="start"
                class="mb-4"
                type="warning"
                variant="tonal"
              >
                Some products have discrepancies between planned and actual
                quantities.
              </v-alert>

              <v-card
                v-for="(product, index) in batchActualForm.products"
                :key="product.production_id"
                class="mb-4"
                variant="outlined"
              >
                <v-card-text class="pa-4">
                  <div class="d-flex align-center mb-3">
                    <v-avatar
                      class="mr-3"
                      color="primary"
                      size="32"
                      variant="tonal"
                    >
                      <v-icon color="primary" size="16">mdi-package</v-icon>
                    </v-avatar>
                    <div>
                      <div class="font-weight-medium text-h6">
                        {{ product.product_name }}
                      </div>
                      <div class="text-caption text-grey">
                        Planned: {{ product.planned_qty }} units
                      </div>
                    </div>
                    <v-spacer />
                    <v-chip
                      :color="product.hasDiscrepancy ? 'orange' : 'green'"
                      size="small"
                      variant="flat"
                    >
                      {{ product.hasDiscrepancy ? "Discrepancy" : "On Track" }}
                    </v-chip>
                  </div>

                  <v-row dense>
                    <v-col cols="12" md="3">
                      <v-text-field
                        v-model.number="product.good_qty"
                        color="green"
                        density="compact"
                        :label="`Good Quantity (${product.planned_qty} planned)`"
                        type="number"
                        variant="outlined"
                        @input="updateProductDiscrepancy(product)"
                      >
                        <template #prepend-inner>
                          <v-icon color="green" size="20"
                            >mdi-check-decagram</v-icon
                          >
                        </template>
                      </v-text-field>
                    </v-col>
                    <v-col cols="12" md="3">
                      <v-text-field
                        v-model.number="product.damaged_qty"
                        color="orange"
                        density="compact"
                        label="Damaged Quantity"
                        type="number"
                        variant="outlined"
                        @input="updateProductDiscrepancy(product)"
                      >
                        <template #prepend-inner>
                          <v-icon color="orange" size="20"
                            >mdi-alert-circle-outline</v-icon
                          >
                        </template>
                      </v-text-field>
                    </v-col>
                    <v-col cols="12" md="3">
                      <v-text-field
                        v-model.number="product.reject_qty"
                        color="red"
                        density="compact"
                        label="Reject Quantity"
                        type="number"
                        variant="outlined"
                        @input="updateProductDiscrepancy(product)"
                      >
                        <template #prepend-inner>
                          <v-icon color="red" size="20"
                            >mdi-close-octagon-outline</v-icon
                          >
                        </template>
                      </v-text-field>
                    </v-col>
                    <v-col cols="12" md="3">
                      <v-text-field
                        v-model.number="product.actual_qty"
                        color="primary"
                        density="compact"
                        label="Total Actual"
                        readonly
                        type="number"
                        variant="outlined"
                      >
                        <template #prepend-inner>
                          <v-icon color="primary" size="20">mdi-counter</v-icon>
                        </template>
                      </v-text-field>
                    </v-col>
                  </v-row>

                  <!-- Discrepancy Reasons -->
                  <template v-if="product.hasDiscrepancy">
                    <v-divider class="my-3" />
                    <div class="mb-2">
                      <v-chip color="orange" size="small" variant="flat">
                        Discrepancy:
                        {{ Math.abs(product.planned_qty - product.good_qty) }}
                        units
                      </v-chip>
                    </div>
                    <v-row
                      v-for="(disc, discIndex) in product.discrepancies"
                      :key="discIndex"
                      class="align-center mb-2"
                    >
                      <v-col cols="12" md="5">
                        <v-select
                          v-model="disc.reason_id"
                          density="compact"
                          item-title="name"
                          item-value="id"
                          :items="discrepancyReasons"
                          label="Reason"
                          prepend-inner-icon="mdi-alert-circle-outline"
                          variant="outlined"
                        />
                      </v-col>
                      <v-col cols="12" md="5">
                        <v-text-field
                          v-model="disc.notes"
                          density="compact"
                          label="Notes"
                          variant="outlined"
                        />
                      </v-col>
                      <v-col class="text-right" cols="12" md="2">
                        <v-btn
                          color="error"
                          icon
                          size="small"
                          variant="text"
                          @click="removeProductDiscrepancy(product, discIndex)"
                        >
                          <v-icon>mdi-delete</v-icon>
                        </v-btn>
                      </v-col>
                    </v-row>
                    <v-btn
                      color="primary"
                      size="small"
                      variant="outlined"
                      @click="addProductDiscrepancy(product)"
                    >
                      <v-icon start>mdi-plus</v-icon>
                      Add Reason
                    </v-btn>
                  </template>
                </v-card-text>
              </v-card>
            </v-card>

            <!-- Batch Summary -->
            <v-card class="rounded-lg pa-4" variant="outlined">
              <div class="d-flex align-center mb-3">
                <v-icon class="mr-2" color="primary">mdi-chart-box</v-icon>
                <h4 class="text-h6 font-weight-medium">Batch Summary</h4>
              </div>
              <v-row>
                <v-col cols="12" md="3">
                  <v-card border class="text-center" variant="outlined">
                    <v-card-text>
                      <div class="text-h6 font-weight-bold text-green">
                        {{ batchActualTotal.good_qty }}
                      </div>
                      <div class="text-caption text-grey">Total Good</div>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" md="3">
                  <v-card border class="text-center" variant="outlined">
                    <v-card-text>
                      <div class="text-h6 font-weight-bold text-orange">
                        {{ batchActualTotal.damaged_qty }}
                      </div>
                      <div class="text-caption text-grey">Total Damaged</div>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" md="3">
                  <v-card border class="text-center" variant="outlined">
                    <v-card-text>
                      <div class="text-h6 font-weight-bold text-red">
                        {{ batchActualTotal.reject_qty }}
                      </div>
                      <div class="text-caption text-grey">Total Reject</div>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" md="3">
                  <v-card border class="text-center" variant="outlined">
                    <v-card-text>
                      <div class="text-h6 font-weight-bold text-primary">
                        {{ batchActualTotal.actual_qty }}
                      </div>
                      <div class="text-caption text-grey">Total Actual</div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card>
          </v-form>
        </v-card-text>

        <!-- ACTIONS -->
        <v-card-actions class="pa-6 bg-grey-lighten-4 rounded-b-xl">
          <v-spacer />
          <v-btn
            class="px-6"
            color="grey"
            variant="outlined"
            @click="closeBatchActualDialog"
          >
            Cancel
          </v-btn>
          <v-btn
            class="px-6"
            color="success"
            :disabled="!canSaveBatchActual"
            elevation="2"
            :loading="saving"
            @click="saveBatchActualProduction"
          >
            <v-icon start>mdi-content-save-check</v-icon>
            Save Actual Production
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ADD/EDIT DIALOG -->
    <v-dialog v-model="dialog" max-width="1400" persistent scrollable>
      <v-card class="rounded-xl" elevation="16">
        <!-- Header -->
        <v-toolbar class="rounded-t-xl" color="primary" density="comfortable">
          <v-avatar class="mr-3" color="white" size="36">
            <v-icon
              color="primary"
              :icon="isEditing ? 'mdi-pencil' : 'mdi-plus'"
            />
          </v-avatar>
          <v-toolbar-title class="text-h5 font-weight-bold text-white">
            {{
              isAddingActual
                ? "Add Actual Quantity"
                : isEditing
                  ? "Edit Production"
                  : "Create New Production (Multiple Products)"
            }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            color="white"
            icon="mdi-close"
            variant="text"
            @click="closeDialog"
          />
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="saveProduction">
            <!-- BASIC INFORMATION -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center mb-4">
                <v-icon class="mr-2" color="primary"> mdi-information </v-icon>
                <h4 class="text-h6 font-weight-medium">Batch Information</h4>
              </div>
              <v-row dense>
                <v-col cols="12" md="4">
                  <div class="position-relative w-100">
                    <span v-if="form.planned_at" class="datepicker-label">
                      Planned Production Date &amp; Time
                    </span>
                    <VueDatePicker
                      v-model="form.planned_at"
                      auto-apply
                      class="rounded-lg border px-4 py-2 w-100"
                      :enable-time-picker="true"
                      format="dd-MM-yyyy HH:mm"
                      model-type="format"
                      placeholder="Select Planned Production Date & Time"
                      :teleport="true"
                    />
                  </div>
                </v-col>
                <v-col v-if="actualAdded" cols="12" md="4">
                  <div class="position-relative w-100">
                    <span v-if="form.produced_at" class="datepicker-label">
                      Actual Production Date &amp; Time
                    </span>
                    <VueDatePicker
                      v-model="form.produced_at"
                      auto-apply
                      class="rounded-lg border px-4 py-2 w-100"
                      :enable-time-picker="true"
                      format="dd-MM-yyyy HH:mm"
                      model-type="format"
                      placeholder="Select Actual Production Date & Time"
                      :teleport="true"
                    />
                  </div>
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="form.notes"
                    color="primary"
                    label="Batch Notes (optional)"
                    prepend-inner-icon="mdi-note-text"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </v-card>

            <!-- PRODUCTS CONFIGURATION (MULTI-PRODUCT) -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center">
                  <v-icon class="mr-2" color="primary">
                    mdi-package-variant
                  </v-icon>
                  <h4 class="text-h6 font-weight-medium">
                    Products in this Batch
                  </h4>
                </div>
                <v-btn
                  color="primary"
                  size="small"
                  variant="outlined"
                  @click="addProductRow"
                >
                  <v-icon start>mdi-plus</v-icon>
                  Add Product
                </v-btn>
              </div>

              <v-alert
                v-if="!form.products.length"
                border="start"
                class="mb-3"
                type="info"
                variant="tonal"
              >
                Add one or more products to this production batch. Each product
                keeps its own mode and ingredients.
              </v-alert>

              <v-row v-for="(p, index) in form.products" :key="p.uid" dense>
                <v-col cols="12">
                  <v-card class="mb-3" :ripple="false" variant="outlined">
                    <v-card-text class="pa-3">
                      <div class="d-flex align-center mb-3">
                        <v-chip
                          class="mr-2"
                          color="primary"
                          size="small"
                          variant="flat"
                        >
                          Product #{{ index + 1 }}
                        </v-chip>
                        <span class="text-body-2 text-grey">
                          {{ productLabel(p) }}
                        </span>
                        <v-spacer />
                        <v-btn
                          v-if="form.products.length > 1"
                          color="error"
                          icon
                          size="x-small"
                          variant="text"
                          @click="removeProductRow(index)"
                        >
                          <v-icon>mdi-close</v-icon>
                        </v-btn>
                      </div>

                      <v-row dense>
                        <v-col cols="12" md="5">
                          <v-autocomplete
                            v-model="p.product_id"
                            clearable
                            density="compact"
                            item-title="name"
                            item-value="id"
                            :items="products"
                            label="Select Product"
                            prepend-inner-icon="mdi-package-variant"
                            variant="outlined"
                            @update:model-value="() => onProductChange(p)"
                          />
                        </v-col>

                        <v-col cols="12" md="3">
                          <v-select
                            v-model="p.mode"
                            density="compact"
                            item-title="label"
                            item-value="value"
                            :items="modes"
                            label="Production Mode"
                            prepend-inner-icon="mdi-cog"
                            variant="outlined"
                            @update:model-value="
                              () => recalcProductIngredients(p)
                            "
                          />
                        </v-col>

                        <!-- By Product -->
                        <v-col v-if="p.mode === 'by_product'" cols="12" md="4">
                          <v-text-field
                            v-model.number="p.qty_product_input"
                            density="compact"
                            label="Planned Units"
                            prepend-inner-icon="mdi-counter"
                            type="number"
                            variant="outlined"
                            @input="() => recalcProductIngredients(p)"
                          />
                        </v-col>

                        <!-- By Ingredient -->
                        <template v-else-if="p.mode === 'by_ingredient'">
                          <v-col cols="12" md="4">
                            <v-autocomplete
                              v-model="p.base_ingredient_id"
                              density="compact"
                              :disabled="!p.recipeItems.length"
                              item-title="item_name"
                              item-value="item_id"
                              :items="p.recipeItems"
                              label="Base Ingredient"
                              prepend-inner-icon="mdi-ingredient"
                              variant="outlined"
                              @update:model-value="
                                () => recalcProductIngredients(p)
                              "
                            />
                          </v-col>
                          <v-col cols="12" md="3">
                            <v-text-field
                              v-model.number="p.base_ingredient_qty"
                              density="compact"
                              :disabled="!p.base_ingredient_id"
                              :label="`Base Qty (${p.baseUnit || 'units'})`"
                              prepend-inner-icon="mdi-weight"
                              type="number"
                              variant="outlined"
                              @input="() => recalcProductIngredients(p)"
                            />
                          </v-col>
                          <v-col class="d-flex align-center" cols="12" md="1">
                            <v-chip
                              v-if="p.computed_qty_product"
                              color="blue"
                              size="small"
                              variant="flat"
                            >
                              Planned {{ p.computed_qty_product }} units
                            </v-chip>
                          </v-col>
                        </template>
                        <v-card-text v-if="actualAdded" class="pa-4">
                          <div class="d-flex align-center mb-3">
                            <v-chip
                              :color="p.hasDiscrepancy ? 'orange' : 'green'"
                              size="small"
                              variant="flat"
                            >
                              {{
                                p.hasDiscrepancy
                                  ? "Discrepancy: " +
                                    Math.abs(p.planned_qty - p.good_qty) +
                                    " units"
                                  : "On Track"
                              }}
                            </v-chip>
                          </div>

                          <v-row dense>
                            <v-col cols="12" md="3">
                              <v-text-field
                                v-model.number="p.good_qty"
                                color="green"
                                density="compact"
                                :label="`Good Quantity (${p.planned_qty} planned)`"
                                type="number"
                                variant="outlined"
                                @input="updateProductDiscrepancy(p)"
                              >
                                <template #prepend-inner>
                                  <v-icon color="green" size="20"
                                    >mdi-check-decagram</v-icon
                                  >
                                </template>
                              </v-text-field>
                            </v-col>
                            <v-col cols="12" md="3">
                              <v-text-field
                                v-model.number="p.damaged_qty"
                                color="orange"
                                density="compact"
                                label="Damaged Quantity"
                                type="number"
                                variant="outlined"
                                @input="updateProductDiscrepancy(p)"
                              >
                                <template #prepend-inner>
                                  <v-icon color="orange" size="20"
                                    >mdi-alert-circle-outline</v-icon
                                  >
                                </template>
                              </v-text-field>
                            </v-col>
                            <v-col cols="12" md="3">
                              <v-text-field
                                v-model.number="p.reject_qty"
                                color="red"
                                density="compact"
                                label="Reject Quantity"
                                type="number"
                                variant="outlined"
                                @input="updateProductDiscrepancy(p)"
                              >
                                <template #prepend-inner>
                                  <v-icon color="red" size="20"
                                    >mdi-close-octagon-outline</v-icon
                                  >
                                </template>
                              </v-text-field>
                            </v-col>
                            <v-col cols="12" md="3">
                              <v-text-field
                                v-model.number="p.actual_qty"
                                color="primary"
                                density="compact"
                                label="Total Actual"
                                readonly
                                type="number"
                                variant="outlined"
                              >
                                <template #prepend-inner>
                                  <v-icon color="primary" size="20"
                                    >mdi-counter</v-icon
                                  >
                                </template>
                              </v-text-field>
                            </v-col>
                          </v-row>

                          <!-- Discrepancy Reasons -->
                          <template v-if="p.hasDiscrepancy">
                            <v-divider class="my-3" />
                            <v-row
                              v-for="(disc, discIndex) in p.discrepancies"
                              :key="discIndex"
                              class="align-center mb-2"
                            >
                              <v-col cols="12" md="5">
                                <v-select
                                  v-model="disc.reason_id"
                                  density="compact"
                                  item-title="name"
                                  item-value="id"
                                  :items="discrepancyReasons"
                                  label="Reason"
                                  prepend-inner-icon="mdi-alert-circle-outline"
                                  variant="outlined"
                                />
                              </v-col>
                              <v-col cols="12" md="5">
                                <v-text-field
                                  v-model="disc.notes"
                                  density="compact"
                                  label="Notes"
                                  variant="outlined"
                                />
                              </v-col>
                              <v-col class="text-right" cols="12" md="2">
                                <v-btn
                                  color="error"
                                  icon
                                  size="small"
                                  variant="text"
                                  @click="
                                    removeProductDiscrepancy(p, discIndex)
                                  "
                                >
                                  <v-icon>mdi-delete</v-icon>
                                </v-btn>
                              </v-col>
                            </v-row>
                            <v-btn
                              color="primary"
                              size="small"
                              variant="outlined"
                              @click="addProductDiscrepancy(p)"
                            >
                              <v-icon start>mdi-plus</v-icon>
                              Add Reason
                            </v-btn>
                          </template>
                        </v-card-text>
                      </v-row>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <v-alert
                v-if="form.products.length"
                border="start"
                class="mt-2"
                type="success"
                variant="tonal"
              >
                Total planned units for this batch:
                <b>{{ computedTotalPlannedUnits }}</b>
              </v-alert>
            </v-card>

            <!-- INGREDIENTS TABS (PER PRODUCT) + SUMMARY -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center">
                  <v-icon class="mr-2" color="primary"> mdi-ingredient </v-icon>
                  <h4 class="text-h6 font-weight-medium">
                    Ingredients & Groups
                  </h4>
                </div>
                <v-btn
                  v-if="
                    deprecated_groups.length &&
                    !ignore_deprecated_ingredients_choices
                  "
                  color="warning"
                  @click="useInactiveGroups(true)"
                  >Ignore Deprecated Ingredients Options</v-btn
                >
                <v-btn
                  v-else-if="
                    deprecated_groups.length &&
                    ignore_deprecated_ingredients_choices
                  "
                  color="success"
                  @click="useInactiveGroups(false)"
                  >Use Deprecated Ingredients Options</v-btn
                >
                <v-switch
                  v-model="editEnabled"
                  color="primary"
                  hide-details
                  inset
                  :label="editEnabled ? 'Editing Enabled' : 'Editing Disabled'"
                />
              </div>

              <v-alert
                v-if="hasInsufficientStock"
                border="start"
                class="mb-3"
                type="error"
                variant="tonal"
              >
                Some ingredients exceed available stock. Please adjust
                quantities before saving.
              </v-alert>

              <v-tabs
                v-model="ingredientTabs"
                bg-color="transparent"
                color="primary"
                density="comfortable"
                show-arrows
              >
                <v-tab
                  v-for="(p, index) in form.products"
                  :key="p.uid"
                  :value="index"
                >
                  {{ pTabLabel(p, index) }}
                </v-tab>
                <v-tab v-if="form.products.length" :value="'summary'">
                  All Ingredients Summary
                </v-tab>
              </v-tabs>

              <v-window v-model="ingredientTabs" class="mt-4">
                <!-- Per-product ingredient tabs -->
                <v-window-item
                  v-for="(p, index) in form.products"
                  :key="`win-${p.uid}`"
                  :value="index"
                >
                  <!-- Inner tabs: Ingredients / Groups for this product -->
                  <v-tabs
                    v-model="p.innerTab"
                    class="mb-2"
                    color="primary"
                    density="compact"
                  >
                    <v-tab value="ingredients">Ingredients</v-tab>
                    <v-tab value="groups"> Ingredient Groups </v-tab>
                  </v-tabs>

                  <v-window v-model="p.innerTab">
                    <!-- INGREDIENTS TABLE -->
                    <v-window-item value="ingredients">
                      <v-data-table
                        class="elevation-1 rounded-lg"
                        density="comfortable"
                        :headers="ingredientHeaders"
                        :items="p.ingredients"
                      >
                        <template #item.item_name="{ item }">
                          <div class="d-flex align-center">
                            <v-icon
                              v-if="item.from_group"
                              class="mr-2"
                              color="purple"
                              size="16"
                            >
                              mdi-cog
                            </v-icon>
                            <span>{{ item.item_name }}</span>
                            <v-chip
                              v-if="item.group_name"
                              class="ml-2"
                              color="purple"
                              size="x-small"
                              variant="outlined"
                            >
                              {{ item.group_name }}
                            </v-chip>
                          </div>
                        </template>

                        <template #item.qty_required="{ item }">
                          <div class="d-flex align-center">
                            <v-text-field
                              v-model.number="item.qty_required"
                              autocomplete="off"
                              autocorrect="off"
                              density="compact"
                              :disabled="!editEnabled"
                              :error="item.exceeds"
                              :error-messages="
                                item.exceeds
                                  ? [
                                      'Exceeds available stock across all products',
                                    ]
                                  : []
                              "
                              hide-details
                              inputmode="none"
                              spellcheck="false"
                              style="max-width: 140px"
                              type="number"
                              variant="outlined"
                              @input="updateIngredientBalances"
                            >
                              <template #append-inner>
                                <span
                                  class="text-caption"
                                  :class="
                                    item.exceeds ? 'text-error' : 'text-grey'
                                  "
                                >
                                  {{ item.unit }}
                                </span>
                              </template>
                            </v-text-field>

                            <v-tooltip
                              v-if="item.exceeds"
                              location="top"
                              :text="
                                isEditing
                                  ? `Stock: ${item.available - (item.previously_used || 0)} + Previously allocated: ${item.previously_used || 0} = ${item.available} available for editing`
                                  : `Maximum available: ${item.available} ${item.unit || ''} (across all products)`
                              "
                            >
                              <template #activator="{ props }">
                                <v-btn
                                  v-bind="props"
                                  class="ml-1"
                                  color="orange"
                                  icon
                                  size="x-small"
                                  variant="text"
                                  @click="
                                    adjustIngredientToAvailable(
                                      item.item_id,
                                      item.available,
                                    )
                                  "
                                >
                                  <v-icon size="16">
                                    mdi-information-outline
                                  </v-icon>
                                </v-btn>
                              </template>
                            </v-tooltip>
                          </div>
                        </template>

                        <template #item.balance="{ item }">
                          <v-chip
                            class="font-weight-medium"
                            :color="item.exceeds ? 'red' : 'blue'"
                            size="small"
                            variant="outlined"
                          >
                            {{ item.balance || 0 }}
                            {{ item.unit }}
                          </v-chip>
                        </template>

                        <template #item.unit="{ item }">
                          <v-chip
                            color="blue-grey"
                            size="small"
                            variant="outlined"
                          >
                            {{ item.unit }}
                          </v-chip>
                        </template>

                        <template #no-data>
                          <div class="text-center py-4 text-grey">
                            Configure this product (mode + quantity) to
                            calculate ingredients
                          </div>
                        </template>
                      </v-data-table>

                      <v-alert
                        v-if="p.computed_qty_product"
                        border="start"
                        class="mt-3"
                        type="success"
                        variant="tonal"
                      >
                        Planned units for
                        <b>{{ productNameById(p.product_id) }}</b
                        >: <b>{{ p.computed_qty_product }}</b
                        >. Ingredients above are specific to this product.
                      </v-alert>
                    </v-window-item>

                    <!-- GROUPS TAB (Product-specific) -->
                    <v-window-item value="groups">
                      <v-card
                        v-if="p.productGroups && p.productGroups.length"
                        class="rounded-lg"
                        variant="outlined"
                      >
                        <v-card-text class="pa-4">
                          <div class="d-flex align-center mb-4">
                            <v-icon class="mr-2" color="purple">
                              mdi-cog
                            </v-icon>
                            <h5 class="text-h6 font-weight-medium">
                              Ingredient Groups for
                              {{ productNameById(p.product_id) }}
                            </h5>
                            <v-chip
                              class="ml-2"
                              color="purple"
                              size="small"
                              variant="flat"
                            >
                              {{ p.productGroups.length }} groups
                            </v-chip>
                          </div>

                          <v-alert class="mb-4" type="info" variant="tonal">
                            Select combinations per group to update ingredients
                            for this product.
                          </v-alert>

                          <v-expansion-panels
                            v-model="p.expandedGroups"
                            multiple
                          >
                            <v-expansion-panel
                              v-for="(group, gi) in p.productGroups"
                              :key="group.id"
                              class="mb-2"
                            >
                              <v-expansion-panel-title
                                class="font-weight-medium"
                              >
                                <div
                                  class="d-flex align-center justify-space-between w-100 pr-4"
                                >
                                  <div class="d-flex align-center">
                                    <v-icon class="mr-2" color="purple">
                                      mdi-cog
                                    </v-icon>
                                    <span>{{ group.name }}</span>
                                    <v-chip
                                      v-if="group.is_mandatory"
                                      class="ml-2"
                                      color="red"
                                      size="x-small"
                                      variant="flat"
                                    >
                                      Required
                                    </v-chip>
                                    <v-chip
                                      v-else
                                      class="ml-2"
                                      color="grey"
                                      size="x-small"
                                      variant="outlined"
                                    >
                                      Optional
                                    </v-chip>
                                    <v-chip
                                      v-if="group.deprecated"
                                      class="ml-2"
                                      color="warning"
                                      size="x-small"
                                      variant="flat"
                                    >
                                      Deprecated
                                    </v-chip>
                                  </div>
                                  <div class="d-flex align-center">
                                    <v-chip
                                      class="mr-2"
                                      color="blue"
                                      size="x-small"
                                      variant="outlined"
                                    >
                                      {{ group.selection_mode }}
                                    </v-chip>
                                    <v-chip
                                      v-if="p.group_choices[group.id]"
                                      color="green"
                                      size="x-small"
                                      variant="flat"
                                    >
                                      Selected
                                    </v-chip>
                                    <v-chip
                                      v-else
                                      color="orange"
                                      size="x-small"
                                      variant="outlined"
                                    >
                                      Not Selected
                                    </v-chip>
                                  </div>
                                </div>
                              </v-expansion-panel-title>

                              <v-expansion-panel-text>
                                <p class="text-caption text-grey mb-2">
                                  {{ group.description }}
                                </p>

                                <v-radio-group
                                  v-model="p.group_choices[group.id]"
                                  hide-details
                                  @update:model-value="
                                    () => recalcProductIngredients(p)
                                  "
                                >
                                  <v-row>
                                    <v-col
                                      v-for="combination in group.combinations"
                                      :key="combination.id"
                                      cols="12"
                                      md="6"
                                    >
                                      <v-card
                                        :class="[
                                          'combination-card',
                                          {
                                            selected:
                                              p.group_choices[group.id] ===
                                              combination.id,
                                          },
                                        ]"
                                        variant="outlined"
                                        @click="
                                          p.group_choices[group.id] =
                                            combination.id;
                                          recalcProductIngredients(p);
                                        "
                                      >
                                        <v-card-text class="pa-3">
                                          <div class="d-flex align-center">
                                            <v-radio
                                              hide-details
                                              :value="combination.id"
                                            />
                                            <div class="ml-2 flex-grow-1">
                                              <div class="font-weight-medium">
                                                {{ combination.name }}
                                              </div>
                                              <div
                                                v-if="combination.notes"
                                                class="text-caption text-grey"
                                              >
                                                {{ combination.notes }}
                                              </div>
                                              <div class="mt-2">
                                                <v-chip
                                                  v-for="option in combination.options"
                                                  :key="option.option_id"
                                                  class="mr-1 mb-1"
                                                  color="green"
                                                  size="x-small"
                                                  variant="outlined"
                                                >
                                                  {{ option.item_name }}:
                                                  {{ option.quantity_per_unit }}
                                                  {{ option.unit }}
                                                </v-chip>
                                              </div>
                                            </div>
                                            <v-chip
                                              v-if="combination.is_default"
                                              color="orange"
                                              size="x-small"
                                              variant="flat"
                                            >
                                              Default
                                            </v-chip>
                                          </div>
                                        </v-card-text>
                                      </v-card>
                                    </v-col>
                                  </v-row>
                                </v-radio-group>
                              </v-expansion-panel-text>
                            </v-expansion-panel>
                          </v-expansion-panels>
                        </v-card-text>
                      </v-card>

                      <v-alert
                        v-else
                        border="start"
                        type="info"
                        variant="tonal"
                      >
                        No ingredient groups configured for this product.
                      </v-alert>
                    </v-window-item>
                  </v-window>
                </v-window-item>

                <!-- SUMMARY TAB -->
                <v-window-item value="summary">
                  <v-data-table
                    class="elevation-1 rounded-lg"
                    density="comfortable"
                    :headers="ingredientHeaders"
                    :items="allIngredientsSummary"
                  >
                    <template #item.item_name="{ item }">
                      <div class="d-flex align-center">
                        <v-avatar
                          class="mr-2"
                          color="primary"
                          size="22"
                          variant="tonal"
                        >
                          <v-icon color="primary" size="14">
                            mdi-ingredient
                          </v-icon>
                        </v-avatar>
                        <span>{{ item.item_name }}</span>
                      </div>
                    </template>

                    <template #item.qty_required="{ item }">
                      <v-chip
                        :color="item.exceeds ? 'red' : 'green'"
                        size="small"
                        variant="outlined"
                      >
                        {{ item.qty_required }} {{ item.unit }}
                      </v-chip>
                    </template>

                    <template #item.available="{ item }">
                      <v-chip
                        :color="item.exceeds ? 'red' : 'blue'"
                        size="small"
                        variant="outlined"
                      >
                        {{ item.available || 0 }} {{ item.unit }}
                      </v-chip>
                    </template>

                    <template #item.unit="{ item }">
                      <span>{{ item.unit }}</span>
                    </template>

                    <template #no-data>
                      <div class="text-center py-4 text-grey">
                        Add products and configure ingredients to see a
                        consolidated summary.
                      </div>
                    </template>
                  </v-data-table>

                  <v-alert
                    v-if="allIngredientsSummary.length"
                    border="start"
                    class="mt-3"
                    type="success"
                    variant="tonal"
                  >
                    Consolidated ingredient requirements across all products in
                    this batch.
                  </v-alert>
                </v-window-item>
              </v-window>
            </v-card>

            <!-- STAFF ASSIGNMENT (BATCH LEVEL) -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center">
                  <v-icon class="mr-2" color="primary">
                    mdi-account-group
                  </v-icon>
                  <h4 class="text-h6 font-weight-medium">Staff Assignment</h4>
                </div>
                <div class="d-flex gap-2">
                  <v-btn
                    color="primary"
                    :disabled="!availableStaff.length"
                    size="small"
                    variant="outlined"
                    @click="addStaffMember"
                  >
                    <v-icon start>mdi-account-plus</v-icon>
                    Add Staff
                  </v-btn>
                  <v-btn
                    color="secondary"
                    :disabled="!form.staff.length"
                    size="small"
                    variant="outlined"
                    @click="clearAllStaff"
                  >
                    <v-icon start>mdi-account-remove</v-icon>
                    Clear All
                  </v-btn>
                </div>
              </div>

              <v-data-table
                class="elevation-1 rounded-lg"
                density="comfortable"
                :headers="staffHeaders"
                :items="form.staff"
              >
                <template #item.staff_id="{ item }">
                  <v-autocomplete
                    v-model="item.staff_id"
                    density="compact"
                    :disabled="!editEnabled"
                    hide-details
                    item-title="name"
                    item-value="id"
                    :items="staffList"
                    placeholder="Select Staff"
                    variant="outlined"
                  />
                </template>
                <template #item.role="{ item }">
                  <v-select
                    v-model="item.role"
                    density="compact"
                    :disabled="!editEnabled"
                    hide-details
                    :items="['Team Leader', 'Assistant', 'Support']"
                    prepend-inner-icon="mdi-account-tie"
                    variant="outlined"
                  />
                </template>
                <template #item.notes="{ item }">
                  <v-text-field
                    v-model="item.notes"
                    density="compact"
                    :disabled="!editEnabled"
                    hide-details
                    variant="outlined"
                  />
                </template>
                <template #item.actions="{ index }">
                  <v-btn
                    color="error"
                    :disabled="!editEnabled"
                    icon
                    size="small"
                    variant="text"
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

              <v-alert
                v-if="form.staff.length"
                border="start"
                class="mt-4"
                type="info"
                variant="tonal"
              >
                <div class="d-flex justify-space-between align-center">
                  <div>
                    <strong>Team Summary:</strong>
                    <v-chip
                      class="ml-2"
                      color="primary"
                      size="small"
                      variant="flat"
                    >
                      {{ form.staff.length }} staff members
                    </v-chip>
                  </div>
                  <div class="text-caption text-grey">
                    {{ assignedStaffCount }} of
                    {{ availableStaff.length + assignedStaffCount }}
                    staff assigned
                  </div>
                </div>
              </v-alert>
            </v-card>
          </v-form>
        </v-card-text>

        <!-- ACTIONS -->
        <v-card-actions class="pa-6 bg-grey-lighten-4 rounded-b-xl">
          <v-spacer />
          <v-btn
            class="px-6"
            color="grey"
            variant="outlined"
            @click="closeDialog"
          >
            Cancel
          </v-btn>
          <v-btn
            class="px-6"
            color="success"
            :disabled="!canSave"
            elevation="2"
            :loading="saving"
            @click="saveProduction"
          >
            <v-icon start>mdi-content-save-check</v-icon>
            {{ isEditing ? "Update Production" : "Create Production" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- VIEW DIALOG -->
    <v-dialog
      v-model="viewDialog"
      max-width="1000"
      scrollable
      transition="dialog-bottom-transition"
    >
      <v-card class="rounded-xl" elevation="16">
        <v-toolbar class="rounded-t-xl" color="primary" density="comfortable">
          <v-avatar class="mr-3" color="white" size="36">
            <v-icon color="primary">mdi-eye</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h5 font-weight-bold text-white">
            Production Details - {{ detail?.production?.product_name }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            color="white"
            icon="mdi-close"
            variant="text"
            @click="viewDialog = false"
          />
        </v-toolbar>

        <v-card-text class="pa-6">
          <!-- Production Information -->
          <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
            <div class="d-flex align-center mb-4">
              <v-icon class="mr-2" color="primary">mdi-information</v-icon>
              <h4 class="text-h6 font-weight-medium">Production Information</h4>
            </div>
            <v-row>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Production ID</div>
                <div class="text-h6 font-weight-bold">
                  #{{ detail?.production?.id }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Product</div>
                <div class="text-body-1 font-weight-medium">
                  {{ detail?.production?.product_name }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Production Mode</div>
                <div class="text-body-1 font-weight-medium">
                  {{ detail?.production?.mode }}
                </div>
              </v-col>
            </v-row>

            <v-row class="mt-2">
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Planned At</div>
                <div class="text-body-1 font-weight-medium">
                  {{ formatDate(detail?.production?.planned_at) }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Produced At</div>
                <div class="text-body-1 font-weight-medium">
                  {{ formatDate(detail?.production?.produced_at) }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Produced By</div>
                <div class="text-body-1 font-weight-medium">
                  {{ detail?.production?.produced_by_name }}
                </div>
              </v-col>
            </v-row>

            <v-row class="mt-2">
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Created</div>
                <div class="text-body-1 font-weight-medium">
                  {{ formatDate(detail?.production?.created) }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Last Updated</div>
                <div class="text-body-1 font-weight-medium">
                  {{ formatDate(detail?.production?.updated_at) }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Batch ID</div>
                <div class="text-body-1 font-weight-medium">
                  {{ detail?.production?.batch_id || "N/A" }}
                </div>
              </v-col>
            </v-row>

            <!-- Production Quantities -->
            <v-row class="mt-4">
              <v-col cols="12" md="3">
                <v-card border class="text-center" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 font-weight-bold text-green">
                      {{ detail?.production?.qty_product }}
                    </div>
                    <div class="text-caption text-grey">Planned Quantity</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="3">
                <v-card border class="text-center" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 font-weight-bold text-blue">
                      {{ detail?.production?.actual_qty }}
                    </div>
                    <div class="text-caption text-grey">Actual Quantity</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="2">
                <v-card border class="text-center" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 font-weight-bold text-green">
                      {{ detail?.production?.good_qty || 0 }}
                    </div>
                    <div class="text-caption text-grey">Good</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="2">
                <v-card border class="text-center" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 font-weight-bold text-orange">
                      {{ detail?.production?.damaged_qty || 0 }}
                    </div>
                    <div class="text-caption text-grey">Damaged</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="2">
                <v-card border class="text-center" variant="outlined">
                  <v-card-text>
                    <div class="text-h6 font-weight-bold text-red">
                      {{ detail?.production?.reject_qty || 0 }}
                    </div>
                    <div class="text-caption text-grey">Reject</div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- Notes -->
            <v-row v-if="detail?.production?.notes" class="mt-4">
              <v-col cols="12">
                <div class="text-body-2 text-grey">Notes</div>
                <div class="text-body-1 font-weight-medium">
                  {{ detail.production.notes }}
                </div>
              </v-col>
            </v-row>
          </v-card>

          <!-- Ingredients -->
          <v-card class="rounded-lg mb-4" variant="outlined">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="primary">mdi-ingredient</v-icon>
              Ingredients Used
              <v-chip class="ml-2" color="primary" size="small" variant="flat">
                {{ detail?.items?.length || 0 }} items
              </v-chip>
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list class="pa-0" lines="two">
                <v-list-item
                  v-for="(ingredient, index) in detail?.items || []"
                  :key="ingredient.id"
                  class="px-4"
                  :class="{ 'bg-grey-lighten-4': index % 2 === 0 }"
                >
                  <template #prepend>
                    <v-avatar class="mr-3" color="primary" size="36">
                      <span class="text-white text-caption font-weight-bold">
                        {{ index + 1 }}
                      </span>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ ingredient.item_name }}
                    <v-chip
                      v-if="ingredient.group_name"
                      class="ml-2"
                      color="purple"
                      size="x-small"
                      variant="outlined"
                    >
                      {{ ingredient.group_name }}
                    </v-chip>
                    <v-chip
                      v-if="ingredient.combination_name"
                      class="ml-1"
                      color="green"
                      size="x-small"
                      variant="outlined"
                    >
                      {{ ingredient.combination_name }}
                    </v-chip>
                  </v-list-item-title>

                  <v-list-item-subtitle class="mt-1">
                    <v-chip
                      class="mr-2"
                      color="primary"
                      size="small"
                      variant="outlined"
                    >
                      {{ ingredient.qty_required }} {{ ingredient.unit || "" }}
                    </v-chip>
                    <span class="text-caption text-grey">
                      Item ID: {{ ingredient.item_id }}
                    </span>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>

          <!-- Group Choices -->
          <v-card
            v-if="detail?.group_choices?.length"
            class="rounded-lg mb-4"
            variant="outlined"
          >
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="purple">mdi-cog</v-icon>
              Ingredient Group Choices
              <v-chip class="ml-2" color="purple" size="small" variant="flat">
                {{ detail.group_choices.length }} groups
              </v-chip>
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list class="pa-0" lines="two">
                <v-list-item
                  v-for="(choice, index) in detail.group_choices"
                  :key="choice.id"
                  class="px-4"
                  :class="{ 'bg-grey-lighten-4': index % 2 === 0 }"
                >
                  <template #prepend>
                    <v-avatar class="mr-3" color="purple" size="36">
                      <v-icon color="white" size="18">mdi-cog</v-icon>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ choice.group_name }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="mt-1">
                    <v-chip color="green" size="small" variant="outlined">
                      {{ choice.combination_name }}
                    </v-chip>
                    <span
                      v-if="choice.chosen_by_name"
                      class="text-caption text-grey ml-2"
                    >
                      Chosen by: {{ choice.chosen_by_name }}
                    </span>
                    <span class="text-caption text-grey ml-2">
                      Created: {{ formatDate(choice.created_at) }}
                    </span>
                  </v-list-item-subtitle>

                  <v-list-item-subtitle
                    v-if="choice.notes"
                    class="mt-1 text-caption"
                  >
                    <strong>Notes:</strong> {{ choice.notes }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
          <!-- Staff Assignments -->
          <v-card
            v-if="detail?.staff?.length"
            class="rounded-lg mb-4"
            variant="outlined"
          >
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="blue">mdi-account-group</v-icon>
              Staff Assignments
              <v-chip class="ml-2" color="blue" size="small" variant="flat">
                {{ detail.staff.length }} staff
              </v-chip>
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list class="pa-0" lines="two">
                <v-list-item
                  v-for="(staff, index) in detail.staff"
                  :key="staff.staff_id"
                  class="px-4"
                  :class="{ 'bg-grey-lighten-4': index % 2 === 0 }"
                >
                  <template #prepend>
                    <v-avatar class="mr-3" color="blue" size="36">
                      <span class="text-white text-caption font-weight-bold">
                        {{ index + 1 }}
                      </span>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ staff.staff_name }}
                    <v-chip
                      class="ml-2"
                      :color="getRoleColor(staff.role)"
                      size="x-small"
                      variant="flat"
                    >
                      {{ staff.role }}
                    </v-chip>
                  </v-list-item-title>

                  <v-list-item-subtitle class="mt-1">
                    <span v-if="staff.notes" class="text-caption">
                      {{ staff.notes }}
                    </span>
                    <span v-else class="text-caption text-grey">
                      No notes
                    </span>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>

          <!-- Discrepancies -->
          <v-card
            v-if="detail?.discrepancies?.length"
            class="rounded-lg"
            variant="outlined"
          >
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="orange">mdi-alert-circle</v-icon>
              Discrepancies
              <v-chip class="ml-2" color="orange" size="small" variant="flat">
                {{ detail.discrepancies.length }} issues
              </v-chip>
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list class="pa-0" lines="two">
                <v-list-item
                  v-for="(discrepancy, index) in detail.discrepancies"
                  :key="discrepancy.id"
                  class="px-4"
                  :class="{ 'bg-grey-lighten-4': index % 2 === 0 }"
                >
                  <template #prepend>
                    <v-avatar class="mr-3" color="orange" size="36">
                      <v-icon color="white" size="18">mdi-alert</v-icon>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ discrepancy.reason_name }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="mt-1">
                    <span class="text-caption text-grey">
                      Reason ID: {{ discrepancy.reason_id }}
                    </span>
                  </v-list-item-subtitle>

                  <v-list-item-subtitle
                    v-if="discrepancy.notes"
                    class="mt-1 text-caption"
                  >
                    <strong>Notes:</strong> {{ discrepancy.notes }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>

          <!-- No Data Message -->
          <v-card
            v-if="
              !detail?.items?.length &&
              !detail?.staff?.length &&
              !detail?.group_choices?.length &&
              !detail?.discrepancies?.length
            "
            class="rounded-lg text-center py-8"
            variant="outlined"
          >
            <v-icon class="mb-2" color="grey" size="48"
              >mdi-information-outline</v-icon
            >
            <div class="text-h6 text-grey">No Additional Data</div>
            <div class="text-body-2 text-grey mt-2">
              This production record doesn't have any additional items, staff,
              or discrepancies.
            </div>
          </v-card>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { toDisplay, toISO } from "@/utils/date.js";

const loading = ref(false);
const saving = ref(false);
const productions = ref([]);
const batches = ref([]);
const showBatches = ref(true);
const page = ref(1);
const totalPages = ref(1);
const dialog = ref(false);
const viewDialog = ref(false);
const batchViewDialog = ref(false);
const batchActualDialog = ref(false);
const selectedBatch = ref(null);
const editEnabled = ref(true);
const isEditing = ref(false);
const isAddingActual = ref(false);
const actualAdded = ref(false);
const detail = ref(null);
const search = ref("");
const ingredientTabs = ref(0);

const deprecated_groups = ref([]);
const ignore_deprecated_ingredients_choices = ref(false);
const products = ref([]);
const editingProducts = ref([]);
const staffList = ref([]);
const availableStock = ref([]);
const discrepancyReasons = ref([]);

// Separate filters for individual productions and batches
const filters = reactive({
  product_id: "",
  status: "all",
  planned_at: "",
  planned_end: "",
  planned_at_op: "=",
  produced_at: "",
  produced_end: "",
  produced_at_op: "=",
  team_leader: "",
  discrepancy_reason: [],
});

const batchFilters = reactive({
  product_id: "",
  status: "all",
  planned_at: "",
  planned_end: "",
  planned_at_op: "=",
  team_leader: "",
});

const form = reactive({
  id: null,
  planned_at: null,
  produced_at: null,
  notes: "",
  good_qty: null,
  damaged_qty: null,
  reject_qty: null,
  actual_qty: null,
  discrepancies: [],
  staff: [],
  products: [],
});

const batchActualForm = reactive({
  batch_id: null,
  produced_at: null,
  notes: "",
  products: [],
});

const modes = [
  { label: "By Product", value: "by_product" },
  { label: "By Ingredient", value: "by_ingredient" },
];

const statusItems = [
  { title: "All Status", value: "all", icon: "mdi-view-grid" },
  {
    title: "Pending",
    value: "pending",
    icon: "mdi-clock-outline",
    color: "orange",
  },
  {
    title: "Completed",
    value: "completed",
    icon: "mdi-check-circle",
    color: "green",
  },
];

const batchStatusItems = [
  { title: "All Status", value: "all", icon: "mdi-view-grid" },
  {
    title: "Pending",
    value: "pending",
    icon: "mdi-clock-outline",
    color: "orange",
  },
  {
    title: "Completed",
    value: "completed",
    icon: "mdi-check-circle",
    color: "green",
  },
];

const dateOperators = [
  { title: "On Date", value: "=" },
  { title: "After", value: ">" },
  { title: "Before", value: "<" },
  { title: "On or After", value: ">=" },
  { title: "On or Before", value: "<=" },
  { title: "Between", value: "in" },
];

const batchHeaders = [
  { title: "Batch Code", key: "batch_code", sortable: true },
  { title: "Status", key: "status", sortable: true, align: "center" },
  { title: "Production Stats", key: "production_stats", sortable: false },
  { title: "Planned Start", key: "planned_at", sortable: true },
  { title: "Produced At", key: "produced_at", sortable: true },
  { title: "Team Leader", key: "team_leader_name", sortable: true },
  { title: "Created By", key: "created_by_name", sortable: true },
  {
    title: "Actions",
    key: "actions",
    sortable: false,
    align: "end",
    width: "100px",
  },
];

const batchProductHeaders = [
  { title: "Product", key: "product_name", sortable: true },
  { title: "Planned Qty", key: "qty_product", sortable: true, align: "center" },
  { title: "Status", key: "produced", sortable: true, align: "center" },
  { title: "Actual Output", key: "good_qty", sortable: false },
  { title: "Actions", key: "actions", sortable: false, align: "center" },
];

const productionHeaders = [
  { title: "Product / Batch", key: "product_name", sortable: true },
  { title: "Quantity", key: "qty_product", sortable: true, align: "center" },
  { title: "Staffs", key: "staff_count", sortable: true, align: "center" },
  { title: "Mode", key: "mode", sortable: true },
  { title: "Status", key: "status", sortable: true },
  { title: "Planned At", key: "planned_at", sortable: true },
  { title: "Produced At", key: "produced_at", sortable: true },
  { title: "Team Leader", key: "team_leader_name", sortable: true },
  {
    title: "Actions",
    key: "actions",
    sortable: false,
    align: "end",
    width: "180px",
  },
];

const ingredientHeaders = [
  { title: "Ingredient", key: "item_name" },
  { title: "Quantity Required", key: "qty_required" },
  { title: "Available", key: "available", align: "center" },
  { title: "Balance", key: "balance", align: "center" },
  { title: "Unit", key: "unit", align: "center" },
];

const staffHeaders = [
  { title: "Staff Member", key: "staff_id", width: "250px" },
  { title: "Role", key: "role", width: "240px" },
  { title: "Notes", key: "notes", width: "240px" },
  { title: "Actions", key: "actions", align: "center", sortable: false },
];

// Batch-specific methods
const getBatchStatusColor = (status) => {
  const colors = {
    completed: "green",
    partial: "orange",
    pending: "red",
    cancelled: "grey",
  };
  return colors[status] || "grey";
};

const getBatchStatusText = (status) => {
  const texts = {
    completed: "Completed",
    partial: "Partial",
    pending: "Pending",
    cancelled: "Cancelled",
  };
  return texts[status] || status;
};

const getBatchStatusClass = (status) => {
  const classes = {
    completed: "bg-green",
    partial: "bg-orange",
    pending: "bg-red",
    cancelled: "bg-grey",
  };
  return classes[status] || "bg-primary";
};

const getStatusColor = (status) => {
  const colors = {
    pending: "bg-orange",
    completed: "bg-green",
    active: "bg-primary",
    cancelled: "bg-red",
  };
  return colors[status] || "bg-primary";
};

// Filter methods
const activeFilterCount = computed(() => {
  let count = 0;
  Object.keys(filters).forEach((key) => {
    const v = filters[key];
    if (Array.isArray(v) && v.length) count++;
    else if (v && v !== "all") count++;
  });
  return count;
});

const batchActiveFilterCount = computed(() => {
  let count = 0;
  Object.keys(batchFilters).forEach((key) => {
    const v = batchFilters[key];
    if (Array.isArray(v) && v.length) count++;
    else if (v && v !== "all") count++;
  });
  return count;
});

const switchView = () => {
  showBatches.value = !showBatches.value;
  page.value = 1;
  loadData();
};

const loadData = () => {
  if (showBatches.value) {
    loadBatches();
  } else {
    loadProductions();
  }
};

const loadBatches = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: page.value,
      limit: 10,
    });

    // Add batch filters to the request
    Object.entries(batchFilters).forEach(([k, v]) => {
      if (v && v !== "all" && !(Array.isArray(v) && !v.length)) {
        params.append(k, v);
      }
    });

    const res = await fetch(`/productions/batches?${params.toString()}`);
    const data = await res.json();
    batches.value = data.data || [];
    totalPages.value = data.totalPages || 1;
  } catch (err) {
    console.error("Failed to load batches:", err);
    batches.value = [];
  } finally {
    loading.value = false;
  }
};

const resetBatchFilters = () => {
  Object.assign(batchFilters, {
    product_id: "",
    status: "all",
    planned_at: "",
    planned_end: "",
    planned_at_op: "=",
    team_leader: "",
  });
  loadBatches();
};

const applyBatchFilters = () => {
  page.value = 1;
  loadBatches();
};

const viewBatch = async (batch) => {
  try {
    const res = await fetch(`/productions/batches/${batch.id}`);
    const data = await res.json();
    selectedBatch.value = data.batch;
    selectedBatch.value.products = data.products || [];
    selectedBatch.value.staff =
      data.products.find((prod) => {
        return prod.staff.length;
      })?.staff || [];
    batchViewDialog.value = true;
  } catch (err) {
    console.error("Failed to load batch details:", err);
  }
};

const addBatchActualProduction = async (batch) => {
  try {
    const res = await fetch(`/productions/batches/${batch.id}`);
    const data = await res.json();
    selectedBatch.value = data.batch;

    // Initialize batch actual form
    batchActualForm.batch_id = batch.id;
    batchActualForm.produced_at = toDisplay(new Date());
    batchActualForm.notes = "";
    batchActualForm.products = data.products.map((product) => ({
      production_id: product.production_id,
      product_id: product.product_id,
      product_name: product.product_name,
      planned_qty: product.qty_product,
      good_qty: product.good_qty || "",
      damaged_qty: product.damaged_qty || "",
      reject_qty: product.reject_qty || "",
      actual_qty:
        (product.good_qty || 0) +
        (product.damaged_qty || 0) +
        (product.reject_qty || 0),
      hasDiscrepancy:
        parseFloat(product.good_qty) !== parseFloat(product.planned_qty),
      discrepancies: product.discrepancies || [],
    }));

    batchActualDialog.value = true;
  } catch (err) {
    console.error("Failed to load batch for actual production:", err);
  }
};

const closeBatchActualDialog = () => {
  batchActualDialog.value = false;
  batchActualForm.batch_id = null;
  batchActualForm.produced_at = null;
  batchActualForm.notes = "";
  batchActualForm.products = [];
};

const updateProductDiscrepancy = (product) => {
  // Calculate total actual quantity
  product.actual_qty =
    (Number(product.good_qty) || 0) +
    (Number(product.damaged_qty) || 0) +
    (Number(product.reject_qty) || 0);

  // Check for discrepancy
  product.hasDiscrepancy =
    Number(product.good_qty) !== Number(product.planned_qty);
  if (!product.hasDiscrepancy) {
    product.discrepancies = [];
  }

  // Add default discrepancy if needed
  if (
    product.hasDiscrepancy &&
    (!product.discrepancies || product.discrepancies.length === 0)
  ) {
    addProductDiscrepancy(product);
  }
};

const addProductDiscrepancy = (product) => {
  if (!product.discrepancies) {
    product.discrepancies = [];
  }
  product.discrepancies.push({ reason_id: null, notes: "" });
};

const removeProductDiscrepancy = (product, index) => {
  if (product.discrepancies) {
    product.discrepancies.splice(index, 1);
  }
};

const batchActualTotal = computed(() => {
  const total = {
    good_qty: 0,
    damaged_qty: 0,
    reject_qty: 0,
    actual_qty: 0,
  };

  batchActualForm.products.forEach((product) => {
    total.good_qty += Number(product.good_qty) || 0;
    total.damaged_qty += Number(product.damaged_qty) || 0;
    total.reject_qty += Number(product.reject_qty) || 0;
    total.actual_qty += Number(product.actual_qty) || 0;
  });

  return total;
});

const canSaveBatchActual = computed(() => {
  if (!batchActualForm.produced_at) return false;
  if (batchActualForm.products.length === 0) return false;

  // Check if all products have at least good quantity filled
  const hasValidQuantities = batchActualForm.products.every(
    (product) =>
      (Number(product.good_qty) || 0) >= 0 &&
      (Number(product.damaged_qty) || 0) >= 0 &&
      (Number(product.reject_qty) || 0) >= 0,
  );

  return hasValidQuantities && !saving.value;
});

const saveBatchActualProduction = async () => {
  saving.value = true;
  try {
    const payload = {
      produced_at: toISO(batchActualForm.produced_at),
      notes: batchActualForm.notes,
      products: batchActualForm.products.map((product) => ({
        production_id: product.production_id,
        good_qty: Number(product.good_qty) || 0,
        damaged_qty: Number(product.damaged_qty) || 0,
        reject_qty: Number(product.reject_qty) || 0,
        actual_qty: Number(product.actual_qty) || 0,
        discrepancies: (product.discrepancies || []).filter(
          (disc) => disc.reason_id,
        ),
      })),
    };

    const res = await fetch(
      `/productions/batches/${batchActualForm.batch_id}/actual`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    const result = await res.json();

    if (!res.ok) {
      alert(result.message || "Failed to save actual production.");
      return;
    }

    batchActualDialog.value = false;
    await loadBatches();
    closeBatchActualDialog();
  } catch (err) {
    console.error("Failed to save batch actual production:", err);
    alert("Failed to save actual production. Please try again.");
  } finally {
    saving.value = false;
  }
};

const viewBatchProducts = (batch) => {
  viewBatch(batch);
};

const deleteBatch = async (batch) => {
  if (
    !confirm(
      `Are you sure you want to delete batch ${batch.batch_code}? This will also delete all productions in this batch.`,
    )
  )
    return;
  try {
    await fetch(`/productions/batches/${batch.id}`, { method: "DELETE" });
    await loadBatches();
  } catch (err) {
    console.error("Failed to delete batch:", err);
    alert("Failed to delete batch. Please try again.");
  }
};

const viewProduction = (productionId) => {
  view({ id: productionId });
};

// Individual production methods
const totalItems = computed(() =>
  showBatches.value ? batches.value.length : productions.value.length,
);
const totalUnits = computed(() => {
  if (showBatches.value) {
    return batches.value.reduce(
      (sum, b) => sum + Number(b.total_good_qty || 0),
      0,
    );
  }
  return productions.value.reduce(
    (sum, p) => sum + Number(p.qty_product || p.total_qty || 0),
    0,
  );
});
const totalStaffAssignments = computed(() => {
  if (showBatches.value) {
    return batches.value.reduce(
      (sum, b) => sum + (b.staff ? b.staff.length : 0),
      0,
    );
  }
  return productions.value.reduce(
    (sum, p) => sum + Number(p.staff_count || 0),
    0,
  );
});
const totalLaborCost = computed(() => {
  return productions.value
    .reduce((sum, p) => sum + Number(p.total_pay || 0), 0)
    .toFixed(2);
});

const hasInsufficientStock = computed(() => {
  const allIngredients = form.products.flatMap((p) => p.ingredients || []);
  return allIngredients.some((i) => i.exceeds);
});

const availableStaff = computed(() => {
  const selectedIds = form.staff
    .map((s) => (typeof s.staff_id === "object" ? s.staff_id?.id : s.staff_id))
    .filter(Boolean);
  return staffList.value.filter((s) => !selectedIds.includes(s.id));
});

const assignedStaffCount = computed(
  () => form.staff.filter((s) => s.staff_id).length,
);

const computedTotalPlannedUnits = computed(() =>
  form.products.reduce(
    (sum, p) => sum + Number(p.computed_qty_product || 0),
    0,
  ),
);

const allIngredientsSummary = computed(() => {
  const map = new Map();

  // Aggregate across all products
  for (const p of form.products) {
    for (const ing of p.ingredients || []) {
      if (!ing.item_id) continue;

      if (!map.has(ing.item_id)) {
        map.set(ing.item_id, {
          item_id: ing.item_id,
          item_name: ing.item_name,
          unit: ing.unit,
          qty_required: 0,
          available: ing.available || 0,
          exceeds: ing.exceeds || false,
        });
      }

      const agg = map.get(ing.item_id);
      agg.qty_required += Number(ing.qty_required || 0);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.item_name.localeCompare(b.item_name),
  );
});

const canSave = computed(() => {
  if (!form.planned_at) return false;
  if (!form.products.length) return false;

  for (const p of form.products) {
    if (!p.product_id || !p.mode) return false;
    if (!p.computed_qty_product || p.computed_qty_product <= 0) return false;
    if (!p.ingredients || !p.ingredients.length) return false;
  }

  const hasValidStaff = form.staff.some((s) => s.staff_id);
  const hasValidGroupChoices = form.products.every((p) =>
    (p.productGroups || []).every(
      (g) => !g.is_mandatory || p.group_choices[g.id],
    ),
  );

  // Use aggregated stock validation
  if (hasInsufficientStock.value) return false;
  if (!hasValidGroupChoices) return false;
  if (!hasValidStaff) return false;
  if (saving.value) return false;

  return true;
});

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function productNameById(id) {
  return products.value.find((p) => p.id === id)?.name || "Product";
}

function productLabel(p) {
  const name = productNameById(p.product_id);
  if (!p.product_id) return "Select product & mode";
  if (p.computed_qty_product) {
    return `${name} • ${p.computed_qty_product} units`;
  }
  return name;
}

function pTabLabel(p, index) {
  const name = productNameById(p.product_id);
  return `${index + 1}. ${name || "Product"}`;
}

const showDiscrepancy = ref(false);

function checkDiscrepancy() {
  const expected = computedTotalPlannedUnits.value;
  const good = Number(form.good_qty || 0);
  showDiscrepancy.value = !!(expected && good !== expected);
  if (showDiscrepancy.value && !form.discrepancies.length) {
    addDiscrepancy();
  }
}

function addDiscrepancy() {
  form.discrepancies.push({ reason_id: null, notes: "" });
}

function removeDiscrepancy(index) {
  form.discrepancies.splice(index, 1);
}

function addStaffMember() {
  form.staff.push({ staff_id: null, role: "", notes: "" });
}

function removeStaffMember(index) {
  form.staff.splice(index, 1);
}

function clearAllStaff() {
  form.staff = [];
}

let uidCounter = 1;
function createEmptyProduct() {
  return {
    uid: uidCounter++,
    product_id: null,
    mode: "by_product",
    qty_product_input: null,
    base_ingredient_id: null,
    base_ingredient_qty: null,
    baseUnit: "",
    computed_qty_product: 0,
    recipeItems: [],
    productGroups: [],
    group_choices: {},
    expandedGroups: [],
    ingredients: [],
    innerTab: "ingredients",
  };
}

function addProductRow() {
  form.products.push(createEmptyProduct());
  if (ingredientTabs.value === "summary") {
    ingredientTabs.value = 0;
  }
  updateIngredientBalances();
}

function removeProductRow(index) {
  form.products.splice(index, 1);
  if (
    typeof ingredientTabs.value === "number" &&
    ingredientTabs.value >= form.products.length
  ) {
    ingredientTabs.value = form.products.length
      ? form.products.length - 1
      : "summary";
  }
  updateIngredientBalances();
}

async function onProductChange(p) {
  const existingP = editingProducts.value.find((edit) => {
    return edit.product_id === p.product_id;
  });
  if (existingP) {
    Object.keys(existingP).forEach((key) => {
      p[key] = existingP[key];
    });
    updateIngredientBalances();
    return;
  }
  p.recipeItems = [];
  p.productGroups = [];
  p.group_choices = {};
  p.expandedGroups = [];
  p.ingredients = [];
  p.base_ingredient_id = null;
  p.base_ingredient_qty = null;
  p.baseUnit = "";
  p.computed_qty_product = 0;

  if (!p.product_id) return;

  try {
    const res = await fetch(`/products/${p.product_id}/groups?active=true`);
    const data = await res.json();

    p.recipeItems = data.fixed_items || [];
    p.productGroups = data.groups || [];
    const hasInactiveGroup = deprecated_groups.value.find((inactive) => {
      return inactive.product === p.product_id;
    });
    if (!ignore_deprecated_ingredients_choices.value && hasInactiveGroup) {
      p.productGroups = [];
      for (const inactive of deprecated_groups.value || []) {
        if (inactive.product !== p.product_id) {
          continue;
        }
        const data = await fetch(`/products/groups/${inactive.group}`);
        const group = await data.json();
        group.deprecated = true;
        p.productGroups.push(group);
      }
    }
    p.productGroups.forEach((g, idx) => {
      const def = g.combinations?.find((c) => c.is_default);
      if (def) {
        p.group_choices[g.id] = def.id;
      }
      p.expandedGroups.push(idx);
    });
    recalcProductIngredients(p);
  } catch (err) {
    console.error("Failed to load product details:", err);
  }
}

function recalcProductIngredients(p) {
  if (!p.product_id || !p.mode) {
    p.ingredients = [];
    p.computed_qty_product = 0;
    updateIngredientBalances();
    return;
  }

  let multiplier = 0;

  if (p.mode === "by_product") {
    multiplier = Number(p.qty_product_input || 0);
  } else if (p.mode === "by_ingredient") {
    const base = p.recipeItems.find(
      (i) => i.item_id === Number(p.base_ingredient_id),
    );
    p.baseUnit = base?.unit || "";
    if (base && base.quantity_per_unit > 0 && p.base_ingredient_qty > 0) {
      multiplier = Number(p.base_ingredient_qty) / base.quantity_per_unit;
    }
  }

  if (!multiplier || multiplier <= 0) {
    p.ingredients = [];
    p.computed_qty_product = 0;
    updateIngredientBalances();
    return;
  }

  p.computed_qty_product = +multiplier.toFixed(3);

  const ingList = [];

  for (const r of p.recipeItems) {
    const qty_required = +(r.quantity_per_unit * multiplier).toFixed(3);
    ingList.push({
      item_id: r.item_id,
      item_name: r.item_name,
      unit_id: r.unit_id,
      unit: r.unit,
      qty_required,
      from_group: false,
      group_id: null,
      group_name: null,
      combination_id: null,
    });
  }

  for (const group of p.productGroups) {
    const combId = p.group_choices[group.id];
    if (!combId) continue;
    const comb = group.combinations?.find((c) => c.id === combId);
    if (!comb || !comb.options) continue;

    for (const opt of comb.options) {
      const qty_required = +(opt.quantity_per_unit * multiplier).toFixed(3);
      ingList.push({
        item_id: opt.item_id,
        item_name: opt.item_name,
        unit: opt.unit,
        qty_required,
        from_group: true,
        group_id: group.id,
        group_name: group.name,
        combination_id: combId,
      });
    }
  }

  p.ingredients = ingList;
  updateIngredientBalances();
}

function openAddDialog() {
  dialog.value = true;
  isEditing.value = false;
  isAddingActual.value = false;
  editEnabled.value = true;
  resetForm();
  addProductRow();
  addStaffMember();
}

function closeDialog() {
  dialog.value = false;
  showDiscrepancy.value = false;
  isEditing.value = false;
  isAddingActual.value = false;
  resetForm();
}

function resetForm() {
  Object.assign(form, {
    id: null,
    planned_at: null,
    produced_at: null,
    notes: "",
    good_qty: null,
    damaged_qty: null,
    reject_qty: null,
    actual_qty: null,
    discrepancies: [],
    staff: [],
    products: [],
  });
  ingredientTabs.value = 0;
  deprecated_groups.value = [];
  ignore_deprecated_ingredients_choices.value = false;
  editingProducts.value = [];
  actualAdded.value = false;
}

function resetFilters() {
  Object.assign(filters, {
    product_id: "",
    status: "all",
    planned_at: "",
    planned_end: "",
    planned_at_op: "=",
    produced_at: "",
    produced_end: "",
    produced_at_op: "=",
    team_leader: "",
    discrepancy_reason: [],
  });
  loadData();
}

function applyFilters() {
  page.value = 1;
  loadData();
}

async function loadProductions() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: page.value,
      limit: 10,
    });
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== "all" && !(Array.isArray(v) && !v.length)) {
        params.append(k, v);
      }
    });

    const res = await fetch(`/productions?${params.toString()}`);
    const data = await res.json();
    productions.value = data.data || [];
    totalPages.value = data.totalPages || 1;
  } catch (err) {
    console.error("Failed to load productions:", err);
    productions.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadProducts() {
  try {
    const res = await fetch("/products?limit=1000&page=1&active=true");
    const data = await res.json();
    products.value = data.data || [];
  } catch (err) {
    console.error("Failed to load products:", err);
  }
}

async function loadStaff() {
  try {
    const res = await fetch("/staffs?status=Active&limit=1000&page=1");
    const data = await res.json();
    staffList.value = data.data || [];
  } catch (err) {
    console.error("Failed to load staff:", err);
  }
}

async function loadAvailableStock() {
  try {
    const res = await fetch("/items/availableStock");
    availableStock.value = await res.json();
  } catch (err) {
    console.error("Failed to load stock:", err);
  }
}

async function loadDiscrepancyReasons() {
  try {
    const res = await fetch("/productions/discrepancyReasons");
    const data = await res.json();
    discrepancyReasons.value = data.data || [];
  } catch (err) {
    console.error("Failed to load discrepancy reasons:", err);
  }
}

async function view(item) {
  try {
    const res = await fetch(`/productions/${item.id}`);
    detail.value = await res.json();
    viewDialog.value = true;
  } catch (err) {
    console.error("Failed to load production details:", err);
  }
}

const getRoleColor = (role) => {
  const colors = {
    "Team Leader": "blue",
    Assistant: "green",
    Support: "orange",
  };
  return colors[role] || "grey";
};

function adjustIngredientToAvailable(itemId, availableQty) {
  let totalRequired = 0;

  // Calculate current total requirement
  for (const p of form.products) {
    for (const ing of p.ingredients || []) {
      if (ing.item_id === itemId) {
        totalRequired += Number(ing.qty_required || 0);
      }
    }
  }

  if (totalRequired <= availableQty) return;

  const ratio = availableQty / totalRequired;

  // Adjust each product's ingredient proportionally
  for (const p of form.products) {
    for (const ing of p.ingredients || []) {
      if (ing.item_id === itemId) {
        ing.qty_required = +(Number(ing.qty_required || 0) * ratio).toFixed(3);
      }
    }
  }
  updateIngredientBalances();
}

function updateIngredientBalances() {
  // Aggregate all ingredient requirements across all products
  const totalRequirements = new Map();

  // First pass: sum up all requirements
  for (const p of form.products) {
    for (const ing of p.ingredients || []) {
      if (!ing.item_id) continue;

      const key = ing.item_id;
      if (!totalRequirements.has(key)) {
        totalRequirements.set(key, {
          item_id: ing.item_id,
          item_name: ing.item_name,
          unit: ing.unit,
          total_required: 0,
          available: 0,
          balance: 0,
          exceeds: false,
          // Track if this ingredient was previously used in this production
          previously_used: 0,
        });
      }

      const agg = totalRequirements.get(key);
      agg.total_required += Number(ing.qty_required || 0);
    }
  }

  // Second pass: get available stock and account for previously used quantities
  for (const [itemId, requirement] of totalRequirements) {
    const stockItem = availableStock.value.find((s) => s.item_id === itemId);
    const baseAvailable = stockItem ? Number(stockItem.available_qty) : 0;

    // If we're editing an existing production, we need to add back the previously used quantities
    // because they're already allocated to this production
    let previouslyUsed = 0;

    if (isEditing.value) {
      // Calculate how much of this ingredient was previously used in this production
      for (const p of form.products) {
        for (const ing of p.ingredients || []) {
          if (ing.item_id === itemId) {
            // If this ingredient has a previously used quantity stored, use it
            if (ing.previously_used !== undefined) {
              previouslyUsed += Number(ing.previously_used || 0);
            } else {
              // Otherwise, use the current qty_required as the previously used amount
              previouslyUsed += Number(ing.qty_required || 0);
            }
          }
        }
      }
    }

    // Effective available stock = current stock + previously allocated quantities
    requirement.available = baseAvailable + previouslyUsed;
    requirement.previously_used = previouslyUsed;
    requirement.exceeds = requirement.total_required > requirement.available;
    requirement.balance = parseFloat(
      (requirement.available - requirement.total_required).toFixed(6),
    );
  }

  // Third pass: update individual product ingredients with aggregated info
  for (const p of form.products) {
    for (const ing of p.ingredients || []) {
      if (!ing.item_id) continue;

      const aggregated = totalRequirements.get(ing.item_id);
      if (aggregated) {
        ing.available = aggregated.available;
        ing.exceeds = aggregated.exceeds;
        ing.balance = aggregated.balance;
        // Store the previously used quantity for reference
        ing.previously_used = aggregated.previously_used;
      }
    }
  }
}

//control if productions with old ingredients groups should still continue using them
const useInactiveGroups = (use) => {
  isEditing.value = true;
  isAddingActual.value = false;
  dialog.value = true;
  editEnabled.value = true;
  const id = form.id;
  resetForm();
  ignore_deprecated_ingredients_choices.value = use;
  editBatch(id);
};

const activateBatchEditing = (batch) => {
  isEditing.value = true;
  isAddingActual.value = false;
  dialog.value = true;
  editEnabled.value = true;
  resetForm();
  editBatch(batch.id);
};

const editBatch = async (id) => {
  try {
    const res = await fetch(`/productions/batches/${id}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to load batch for editing.");
    }

    // Batch-level
    form.id = data.batch.id;
    form.notes = data.batch.notes || "";
    form.planned_at = toDisplay(data.batch.planned_at);
    form.produced_at = toDisplay(data.batch.produced_at);

    // Products
    form.products = [];
    (data.products || []).forEach((prod) => {
      for (const product of products.value) {
        if (product.id === prod.product_id) {
          product.editing = true;
        }
      }
      const p = createEmptyProduct();
      p.production_id = prod.production_id;
      p.product_id = prod.product_id;
      p.product_name = prod.product_name;
      p.planned_qty = prod.qty_product || "";
      p.good_qty = prod.good_qty || "";
      p.damaged_qty = prod.damaged_qty || "";
      p.reject_qty = prod.reject_qty || "";
      p.actual_qty = prod.actual_qty || "";
      p.hasDiscrepancy = prod.discrepancies.length > 0;
      p.discrepancies = prod.discrepancies || [];
      p.mode = prod.mode || "by_product";
      form.staff = prod.staff || [];
      if (prod.good_qty || prod.damaged_qty || prod.reject_qty) {
        actualAdded.value = true;
      }

      if (p.mode === "by_product") {
        p.qty_product_input = Number(prod.qty_product || 0);
      } else {
        p.base_ingredient_id = prod.base_ingredient_id || null;
        p.base_ingredient_qty = prod.base_ingredient_qty || null;
      }

      p.computed_qty_product = Number(prod.qty_product || 0) || 0;
      form.products.push(p);
    });

    if (!form.products.length) {
      addProductRow();
    }

    // Load metadata + attach ingredients/group choices
    for (const prod of data.products || []) {
      //get groups that are not active and manually get them, as the onProductChange will only load active groups
      deprecated_groups.value = prod.ingredients
        .filter((i) => i.group_active === false && i.group_id !== null)
        .map((i) => {
          return {
            product: prod.product_id,
            group: i.group_id,
          };
        });
      //ensure unique
      if (deprecated_groups.value.length) {
        deprecated_groups.value = [
          ...new Map(
            deprecated_groups.value.map((item) => [
              `${item.product}-${item.group}`,
              item,
            ]),
          ).values(),
        ];
      }

      const p =
        form.products.find((x) => x.production_id === prod.production_id) ||
        form.products.find((x) => x.product_id === prod.product_id);

      if (!p || !p.product_id) continue;

      await onProductChange(p);

      // Group choices
      const groupChoices = prod.group_choices || [];
      if (groupChoices.length) {
        groupChoices.forEach((gc) => {
          if (gc.group_id && gc.combination_id) {
            p.group_choices[gc.group_id] = gc.combination_id;
          }
        });
      } else if (Array.isArray(prod.ingredients)) {
        prod.ingredients.forEach((ing) => {
          if (ing.group_id && ing.combination_id) {
            p.group_choices[ing.group_id] = ing.combination_id;
          }
        });
      }

      // Ingredients from API
      const defaultIngredients = JSON.parse(JSON.stringify(p.ingredients));
      if (Array.isArray(prod.ingredients) && prod.ingredients.length) {
        p.ingredients = [];
        for (const ing of prod.ingredients) {
          if (
            ignore_deprecated_ingredients_choices.value &&
            !defaultIngredients.find((def) => {
              return def.item_id === ing.item_id;
            })
          ) {
            continue;
          }

          const prevUsed = Number(ing.qty_required || ing.quantity || 0);

          p.ingredients.push({
            item_id: ing.item_id,
            item_name: ing.item_name,
            unit: ing.unit,
            qty_required: prevUsed,
            previously_used: prevUsed,
            from_group: !!ing.group_id,
            group_id: ing.group_id || null,
            group_name: ing.group_name || null,
            combination_id: ing.combination_id || null,
          });
        }
      }
      editingProducts.value.push(JSON.parse(JSON.stringify(p)));
    }
    ingredientTabs.value = form.products.length ? 0 : "summary";
    checkDiscrepancy();
    updateIngredientBalances();
  } catch (err) {
    console.error("Failed to load batch for editing:", err);
    alert("Failed to load batch for editing.");
    dialog.value = false;
  }
};

async function saveProduction() {
  saving.value = true;
  try {
    const productsPayload = form.products.map((p) => {
      const group_choices = Object.entries(p.group_choices || {})
        .filter(([, combId]) => combId)
        .map(([group_id, combination_id]) => ({
          group_id: Number(group_id),
          combination_id,
        }));

      return {
        production_id: p.production_id || null,
        product_id: p.product_id,
        mode: p.mode,
        qty_product: p.computed_qty_product,
        good_qty: p.good_qty || 0,
        damaged_qty: p.damaged_qty || 0,
        reject_qty: p.reject_qty || 0,
        actual_qty: p.actual_qty || 0,
        discrepancies: p.discrepancies,
        base_ingredient_id: p.base_ingredient_id,
        base_ingredient_qty: p.base_ingredient_qty,
        ingredients: (p.ingredients || []).map((ing) => ({
          item_id: ing.item_id,
          qty_required: Number(ing.qty_required || 0),
          unit: ing.unit,
          group_id: ing.group_id || null,
          combination_id: ing.combination_id || null,
        })),
        group_choices,
      };
    });

    const payload = {
      planned_at: toISO(form.planned_at),
      produced_at: form.produced_at ? toISO(form.produced_at) : null,
      notes: form.notes,
      products: productsPayload,
      staffs: form.staff
        .filter((s) => s.staff_id)
        .map((s) => ({
          staff_id: typeof s.staff_id === "object" ? s.staff_id.id : s.staff_id,
          role: s.role || null,
          notes: s.notes || null,
        })),
    };

    const url = isEditing.value ? `/productions/${form.id}` : "/productions";
    const method = isEditing.value ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) {
      if (result.error === "INSUFFICIENT_STOCK") {
        alert(
          `${result.message}\nAvailable: ${result.details.available}\nRequired: ${result.details.required}`,
        );
      } else {
        alert(result.message || "Failed to save production.");
      }
      return;
    }

    dialog.value = false;
    resetForm();
    await loadAvailableStock();
    await loadData();
  } catch (err) {
    console.error("Failed to save production:", err);
    alert("Failed to save production. Please try again.");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([
    loadStaff(),
    loadProducts(),
    loadData(),
    loadDiscrepancyReasons(),
    loadAvailableStock(),
  ]);
});
</script>

<style scoped>
.production-container {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.stat-card {
  transition:
    transform 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.combination-card {
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.combination-card.selected {
  border-color: #1976d2;
  background-color: #e3f2fd;
}

.combination-card:hover:not(.selected) {
  border-color: #90caf9;
  background-color: #f5f5f5;
}

.position-relative {
  position: relative;
}

.datepicker-label {
  position: absolute;
  top: -8px;
  left: 12px;
  background: white;
  padding: 0 6px;
  font-size: 0.75rem;
  color: #666;
  z-index: 2;
  pointer-events: none;
}

.gap-2 {
  gap: 8px;
}

.action-menu-btn {
  transition: all 0.2s ease-in-out;
}

.action-menu-btn:hover {
  transform: scale(1.1);
  background-color: rgba(25, 118, 210, 0.1);
}

:deep(.action-item:hover) {
  background-color: rgba(0, 0, 0, 0.04);
  transform: translateX(2px);
  transition: all 0.2s ease;
}

.output-bar {
  display: flex;
  height: 16px;
  border-radius: 8px;
  overflow: hidden;
  background-color: #e0e0e0;
}

.bar-segment {
  height: 100%;
}

.bar-segment.good {
  background-color: #4caf50;
}

.bar-segment.damaged {
  background-color: #fb8c00;
}

.bar-segment.reject {
  background-color: #e53935;
}
</style>
