<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- 🎯 HEADER WITH STATS -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-truck-delivery</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Stock Transfers
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Manage inventory movements between outlets
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="6">
            <v-btn
              v-if="$store.getters.hasTask('can_adjust_stock_quality')"
              class="mr-3 text-white"
              color="secondary"
              size="large"
              @click="openAdjustDialog"
            >
              <v-icon start>mdi-autorenew</v-icon>
              Adjust Quality
            </v-btn>
            <v-btn
              v-if="$store.getters.hasTask('can_transfer_stock')"
              color="primary"
              size="large"
              @click="openAddDialog"
            >
              <v-icon start>mdi-plus</v-icon>
              New Transfer
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 🔍 ENHANCED FILTERS -->
    <v-card class="mb-6" elevation="1">
      <v-card-text class="pa-4">
        <v-row align="center" dense>
          <v-col cols="12" sm="3">
            <v-select
              v-model="filters.from_outlet_id"
              clearable
              density="comfortable"
              item-title="name"
              item-value="id"
              :items="fromOutlets"
              label="From Outlet"
              prepend-inner-icon="mdi-export"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-select
              v-model="filters.to_outlet_id"
              clearable
              density="comfortable"
              item-title="name"
              item-value="id"
              :items="toOutlets"
              label="To Outlet"
              prepend-inner-icon="mdi-import"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="filters.date"
              autocomplete="off"
              autocorrect="off"
              clearable
              density="comfortable"
              inputmode="none"
              label="Transfer Date"
              prepend-inner-icon="mdi-calendar"
              spellcheck="false"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col class="d-flex justify-end" cols="12" sm="3">
            <v-btn
              class="mr-2"
              color="primary"
              variant="flat"
              @click="loadTransfers"
            >
              <v-icon start>mdi-magnify</v-icon>
              Search
            </v-btn>
            <v-btn color="grey" variant="outlined" @click="resetFilters">
              <v-icon start>mdi-refresh</v-icon>
              Reset
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 📊 MAIN CONTENT CARD -->
    <v-card class="rounded-lg" elevation="2">
      <!-- LOADING BAR -->
      <v-progress-linear
        :active="loading"
        color="primary"
        height="4"
        :indeterminate="loading"
      />

      <!-- ENHANCED TABLE -->
      <v-data-table
        class="elevation-0"
        :headers="headers"
        :items="transfers"
        :items-per-page="10"
        :loading="loading"
        loading-text="Loading transfers..."
        no-data-text="No transfers found"
      >
        <template #top>
          <v-card-title class="d-flex align-center pt-4">
            <v-icon class="mr-2" color="primary"
              >mdi-format-list-bulleted</v-icon
            >
            Recent Transfers
            <v-chip class="ml-3" color="primary" size="small" variant="flat">
              {{ transfers.length }} total
            </v-chip>
          </v-card-title>
          <v-divider />
        </template>

        <template #item.from_outlet="{ item }">
          <div class="d-flex align-center">
            <v-avatar
              class="mr-2"
              :color="getOutletColor(item.from_outlet_type)"
              size="32"
            >
              <v-icon color="white" size="16">
                {{ getOutletIcon(item.from_outlet_type) }}
              </v-icon>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.from_outlet }}</div>
              <div class="text-caption text-grey">
                {{ item.from_outlet_type }}
              </div>
            </div>
          </div>
        </template>

        <template #item.to_outlet="{ item }">
          <div class="d-flex align-center">
            <v-avatar
              class="mr-2"
              :color="getOutletColor(item.to_outlet_type)"
              size="32"
            >
              <v-icon color="white" size="16">
                {{ getOutletIcon(item.to_outlet_type) }}
              </v-icon>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.to_outlet }}</div>
              <div class="text-caption text-grey">
                {{ item.to_outlet_type }}
              </div>
            </div>
          </div>
        </template>

        <template #item.transfer_date="{ item }">
          <div class="d-flex align-center">
            <v-icon class="mr-2" color="grey" size="16">mdi-calendar</v-icon>
            <span class="font-weight-medium">{{
              formatDate(item.transfer_date)
            }}</span>
          </div>
        </template>

        <template #item.items_count="{ item }">
          <v-chip color="primary" size="small" variant="outlined">
            {{ item.items_count }} items
          </v-chip>
        </template>

        <template #item.total_quantity="{ item }">
          <div class="text-center">
            <v-chip color="green" size="small" variant="flat">
              {{ item.total_quantity }}
            </v-chip>
          </div>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex justify-end">
            <v-tooltip location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  color="info"
                  icon
                  size="small"
                  variant="text"
                  @click="openViewDialog(item)"
                >
                  <v-icon>mdi-eye-outline</v-icon>
                </v-btn>
              </template>
              <span>View Details</span>
            </v-tooltip>

            <v-tooltip location="top">
              <template #activator="{ props }">
                <v-btn
                  v-if="$store.getters.hasTask('can_edit_stock_transfer')"
                  v-bind="props"
                  color="primary"
                  icon
                  size="small"
                  variant="text"
                  @click="openEditDialog(item)"
                >
                  <v-icon>mdi-pencil-outline</v-icon>
                </v-btn>
              </template>
              <span>Edit Transfer</span>
            </v-tooltip>

            <v-tooltip location="top">
              <template #activator="{ props }">
                <v-btn
                  v-if="$store.getters.hasTask('can_delete_stock_transfer')"
                  v-bind="props"
                  color="error"
                  icon
                  size="small"
                  variant="text"
                  @click="openDeleteDialog(item)"
                >
                  <v-icon>mdi-delete-outline</v-icon>
                </v-btn>
              </template>
              <span>Delete Transfer</span>
            </v-tooltip>
          </div>
        </template>
      </v-data-table>

      <!-- ENHANCED PAGINATION -->
      <v-card-actions class="px-4 py-3 bg-grey-lighten-3">
        <v-spacer />
        <v-pagination
          v-model="page"
          color="primary"
          :length="totalPages"
          total-visible="7"
          @update:model-value="loadTransfers"
        />
      </v-card-actions>
    </v-card>

    <v-dialog v-model="showDialog" max-width="1200" persistent scrollable>
      <v-card class="rounded-lg">
        <v-toolbar
          :color="isEditing ? 'warning' : 'primary'"
          density="comfortable"
        >
          <v-avatar
            class="mr-3"
            :color="isEditing ? 'warning' : 'primary'"
            size="40"
          >
            <v-icon color="white">
              {{ isEditing ? "mdi-pencil" : "mdi-plus" }}
            </v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ isEditing ? "Edit Transfer" : "Create New Transfer" }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="closeDialog">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-alert
          v-if="saving && hasQualityChanges"
          class="mb-4"
          color="info"
          icon="mdi-autorenew"
          variant="tonal"
        >
          <v-progress-linear
            class="mb-2"
            color="info"
            height="4"
            indeterminate
          />
          Processing quality adjustments...
        </v-alert>

        <v-card-text class="pa-6">
          <!-- Basic Info Section -->
          <v-card class="mb-6" variant="outlined">
            <v-card-title class="d-flex align-center bg-blue-lighten-5">
              <v-icon class="mr-2" color="primary">mdi-information</v-icon>
              Transfer Information
            </v-card-title>
            <v-card-text class="pa-4">
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.from_outlet_id"
                    item-title="name"
                    item-value="id"
                    :items="filteredFromOutlets"
                    label="From Outlet"
                    prepend-inner-icon="mdi-export"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.to_outlet_id"
                    item-title="name"
                    item-value="id"
                    :items="filteredToOutlets"
                    label="To Outlet"
                    prepend-inner-icon="mdi-import"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.movement_date"
                    autocomplete="off"
                    autocorrect="off"
                    inputmode="none"
                    label="Transfer Date"
                    prepend-inner-icon="mdi-calendar"
                    required
                    spellcheck="false"
                    type="date"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="form.remarks"
                    label="Remarks"
                    placeholder="Add any notes about this transfer..."
                    rows="2"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Transfer Items Section -->
          <v-card variant="outlined">
            <v-card-title
              class="d-flex align-center justify-space-between bg-green-lighten-5"
            >
              <div class="d-flex align-center">
                <v-icon class="mr-2" color="green">mdi-package-variant</v-icon>
                Transfer Items
                <v-chip class="ml-3" color="green" size="small" variant="flat">
                  {{ form.items.length }} items
                </v-chip>
              </div>
              <v-btn
                color="green"
                :disabled="!canAddTransferItem"
                size="small"
                @click="addItem"
              >
                <v-icon start>mdi-plus</v-icon>
                Add Item
              </v-btn>
            </v-card-title>

            <v-card-text class="pa-4">
              <!-- Quality Change Notice -->
              <v-alert
                v-if="hasQualityChanges"
                class="mb-4"
                color="info"
                icon="mdi-autorenew"
                variant="tonal"
              >
                {{ qualityChangeSummary }}
              </v-alert>

              <!-- Validation Errors -->
              <v-alert
                v-if="validationErrors.length"
                class="mb-4"
                color="error"
                icon="mdi-alert-circle"
                variant="tonal"
              >
                <div v-for="error in validationErrors" :key="error">
                  • {{ error }}
                </div>
              </v-alert>

              <!-- Items List -->
              <div
                v-for="(item, index) in form.items"
                :key="index"
                class="mb-4"
              >
                <v-card
                  class="elevation-2"
                  :color="isQualityChanged(item) ? 'orange-lighten-5' : ''"
                >
                  <v-card-text class="pa-4">
                    <v-row align="center" dense>
                      <!-- Product Selection -->
                      <v-col cols="12" md="3">
                        <v-autocomplete
                          v-model="item.product_id"
                          autocapitalize="off"
                          autocomplete="off"
                          autocorrect="off"
                          density="comfortable"
                          inputmode="none"
                          item-title="name"
                          item-value="id"
                          :items="getAvailableProducts(index)"
                          label="Product"
                          prepend-inner-icon="mdi-cube-outline"
                          required
                          spellcheck="false"
                          variant="outlined"
                          @update:model-value="() => onProductChange(item)"
                        />
                      </v-col>

                      <!-- Stock Information Card -->
                      <v-col cols="12" md="2">
                        <v-card
                          class="pa-3 text-center"
                          color="blue-lighten-5"
                          variant="flat"
                        >
                          <div
                            class="text-caption text-blue-darken-3 font-weight-bold"
                          >
                            STOCK INFO
                          </div>
                          <div
                            class="text-body-2 font-weight-bold text-blue-darken-3"
                          >
                            {{ getSystemQuality(item) }}
                          </div>
                          <div class="text-caption text-blue-darken-2">
                            Available: {{ getSystemAvailableStock(item) }}
                          </div>
                        </v-card>
                      </v-col>

                      <!-- Quality Selectors -->
                      <v-col cols="12" md="2">
                        <v-select
                          v-model="item.from_quality"
                          :color="getQualityColor(item.from_quality)"
                          density="comfortable"
                          :hint="getFromQualityHint(item)"
                          :items="qualityOptions"
                          label="From Quality"
                          persistent-hint
                          required
                          variant="outlined"
                          @update:model-value="() => onFromQualityChange(item)"
                        />
                      </v-col>

                      <v-col cols="12" md="2">
                        <v-select
                          v-model="item.to_quality"
                          :color="getQualityColor(item.to_quality)"
                          density="comfortable"
                          :hint="getToQualityHint(item)"
                          :items="qualityOptions"
                          label="To Quality"
                          persistent-hint
                          required
                          variant="outlined"
                        />
                      </v-col>

                      <!-- Quantity Input -->
                      <v-col cols="12" md="2">
                        <v-text-field
                          v-model="item.quantity"
                          autocomplete="off"
                          autocorrect="off"
                          density="comfortable"
                          :error="hasStockError(item)"
                          :hint="getQuantityHint(item)"
                          inputmode="none"
                          label="Quantity"
                          persistent-hint
                          required
                          spellcheck="false"
                          type="number"
                          variant="outlined"
                          @input="() => validateItemStock(item)"
                        />
                      </v-col>

                      <!-- Remove Button -->
                      <v-col cols="12" md="1">
                        <v-btn
                          color="error"
                          icon
                          size="small"
                          variant="text"
                          @click="removeItem(index)"
                        >
                          <v-icon>mdi-delete-outline</v-icon>
                        </v-btn>
                      </v-col>
                    </v-row>

                    <!-- Replacement Section -->
                    <v-row
                      v-if="isReturnToMain && item.to_quality === 'REJECT'"
                      class="mt-2"
                    >
                      <v-col cols="12">
                        <v-card variant="outlined">
                          <v-card-text class="pa-3">
                            <v-row align="center">
                              <v-col cols="auto">
                                <v-checkbox
                                  v-model="item.is_replacement"
                                  color="orange"
                                  density="compact"
                                  label="Mark as Replacement"
                                />
                              </v-col>
                              <v-col>
                                <v-text-field
                                  v-if="item.is_replacement"
                                  v-model="item.replacement_note"
                                  autocomplete="off"
                                  autocorrect="off"
                                  density="compact"
                                  inputmode="none"
                                  label="Replacement Reason"
                                  placeholder="Explain why this is a replacement..."
                                  spellcheck="false"
                                  variant="outlined"
                                />
                              </v-col>
                            </v-row>
                          </v-card-text>
                        </v-card>
                      </v-col>
                    </v-row>

                    <!-- Quality Change Indicator -->
                    <v-alert
                      v-if="isQualityChanged(item)"
                      class="mt-2"
                      color="warning"
                      density="compact"
                      icon="mdi-autorenew"
                      variant="tonal"
                    >
                      Quality conversion:
                      <strong>{{ item.from_quality }}</strong>
                      <v-icon color="warning" small>mdi-arrow-right</v-icon>
                      <strong>{{ item.to_quality }}</strong>
                    </v-alert>

                    <!-- Item Error Message -->
                    <v-alert
                      v-if="getItemError(item)"
                      class="mt-2"
                      color="error"
                      density="compact"
                      icon="mdi-alert"
                      variant="tonal"
                    >
                      {{ getItemError(item) }}
                    </v-alert>
                  </v-card-text>
                </v-card>
              </div>

              <!-- Empty State -->
              <div v-if="form.items.length === 0" class="text-center py-8">
                <v-icon class="mb-4" color="grey" size="64"
                  >mdi-package-variant-plus</v-icon
                >
                <div class="text-h6 text-grey mb-2">No Items Added</div>
                <div class="text-body-1 text-grey mb-4">
                  Click "Add Item" to start adding products to this transfer
                </div>
                <v-btn
                  color="primary"
                  :disabled="!canAddTransferItem"
                  @click="addItem"
                >
                  <v-icon start>mdi-plus</v-icon>
                  Add Your First Item
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn size="large" variant="outlined" @click="closeDialog">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!canSave"
            :loading="saving"
            size="large"
            variant="flat"
            @click="saveTransfer"
          >
            <v-icon start>{{
              isEditing ? "mdi-content-save" : "mdi-check"
            }}</v-icon>
            {{ isEditing ? "Update Transfer" : "Create Transfer" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 🎨 ENHANCED QUALITY ADJUSTMENT DIALOG -->
    <v-dialog v-model="showAdjustDialog" max-width="700">
      <v-card class="rounded-lg">
        <v-toolbar color="secondary" density="comfortable">
          <v-avatar class="mr-3" color="secondary" size="40">
            <v-icon color="white">mdi-autorenew</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            Adjust Product Quality
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showAdjustDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-card class="mb-4" variant="outlined">
            <v-card-text class="pa-4">
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="adjust.outlet_id"
                    item-title="name"
                    item-value="id"
                    :items="fromOutlets"
                    label="Outlet"
                    prepend-inner-icon="mdi-store"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="adjust.product_id"
                    item-title="name"
                    item-value="id"
                    :items="products"
                    label="Product"
                    prepend-inner-icon="mdi-cube-scan"
                    required
                    variant="outlined"
                    @update:model-value="fetchAdjustAvailability"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="adjust.from_quality"
                    :color="getQualityColor(adjust.from_quality)"
                    :items="qualityOptions"
                    label="From Quality"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="adjust.to_quality"
                    :color="getQualityColor(adjust.to_quality)"
                    :items="qualityOptions"
                    label="To Quality"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    v-model.number="adjust.quantity"
                    autocomplete="off"
                    autocorrect="off"
                    :error="hasAdjustStockError"
                    :hint="getAdjustStockHint"
                    inputmode="none"
                    label="Quantity"
                    persistent-hint
                    prepend-inner-icon="mdi-scale"
                    required
                    spellcheck="false"
                    type="number"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="adjust.remarks"
                    label="Remarks"
                    placeholder="Reason for quality adjustment..."
                    required
                    rows="3"
                    variant="outlined"
                  />
                </v-col>
              </v-row>

              <!-- Available Stock Display -->
              <v-alert
                v-if="adjust.available"
                class="mt-4"
                color="info"
                variant="tonal"
              >
                <template #prepend>
                  <v-icon color="info">mdi-information</v-icon>
                </template>
                <div class="font-weight-bold mb-2">Current Stock Levels:</div>
                <div class="d-flex gap-4">
                  <div class="text-center">
                    <div class="text-caption text-grey">GOOD</div>
                    <div class="text-h6 font-weight-bold text-green">
                      {{ adjust.available.GOOD || 0 }}
                    </div>
                  </div>
                  <div class="text-center">
                    <div class="text-caption text-grey">DAMAGED</div>
                    <div class="text-h6 font-weight-bold text-orange">
                      {{ adjust.available.DAMAGED || 0 }}
                    </div>
                  </div>
                  <div class="text-center">
                    <div class="text-caption text-grey">REJECT</div>
                    <div class="text-h6 font-weight-bold text-red">
                      {{ adjust.available.REJECT || 0 }}
                    </div>
                  </div>
                </div>
              </v-alert>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            size="large"
            variant="outlined"
            @click="showAdjustDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="secondary"
            :disabled="!canAdjust"
            :loading="adjustingQuality"
            size="large"
            variant="flat"
            @click="applyQualityAdjustment"
          >
            <v-icon start>mdi-check</v-icon>
            Apply Adjustment
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 👁️ ENHANCED VIEW TRANSFER DIALOG -->
    <v-dialog
      v-model="showViewDialog"
      max-width="800"
      scrollable
      transition="dialog-bottom-transition"
    >
      <v-card class="rounded-lg">
        <v-toolbar color="info" density="comfortable">
          <v-avatar class="mr-3" color="info" size="40">
            <v-icon color="white">mdi-eye</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            Transfer Details
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showViewDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <!-- Enhanced Transfer Information -->
          <v-card class="mb-6 elevation-2">
            <v-card-text class="pa-4">
              <v-row>
                <v-col class="border-e" cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-avatar class="mr-3" color="primary" size="48">
                      <v-icon color="white">mdi-identifier</v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-caption text-grey">TRANSFER ID</div>
                      <div class="text-h5 font-weight-bold">
                        #{{ currentTransfer?.id }}
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-center">
                    <v-icon class="mr-3" color="grey">mdi-calendar</v-icon>
                    <div>
                      <div class="text-caption text-grey">TRANSFER DATE</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ formatDate(currentTransfer?.transfer_date) }}
                      </div>
                    </div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-avatar
                      class="mr-3"
                      :color="getOutletColor(currentTransfer?.from_outlet_type)"
                      size="48"
                    >
                      <v-icon color="white">{{
                        getOutletIcon(currentTransfer?.from_outlet_type)
                      }}</v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-caption text-grey">FROM OUTLET</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ currentTransfer?.from_outlet }}
                      </div>
                      <v-chip
                        class="mt-1"
                        :color="
                          getOutletColor(currentTransfer?.from_outlet_type)
                        "
                        size="small"
                      >
                        {{ currentTransfer?.from_outlet_type }}
                      </v-chip>
                    </div>
                  </div>
                  <div class="d-flex align-center">
                    <v-avatar
                      class="mr-3"
                      :color="getOutletColor(currentTransfer?.to_outlet_type)"
                      size="48"
                    >
                      <v-icon color="white">{{
                        getOutletIcon(currentTransfer?.to_outlet_type)
                      }}</v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-caption text-grey">TO OUTLET</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ currentTransfer?.to_outlet }}
                      </div>
                      <v-chip
                        class="mt-1"
                        :color="getOutletColor(currentTransfer?.to_outlet_type)"
                        size="small"
                      >
                        {{ currentTransfer?.to_outlet_type }}
                      </v-chip>
                    </div>
                  </div>
                </v-col>
                <v-col v-if="currentTransfer?.remarks" cols="12">
                  <v-divider class="my-3" />
                  <div class="text-caption text-grey mb-1">REMARKS</div>
                  <v-card color="grey-lighten-4" variant="outlined">
                    <v-card-text class="pa-3">
                      {{ currentTransfer.remarks }}
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Enhanced Transfer Items -->
          <v-card elevation="2">
            <v-card-title class="d-flex align-center bg-teal-lighten-5">
              <v-icon class="mr-2" color="teal">mdi-package-variant</v-icon>
              Transfer Items
              <v-chip class="ml-3" color="teal" size="small" variant="flat">
                {{ currentTransferItems.length }} items
              </v-chip>
              <v-chip class="ml-2" color="green" size="small" variant="flat">
                Total: {{ totalItemsQuantity }} units
              </v-chip>
            </v-card-title>

            <v-card-text class="pa-0">
              <v-table density="comfortable">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <th class="text-left font-weight-bold text-grey">
                      PRODUCT
                    </th>
                    <th class="text-center font-weight-bold text-grey">
                      FROM QUALITY
                    </th>
                    <th class="text-center font-weight-bold text-grey">
                      TO QUALITY
                    </th>
                    <th class="text-center font-weight-bold text-grey">
                      QUANTITY
                    </th>
                    <th
                      v-if="hasReplacements"
                      class="text-center font-weight-bold text-grey"
                    >
                      REPLACEMENT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in currentTransferItems"
                    :key="item.id"
                    class="border-bottom"
                  >
                    <td>
                      <div class="d-flex align-center">
                        <v-avatar class="mr-3" color="blue" size="36">
                          <v-icon color="white" size="18">mdi-cube</v-icon>
                        </v-avatar>
                        <div>
                          <div class="font-weight-medium">
                            {{ item.product_name }}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="text-center">
                      <v-chip
                        :color="getQualityColor(item.from_quality)"
                        size="small"
                        variant="flat"
                      >
                        {{ item.from_quality }}
                      </v-chip>
                    </td>
                    <td class="text-center">
                      <div class="d-flex align-center justify-center">
                        <v-chip
                          :color="getQualityColor(item.to_quality)"
                          size="small"
                          variant="flat"
                        >
                          {{ item.to_quality }}
                        </v-chip>
                        <v-icon
                          v-if="
                            isQualityChanged({
                              from_quality: item.from_quality,
                              to_quality: item.to_quality,
                            })
                          "
                          class="ml-2"
                          color="orange"
                          size="16"
                        >
                          mdi-arrow-right
                        </v-icon>
                      </div>
                    </td>
                    <td class="text-center">
                      <v-chip color="green" size="small" variant="flat">
                        <strong>{{ item.quantity }}</strong>
                      </v-chip>
                    </td>
                    <td v-if="hasReplacements" class="text-center">
                      <v-chip
                        v-if="item.is_replacement"
                        color="orange"
                        :prepend-icon="
                          item.is_replacement ? 'mdi-autorenew' : undefined
                        "
                        size="small"
                        variant="flat"
                      >
                        Replacement
                        <v-tooltip
                          v-if="item.replacement_note"
                          activator="parent"
                          location="top"
                        >
                          {{ item.replacement_note }}
                        </v-tooltip>
                      </v-chip>
                      <v-chip
                        v-else
                        color="grey"
                        size="small"
                        variant="outlined"
                      >
                        Regular
                      </v-chip>
                    </td>
                  </tr>
                </tbody>
              </v-table>

              <!-- Empty State -->
              <div
                v-if="currentTransferItems.length === 0"
                class="text-center py-12"
              >
                <v-icon class="mb-4" color="grey" size="80"
                  >mdi-package-variant-remove</v-icon
                >
                <div class="text-h6 text-grey mb-2">No Transfer Items</div>
                <div class="text-body-1 text-grey">
                  This transfer doesn't contain any items
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            color="primary"
            size="large"
            variant="flat"
            @click="showViewDialog = false"
          >
            <v-icon start>mdi-close</v-icon>
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 🗑️ ENHANCED DELETE CONFIRMATION -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card class="rounded-lg">
        <v-toolbar color="error" density="comfortable">
          <v-avatar class="mr-3" color="error" size="40">
            <v-icon color="white">mdi-alert</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            Confirm Deletion
          </v-toolbar-title>
        </v-toolbar>

        <v-card-text class="pa-6 text-center">
          <v-icon class="mb-4" color="error" size="64">mdi-delete-alert</v-icon>
          <div class="text-h5 font-weight-bold mb-2">Delete Transfer?</div>
          <div class="text-body-1 text-grey mb-4">
            Are you sure you want to delete transfer
            <span class="font-weight-bold text-error"
              >#{{ currentTransferId }}</span
            >? This action cannot be undone.
          </div>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            size="large"
            variant="outlined"
            @click="showDeleteDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            size="large"
            variant="flat"
            @click="confirmDelete"
          >
            <v-icon start>mdi-delete</v-icon>
            Delete Transfer
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useStore } from "vuex";

