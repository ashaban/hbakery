<template>
  <v-container class="production-container" fluid>
    <v-alert
      v-if="form.damaged_qty > 0 || form.reject_qty > 0"
      border="start"
      class="mt-2"
      type="warning"
      variant="tonal"
    >
      Some quantities were marked as damaged or reject — please ensure they’re
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
              Manage production batches and assign staff teams
            </p>
          </div>
          <v-btn
            class="px-6"
            color="primary"
            elevation="2"
            size="large"
            @click="openAddDialog"
          >
            <v-icon size="20" start>mdi-plus-circle</v-icon>
            New Production
          </v-btn>
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
                  {{ productions.length }}
                </div>
                <div class="text-caption text-grey">Total Productions</div>
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
                <div class="text-caption text-grey">Total Units</div>
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

    <v-card class="mb-4" elevation="2" rounded="lg">
      <v-card-text class="pa-0">
        <!-- Table Header -->
        <div class="d-flex align-center pa-4 bg-grey-lighten-4 rounded-t-lg">
          <v-icon class="mr-2" color="primary">mdi-table</v-icon>
          <h3 class="text-h6 font-weight-medium">Production Records</h3>
        </div>
        <v-card border class="pa-6 mb-6" elevation="3" rounded="lg">
          <!-- Header -->
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

          <!-- Filters Grid -->
          <v-row class="align-start" dense>
            <!-- Product Filter -->
            <v-col cols="12" lg="3" md="4" sm="6">
              <v-card border class="rounded-lg h-100" variant="outlined">
                <v-card-text class="pa-3">
                  <div class="d-flex align-center mb-2">
                    <v-icon class="mr-2" color="primary" size="18"
                      >mdi-package-variant</v-icon
                    >
                    <label class="text-caption font-weight-medium text-primary"
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
                    <label class="text-caption font-weight-medium text-primary"
                      >Status</label
                    >
                  </div>
                  <v-select
                    v-model="filters.status"
                    color="primary"
                    density="compact"
                    hide-details
                    :items="[
                      {
                        title: 'All Status',
                        value: 'all',
                        icon: 'mdi-view-grid',
                      },
                      {
                        title: 'Pending',
                        value: 'pending',
                        icon: 'mdi-clock-outline',
                        color: 'orange',
                      },
                      {
                        title: 'Completed',
                        value: 'completed',
                        icon: 'mdi-check-circle',
                        color: 'green',
                      },
                    ]"
                    placeholder="Select Status"
                    variant="underlined"
                  >
                    <template #item="{ item, props }">
                      <v-list-item v-bind="props">
                        <template #prepend>
                          <v-icon :color="item.raw.color || 'grey'">{{
                            item.raw.icon
                          }}</v-icon>
                        </template>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <div class="d-flex align-center">
                        <v-icon
                          class="mr-2"
                          :color="item.raw.color || 'grey'"
                          size="16"
                          >{{ item.raw.icon }}</v-icon
                        >
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
                    <label class="text-caption font-weight-medium text-primary"
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
                  >
                    <template #item="{ props, item }">
                      <v-list-item v-bind="props">
                        <template #prepend>
                          <v-avatar
                            class="mr-3"
                            color="blue-grey-lighten-5"
                            size="28"
                          >
                            <v-icon color="blue-grey" size="14"
                              >mdi-account</v-icon
                            >
                          </v-avatar>
                        </template>
                      </v-list-item>
                    </template>
                  </v-autocomplete>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Discrepancy Reasons -->
            <v-col cols="12" lg="3" md="4" sm="6">
              <v-card border class="rounded-lg h-100" variant="outlined">
                <v-card-text class="pa-3">
                  <div class="d-flex align-center mb-2">
                    <v-icon class="mr-2" color="red" size="18"
                      >mdi-alert-circle</v-icon
                    >
                    <label class="text-caption font-weight-medium text-primary"
                      >Discrepancy Reasons</label
                    >
                  </div>
                  <v-select
                    v-model="filters.discrepancy_reason"
                    clearable
                    color="primary"
                    density="compact"
                    hide-details
                    :items="[
                      {
                        title: 'Machine Failure',
                        icon: 'mdi-robot-off',
                        color: 'red',
                      },
                      {
                        title: 'Ingredient Shortage',
                        icon: 'mdi-sack',
                        color: 'orange',
                      },
                      {
                        title: 'Power Outage',
                        icon: 'mdi-power-plug-off',
                        color: 'amber',
                      },
                      {
                        title: 'Human Error',
                        icon: 'mdi-account-alert',
                        color: 'blue',
                      },
                    ]"
                    multiple
                    placeholder="Select Reasons"
                    variant="underlined"
                  >
                    <template #item="{ item, props }">
                      <v-list-item v-bind="props">
                        <template #prepend>
                          <v-icon :color="item.raw.color" size="16">{{
                            item.raw.icon
                          }}</v-icon>
                        </template>
                      </v-list-item>
                    </template>
                    <template #selection="{ item }">
                      <v-chip
                        class="mr-1 mb-1"
                        :color="item.raw.color"
                        size="small"
                        variant="tonal"
                      >
                        <v-icon size="14" start>{{ item.raw.icon }}</v-icon>
                        {{ item.title }}
                      </v-chip>
                    </template>
                  </v-select>
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
                    <label class="text-caption font-weight-medium text-primary"
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
                        :items="[
                          { title: 'On Date', value: '=' },
                          { title: 'After', value: '>' },
                          { title: 'Before', value: '<' },
                          { title: 'On or After', value: '>=' },
                          { title: 'On or Before', value: '<=' },
                          { title: 'Between', value: 'in' },
                        ]"
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

            <!-- Produced Date Range -->
            <v-col cols="12" lg="6" md="8">
              <v-card border class="rounded-lg" variant="outlined">
                <v-card-text class="pa-3">
                  <div class="d-flex align-center mb-2">
                    <v-icon class="mr-2" color="orange" size="18"
                      >mdi-calendar-check</v-icon
                    >
                    <label class="text-caption font-weight-medium text-primary"
                      >Produced Date Range</label
                    >
                  </div>
                  <v-row class="align-center" dense>
                    <v-col cols="12" sm="4">
                      <v-select
                        v-model="filters.produced_at_op"
                        color="primary"
                        density="compact"
                        hide-details
                        :items="[
                          { title: 'On Date', value: '=' },
                          { title: 'After', value: '>' },
                          { title: 'Before', value: '<' },
                          { title: 'On or After', value: '>=' },
                          { title: 'On or Before', value: '<=' },
                          { title: 'Between', value: 'in' },
                        ]"
                        variant="underlined"
                      />
                    </v-col>
                    <v-col cols="12" sm="4">
                      <VueDatePicker
                        v-model="filters.produced_at"
                        auto-apply
                        format="dd-MM-yyyy"
                        model-type="format"
                        placeholder="Start Date"
                        :teleport="true"
                      />
                    </v-col>
                    <v-col
                      v-if="filters.produced_at_op === 'in'"
                      cols="12"
                      sm="4"
                    >
                      <VueDatePicker
                        v-model="filters.produced_end"
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

          <!-- Action Buttons -->
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
                size="small"
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
                size="small"
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
              <v-avatar class="mr-3" color="primary" size="32" variant="tonal">
                <v-icon color="primary" size="16">mdi-package</v-icon>
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ item.product_name }}</div>
                <div class="text-caption text-grey">{{ item.mode }}</div>
              </div>
            </div>
          </template>

          <template #item.qty_product="{ item }">
            <v-chip color="green" size="small" variant="flat">
              <v-icon size="16" start>mdi-counter</v-icon>
              {{ parseFloat(item.qty_product) }}
            </v-chip>
          </template>

          <template #item.staff_count="{ item }">
            <div class="d-flex align-center">
              <v-avatar class="mr-2" color="blue-lighten-5" size="28">
                <v-icon color="blue" size="14">mdi-account-group</v-icon>
              </v-avatar>
              <span class="font-weight-medium">{{
                item.staff_count || 0
              }}</span>
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
              <span class="font-weight-medium">{{
                item.produced_by_name
              }}</span>
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
                      v-if="item.status === 'pending'"
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
                  <!-- Header with Status -->
                  <v-card-text
                    class="pa-4"
                    :class="getStatusColor(item.status)"
                  >
                    <div class="d-flex align-center justify-space-between">
                      <div class="d-flex align-center">
                        <v-avatar
                          class="mr-3"
                          color="white"
                          size="32"
                          variant="tonal"
                        >
                          <v-icon color="primary" size="18">mdi-factory</v-icon>
                        </v-avatar>
                        <div>
                          <div class="text-white text-body-2 font-weight-bold">
                            Production Actions
                          </div>
                          <div class="text-white text-caption opacity-75">
                            {{ item.product_name }}
                          </div>
                        </div>
                      </div>
                      <v-chip color="white" size="small" variant="flat">
                        {{ item.status || "active" }}
                      </v-chip>
                    </div>
                  </v-card-text>

                  <v-list class="pa-2" density="compact">
                    <!-- View Details -->
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
                          <v-icon color="blue" size="18"
                            >mdi-eye-outline</v-icon
                          >
                        </v-avatar>
                      </template>
                      <v-list-item-title class="text-body-2 font-weight-medium">
                        View Details
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption text-blue">
                        Complete information
                      </v-list-item-subtitle>
                    </v-list-item>

                    <!-- Add Actual Production -->
                    <v-list-item
                      class="rounded-lg mb-1 action-item"
                      :disabled="item.status === 'completed'"
                      @click="edit(item, 'actual')"
                    >
                      <template #prepend>
                        <v-avatar
                          class="mr-3"
                          color="green-lighten-5"
                          size="36"
                          variant="flat"
                        >
                          <v-icon color="green" size="18"
                            >mdi-plus-circle</v-icon
                          >
                        </v-avatar>
                      </template>
                      <v-list-item-title class="text-body-2 font-weight-medium">
                        Add Actual Production
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption text-green">
                        Record actual output
                      </v-list-item-subtitle>
                    </v-list-item>

                    <!-- Edit Production -->
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
                          <v-icon color="orange" size="18"
                            >mdi-pencil-outline</v-icon
                          >
                        </v-avatar>
                      </template>
                      <v-list-item-title class="text-body-2 font-weight-medium">
                        Edit Production
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption text-orange">
                        Modify details
                      </v-list-item-subtitle>
                    </v-list-item>

                    <v-divider class="my-2" />

                    <!-- Delete -->
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
                          <v-icon color="red" size="18"
                            >mdi-delete-outline</v-icon
                          >
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
                    </v-list-item>
                  </v-list>
                </v-card>
              </v-menu>
            </div>
          </template>

          <template #no-data>
            <div class="text-center py-8">
              <v-icon class="mb-4" color="grey-lighten-2" size="64"
                >mdi-inbox</v-icon
              >
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

    <!-- PAGINATION -->
    <v-card elevation="2" rounded="lg">
      <v-card-text class="pa-4">
        <div class="d-flex justify-space-between align-center">
          <div class="text-body-2 text-grey">
            Showing {{ productions.length }} of {{ totalItems }} records
          </div>
          <v-pagination
            v-model="page"
            color="primary"
            :length="totalPages"
            :total-visible="7"
            @update:model-value="loadProductions"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- ADD/EDIT DIALOG -->
    <v-dialog v-model="dialog" max-width="1200" persistent scrollable>
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
                  : "Create New Production"
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
            <!-- Basic Information -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center mb-4">
                <v-icon class="mr-2" color="primary">mdi-information</v-icon>
                <h4 class="text-h6 font-weight-medium">Basic Information</h4>
              </div>
              <v-row dense>
                <v-col cols="12" md="4">
                  <div class="position-relative w-100">
                    <!-- floating label that appears only when value exists -->
                    <span v-if="form.planned_at" class="datepicker-label">
                      Planned Production Date & Time
                    </span>

                    <VueDatePicker
                      v-model="form.planned_at"
                      auto-apply
                      class="rounded-lg border px-4 py-2 w-100"
                      :disabled="isEditing && !editEnabled"
                      :enable-time-picker="true"
                      format="dd-MM-yyyy HH:mm"
                      model-type="format"
                      placeholder="Select Planned Production Date & Time"
                      :teleport="true"
                    />
                  </div>
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="form.mode"
                    color="primary"
                    :disabled="isEditing"
                    item-title="label"
                    item-value="value"
                    :items="modes"
                    label="Production Mode"
                    prepend-inner-icon="mdi-cog"
                    required
                    variant="outlined"
                  />
                </v-col>

                <v-col cols="12" md="5">
                  <v-autocomplete
                    v-model="form.product_id"
                    color="primary"
                    :disabled="isEditing"
                    item-title="name"
                    item-value="id"
                    :items="products"
                    label="Select Product"
                    prepend-inner-icon="mdi-package-variant"
                    required
                    variant="outlined"
                    @update:model-value="onProductChange"
                  />
                </v-col>
              </v-row>
            </v-card>

            <!-- Quantity Configuration -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center mb-4">
                <v-icon class="mr-2" color="primary">mdi-scale</v-icon>
                <h4 class="text-h6 font-weight-medium">
                  Quantity Configuration
                </h4>
              </div>

              <!-- By Product -->
              <v-row v-if="form.mode === 'by_product'" dense>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.qty_product"
                    color="primary"
                    :disabled="isEditing && !editEnabled"
                    label="Quantity of Product"
                    prepend-inner-icon="mdi-numeric"
                    required
                    type="number"
                    variant="outlined"
                    @input="recalc"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-alert class="mt-2" type="info" variant="tonal">
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
                      color="primary"
                      :disabled="
                        !recipeItems.length || (isEditing && !editEnabled)
                      "
                      item-title="item_name"
                      item-value="item_id"
                      :items="recipeItems"
                      label="Base Ingredient"
                      prepend-inner-icon="mdi-ingredient"
                      variant="outlined"
                      @update:model-value="recalc"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="form.base_ingredient_qty"
                      color="primary"
                      :disabled="
                        !form.base_ingredient_id || (isEditing && !editEnabled)
                      "
                      :label="`Ingredient Quantity (${baseUnit || 'units'})`"
                      prepend-inner-icon="mdi-weight"
                      required
                      type="number"
                      variant="outlined"
                      @input="recalc"
                    />
                  </v-col>
                </v-row>
              </template>
            </v-card>
            <v-card
              v-if="isEditing"
              class="rounded-lg pa-4 mb-4"
              variant="outlined"
            >
              <div class="d-flex align-center mb-4">
                <v-icon class="mr-2" color="primary">mdi-scale-balance</v-icon>
                <h4 class="text-h6 font-weight-medium">
                  Actual Output & Discrepancies
                </h4>
              </div>

              <v-row dense>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="form.good_qty"
                    color="green"
                    label="Good Quantity"
                    prepend-inner-icon="mdi-check-decagram"
                    type="number"
                    variant="outlined"
                    @input="recomputeActual"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="form.damaged_qty"
                    color="orange"
                    label="Damaged Quantity"
                    prepend-inner-icon="mdi-alert-circle-outline"
                    type="number"
                    variant="outlined"
                    @input="recomputeActual"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="form.reject_qty"
                    color="red"
                    label="Reject Quantity"
                    prepend-inner-icon="mdi-close-octagon-outline"
                    type="number"
                    variant="outlined"
                    @input="recomputeActual"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="form.actual_qty"
                    color="primary"
                    :disabled="!isAddingActual && isEditing && !editEnabled"
                    label="Total Actual Quantity Produced"
                    prepend-inner-icon="mdi-counter"
                    readonly
                    required
                    type="number"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="6" md="6">
                  <div class="position-relative w-100">
                    <!-- floating label that appears only when value exists -->
                    <span v-if="form.produced_at" class="datepicker-label">
                      Actual Production Date & Time
                    </span>

                    <VueDatePicker
                      v-model="form.produced_at"
                      auto-apply
                      class="rounded-lg border px-4 py-2 w-100"
                      :disabled="!isAddingActual && isEditing && !editEnabled"
                      :enable-time-picker="true"
                      format="dd-MM-yyyy HH:mm"
                      model-type="format"
                      placeholder="Select Actual Production Date & Time"
                      :teleport="true"
                    />
                  </div>
                </v-col>
                <v-col v-if="showDiscrepancy" cols="12" md="6">
                  <v-alert
                    border="start"
                    class="mt-2"
                    type="warning"
                    variant="tonal"
                  >
                    Discrepancy detected (Planned:
                    {{ parseFloat(computedData.qty_product) }} | Good Quantity:
                    {{ form.good_qty }})
                  </v-alert>
                </v-col>
              </v-row>
              <template v-if="showDiscrepancy">
                <v-divider class="my-4" />
                <v-row
                  v-for="(disc, i) in form.discrepancies"
                  :key="i"
                  class="align-center mb-3"
                >
                  <v-col cols="12" md="5">
                    <v-select
                      v-model="disc.reason_id"
                      color="primary"
                      hide-details
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
                      color="primary"
                      hide-details
                      label="Notes"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col class="text-right" cols="12" md="2">
                    <v-btn
                      color="error"
                      icon
                      variant="text"
                      @click="removeDiscrepancy(i)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </v-col>
                </v-row>

                <v-btn
                  color="primary"
                  size="small"
                  variant="outlined"
                  @click="addDiscrepancy"
                >
                  <v-icon start>mdi-plus</v-icon>
                  Add Reason
                </v-btn>
              </template>
            </v-card>

            <!-- Staff Assignment -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center">
                  <v-icon class="mr-2" color="primary"
                    >mdi-account-group</v-icon
                  >
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
                <template #item.staff_id="{ item, index }">
                  <v-autocomplete
                    v-model="item.staff_id"
                    density="compact"
                    :disabled="!editEnabled"
                    hide-details
                    item-title="name"
                    item-value="id"
                    :items="availableStaff"
                    placeholder="Select Staff"
                    return-object
                    variant="outlined"
                  />
                </template>

                <template #item.role="{ item }">
                  <v-select
                    v-model="item.role"
                    clearable
                    color="primary"
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

                <template #item.actions="{ item, index }">
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

              <!-- Staff Summary -->
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
                    {{ availableStaff.length + assignedStaffCount }} staff
                    assigned
                  </div>
                </div>
              </v-alert>
            </v-card>

            <!-- Ingredients Management -->
            <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center">
                  <v-icon class="mr-2" color="primary">mdi-ingredient</v-icon>
                  <h4 class="text-h6 font-weight-medium">
                    Ingredients Required
                  </h4>
                </div>
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
              <v-data-table
                class="elevation-1 rounded-lg"
                density="comfortable"
                :headers="ingredientHeaders"
                :items="computedData.ingredients"
              >
                <template #item.qty_required="{ item }">
                  <div class="d-flex align-center">
                    <v-text-field
                      v-model.number="item.qty_required"
                      density="compact"
                      :error="item.exceeds"
                      :error-messages="
                        item.exceeds ? ['Exceeds available stock'] : []
                      "
                      hide-details
                      style="max-width: 140px"
                      type="number"
                      variant="outlined"
                      @input="item.exceeds = item.qty_required > item.available"
                    >
                      <template #append-inner>
                        <span
                          class="text-caption"
                          :class="item.exceeds ? 'text-error' : 'text-grey'"
                        >
                          {{ item.unit }}
                        </span>
                      </template>
                    </v-text-field>

                    <!-- Tooltip + Auto-correct Button -->
                    <v-tooltip
                      v-if="item.exceeds"
                      location="top"
                      :text="
                        'Maximum available: ' + item.available + ' ' + item.unit
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
                            item.qty_required = item.available;
                            item.exceeds = false;
                          "
                        >
                          <v-icon size="16">mdi-information-outline</v-icon>
                        </v-btn>
                      </template>
                    </v-tooltip>
                  </div>
                </template>

                <template #item.available="{ item }">
                  <v-chip
                    class="font-weight-medium"
                    :color="item.exceeds ? 'red' : 'blue'"
                    size="small"
                    variant="outlined"
                  >
                    {{ item.available }} {{ item.unit }}
                  </v-chip>
                </template>

                <template #item.unit="{ item }">
                  <v-chip color="blue-grey" size="small" variant="outlined">
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
                border="start"
                class="mt-4"
                type="success"
                variant="tonal"
              >
                <div class="d-flex justify-space-between align-center">
                  <div>
                    <strong>Total Product Units:</strong>
                    <v-chip
                      class="ml-2"
                      color="success"
                      size="small"
                      variant="flat"
                    >
                      <b>{{ parseFloat(computedData.qty_product) || 0 }}</b>
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
              color="primary"
              :disabled="!editEnabled && isEditing"
              label="Additional Notes"
              prepend-inner-icon="mdi-note-text"
              rows="3"
              variant="outlined"
            />
          </v-form>
        </v-card-text>

        <!-- Actions -->
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
    <v-dialog v-model="viewDialog" max-width="900">
      <v-card class="rounded-xl" elevation="16">
        <v-toolbar class="rounded-t-xl" color="primary" density="comfortable">
          <v-avatar class="mr-3" color="white" size="36">
            <v-icon color="primary">mdi-eye</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h5 font-weight-bold text-white">
            Production Details
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
          <!-- Production Header -->
          <v-card class="rounded-lg pa-4 mb-4" variant="outlined">
            <v-row>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Production ID</div>
                <div class="text-h6 font-weight-bold">
                  #{{ detail?.production?.id }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Product</div>
                <div class="text-h6 font-weight-bold text-primary">
                  {{ detail?.production?.product_name }}
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Planning Mode</div>
                <v-chip
                  :color="
                    detail?.production?.mode === 'by_product'
                      ? 'blue'
                      : 'orange'
                  "
                  variant="flat"
                >
                  {{ detail?.production?.mode }}
                </v-chip>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Planned Units</div>
                <v-chip color="blue" size="large" variant="flat">
                  <v-icon start>mdi-counter</v-icon>
                  {{ parseFloat(detail?.production?.qty_product) }}
                </v-chip>
              </v-col>
              <!-- Actual Output Breakdown -->
              <v-col cols="12" md="6">
                <div class="text-body-2 text-grey mb-2">
                  Actual Output Breakdown
                </div>

                <!-- Quantities Chips -->
                <v-chip-group class="d-flex flex-wrap gap-2 mb-3" column>
                  <v-chip
                    class="font-weight-medium"
                    color="green"
                    prepend-icon="mdi-check-decagram"
                    size="small"
                    variant="flat"
                  >
                    Good: {{ parseFloat(detail?.production?.good_qty) || 0 }}
                  </v-chip>

                  <v-chip
                    class="font-weight-medium"
                    color="orange"
                    prepend-icon="mdi-alert-circle-outline"
                    size="small"
                    variant="flat"
                  >
                    Damaged:
                    {{ parseFloat(detail?.production?.damaged_qty) || 0 }}
                  </v-chip>

                  <v-chip
                    class="font-weight-medium"
                    color="red"
                    prepend-icon="mdi-close-octagon-outline"
                    size="small"
                    variant="flat"
                  >
                    Reject:
                    {{ parseFloat(detail?.production?.reject_qty) || 0 }}
                  </v-chip>

                  <v-chip
                    class="font-weight-bold"
                    color="blue"
                    prepend-icon="mdi-counter"
                    size="small"
                    variant="flat"
                  >
                    Total: {{ parseFloat(detail?.production?.actual_qty) || 0 }}
                  </v-chip>
                </v-chip-group>

                <!-- Visual Distribution Bar -->
                <div class="mb-2 text-caption text-grey">
                  Quality Distribution
                </div>
                <div class="output-bar">
                  <div
                    v-if="goodPercent > 0"
                    class="bar-segment good"
                    :style="{ width: goodPercent + '%' }"
                  />
                  <div
                    v-if="damagedPercent > 0"
                    class="bar-segment damaged"
                    :style="{ width: damagedPercent + '%' }"
                  />
                  <div
                    v-if="rejectPercent > 0"
                    class="bar-segment reject"
                    :style="{ width: rejectPercent + '%' }"
                  />
                </div>

                <div
                  class="d-flex justify-space-between mt-1 text-caption text-grey"
                >
                  <div>Good: {{ goodPercent.toFixed(1) }}%</div>
                  <div>Damaged: {{ damagedPercent.toFixed(1) }}%</div>
                  <div>Reject: {{ rejectPercent.toFixed(1) }}%</div>
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-body-2 text-grey">Team Size</div>
                <v-chip color="purple" variant="flat">
                  <v-icon start>mdi-account-group</v-icon>
                  {{ detail?.staff?.length || 0 }} members
                </v-chip>
              </v-col>
              <v-col cols="4" md="4">
                <div class="text-body-2 text-grey">Planned By</div>
                <div class="text-body-1 font-weight-medium">
                  {{ detail?.production?.produced_by_name }}
                </div>
              </v-col>
              <v-col cols="4" md="4">
                <div class="d-flex align-center">
                  <v-avatar class="mr-3" color="orange-lighten-5" size="40">
                    <v-icon color="orange">mdi-calendar-clock</v-icon>
                  </v-avatar>
                  <div>
                    <div class="text-body-2 text-grey">Planned At</div>
                    <div class="text-body-1 font-weight-medium">
                      {{ formatDate(detail?.production?.planned_at) }}
                    </div>
                  </div>
                </div>
              </v-col>
              <v-col cols="4" md="4">
                <div class="d-flex align-center">
                  <v-avatar class="mr-3" color="green-lighten-5" size="40">
                    <v-icon color="green">mdi-calendar-check</v-icon>
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

          <!-- 🚨 Discrepancy Reasons -->
          <v-card
            v-if="detail?.discrepancies?.length"
            class="rounded-lg pa-4 mb-4"
            variant="outlined"
          >
            <div class="d-flex align-center mb-3">
              <v-icon class="mr-2" color="red">mdi-alert-circle</v-icon>
              <h5 class="text-h6 font-weight-medium text-red">
                Discrepancy Details
              </h5>
            </div>

            <div class="mb-3 text-body-2 text-grey">
              The actual produced quantity differs from the planned quantity.
              Below are the reported reasons:
            </div>

            <v-chip-group class="d-flex flex-wrap gap-2" column multiple>
              <v-chip
                v-for="(reason, idx) in detail.discrepancies"
                :key="idx"
                color="red-lighten-2"
                prepend-icon="mdi-alert"
                variant="outlined"
              >
                {{ reason.name }} - {{ reason.notes }}
              </v-chip>
            </v-chip-group>
          </v-card>

          <!-- Staff Assignment Section -->
          <v-card
            v-if="detail?.staff?.length"
            class="rounded-lg mb-4"
            variant="outlined"
          >
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="primary">mdi-account-group</v-icon>
              Assigned Staff Team
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list class="pa-0" lines="two">
                <v-list-item
                  v-for="(staff, index) in detail.staff"
                  :key="index"
                  class="px-4"
                  :class="{ 'bg-grey-lighten-4': index % 2 === 0 }"
                >
                  <template #prepend>
                    <v-avatar
                      class="mr-3"
                      color="primary"
                      size="40"
                      variant="tonal"
                    >
                      <v-icon color="white" size="20">mdi-account</v-icon>
                    </v-avatar>
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ staff.name }}
                  </v-list-item-title>

                  <v-list-item-subtitle class="mt-1">
                    <div class="d-flex flex-wrap gap-2 align-center">
                      <v-chip
                        v-if="staff.role"
                        color="blue"
                        size="small"
                        variant="outlined"
                      >
                        {{ staff.role }}
                      </v-chip>
                    </div>
                    <div v-if="staff.notes" class="text-caption text-grey mt-1">
                      {{ staff.notes }}
                    </div>
                  </v-list-item-subtitle>

                  <template #append>
                    <v-chip color="success" size="small" variant="flat">
                      Active
                    </v-chip>
                  </template>
                </v-list-item>
              </v-list>

              <!-- Staff Summary -->
              <v-divider />
              <div class="pa-4 bg-grey-lighten-4">
                <v-row dense>
                  <v-col class="text-center" cols="12" md="4">
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
          <v-card class="rounded-lg" variant="outlined">
            <v-card-title class="d-flex align-center">
              <v-icon class="mr-2" color="primary">mdi-ingredient</v-icon>
              Ingredients Used
            </v-card-title>
            <v-card-text class="pa-0">
              <v-list class="pa-0" lines="two">
                <v-list-item
                  v-for="(ingredient, index) in detail?.items || []"
                  :key="index"
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
import { computed, onMounted, reactive, ref } from "vue";
import { toDisplay, toISO } from "@/utils/date.js";

