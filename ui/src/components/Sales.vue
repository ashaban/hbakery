<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-receipt-text</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">Sales</h1>
                <p class="text-body-1 text-grey mt-1">
                  Create and manage posted sales per outlet with part payments
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="6">
            <v-btn color="primary" size="large" @click="openAddDialog">
              <v-icon start>mdi-plus</v-icon>
              New Sale
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- FILTERS -->
    <v-card class="mb-6" elevation="1">
      <v-card-text class="pa-4">
        <v-row align="center" dense>
          <v-col cols="12" sm="3">
            <v-select
              v-model="filters.outlet_id"
              clearable
              density="comfortable"
              item-title="name"
              item-value="id"
              :items="outlets"
              label="Outlet"
              prepend-inner-icon="mdi-store"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="filters.start_date"
              clearable
              density="comfortable"
              label="Start Date"
              prepend-inner-icon="mdi-calendar"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="filters.end_date"
              clearable
              density="comfortable"
              label="End Date"
              prepend-inner-icon="mdi-calendar"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-select
              v-model="filters.payment_status"
              clearable
              density="comfortable"
              :items="[
                { title: 'All', value: '' },
                { title: 'Fully Paid', value: 'PAID' },
                { title: 'Part Paid', value: 'PART' },
              ]"
              label="Payment Status"
              prepend-inner-icon="mdi-filter"
              variant="outlined"
            />
          </v-col>
          <v-col class="d-flex justify-end" cols="12" sm="3">
            <v-btn
              class="mr-2"
              color="primary"
              variant="flat"
              @click="loadSales"
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

    <!-- LIST -->
    <v-card class="rounded-lg" elevation="2">
      <v-progress-linear
        :active="loading"
        color="primary"
        height="4"
        :indeterminate="loading"
      />
      <v-data-table
        class="elevation-0"
        :headers="headers"
        :items="sales"
        :items-per-page="10"
        :loading="loading"
        loading-text="Loading sales..."
        no-data-text="No sales found"
      >
        <template #top>
          <v-card-title class="d-flex align-center pt-4">
            <v-icon class="mr-2" color="primary"
              >mdi-format-list-bulleted</v-icon
            >
            Recent Sales
            <v-chip class="ml-3" color="primary" size="small" variant="flat">
              {{ sales.length }} total
            </v-chip>
          </v-card-title>
          <v-divider />
        </template>

        <template #item.sale_date="{ item }">
          <div class="d-flex align-center">
            <v-icon class="mr-2" color="grey" size="16">mdi-calendar</v-icon>
            <span class="font-weight-medium">{{
              formatDate(item.sale_date)
            }}</span>
          </div>
        </template>

        <template #item.outlet="{ item }">
          <div class="d-flex align-center">
            <v-avatar
              class="mr-2"
              :color="getOutletColor(item.outlet_type)"
              size="28"
            >
              <v-icon color="white" size="14">{{
                getOutletIcon(item.outlet_type)
              }}</v-icon>
            </v-avatar>
            <div class="font-weight-medium">{{ item.outlet }}</div>
          </div>
        </template>

        <template #item.customer_name="{ item }">
          <v-chip
            :color="item.customer_name ? 'primary' : 'grey'"
            size="small"
            variant="flat"
          >
            {{ item.customer_name || "Walk-in" }}
          </v-chip>
        </template>

        <template #item.total_qty="{ item }">
          <v-chip color="green" size="small" variant="flat">{{
            item.total_qty
          }}</v-chip>
        </template>

        <template #item.total_amount="{ item }">
          <div class="text-right font-weight-bold">
            {{ money(item.total_amount) }}
          </div>
        </template>

        <template #item.paid_amount="{ item }">
          <div class="text-right">{{ money(item.paid_amount) }}</div>
        </template>

        <template #item.balance="{ item }">
          <div
            :class="[
              'text-right',
              Number(item.balance) > 0 ? 'text-error' : 'text-grey',
            ]"
          >
            {{ money(item.balance) }}
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
              <span>View</span>
            </v-tooltip>

            <v-tooltip location="top">
              <template #activator="{ props }">
                <v-btn
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
              <span>Edit</span>
            </v-tooltip>

            <v-tooltip location="top">
              <template #activator="{ props }">
                <v-btn
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
              <span>Delete</span>
            </v-tooltip>
          </div>
        </template>
      </v-data-table>

      <v-card-actions class="px-4 py-3 bg-grey-lighten-3">
        <v-spacer />
        <v-pagination
          v-model="page"
          color="primary"
          :length="totalPages"
          total-visible="7"
          @update:model-value="loadSales"
        />
      </v-card-actions>
    </v-card>

    <!-- CREATE/EDIT DIALOG -->
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
            <v-icon color="white">{{
              isEditing ? "mdi-pencil" : "mdi-plus"
            }}</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ isEditing ? "Edit Sale" : "Create New Sale" }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="closeDialog"><v-icon>mdi-close</v-icon></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <!-- Header -->
          <v-card class="mb-6" variant="outlined">
            <v-card-title class="d-flex align-center bg-blue-lighten-5">
              <v-icon class="mr-2" color="primary">mdi-information</v-icon>
              Sale Information
            </v-card-title>
            <v-card-text class="pa-4">
              <v-row>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.outlet_id"
                    item-title="name"
                    item-value="id"
                    :items="outlets"
                    label="Outlet"
                    prepend-inner-icon="mdi-store"
                    required
                    variant="outlined"
                    @update:model-value="onOutletChange"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <!-- Customer: optional + free typed -->
                  <v-combobox
                    v-model="customerSelection"
                    auto-select-first="false"
                    clearable
                    hide-no-data
                    item-title="name"
                    item-value="id"
                    :items="customers"
                    label="Customer (optional, type to add)"
                    prepend-inner-icon="mdi-account"
                    return-object
                    variant="outlined"
                    @update:model-value="onCustomerChange"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="form.sale_date"
                    label="Sale Date"
                    prepend-inner-icon="mdi-calendar"
                    required
                    type="date"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="form.notes"
                    label="Notes / Description"
                    placeholder="Add any notes about this sale…"
                    rows="2"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Items -->
          <v-card class="mb-6" variant="outlined">
            <v-card-title
              class="d-flex align-center justify-space-between bg-green-lighten-5"
            >
              <div class="d-flex align-center">
                <v-icon class="mr-2" color="green">mdi-package-variant</v-icon>
                Sale Items
                <v-chip class="ml-3" color="green" size="small" variant="flat">
                  {{ form.items.length }} items
                </v-chip>
                <v-chip
                  class="ml-2"
                  color="indigo"
                  size="small"
                  variant="tonal"
                >
                  Total: {{ fmt(saleTotals.total) }}
                </v-chip>
                <v-chip class="ml-2" color="teal" size="small" variant="tonal">
                  Paid: {{ fmt(saleTotals.paid) }}
                </v-chip>
                <v-chip
                  class="ml-2"
                  :color="saleTotals.balance > 0 ? 'warning' : 'success'"
                  size="small"
                  variant="tonal"
                >
                  Balance: {{ fmt(saleTotals.balance) }}
                </v-chip>
              </div>
              <v-btn
                color="green"
                :disabled="!form.outlet_id"
                size="small"
                @click="addItem"
              >
                <v-icon start>mdi-plus</v-icon>
                Add Item
              </v-btn>
            </v-card-title>

            <v-card-text class="pa-4">
              <v-alert
                v-if="validationErrors.length"
                class="mb-4"
                color="error"
                icon="mdi-alert-circle"
                variant="tonal"
              >
                <div v-for="err in validationErrors" :key="err">
                  • {{ err }}
                </div>
              </v-alert>

              <div v-for="(it, idx) in form.items" :key="idx" class="mb-4">
                <v-card class="elevation-1">
                  <v-card-text class="pa-4">
                    <v-row align="center" dense>
                      <v-col cols="12" md="3">
                        <v-autocomplete
                          v-model="it.product_id"
                          item-title="name"
                          item-value="id"
                          :items="products"
                          label="Product"
                          prepend-inner-icon="mdi-cube-outline"
                          required
                          variant="outlined"
                          @update:model-value="() => onProductChange(it)"
                        />
                      </v-col>

                      <!-- Stock for chosen quality -->
                      <v-col cols="12" md="2">
                        <v-select
                          v-model="it.quality"
                          :color="getQualityColor(it.quality)"
                          item-title="title"
                          item-value="value"
                          :items="qualityOptions"
                          label="Quality"
                          required
                          variant="outlined"
                          @update:model-value="() => onQualityChange(it)"
                        />
                      </v-col>

                      <v-col cols="12" md="2">
                        <v-text-field
                          v-model="it.quantity"
                          density="comfortable"
                          :error="hasItemStockError(it)"
                          :hint="itemQuantityHint(it)"
                          label="Quantity"
                          persistent-hint
                          type="number"
                          variant="outlined"
                          @input="() => validateForm()"
                        />
                      </v-col>

                      <v-col cols="12" md="2">
                        <v-text-field
                          v-model="it.unit_price"
                          density="comfortable"
                          label="Unit Price"
                          type="number"
                          variant="outlined"
                          @blur="normalizePrice(it)"
                        />
                      </v-col>

                      <v-col cols="12" md="2">
                        <v-card
                          class="pa-3 text-center"
                          color="blue-lighten-5"
                          variant="flat"
                        >
                          <div
                            class="text-caption text-blue-darken-3 font-weight-bold"
                          >
                            AVAILABLE
                          </div>
                          <div
                            class="text-h6 font-weight-bold text-blue-darken-3"
                          >
                            {{ getItemAvailable(it) }}
                          </div>
                        </v-card>
                      </v-col>

                      <v-col class="text-right" cols="12" md="1">
                        <v-btn
                          color="error"
                          icon
                          size="small"
                          variant="text"
                          @click="removeItem(idx)"
                        >
                          <v-icon>mdi-delete-outline</v-icon>
                        </v-btn>
                      </v-col>
                    </v-row>

                    <v-row class="mt-1">
                      <v-col class="text-right text-grey" cols="12">
                        Line total:
                        <strong>{{ money(lineTotal(it)) }}</strong>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </div>

              <div v-if="form.items.length === 0" class="text-center py-8">
                <v-icon class="mb-4" color="grey" size="64"
                  >mdi-package-variant-plus</v-icon
                >
                <div class="text-h6 text-grey mb-2">No Items Added</div>
                <div class="text-body-1 text-grey mb-4">
                  Click "Add Item" to start adding products to this sale
                </div>
                <v-btn
                  color="primary"
                  :disabled="!form.outlet_id"
                  @click="addItem"
                >
                  <v-icon start>mdi-plus</v-icon>
                  Add Your First Item
                </v-btn>
              </div>

              <v-divider class="my-4" />
              <v-alert
                v-if="saleTotals.balance > 0"
                class="mt-2"
                color="warning"
                icon="mdi-alert"
                variant="tonal"
              >
                Balance due: <strong>{{ fmt(saleTotals.balance) }}</strong>
              </v-alert>
              <v-alert
                v-else-if="saleTotals.total > 0"
                class="mt-2"
                color="success"
                icon="mdi-check"
                variant="tonal"
              >
                Fully paid 🎉
              </v-alert>
              <div class="text-right">
                <div class="text-h6">
                  Total: <strong>{{ money(total) }}</strong>
                </div>
              </div>
            </v-card-text>
          </v-card>

          <!-- Payments -->
          <v-card variant="outlined">
            <v-card-title
              class="d-flex align-center justify-space-between bg-purple-lighten-5"
            >
              <div class="d-flex align-center">
                <v-icon class="mr-2" color="purple">mdi-cash</v-icon>
                Payments
                <v-chip class="ml-3" color="purple" size="small" variant="flat">
                  {{ form.payments.length }} row(s)
                </v-chip>
              </div>
              <v-btn color="purple" size="small" @click="addPayment">
                <v-icon start>mdi-plus</v-icon>
                Add Payment
              </v-btn>
            </v-card-title>

            <v-card-text class="pa-4">
              <v-alert
                v-if="paymentErrors.length"
                class="mb-4"
                color="error"
                icon="mdi-alert-circle"
                variant="tonal"
              >
                <div v-for="err in paymentErrors" :key="err">• {{ err }}</div>
              </v-alert>

              <div v-for="(p, pidx) in form.payments" :key="pidx" class="mb-3">
                <v-row dense>
                  <v-col cols="12" md="3">
                    <v-text-field
                      v-model="p.amount"
                      density="comfortable"
                      :error="!p.amount"
                      :hint="'Required'"
                      label="Amount"
                      persistent-hint
                      type="number"
                      variant="outlined"
                      @input="
                        () => {
                          validatePayments();
                          onUserEditedPayment(pidx);
                        }
                      "
                    />
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-select
                      v-model="p.method"
                      density="comfortable"
                      :items="paymentMethods"
                      label="Method"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-text-field
                      v-model="p.reference"
                      density="comfortable"
                      label="Reference"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col cols="12" md="2">
                    <v-text-field
                      v-model="p.payment_date"
                      density="comfortable"
                      label="Payment Date"
                      type="date"
                      variant="outlined"
                    />
                  </v-col>
                  <v-col class="text-right" cols="12" md="1">
                    <v-btn
                      color="error"
                      icon
                      size="small"
                      variant="text"
                      @click="removePayment(pidx)"
                    >
                      <v-icon>mdi-delete-outline</v-icon>
                    </v-btn>
                  </v-col>
                </v-row>
              </div>

              <v-divider class="my-4" />
              <div class="d-flex justify-end">
                <div class="text-right mr-6">
                  <div>
                    Paid: <strong>{{ money(totalPaid) }}</strong>
                  </div>
                  <div class="text-error">
                    Balance:
                    <strong>{{ money(Math.max(total - totalPaid, 0)) }}</strong>
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn size="large" variant="outlined" @click="closeDialog"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            :disabled="!canSave"
            :loading="saving"
            size="large"
            variant="flat"
            @click="saveSale"
          >
            <v-icon start>{{
              isEditing ? "mdi-content-save" : "mdi-check"
            }}</v-icon>
            {{ isEditing ? "Update Sale" : "Create Sale" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- VIEW DIALOG -->
    <v-dialog
      v-model="showViewDialog"
      max-width="900"
      scrollable
      transition="dialog-bottom-transition"
    >
      <v-card class="rounded-lg">
        <v-toolbar color="info" density="comfortable">
          <v-avatar class="mr-3" color="info" size="40">
            <v-icon color="white">mdi-eye</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold"
            >Sale Details</v-toolbar-title
          >
          <v-spacer />
          <v-btn icon @click="showViewDialog = false"
            ><v-icon>mdi-close</v-icon></v-btn
          >
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-card class="mb-6 elevation-2">
            <v-card-text class="pa-4">
              <v-row>
                <v-col class="border-e" cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-avatar class="mr-3" color="primary" size="48">
                      <v-icon color="white">mdi-identifier</v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-caption text-grey">SALE ID</div>
                      <div class="text-h5 font-weight-bold">
                        #{{ currentSale?.id }}
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-center">
                    <v-icon class="mr-3" color="grey">mdi-calendar</v-icon>
                    <div>
                      <div class="text-caption text-grey">DATE</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ formatDate(currentSale?.sale_date) }}
                      </div>
                    </div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-avatar
                      class="mr-3"
                      :color="getOutletColor(currentSale?.outlet_type)"
                      size="48"
                    >
                      <v-icon color="white">{{
                        getOutletIcon(currentSale?.outlet_type)
                      }}</v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-caption text-grey">OUTLET</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ currentSale?.outlet_name }}
                      </div>
                      <v-chip
                        class="mt-1"
                        :color="getOutletColor(currentSale?.outlet_type)"
                        size="small"
                      >
                        {{ currentSale?.outlet_type }}
                      </v-chip>
                    </div>
                  </div>
                  <div class="d-flex align-center">
                    <v-icon class="mr-3" color="grey">mdi-account</v-icon>
                    <div>
                      <div class="text-caption text-grey">CUSTOMER</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ currentSale?.customer_name || "Walk-in" }}
                      </div>
                    </div>
                  </div>
                </v-col>
                <v-col v-if="currentSale?.notes" cols="12">
                  <v-divider class="my-3" />
                  <div class="text-caption text-grey mb-1">NOTES</div>
                  <v-card variant="outlined">
                    <v-card-text class="pa-3">{{
                      currentSale?.notes
                    }}</v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <v-card class="mb-6 elevation-2">
            <v-card-title class="d-flex align-center bg-teal-lighten-5">
              <v-icon class="mr-2" color="teal">mdi-package-variant</v-icon>
              Items
            </v-card-title>
            <v-card-text class="pa-0">
              <v-table density="comfortable">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <th class="text-left font-weight-bold text-grey">
                      PRODUCT
                    </th>
                    <th class="text-center font-weight-bold text-grey">
                      QUALITY
                    </th>
                    <th class="text-center font-weight-bold text-grey">QTY</th>
                    <th class="text-right font-weight-bold text-grey">
                      UNIT PRICE
                    </th>
                    <th class="text-right font-weight-bold text-grey">
                      TOTAL PRICE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="li in currentItems" :key="li.id">
                    <td class="text-left">{{ li.product_name }}</td>
                    <td class="text-center">
                      <v-chip
                        :color="getQualityColor(li.quality)"
                        size="small"
                        variant="flat"
                      >
                        {{ li.quality }}
                      </v-chip>
                    </td>
                    <td class="text-center">{{ parseFloat(li.quantity) }}</td>
                    <td class="text-right">{{ money(li.unit_price) }}</td>
                    <td class="text-right">
                      {{ money(li.quantity * li.unit_price) }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <div class="text-right pa-4">
                <div class="mb-1">
                  Paid:
                  <strong>{{ money(currentSale?.total_paid || 0) }}</strong>
                </div>
                <div class="text-h6">
                  Total:
                  <strong>{{ money(currentSale?.total_amount || 0) }}</strong>
                </div>
                <div class="text-error mt-1">
                  Balance:
                  <strong>{{
                    money(
                      (currentSale?.total_amount || 0) -
                        (currentSale?.total_paid || 0),
                    )
                  }}</strong>
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

    <!-- DELETE DIALOG -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card class="rounded-lg">
        <v-toolbar color="error" density="comfortable">
          <v-avatar class="mr-3" color="error" size="40">
            <v-icon color="white">mdi-alert</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold"
            >Confirm Deletion</v-toolbar-title
          >
        </v-toolbar>
        <v-card-text class="pa-6 text-center">
          <v-icon class="mb-4" color="error" size="64">mdi-delete-alert</v-icon>
          <div class="text-h5 font-weight-bold mb-2">Delete Sale?</div>
          <div class="text-body-1 text-grey mb-4">
            Are you sure you want to delete sale
            <span class="font-weight-bold text-error">#{{ currentSaleId }}</span
            >? This cannot be undone.
          </div>
        </v-card-text>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            size="large"
            variant="outlined"
            @click="showDeleteDialog = false"
            >Cancel</v-btn
          >
          <v-btn
            color="error"
            :loading="deleting"
            size="large"
            variant="flat"
            @click="confirmDelete"
          >
            <v-icon start>mdi-delete</v-icon>
            Delete Sale
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useStore } from "vuex";