const store = useStore();

// Data
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const adjustingQuality = ref(false);
const transfers = ref([]);
const fromOutlets = ref([]);
const toOutlets = ref([]);
const products = ref([]);
const page = ref(1);
const totalPages = ref(1);

// UI State
const showDialog = ref(false);
const showViewDialog = ref(false);
const showAdjustDialog = ref(false);
const showDeleteDialog = ref(false);
const isEditing = ref(false);
const currentTransferId = ref(null);
const currentTransfer = ref(null);
const currentTransferItems = ref([]);

// Filters
const filters = reactive({
  from_outlet_id: "",
  to_outlet_id: "",
  date: "",
});

// Form - Enhanced for quality conversion
const form = reactive({
  from_outlet_id: "",
  to_outlet_id: "",
  movement_date: new Date().toISOString().split("T")[0],
  remarks: "",
  items: [],
  originalItems: [],
});

// Quality Adjustment Form
const adjust = reactive({
  outlet_id: "",
  product_id: "",
  from_quality: "GOOD",
  to_quality: "DAMAGED",
  quantity: 0,
  remarks: "",
  available: null,
});

// Validation
const validationErrors = ref([]);

// Constants
const qualityOptions = [
  { title: "Good", value: "GOOD" },
  { title: "Damaged", value: "DAMAGED" },
  { title: "Reject", value: "REJECT" },
];