// Reactive state
const loading = ref(false);
const saving = ref(false);
const productions = ref([]);
const page = ref(1);
const totalPages = ref(1);
const dialog = ref(false);
const viewDialog = ref(false);
const editEnabled = ref(true);
const isEditing = ref(false);
const isAddingActual = ref(false);
const detail = ref(null);
const search = ref("");

// Data collections
const products = ref([]);
const staffList = ref([]);
const recipeItems = ref([]);
const baseUnit = ref("");
const availableStock = ref([]);

const discrepancyReasons = ref([]);
const showDiscrepancy = ref(false);

// Form structure
const form = reactive({
  planned_at: null,
  produced_at: null,
  mode: "",
  product_id: "",
  qty_product: null,
  actual_qty: null,
  good_qty: null,
  damaged_qty: null,
  reject_qty: null,
  base_ingredient_id: "",
  base_ingredient_qty: null,
  notes: "",
  staff: [],
  discrepancies: [],
});

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

// Computed data for ingredients
const computedData = reactive({
  qty_product: 0,
  ingredients: [],
});

function recomputeActual() {
  form.actual_qty =
    (Number(form.good_qty) || 0) +
    (Number(form.damaged_qty) || 0) +
    (Number(form.reject_qty) || 0);
  checkDiscrepancy();
}