const store = useStore();

// State
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const sales = ref([]);
const outlets = ref([]);
const customers = ref([]);
const products = ref([]);
const page = ref(1);
const totalPages = ref(1);

// UI state
const showDialog = ref(false);
const showViewDialog = ref(false);
const showDeleteDialog = ref(false);
const isEditing = ref(false);
const currentSaleId = ref(null);
const currentSale = ref(null);
const currentItems = ref([]);

// Filters
const filters = reactive({
  outlet_id: "",
  start_date: "",
  end_date: "",
  payment_status: "",
});

// Customer selector state
const customerSelection = ref(null); // holds id when selected, or null
const customerSearch = ref(""); // free-typed text, used for auto-create on save

// Form
const today = new Date().toISOString().split("T")[0];
const form = reactive({
  outlet_id: "",
  sale_date: today,
  notes: "",
  items: [],
  payments: [], // default row added below in resetForm()
});

// Validation
const validationErrors = ref([]);
const paymentErrors = ref([]);

// Constants
const headers = [
  { title: "ID", key: "id" },
  { title: "Date", key: "sale_date" },
  { title: "Outlet", key: "outlet" },
  { title: "Customer", key: "customer_name" },
  { title: "Items", key: "items_count", align: "center" },
  { title: "Qty", key: "total_qty", align: "center" },
  { title: "Total", key: "total_amount", align: "end" },
  { title: "Paid", key: "paid_amount", align: "end" },
  { title: "Balance", key: "balance", align: "end" },
  { title: "Actions", key: "actions", sortable: false },
];