const headers = [
  { title: "ID", key: "id" },
  { title: "From Outlet", key: "from_outlet" },
  { title: "To Outlet", key: "to_outlet" },
  { title: "Date", key: "transfer_date" },
  { title: "Items", key: "items_count", align: "center" },
  { title: "Total Qty", key: "total_quantity", align: "center" },
  { title: "Actions", key: "actions", sortable: false },
];

const filteredFromOutlets = computed(() => {
  if (!form.to_outlet_id) return fromOutlets.value;
  return fromOutlets.value.filter((outlet) => outlet.id !== form.to_outlet_id);
});

const filteredToOutlets = computed(() => {
  if (!form.from_outlet_id) return toOutlets.value;
  return toOutlets.value.filter((outlet) => outlet.id !== form.from_outlet_id);
});

// Enhanced Computed Properties
const isReturnToMain = computed(() => {
  const fromOutlet = fromOutlets.value.find(
    (o) => o.id === form.from_outlet_id,
  );
  const toOutlet = toOutlets.value.find((o) => o.id === form.to_outlet_id);
  return toOutlet?.type === "MAIN" && fromOutlet?.type !== "MAIN";
});

const hasQualityChanges = computed(() => {
  return form.items.some((item) => item.from_quality !== item.to_quality);
});

// Update the qualityChangeSummary computed property
const qualityChangeSummary = computed(() => {
  const changes = form.items.filter(
    (item) => item.from_quality !== item.to_quality,
  );
  if (changes.length === 0) return "";

  const changeTypes = changes.reduce((acc, item) => {
    const key = `${item.from_quality}→${item.to_quality}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const changeText = Object.entries(changeTypes)
    .map(([change, count]) => `${count} ${change}`)
    .join(", ");

  return `${changes.length} item(s) will undergo quality conversion: ${changeText}`;
});

const canSave = computed(() => {
  return (
    form.from_outlet_id &&
    form.to_outlet_id &&
    form.movement_date &&
    form.items.length > 0 &&
    validationErrors.value.length === 0
  );
});

const canAddTransferItem = computed(() => {
  return form.from_outlet_id && form.to_outlet_id && form.movement_date;
});

const hasReplacements = computed(() => {
  return currentTransferItems.value.some((item) => item.is_replacement);
});

const totalItemsQuantity = computed(() => {
  return currentTransferItems.value.reduce(
    (sum, item) => sum + Number(item.quantity),
    0,
  );
});

// Quality Adjustment Computed
const hasAdjustStockError = computed(() => {
  if (!adjust.available || !adjust.quantity) return false;
  return adjust.quantity > (adjust.available[adjust.from_quality] || 0);
});

const getAdjustStockHint = computed(() => {
  if (!adjust.available) return "Select product first";
  const available = adjust.available[adjust.from_quality] || 0;
  return `Available: ${available}`;
});

const canAdjust = computed(() => {
  return (
    adjust.outlet_id &&
    adjust.product_id &&
    adjust.from_quality &&
    adjust.to_quality &&
    adjust.quantity > 0 &&
    adjust.remarks &&
    !hasAdjustStockError.value
  );
});

function getOutletIcon(type) {
  const icons = {
    MAIN: "mdi-home",
    SHOP: "mdi-store",
    CAR: "mdi-truck",
  };
  return icons[type] || "mdi-store";
}
function getOutletColor(type) {
  const colors = { MAIN: "primary", SHOP: "success", CAR: "warning" };
  return colors[type] || "grey";
}

function getQualityColor(quality) {
  const colors = { GOOD: "success", DAMAGED: "warning", REJECT: "error" };
  return colors[quality] || "grey";
}

function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

// Enhanced Item Methods
function isQualityChanged(item) {
  return (
    item.from_quality &&
    item.to_quality &&
    item.from_quality !== item.to_quality
  );
}

function getSystemQuality(item) {
  // Return the currently selected from_quality
  return item.from_quality || "GOOD";
}

function getSystemAvailableStock(item) {
  // Return available stock for the selected from_quality
  if (!item.stockData) return 0;
  return item.stockData[item.from_quality] || 0;
}

function getFromQualityHint(item) {
  if (!item.product_id) return "Select product first";
  return `Available: ${getSystemAvailableStock(item)}`;
}

function getToQualityHint(item) {
  if (!item.from_quality) return "Select from quality first";
  if (item.from_quality === item.to_quality) return "Same quality";
  return `Changing from ${item.from_quality}`;
}

function getQuantityHint(item) {
  if (!item.product_id || !item.from_quality) return "";
  return `Available: ${getSystemAvailableStock(item)}`;
}

// Enhanced Stock Management
async function fetchAvailableStock(item) {
  if (!form.from_outlet_id || !item.product_id) {
    item.availableStock = 0;
    item.stockData = null;
    return;
  }

  try {
    const res = await fetch(
      `/stocktransfers/availableByQuality?outlet_id=${form.from_outlet_id}&product_id=${item.product_id}`,
    );
    const data = await res.json();
    item.stockData = data.stock || { GOOD: 0, DAMAGED: 0, REJECT: 0 };
    let availableStock = item.stockData[item.from_quality] || 0;

    // If editing, add back the original quantity
    if (isEditing.value && item.originalQuantity) {
      // Find if this item was in the original transfer
      const originalItem = form.originalItems.find(
        (orig) =>
          orig.product_id === item.product_id &&
          orig.from_quality === item.from_quality &&
          orig.to_quality === item.to_quality,
      );

      if (originalItem) {
        availableStock += Number(originalItem.quantity);
      }
    }

    item.availableStock = availableStock;
  } catch (error) {
    console.error("Error fetching stock:", error);
    item.availableStock = 0;
    item.stockData = null;
  }
}

async function onFromQualityChange(item) {
  // Update available stock when from_quality changes
  if (item.stockData) {
    item.availableStock = item.stockData[item.from_quality] || 0;
  }
  await validateItemStock(item);
}

function hasStockError(item) {
  if (!item.quantity || !item.product_id || !item.from_quality) return false;

  const requestedQuantity = Number(item.quantity);
  const availableStock = item.availableStock || 0;

  // If editing, we need to check if we're increasing the quantity
  if (isEditing.value && item.originalQuantity) {
    const originalQuantity = Number(item.originalQuantity);
    const quantityIncrease = requestedQuantity - originalQuantity;

    if (quantityIncrease > 0) {
      // Only validate the increase amount
      return requestedQuantity > availableStock;
    }
    return false; // Decreasing or same quantity is always valid
  }

  // For new transfers, validate normally
  return requestedQuantity > availableStock;
}

function getItemError(item) {
  if (!item.product_id || !item.from_quality || !item.to_quality) return null;

  // Check for duplicates
  const combination = `${item.product_id}_${item.from_quality}_${item.to_quality}`;
  const duplicateCount = form.items.filter(
    (i) =>
      i.product_id &&
      i.from_quality &&
      i.to_quality &&
      `${i.product_id}_${i.from_quality}_${i.to_quality}` === combination,
  ).length;

  if (duplicateCount > 1) {
    return "This product with same transfer quality is already added";
  }

  // Check stock with edit consideration
  if (hasStockError(item)) {
    const product = products.value.find((p) => p.id === item.product_id);
    const availableStock = item.availableStock || 0;

    if (isEditing.value && item.originalQuantity) {
      const originalQuantity = Number(item.originalQuantity);
      const maxAllowed = originalQuantity + availableStock;

      return `Cannot increase quantity beyond ${availableStock}. Available: ${availableStock - originalQuantity}`;
    }

    return `Insufficient ${item.from_quality} stock. Available: ${availableStock}`;
  }

  return null;
}

function getAvailableProducts(currentIndex) {
  // const usedCombinations = form.items
  //   .filter((_, index) => index !== currentIndex)
  //   .map((item) => `${item.product_id}_${item.to_quality}`)
  //   .filter((combo) => combo !== "_");

  // return products.value.filter((product) => {
  //   if (form.items[currentIndex].product_id === product.id) return true;
  //   const currentToQuality = form.items[currentIndex].to_quality || "GOOD";
  //   const combination = `${product.id}_${currentToQuality}`;
  //   return !usedCombinations.includes(combination);
  // });
  return products.value;
}

// Enhanced Item Management
function addItem() {
  form.items.push({
    product_id: "",
    from_quality: "GOOD", // Actual stock quality
    to_quality: "GOOD", // Transfer quality
    quantity: "",
    is_replacement: false,
    replacement_note: "",
    availableStock: 0,
    stockData: null,
    originalQuantity: 0,
  });
  validateForm();
}

// Quality Adjustment Methods
function openAdjustDialog() {
  // Reset adjustment form
  Object.assign(adjust, {
    outlet_id: "",
    product_id: "",
    from_quality: "GOOD",
    to_quality: "DAMAGED",
    quantity: 0,
    remarks: "",
    available: null,
  });
  showAdjustDialog.value = true;
}

async function fetchAdjustAvailability() {
  if (!adjust.outlet_id || !adjust.product_id) {
    adjust.available = null;
    return;
  }

  try {
    const res = await fetch(
      `/stocktransfers/availableByQuality?outlet_id=${adjust.outlet_id}&product_id=${adjust.product_id}`,
    );
    const data = await res.json();
    adjust.available = data.stock || { GOOD: 0, DAMAGED: 0, REJECT: 0 };
  } catch (error) {
    console.error("Error fetching adjustment stock:", error);
    adjust.available = null;
  }
}

async function applyQualityAdjustment() {
  if (!canAdjust.value) return;

  adjustingQuality.value = true;
  try {
    const payload = {
      outlet_id: adjust.outlet_id,
      product_id: adjust.product_id,
      from_quality: adjust.from_quality,
      to_quality: adjust.to_quality,
      quantity: adjust.quantity,
      remarks: adjust.remarks,
      movement_date: new Date().toISOString().split("T")[0],
    };

    const res = await fetch(`/stocktransfers/adjust-quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Failed to adjust quality");

    const result = await res.json();

    store.commit("setMessage", {
      type: "success",
      text: `Quality adjusted successfully (Adjustment ID: ${result.adjustmentId})`,
    });

    showAdjustDialog.value = false;
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to adjust quality",
    });
  } finally {
    adjustingQuality.value = false;
  }
}