const goodPercent = computed(() => {
  const total = Number(detail.value?.production?.actual_qty) || 0;
  const good = Number(detail.value?.production?.good_qty) || 0;
  return total ? (good / total) * 100 : 0;
});

const damagedPercent = computed(() => {
  const total = Number(detail.value?.production?.actual_qty) || 0;
  const damaged = Number(detail.value?.production?.damaged_qty) || 0;
  return total ? (damaged / total) * 100 : 0;
});

const rejectPercent = computed(() => {
  const total = Number(detail.value?.production?.actual_qty) || 0;
  const reject = Number(detail.value?.production?.reject_qty) || 0;
  return total ? (reject / total) * 100 : 0;
});

// Configuration
const modes = [
  { label: "By Product", value: "by_product" },
  { label: "By Ingredient", value: "by_ingredient" },
];

// Headers
const productionHeaders = [
  {
    title: "Product",
    key: "product_name",
    sortable: true,
    width: "250px",
  },
  {
    title: "Quantity",
    key: "qty_product",
    sortable: true,
    align: "center",
  },
  {
    title: "Staffs",
    key: "staff_count",
    sortable: true,
    align: "center",
  },
  {
    title: "Mode",
    key: "mode",
    sortable: true,
  },
  {
    title: "Status",
    key: "status",
    sortable: true,
  },
  {
    title: "Planned At",
    key: "planned_at",
    sortable: true,
    width: "150px",
  },
  {
    title: "Produced At",
    key: "produced_at",
    sortable: true,
    width: "150px",
  },
  {
    title: "Team Leader",
    key: "team_leader_name",
    sortable: true,
  },
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
];