const qualityOptions = [
  { title: "Good", value: "GOOD" },
  { title: "Damaged", value: "DAMAGED" },
  { title: "Reject", value: "REJECT" },
];

const paymentMethods = ["CASH", "MOBILE", "CARD", "BANK"];
const paymentAutoLinked = ref(true);

// Computed totals
const subtotal = computed(() =>
  form.items.reduce(
    (s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0),
    0,
  ),
);
const total = computed(() => subtotal.value);
const totalPaid = computed(() =>
  form.payments.reduce((s, p) => s + Number(p.amount || 0), 0),
);

// Save button rule
const canSave = computed(() => {
  return (
    form.outlet_id &&
    form.sale_date &&
    form.items.length > 0 &&
    validationErrors.value.length === 0 &&
    paymentErrors.value.length === 0
  );
});

const saleTotals = computed(() => {
  const total = form.items.reduce((s, it) => s + lineTotal(it), 0);
  const paid = form.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(total - paid, 0);
  return { total, paid, balance };
});
watch(
  () => saleTotals.value.total,
  (newTotal) => {
    if (form.payments.length > 0 && paymentAutoLinked.value) {
      form.payments[0].amount = newTotal;
    }
  },
);

// Helpers
function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmt(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat().format(n);
}
function formatDate(date) {
  return new Date(date).toLocaleDateString();
}
function getOutletIcon(type) {
  const icons = { MAIN: "mdi-home", SHOP: "mdi-store", CAR: "mdi-truck" };
  return icons[type] || "mdi-store";
}
function getOutletColor(type) {
  const colors = { MAIN: "primary", SHOP: "success", CAR: "warning" };
  return colors[type] || "grey";
}
function getQualityColor(q) {
  const colors = { GOOD: "success", DAMAGED: "warning", REJECT: "error" };
  return colors[q] || "grey";
}