// Enhanced Save Transfer
// In saveTransfer() - Handle the new response format
async function saveTransfer() {
  if (!canSave.value) return;

  saving.value = true;
  const url = isEditing.value
    ? `/stocktransfers/${currentTransferId.value}`
    : "/stocktransfers";
  const method = isEditing.value ? "PUT" : "POST";

  try {
    const payload = {
      from_outlet_id: form.from_outlet_id,
      to_outlet_id: form.to_outlet_id,
      movement_date: form.movement_date,
      remarks: form.remarks,
      items: form.items.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        from_quality: item.from_quality,
        to_quality: item.to_quality,
        is_replacement: item.is_replacement,
        replacement_note: item.replacement_note,
      })),
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Failed to save transfer");

    const result = await res.json(); // Get the full response

    let successMessage = `Transfer ${isEditing.value ? "updated" : "created"} successfully`;

    // Add quality adjustment info if applicable
    if (result.adjustmentIds && result.adjustmentIds.length > 0) {
      successMessage += ` (${result.adjustmentIds.length} quality adjustments processed)`;
    }

    // Add undo info for updates
    if (result.undoneAdjustments && result.undoneAdjustments > 0) {
      successMessage += ` (${result.undoneAdjustments} previous adjustments reversed)`;
    }

    store.commit("setMessage", {
      type: "success",
      text: successMessage,
    });

    closeDialog();
    loadTransfers();
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to save transfer",
    });
  } finally {
    saving.value = false;
  }
}