const staffHeaders = [
  { title: "Staff Member", key: "staff_id", width: "250px" },
  { title: "Role", key: "role", width: "240px" },
  { title: "Notes", key: "notes", width: "240px" },
  { title: "Actions", key: "actions", align: "center", sortable: false },
];

const getStatusColor = (status) => {
  const colors = {
    pending: "bg-orange",
    completed: "bg-green",
    active: "bg-primary",
    cancelled: "bg-red",
  };
  return colors[status] || "bg-primary";
};

const activeFilterCount = computed(() => {
  let count = 0;
  const filterKeys = Object.keys(filters);

  filterKeys.forEach((key) => {
    if (filters[key] && filters[key] !== "all") {
      if (Array.isArray(filters[key])) {
        if (filters[key].length > 0) count++;
      } else {
        count++;
      }
    }
  });

  return count;
});
// Computed properties
const hasInsufficientStock = computed(() => {
  return computedData.ingredients.some((i) => i.exceeds);
});
const availableStaff = computed(() => {
  const selectedIds = form.staff
    .map((s) => s.staff_id?.id)
    .filter((id) => !!id);

  // Return only staff not yet selected
  return staffList.value.filter((staff) => !selectedIds.includes(staff.id));
});

const assignedStaffCount = computed(() => {
  return form.staff.filter((staff) => staff.staff_id).length;
});