// Items logic
function addItem() {
  form.items.push({
    product_id: "",
    quality: "GOOD",
    quantity: "", // empty by default (your rule)
    unit_price: "", // defaulted when product chosen
    stockData: null,
  });
  validateForm();
}
function removeItem(i) {
  form.items.splice(i, 1);
  validateForm();
}
function onUserEditedPayment(index) {
  if (index === 0) paymentAutoLinked.value = false;
}
function lineTotal(it) {
  return Number(it.quantity || 0) * Number(it.unit_price || 0);
}
function getItemAvailable(it) {
  if (!it.stockData) return 0;
  return it.stockData[it.quality] || 0;
}
async function onProductChange(it) {
  // default unit price from product master; allow edit
  const prod = products.value.find((p) => p.id === it.product_id);
  if (prod && (it.unit_price === "" || it.unit_price == null)) {
    it.unit_price = Number(prod.price || 0);
  }
  await fetchItemAvailability(it);
  validateForm();
}
async function onQualityChange(it) {
  await fetchItemAvailability(it);
  validateForm();
}
async function fetchItemAvailability(it) {
  if (!form.outlet_id || !it.product_id) {
    it.stockData = null;
    return;
  }
  try {
    const res = await fetch(
      `/stocktransfers/availableByQuality?outlet_id=${form.outlet_id}&product_id=${it.product_id}`,
    );
    const data = await res.json();
    it.stockData = data.stock || { GOOD: 0, DAMAGED: 0, REJECT: 0 };
  } catch (err) {
    console.error("Stock check failed:", err);
    it.stockData = null;
  }
}
function hasItemStockError(it) {
  if (!it.product_id || !it.quality || !it.quantity) return false;
  return Number(it.quantity) > Number(getItemAvailable(it) || 0);
}
function itemQuantityHint(it) {
  if (!it.product_id) return "Pick a product";
  const a = getItemAvailable(it);
  return `Available: ${a}`;
}
function normalizePrice(it) {
  if (it.unit_price === "" || it.unit_price == null) return;
  it.unit_price = Number(it.unit_price);
  if (isNaN(it.unit_price) || it.unit_price < 0) it.unit_price = 0;
}