// Enhanced Edit Dialog
async function openEditDialog(transfer) {
  isEditing.value = true;
  currentTransferId.value = transfer.id;
  loading.value = true;

  try {
    const res = await fetch(`/stocktransfers/${transfer.id}`);
    const data = await res.json();

    form.from_outlet_id = data.transfer.from_outlet_id;
    form.to_outlet_id = data.transfer.to_outlet_id;
    form.movement_date =
      data.transfer.movement_date?.split("T")[0] ||
      new Date().toISOString().split("T")[0];
    form.remarks = data.transfer.remarks;
    form.originalItems = data.items.map((item) => ({
      product_id: item.product_id,
      from_quality: item.from_quality || "GOOD",
      to_quality: item.to_quality || "GOOD",
      quantity: item.quantity,
    }));

    // Enhanced item mapping with quality fields
    form.items = data.items.map((item) => ({
      product_id: item.product_id,
      from_quality: item.from_quality || "GOOD",
      to_quality: item.to_quality || "GOOD",
      quantity: item.quantity,
      is_replacement: item.is_replacement || false,
      replacement_note: item.replacement_note || "",
      availableStock: 0,
      stockData: null,
      originalQuantity: item.quantity,
    }));

    for (const item of form.items) {
      await fetchAvailableStock(item);
    }
    validateForm();

    showDialog.value = true;
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load transfer",
    });
  } finally {
    loading.value = false;
  }
}