const totalItems = computed(() => productions.value.length);
const totalUnits = computed(() => {
  return productions.value.reduce((sum, p) => sum + (p.qty_product || 0), 0);
});
const totalStaffAssignments = computed(() => {
  return productions.value.reduce(
    (sum, p) => parseInt(sum) + parseInt(p.staff_count || 0),
    0,
  );
});
const totalLaborCost = computed(() => {
  return productions.value
    .reduce((sum, p) => sum + (p.total_pay || 0), 0)
    .toFixed(2);
});

const canSave = computed(() => {
  const hasValidStaff = form.staff.some((staff) => staff.staff_id);
  const hasValidIngredients = computedData.ingredients.length > 0;
  const hasValidQuantity = computedData.qty_product > 0;
  const hasValidProduct = form.product_id;
  let hasValidActual = true;
  if (isAddingActual.value) {
    hasValidActual = form.actual_qty !== null && form.actual_qty >= 0;
  }
  let hasProducedAt = true;
  if (form.actual_qty && !form.produced_at) {
    hasProducedAt = false;
  }

  return (
    hasValidProduct &&
    hasValidIngredients &&
    hasValidQuantity &&
    hasValidStaff &&
    hasValidActual &&
    !hasInsufficientStock.value &&
    form.planned_at &&
    hasProducedAt &&
    !saving.value
  );
});