function onCustomerChange(val) {
  if (typeof val === "string") {
    customerSelection.value = val.trim() || null;
    return;
  }
  if (val && typeof val === "object") {
    // Normalize to the shape we expect
    customerSelection.value = { id: val.id ?? null, name: val.name ?? "" };
    return;
  }
  customerSelection.value = null;
}
// Payments logic
function addPayment() {
  form.payments.push({
    amount: "", // must be filled if row exists
    method: "CASH",
    reference: "",
    payment_date: today,
  });
  if (form.payments.length === 1) {
    paymentAutoLinked.value = true;
    if (saleTotals.value.total > 0)
      form.payments[0].amount = saleTotals.value.total;
  }
  validateForm();
}
function removePayment(i) {
  form.payments.splice(i, 1);
  if (i === 0) paymentAutoLinked.value = true;
  validateForm();
}

// Validation rules
function validateForm() {
  const errs = [];

  if (!form.outlet_id) errs.push("Outlet is required.");
  if (!form.sale_date) errs.push("Sale date is required.");
  const comboSet = new Set();
  form.items.forEach((it, idx) => {
    const line = idx + 1;
    if (!it.product_id) errs.push(`Item ${line}: product is required.`);
    if (!it.quality) errs.push(`Item ${line}: quality is required.`);
    if (it.quantity === "" || Number(it.quantity) <= 0) {
      errs.push(`Item ${line}: quantity is required and must be > 0.`);
    }
    if (it.unit_price === "" || Number(it.unit_price) < 0) {
      errs.push(`Item ${line}: unit price is required and cannot be negative.`);
    }
    if (hasItemStockError(it)) {
      errs.push(`Item ${line}: insufficient ${it.quality} stock.`);
    }
    if (it.product_id && it.quality) {
      const key = `${it.product_id}|${it.quality}`;
      if (comboSet.has(key)) {
        errs.push(`Duplicate product and quality detected on item ${idx + 1}.`);
      }
      comboSet.add(key);
    }
  });

  validationErrors.value = errs;
  validatePayments();
}
function validatePayments() {
  const errs = [];
  // Rule: default payment row exists; if any row exists, amount is mandatory for that row
  let paid = 0;
  form.payments.forEach((p, idx) => {
    if (p.amount === "" || Number(p.amount) <= 0) {
      errs.push(
        `Payment ${idx + 1}: amount is required and must be > 0, or delete the row.`,
      );
    } else {
      paid += Number(p.amount);
    }
  });
  if (paid > saleTotals.value.total) {
    errs.push(`Total payment amount cannot exceed sale total.`);
  }
  paymentErrors.value = errs;
}