async function validateItemStock(item) {
  await fetchAvailableStock(item);
  validateForm();
}

async function onProductChange(item) {
  await validateItemStock(item);
}

function validateForm() {
  const errors = [];

  form.items.forEach((item, index) => {
    if (
      !item.product_id ||
      !item.from_quality ||
      !item.to_quality ||
      !item.quantity
    ) {
      errors.push(`Item ${index + 1} is incomplete`);
      return;
    }

    const combination = `${item.product_id}_${item.from_quality}_${item.to_quality}`;
    const duplicateCount = form.items.filter(
      (i) =>
        i.product_id &&
        i.from_quality &&
        i.to_quality &&
        `${i.product_id}_${i.from_quality}_${i.to_quality}` === combination,
    ).length;

    if (duplicateCount > 1) {
      errors.push(`Duplicate product with same quality found`);
    }

    if (hasStockError(item)) {
      const product = products.value.find((p) => p.id === item.product_id);
      errors.push(
        `Insufficient ${item.from_quality} stock for ${product?.name}`,
      );
    }
  });

  validationErrors.value = errors;
}

function removeItem(index) {
  form.items.splice(index, 1);
  validateForm();
}

async function onOutletChange() {
  for (const item of form.items) {
    await fetchAvailableStock(item);
  }
  validateForm();
}