async function loadAvailableStock() {
  try {
    const res = await fetch("/items/availableStock");
    availableStock.value = await res.json();
  } catch (err) {
    console.error("Failed to load stock:", err);
  }
}

async function loadDiscrepancyReasons() {
  const res = await fetch("/productions/discrepancyReasons");
  const data = await res.json();
  discrepancyReasons.value = data.data || [];
}

function checkDiscrepancy() {
  const expectedQty = parseFloat(computedData.qty_product);
  const goodQty = parseFloat(form.good_qty);
  showDiscrepancy.value = !!(goodQty && goodQty !== expectedQty);
  if (showDiscrepancy.value && !form.discrepancies.length) addDiscrepancy();
}

function addDiscrepancy() {
  form.discrepancies.push({ reason_id: null, notes: "" });
}

function removeDiscrepancy(index) {
  form.discrepancies.splice(index, 1);
}

// Methods
function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addStaffMember() {
  form.staff.push({
    staff_id: "",
    role: "",
    notes: "",
  });
}

function removeStaffMember(index) {
  form.staff.splice(index, 1);
}

function clearAllStaff() {
  form.staff = [];
}

function closeDialog() {
  dialog.value = false;
  showDiscrepancy.value = false;
  resetForm();
}

function resetForm() {
  Object.assign(form, {
    mode: "",
    product_id: "",
    qty_product: null,
    good_qty: null,
    damaged_qty: null,
    reject_qty: null,
    actual_qty: null,
    discrepancies: [],
    base_ingredient_id: "",
    base_ingredient_qty: null,
    notes: "",
    staff: [],
  });
  computedData.qty_product = 0;
  computedData.ingredients = [];
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
  loadProductions();
}