// API
async function loadSales() {
  loading.value = true;
  const params = new URLSearchParams({ page: page.value, limit: 10 });
  if (filters.outlet_id) params.append("outlet_id", filters.outlet_id);
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);
  if (filters.payment_status)
    params.append("payment_status", filters.payment_status);

  try {
    const res = await fetch(`/sales?${params}`);
    const data = await res.json();
    sales.value = data.data || [];
    totalPages.value = data.totalPages || 1;
  } catch (e) {
    store.commit("setMessage", { type: "error", text: "Failed to load sales" });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.outlet_id = "";
  filters.start_date = "";
  filters.end_date = "";
  filters.payment_status = "";
  loadSales();
}

function openAddDialog() {
  isEditing.value = false;
  currentSaleId.value = null;
  resetForm();
  showDialog.value = true;
}

async function openEditDialog(row) {
  isEditing.value = true;
  currentSaleId.value = row.id;
  loading.value = true;
  try {
    const res = await fetch(`/sales/${row.id}`);
    const data = await res.json();

    // Header
    form.outlet_id = data.sale.outlet_id;
    form.sale_date = data.sale.sale_date?.split("T")[0] || today;
    form.notes = data.sale.notes || "";

    // Customer
    customerSelection.value = data.sale.customer_id || null;
    customerSearch.value = data.sale.customer_name || "";

    // Items
    form.items = (data.items || []).map((li) => ({
      product_id: li.product_id,
      quality: li.quality,
      quantity: String(li.quantity), // keep as string for "empty" detection
      unit_price: Number(li.unit_price),
      stockData: null,
    }));

    // Payments (existing)
    form.payments = (data.payments || []).map((p) => ({
      amount: String(p.amount),
      method: p.method || "CASH",
      reference: p.reference || "",
      payment_date: p.payment_date?.split("T")[0] || today,
    }));
    paymentAutoLinked.value = false;

    // Stock preload
    for (const it of form.items) await fetchItemAvailability(it);

    validateForm();

    showDialog.value = true;
  } catch (e) {
    store.commit("setMessage", { type: "error", text: "Failed to load sale" });
  } finally {
    loading.value = false;
  }
}