// Dialog Management
function openAddDialog() {
  isEditing.value = false;
  currentTransferId.value = null;
  resetForm();
  showDialog.value = true;
}

async function openViewDialog(transfer) {
  currentTransferId.value = transfer.id;
  loading.value = true;

  try {
    const res = await fetch(`/stocktransfers/${transfer.id}`);
    const data = await res.json();

    currentTransfer.value = data.transfer;
    currentTransferItems.value = data.items || [];

    showViewDialog.value = true;
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load transfer details",
    });
  } finally {
    loading.value = false;
  }
}

function closeDialog() {
  showDialog.value = false;
  resetForm();
}

function resetForm() {
  form.from_outlet_id = "";
  form.to_outlet_id = "";
  form.movement_date = new Date().toISOString().split("T")[0];
  form.remarks = "";
  form.items = [];
  form.originalItems = [];
  validationErrors.value = [];
}

// API Operations
async function loadTransfers() {
  loading.value = true;
  const params = new URLSearchParams({ page: page.value, limit: 10 });

  if (filters.from_outlet_id) {
    params.append("from_outlet_id", filters.from_outlet_id);
  } else if (store.state.auth.outlets.length) {
    store.state.auth.outlets.forEach((outlet) =>
      params.append("from_outlet_id[]", outlet.outlet_id),
    );
  }
  if (filters.to_outlet_id) params.append("to_outlet_id", filters.to_outlet_id);
  if (filters.date) params.append("date", filters.date);

  try {
    const res = await fetch(`/stocktransfers?${params}`);
    const data = await res.json();
    transfers.value = data.data || [];
    totalPages.value = data.totalPages || 1;
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load transfers",
    });
  } finally {
    loading.value = false;
  }
}