function applyFilters() {
  page.value = 1;
  loadProductions();
}

async function loadProductions() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: page.value,
      limit: 10,
      ...filters,
    });
    const res = await fetch(`/productions?${params.toString()}`);
    const data = await res.json();
    productions.value = data.data || [];
    totalPages.value = data.totalPages || 1;
  } catch (error) {
    console.error("Failed to load productions:", error);
    productions.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadProducts() {
  try {
    const res = await fetch("/products?limit=1000&page=1");
    const data = await res.json();
    products.value = data.data || [];
  } catch (error) {
    console.error("Failed to load products:", error);
    products.value = [];
  }
}

async function loadStaff() {
  try {
    const res = await fetch("/staffs?status=Active&limit=1000&page=1");
    const data = await res.json();
    staffList.value = data.data || [];
  } catch (error) {
    console.error("Failed to load staff:", error);
    staffList.value = [];
  }
}

async function onProductChange() {
  computedData.ingredients = [];
  computedData.qty_product = 0;
  baseUnit.value = "";

  if (!form.product_id) return;

  try {
    const res = await fetch(`/products/${form.product_id}`);
    const data = await res.json();
    const items = data.items || [];
    recipeItems.value = items.map((i) => ({
      item_id: i.item_id,
      item_name: i.item_name || i.name,
      quantity_per_unit: Number(i.quantity_per_unit),
      unit_id: i.unit_id,
      unit: i.unit || i.unit_short,
    }));
  } catch (error) {
    console.error("Failed to load product details:", error);
    recipeItems.value = [];
  }
}

function recalc() {
  if (!form.product_id || recipeItems.value.length === 0) return;

  let multiplier = 0;
  if (form.mode === "by_product") {
    multiplier = Number(form.qty_product) || 0;
  } else if (form.mode === "by_ingredient") {
    const base = recipeItems.value.find(
      (i) => i.item_id === Number(form.base_ingredient_id),
    );
    baseUnit.value = base?.unit || "";
    if (base && base.quantity_per_unit > 0 && form.base_ingredient_qty > 0) {
      multiplier = form.base_ingredient_qty / base.quantity_per_unit;
    }
  }

  computedData.qty_product = multiplier;
  computedData.ingredients = recipeItems.value.map((r) => {
    const available =
      availableStock.value.find((s) => s.item_id === r.item_id)
        ?.available_qty || 0;
    return {
      item_id: r.item_id,
      item_name: r.item_name,
      unit_id: r.unit_id,
      unit: r.unit,
      qty_required: +(r.quantity_per_unit * multiplier).toFixed(3),
      available: +available,
      exceeds: r.quantity_per_unit * multiplier > available,
    };
  });
}

function openAddDialog() {
  dialog.value = true;
  isEditing.value = false;
  isAddingActual.value = false;
  editEnabled.value = true;
  resetForm();
  addStaffMember(); // Start with one staff member
}

async function edit(item, type) {
  if (type === "actual") {
    isAddingActual.value = true;
  } else {
    isAddingActual.value = false;
  }
  isEditing.value = true;
  dialog.value = true;
  editEnabled.value = false;

  try {
    const res = await fetch(`/productions/${item.id}`);
    const data = await res.json();
    Object.assign(form, {
      id: data.production.id,
      mode: data.production.mode,
      product_id: data.production.product_id,
      qty_product: parseFloat(data.production.qty_product),
      actual_qty: parseFloat(data.production.actual_qty),
      good_qty: parseFloat(data.production.good_qty),
      damaged_qty: parseFloat(data.production.damaged_qty),
      reject_qty: parseFloat(data.production.reject_qty),
      base_ingredient_id: data.production.base_ingredient_id,
      base_ingredient_qty: parseFloat(data.production.base_ingredient_qty),
      planned_at: toDisplay(data.production.planned_at),
      produced_at: toDisplay(data.production.produced_at),
      notes: data.production.notes,
      staff:
        data.staff.map((row) => ({
          staff_id: {
            id: row.id,
            name: row.name,
          },
          role: row.role || "",
          notes: row.notes || "",
        })) || [],
      discrepancies: data.discrepancies,
    });
    if (data.discrepancies.length) {
      checkDiscrepancy();
    }
    onProductChange();

    computedData.qty_product = data.production.qty_product;
    computedData.ingredients = data.items.map((i) => ({
      item_id: i.item_id,
      item_name: i.item_name,
      unit_id: i.unit_id,
      unit: i.unit,
      qty_required: parseFloat(i.qty_required),
    }));
  } catch (error) {
    console.error("Failed to load production for editing:", error);
  }
}

async function saveProduction() {
  saving.value = true;
  try {
    const payload = {
      product_id: form.product_id,
      base_ingredient_id: form.base_ingredient_id,
      base_ingredient_qty: form.base_ingredient_qty,
      planned_at: toISO(form.planned_at),
      produced_at: toISO(form.produced_at),
      mode: form.mode,
      qty_product: computedData.qty_product,
      good_qty: form.good_qty || 0,
      damaged_qty: form.damaged_qty || 0,
      reject_qty: form.reject_qty || 0,
      actual_qty: form.actual_qty || 0,
      notes: form.notes,
      ingredients: computedData.ingredients,
      staffs: form.staff.filter((staff) => staff.staff_id),
      discrepancies: form.discrepancies.filter((discr) => discr.reason_id),
    };

    const url = isEditing.value ? `/productions/${form.id}` : "/productions";
    const method = isEditing.value ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      if (err.error === "INSUFFICIENT_STOCK") {
        alert(
          `${err.message}\nAvailable: ${err.details.available}\nRequired: ${err.details.required}`,
        );
      } else {
        alert(err.message || "Failed to save production.");
      }
      return;
    }

    dialog.value = false;
    loadAvailableStock();
    resetForm();
    await loadProductions();
  } catch (error) {
    console.error("Failed to save production:", error);
    alert("Failed to save production. Please try again.");
  } finally {
    saving.value = false;
  }
}