async function openViewDialog(row) {
  currentSaleId.value = row.id;
  loading.value = true;
  try {
    const res = await fetch(`/sales/${row.id}`);
    const data = await res.json();

    currentSale.value = {
      ...data.sale,
      outlet: data.sale.outlet_name,
      outlet_type: data.sale.outlet_type,
    };
    currentItems.value = data.items || [];

    showViewDialog.value = true;
  } catch (e) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load sale details",
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
  form.outlet_id = "";
  form.sale_date = today;
  form.notes = "";
  form.items = [];
  form.payments = [];
  // Default payment row must exist with empty amount (your rule)
  addPayment();

  customerSelection.value = null;
  customerSearch.value = "";

  validationErrors.value = [];
  paymentErrors.value = [];
  paymentAutoLinked.value = true;
}

function openDeleteDialog(row) {
  currentSaleId.value = row.id;
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  deleting.value = true;
  try {
    const res = await fetch(`/sales/${currentSaleId.value}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete");
    store.commit("setMessage", {
      type: "success",
      text: "Sale deleted successfully",
    });
    showDeleteDialog.value = false;
    loadSales();
  } catch (e) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to delete sale",
    });
  } finally {
    deleting.value = false;
  }
}

async function onOutletChange() {
  for (const it of form.items) await fetchItemAvailability(it);
  validateForm();
}

// SAVE
async function saveSale() {
  validateForm();
  if (!canSave.value) return;

  saving.value = true;

  const payload = {
    outlet_id: form.outlet_id,
    sale_date: form.sale_date,
    notes: form.notes || null,
    items: form.items.map((it) => ({
      product_id: it.product_id,
      quality: it.quality,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
    })),
    payments: form.payments.map((p) => ({
      amount: Number(p.amount),
      method: p.method || null,
      reference: p.reference || null,
      payment_date: p.payment_date || form.sale_date,
    })),
  };
  if (typeof customerSelection.value === "string") {
    payload.customer_id = null;
    payload.customer_name = customerSelection.value;
  } else if (customerSelection.value?.id) {
    payload.customer_id = customerSelection.value.id;
    payload.customer_name = customerSelection.value.name;
  } else {
    payload.customer_id = null;
    payload.customer_name = null;
  }

  const url = isEditing.value ? `/sales/${currentSaleId.value}` : "/sales";
  const method = isEditing.value ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to save sale");
    const result = await res.json();

    store.commit("setMessage", {
      type: "success",
      text: isEditing.value
        ? "Sale updated successfully"
        : "Sale created successfully",
    });

    closeDialog();
    loadSales();
  } catch (e) {
    store.commit("setMessage", { type: "error", text: "Failed to save sale" });
  } finally {
    saving.value = false;
  }
}

// Init
async function loadInitialData() {
  try {
    const [outRes, prodRes, custRes] = await Promise.all([
      fetch("/outlets?limit=1000"),
      fetch("/products?limit=1000"),
      fetch("/customers?limit=1000"),
    ]);

    outlets.value = (await outRes.json()).data || [];
    products.value = (await prodRes.json()).data || [];
    customers.value = (await custRes.json()).data || [];
  } catch (e) {
    console.error("Init data load failed:", e);
  }
}

onMounted(() => {
  loadSales();
  loadInitialData();
});
</script>

<style scoped>
.border-e {
  border-right: 1px solid #e0e0e0;
}
.v-card {
  transition: all 0.3s ease;
}
.v-btn {
  transition: all 0.2s ease;
}
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
.text-right {
  text-align: right;
}
</style>