function openDeleteDialog(transfer) {
  currentTransferId.value = transfer.id;
  showDeleteDialog.value = true;
}

// In confirmDelete() - Handle the enhanced response
async function confirmDelete() {
  deleting.value = true;

  try {
    const res = await fetch(`/stocktransfers/${currentTransferId.value}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete transfer");

    const result = await res.json();

    let successMessage = "Transfer deleted successfully";
    if (result.undoneAdjustments && result.undoneAdjustments > 0) {
      successMessage += ` (${result.undoneAdjustments} quality adjustments reversed)`;
    }

    store.commit("setMessage", {
      type: "success",
      text: successMessage,
    });

    showDeleteDialog.value = false;
    loadTransfers();
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to delete transfer",
    });
  } finally {
    deleting.value = false;
  }
}

function resetFilters() {
  filters.from_outlet_id = "";
  filters.to_outlet_id = "";
  filters.date = "";
  loadTransfers();
}

// Initialization
async function loadInitialData() {
  try {
    const outletsParams = new URLSearchParams({ limit: 1000 });
    if (store.state.auth.outlets.length) {
      store.state.auth.outlets.forEach((outlet) =>
        outletsParams.append("id[]", outlet.outlet_id),
      );
    } else {
      outletsParams.append("id[]", -1); // force no outlets
    }
    const [fromOutletsRes, toOutletsRes, productsRes] = await Promise.all([
      fetch(`/outlets?${outletsParams}`),
      fetch(`/outlets`),
      fetch("/products?limit=1000"),
    ]);

    fromOutlets.value = (await fromOutletsRes.json()).data || [];
    toOutlets.value = (await toOutletsRes.json()).data || [];
    products.value = (await productsRes.json()).data || [];
  } catch (error) {
    console.error("Error loading initial data:", error);
  }
}

onMounted(() => {
  loadTransfers();
  loadInitialData();
});
</script>
<style scoped>
.border-e {
  border-right: 1px solid #e0e0e0;
}

/* Smooth transitions for better UX */
.v-card {
  transition: all 0.3s ease;
}

.v-btn {
  transition: all 0.2s ease;
}

/* Custom scrollbar for dialogs */
.v-dialog .v-card {
  scrollbar-width: thin;
  scrollbar-color: #bdbdbd transparent;
}

.v-dialog .v-card::-webkit-scrollbar {
  width: 6px;
}

.v-dialog .v-card::-webkit-scrollbar-track {
  background: transparent;
}

.v-dialog .v-card::-webkit-scrollbar-thumb {
  background-color: #bdbdbd;
  border-radius: 3px;
}
</style>