async function view(item) {
  try {
    const res = await fetch(`/productions/${item.id}`);
    detail.value = await res.json();
    viewDialog.value = true;
  } catch (error) {
    console.error("Failed to load production details:", error);
  }
}

async function remove(item) {
  if (!confirm("Are you sure you want to delete this production?")) return;

  try {
    await fetch(`/productions/${item.id}`, { method: "DELETE" });
    await loadProductions();
  } catch (error) {
    console.error("Failed to delete production:", error);
    alert("Failed to delete production. Please try again.");
  }
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    loadStaff(),
    loadProducts(),
    loadProductions(),
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
  transition: opacity 0.2s ease;
}

:deep(.dp__input) {
  padding-top: 18px; /* gives visual space for the label */
}

.h-100 {
  height: 100%;
}

:deep(.custom-date-picker .dp__input) {
  border: none !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.42) !important;
  border-radius: 0 !important;
  padding-left: 0 !important;
  font-size: 14px;
}

:deep(.custom-date-picker .dp__input:focus) {
  border-bottom: 2px solid #1976d2 !important;
}

:deep(.custom-date-picker .dp__input::placeholder) {
  color: rgba(0, 0, 0, 0.6);
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
  background-color: #4caf50; /* green */
}

.bar-segment.damaged {
  background-color: #fb8c00; /* orange */
}

.bar-segment.reject {
  background-color: #e53935; /* red */
}
</style>
