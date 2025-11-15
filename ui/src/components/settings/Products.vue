<template>
  <v-container fluid>
    <!-- 🔍 FILTERS -->
    <v-card class="pa-4 mb-4">
      <v-row dense>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model="filters.search"
            append-inner-icon="mdi-close-circle"
            autocomplete="off"
            autocorrect="off"
            clearable
            inputmode="none"
            label="Search Product Name"
            spellcheck="false"
            @click:append-inner="filters.search = ''"
          />
        </v-col>
        <v-col class="d-flex justify-end" cols="12">
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
    <v-alert border="start" class="mb-4" type="info" variant="outlined">
      <strong>Total Products:</strong> {{ totals.total_products || "0" }}
    </v-alert>

    <!-- 📋 HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h3>Products</h3>
      <v-btn
        v-if="$store.getters.hasTask('can_add_settings')"
        class="text-white"
        color="primary"
        size="small"
        @click="activateAddDialog"
      >
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
      height="400"
      :items="values"
      :loading="loading"
    >
      <template
        v-if="$store.getters.hasTask('can_add_settings')"
        #item.actions="{ item }"
      >
        <v-icon class="mr-2" color="primary" @click="activateEditDialog(item)">
          mdi-square-edit-outline
        </v-icon>
        <v-icon color="green" @click="viewIngredients(item)"> mdi-eye </v-icon>
      </template>
    </v-data-table>

    <!-- PAGINATION -->
    <div class="d-flex justify-end align-center mt-4">
      <v-pagination
        v-model="page"
        :length="totalPages"
        total-visible="7"
        @update:model-value="loadValues"
      />
    </div>

    <!-- ADD / EDIT PRODUCT DIALOG -->
    <v-dialog
      v-model="dialog"
      max-width="1200"
      scrollable
      transition="dialog-top-transition"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg flex-wrap px-4" color="primary" flat>
          <div class="d-flex align-center flex-wrap">
            <v-icon class="mr-2 text-white">mdi-package-variant</v-icon>
            <span class="text-white font-weight-bold text-h6">
              {{ isEditing ? "Edit Product" : "Add Product" }}
            </span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="dialog = false" />
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <!-- Basic Product Information -->
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="state.name"
                  autocomplete="off"
                  autocorrect="off"
                  bg-color="#E0E0E0"
                  :error-messages="v$.name.$errors.map((e) => e.$message)"
                  inputmode="none"
                  label="Product Name"
                  required
                  spellcheck="false"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="state.unit"
                  autocomplete="off"
                  autocorrect="off"
                  bg-color="#E0E0E0"
                  :error-messages="v$.unit.$errors.map((e) => e.$message)"
                  inputmode="none"
                  label="Unit (e.g. Loaf, Pack)"
                  required
                  spellcheck="false"
                />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="state.description"
                  autocomplete="off"
                  autocorrect="off"
                  bg-color="#E0E0E0"
                  inputmode="none"
                  label="Description"
                  spellcheck="false"
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="state.price"
                  autocomplete="off"
                  autocorrect="off"
                  bg-color="#E0E0E0"
                  :error-messages="v$.price.$errors.map((e) => e.$message)"
                  inputmode="none"
                  label="Price"
                  prefix="TSh "
                  required
                  spellcheck="false"
                  type="number"
                />
              </v-col>
            </v-row>

            <!-- 🧩 Mandatory Ingredients Section -->
            <v-divider class="my-4" />
            <h4>Mandatory Ingredients (Fixed Requirements)</h4>

            <v-alert
              v-if="v$.items.$error"
              border="start"
              class="mb-2"
              type="error"
              variant="outlined"
            >
              Each ingredient must have Item and Quantity.
            </v-alert>

            <v-row
              v-for="(it, index) in state.items"
              :key="'mandatory-' + index"
              align="center"
              class="mb-2"
              dense
            >
              <v-col cols="12" sm="6">
                <v-autocomplete
                  v-model="it.item_id"
                  autocomplete="off"
                  autocorrect="off"
                  clearable
                  dense
                  :error="v$.items.$dirty && !it.item_id"
                  :error-messages="
                    v$.items.$dirty && !it.item_id ? ['Item required'] : []
                  "
                  inputmode="none"
                  item-title="name"
                  item-value="id"
                  :items="availableMandatoryItems(index)"
                  label="Item"
                  spellcheck="false"
                  @update:model-value="onMandatoryItemChange(it)"
                />
              </v-col>

              <v-col cols="12" sm="5">
                <v-text-field
                  v-model="it.quantity_per_unit"
                  autocomplete="off"
                  autocorrect="off"
                  dense
                  :error="
                    v$.items.$dirty &&
                    (!it.quantity_per_unit || it.quantity_per_unit <= 0)
                  "
                  :error-messages="
                    v$.items.$dirty &&
                    (!it.quantity_per_unit || it.quantity_per_unit <= 0)
                      ? ['Quantity > 0 required']
                      : []
                  "
                  inputmode="none"
                  :label="`Quantity in ${it.unit || ''}`"
                  spellcheck="false"
                  type="number"
                />
              </v-col>

              <v-col class="d-flex justify-end" cols="12" sm="1">
                <v-btn
                  color="error"
                  icon
                  size="small"
                  @click="removeMandatoryItem(index)"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </v-row>

            <div class="d-flex justify-end mt-2">
              <v-btn color="primary" size="small" @click="addMandatoryItem">
                <v-icon start>mdi-plus</v-icon> Add Mandatory Ingredient
              </v-btn>
            </div>

            <!-- 🧩 Ingredient Groups Section -->
            <v-divider class="my-4" />
            <div class="d-flex justify-space-between align-center mb-4">
              <h4>Ingredient Groups (Flexible Combinations)</h4>
              <v-btn color="primary" size="small" @click="addGroup">
                <v-icon start>mdi-plus</v-icon> Add Group
              </v-btn>
            </div>

            <v-alert
              v-if="groupValidationError"
              border="start"
              class="mb-2"
              type="error"
              variant="outlined"
            >
              {{ groupValidationError }}
            </v-alert>

            <!-- Ingredient Groups -->
            <v-card
              v-for="(group, groupIndex) in state.groups"
              :key="'group-' + groupIndex"
              class="mb-4"
              variant="outlined"
            >
              <v-card-title class="d-flex align-center bg-grey-lighten-3">
                <v-text-field
                  v-model="group.name"
                  autocomplete="off"
                  autocorrect="off"
                  class="mr-2"
                  density="compact"
                  hide-details
                  inputmode="none"
                  label="Group Name"
                  spellcheck="false"
                  @update:model-value="generateCombinations(groupIndex)"
                />
                <v-spacer />
                <v-btn
                  color="error"
                  icon
                  size="small"
                  @click="removeGroup(groupIndex)"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-card-title>

              <v-card-text>
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="group.description"
                      autocomplete="off"
                      autocorrect="off"
                      density="compact"
                      inputmode="none"
                      label="Description"
                      spellcheck="false"
                    />
                  </v-col>
                  <v-col cols="12" sm="3">
                    <v-checkbox
                      v-model="group.is_mandatory"
                      density="compact"
                      hide-details
                      label="Mandatory"
                    />
                  </v-col>
                  <v-col cols="12" sm="3">
                    <v-select
                      v-model="group.selection_mode"
                      density="compact"
                      hide-details
                      item-title="text"
                      item-value="value"
                      :items="selectionModes"
                      label="Selection Mode"
                      @update:model-value="generateCombinations(groupIndex)"
                    />
                    <div class="text-caption text-grey mt-1">
                      {{ getSelectionModeDescription(group.selection_mode) }}
                    </div>
                  </v-col>
                </v-row>

                <!-- Group Options -->
                <v-divider class="my-3" />
                <h5 class="mb-2">Available Options</h5>

                <v-alert
                  v-if="group.options.length >= 5"
                  class="mb-2"
                  density="compact"
                  type="warning"
                >
                  {{ group.options.length }} options will generate
                  {{ getCombinationCount(group) }} combinations
                </v-alert>

                <v-row
                  v-for="(option, optionIndex) in group.options"
                  :key="'option-' + groupIndex + '-' + optionIndex"
                  align="center"
                  class="mb-2"
                  dense
                >
                  <v-col cols="12" sm="6">
                    <v-autocomplete
                      v-model="option.item_id"
                      autocomplete="off"
                      autocorrect="off"
                      clearable
                      density="compact"
                      inputmode="none"
                      item-title="name"
                      item-value="id"
                      :items="availableGroupItems(groupIndex, optionIndex)"
                      label="Item"
                      spellcheck="false"
                      @update:model-value="
                        onGroupItemChange(groupIndex, optionIndex)
                      "
                    />
                  </v-col>
                  <v-col cols="12" sm="5">
                    <v-text-field
                      v-model="option.position"
                      autocomplete="off"
                      autocorrect="off"
                      density="compact"
                      inputmode="none"
                      label="Position"
                      :max="group.options.length"
                      min="1"
                      spellcheck="false"
                      type="number"
                    />
                  </v-col>
                  <v-col class="d-flex justify-end" cols="12" sm="1">
                    <v-btn
                      color="error"
                      icon
                      size="small"
                      @click="removeGroupOption(groupIndex, optionIndex)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </v-col>
                </v-row>

                <div class="d-flex justify-end mt-2">
                  <v-btn
                    color="primary"
                    size="small"
                    @click="addGroupOption(groupIndex)"
                  >
                    <v-icon start>mdi-plus</v-icon> Add Option
                  </v-btn>
                </div>

                <!-- Auto-generated Combinations -->
                <v-divider class="my-3" />
                <div class="d-flex justify-space-between align-center mb-2">
                  <h5>Combinations (Auto-generated)</h5>
                  <v-btn
                    color="primary"
                    :disabled="group.options.length < 1"
                    size="small"
                    @click="generateCombinations(groupIndex)"
                  >
                    <v-icon start>mdi-autorenew</v-icon> Regenerate
                  </v-btn>
                </div>

                <v-alert
                  v-if="group.options.length === 0"
                  class="mb-2"
                  density="compact"
                  type="info"
                >
                  Add options above to generate combinations automatically
                </v-alert>

                <div
                  v-else-if="group.combinations.length === 0"
                  class="text-center py-4"
                >
                  <v-icon class="mb-2" color="grey" size="48"
                    >mdi-cog-refresh</v-icon
                  >
                  <div class="text-grey">
                    Click "Regenerate" to create combinations
                  </div>
                </div>

                <div v-else>
                  <v-alert class="mb-2" density="compact" type="info">
                    {{ group.combinations.length }} combination(s) generated.
                    Set quantities for included items.
                  </v-alert>

                  <v-card
                    v-for="(combination, combIndex) in group.combinations"
                    :key="'comb-' + groupIndex + '-' + combIndex"
                    class="mb-3"
                    variant="outlined"
                  >
                    <v-card-title class="d-flex align-center bg-grey-lighten-2">
                      <div class="flex-grow-1">
                        <span class="font-weight-medium">{{
                          combination.name
                        }}</span>
                        <v-chip
                          v-if="combination.is_default"
                          class="ml-2"
                          color="green"
                          size="small"
                        >
                          Default
                        </v-chip>
                      </div>
                      <v-checkbox
                        v-model="combination.is_default"
                        class="mr-2"
                        density="compact"
                        hide-details
                        label="Default"
                      />
                      <v-btn
                        color="error"
                        icon
                        size="small"
                        @click="removeCombination(groupIndex, combIndex)"
                      >
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </v-card-title>

                    <v-card-text>
                      <!-- Combination Quantities - Only show included items -->
                      <div
                        v-if="
                          getIncludedOptions(group, combination).length === 0
                        "
                        class="text-center py-2 text-grey"
                      >
                        No items included in this combination
                      </div>

                      <v-row
                        v-for="option in getIncludedOptions(group, combination)"
                        :key="
                          'qty-' +
                          groupIndex +
                          '-' +
                          combIndex +
                          '-' +
                          option.item_id
                        "
                        align="center"
                        class="mb-2"
                        dense
                      >
                        <v-col cols="12" sm="4">
                          <v-text-field
                            autocomplete="off"
                            autocorrect="off"
                            density="compact"
                            inputmode="none"
                            label="Item"
                            :model-value="getItemName(option.item_id)"
                            readonly
                            spellcheck="false"
                            variant="outlined"
                          />
                        </v-col>
                        <v-col cols="12" sm="4">
                          <v-text-field
                            autocomplete="off"
                            autocorrect="off"
                            density="compact"
                            inputmode="none"
                            :label="`Quantity (${option.unit || ''})`"
                            min="0"
                            :model-value="
                              getCombinationQuantity(
                                groupIndex,
                                combIndex,
                                option.item_id,
                              )
                            "
                            spellcheck="false"
                            step="0.001"
                            type="number"
                            @update:model-value="
                              setCombinationQuantity(
                                groupIndex,
                                combIndex,
                                option.item_id,
                                $event,
                              )
                            "
                          />
                        </v-col>
                        <v-col cols="12" sm="4">
                          <v-chip color="primary" size="small" variant="flat">
                            Required
                          </v-chip>
                        </v-col>
                      </v-row>

                      <!-- Show excluded items count -->
                      <div
                        v-if="getExcludedOptionsCount(group, combination) > 0"
                        class="text-caption text-grey mt-2"
                      >
                        {{ getExcludedOptionsCount(group, combination) }}
                        item(s) excluded from this combination
                      </div>

                      <v-text-field
                        v-model="combination.notes"
                        autocomplete="off"
                        autocorrect="off"
                        class="mt-2"
                        density="compact"
                        inputmode="none"
                        label="Notes (Optional)"
                        spellcheck="false"
                      />
                    </v-card-text>
                  </v-card>
                </div>
              </v-card-text>
            </v-card>

            <!-- Summary -->
            <div
              class="mt-4 text-caption font-weight-medium d-flex align-center"
              :class="summaryColor"
            >
              <v-icon class="mr-1" :color="summaryColor" size="small">
                mdi-information
              </v-icon>
              {{ summaryText }}
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end mt-2">
          <v-btn
            color="success"
            :disabled="v$.$invalid || hasGroupErrors"
            :loading="loading"
            @click="saveProduct"
          >
            <v-icon start>mdi-content-save</v-icon>
            {{ isEditing ? "Save Changes" : "Add Product" }}
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

    <!-- VIEW INGREDIENTS DIALOG -->
    <v-dialog v-model="viewDialog" max-width="800">
      <v-card border elevation="0" rounded="xl">
        <div class="bg-primary pa-6 rounded-t-xl">
          <div class="d-flex align-center">
            <v-avatar class="mr-4" color="white" size="48">
              <v-icon
                color="primary"
                icon="mdi-silverware-fork-knife"
                size="24"
              />
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold text-white">
                {{ viewedProduct?.name }}
              </div>
              <div class="text-body-2 text-white mt-1">
                Ingredients & Combinations
              </div>
            </div>
            <v-spacer />
            <v-btn
              color="white"
              icon="mdi-close"
              size="small"
              variant="text"
              @click="viewDialog = false"
            />
          </div>
        </div>

        <v-card-text class="pa-0">
          <v-tabs v-model="viewTab" grow>
            <v-tab value="mandatory">Mandatory Ingredients</v-tab>
            <v-tab value="groups">Ingredient Groups</v-tab>
          </v-tabs>

          <v-window v-model="viewTab">
            <v-window-item value="mandatory">
              <div class="pa-4">
                <div
                  v-if="!viewedProductItems?.length"
                  class="text-center py-8"
                >
                  <v-icon
                    class="mb-3"
                    color="grey"
                    icon="mdi-food-off"
                    size="48"
                  />
                  <div class="text-h6 text-grey">No Mandatory Ingredients</div>
                </div>
                <div v-else class="ingredients-grid">
                  <v-card
                    v-for="(ingredient, index) in viewedProductItems"
                    :key="ingredient.id || index"
                    border
                    class="mb-3 rounded-lg"
                    hover
                    variant="outlined"
                  >
                    <v-card-text class="pa-4">
                      <div class="d-flex align-center">
                        <div class="flex-grow-1">
                          <div class="text-body-1 font-weight-medium">
                            {{ ingredient.item_name }}
                          </div>
                          <div class="d-flex align-center mt-2">
                            <v-chip
                              class="mr-2"
                              color="primary"
                              size="small"
                              variant="flat"
                            >
                              {{ ingredient.quantity_per_unit }}
                              {{ ingredient.unit }}
                            </v-chip>
                            <v-icon
                              class="mr-1"
                              color="orange"
                              icon="mdi-alert-circle"
                              size="16"
                            />
                            <span class="text-caption text-grey"
                              >Mandatory</span
                            >
                          </div>
                        </div>
                        <v-avatar color="primary" size="32" variant="tonal">
                          <span
                            class="text-primary text-caption font-weight-bold"
                          >
                            {{ index + 1 }}
                          </span>
                        </v-avatar>
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
              </div>
            </v-window-item>

            <v-window-item value="groups">
              <div class="pa-4">
                <div
                  v-if="!viewedProductGroups?.length"
                  class="text-center py-8"
                >
                  <v-icon
                    class="mb-3"
                    color="grey"
                    icon="mdi-group"
                    size="48"
                  />
                  <div class="text-h6 text-grey">No Ingredient Groups</div>
                </div>
                <div v-else>
                  <v-card
                    v-for="group in viewedProductGroups"
                    :key="group.id"
                    class="mb-4"
                    variant="outlined"
                  >
                    <v-card-title class="bg-grey-lighten-3">
                      {{ group.name }}
                      <v-chip
                        class="ml-2"
                        :color="group.is_mandatory ? 'orange' : 'grey'"
                        size="small"
                      >
                        {{ group.is_mandatory ? "Mandatory" : "Optional" }}
                      </v-chip>
                      <v-chip class="ml-2" color="primary" size="small">
                        {{ group.selection_mode }}
                      </v-chip>
                    </v-card-title>
                    <v-card-text>
                      <div v-if="group.description" class="text-body-2 mb-3">
                        {{ group.description }}
                      </div>

                      <div class="mb-3">
                        <strong>Available Options:</strong>
                        <v-chip
                          v-for="option in group.options"
                          :key="option.id"
                          class="ml-1"
                          size="small"
                          variant="outlined"
                        >
                          {{ option.item_name }}
                        </v-chip>
                      </div>

                      <div>
                        <strong>Combinations:</strong>
                        <v-card
                          v-for="comb in group.combinations"
                          :key="comb.id"
                          class="mt-2"
                          variant="outlined"
                        >
                          <v-card-title class="text-body-2 bg-grey-lighten-4">
                            {{ comb.name }}
                            <v-chip
                              v-if="comb.is_default"
                              class="ml-2"
                              color="green"
                              size="small"
                            >
                              Default
                            </v-chip>
                          </v-card-title>
                          <v-card-text>
                            <div
                              v-for="qty in comb.quantities"
                              :key="qty.option_id"
                              class="text-caption"
                            >
                              •
                              {{
                                getItemNameForView(group.options, qty.item_id)
                              }}: {{ qty.quantity_per_unit }}
                            </div>
                          </v-card-text>
                        </v-card>
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
              </div>
            </v-window-item>
          </v-window>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- CONFIRM DELETE -->
    <v-dialog v-model="confirmDeleteDialog" persistent width="400">
      <v-card>
        <v-toolbar color="warning" :title="'Confirm Deleting ' + state.name">
          <v-btn
            color="white"
            icon="mdi-close"
            @click="confirmDeleteDialog = false"
          />
        </v-toolbar>
        <v-card-text
          >Are you sure you want to delete {{ state.name }}?</v-card-text
        >
        <v-card-actions class="d-flex justify-end">
          <v-btn color="grey" @click="confirmDeleteDialog = false"
            >Cancel</v-btn
          >
          <v-btn color="error" @click="removeProduct">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useStore } from "vuex";
import { useVuelidate } from "@vuelidate/core";
import { helpers, minValue, required } from "@vuelidate/validators";

const store = useStore();
const loading = ref(false);
const values = ref([]);
const dialog = ref(false);
const confirmDeleteDialog = ref(false);
const viewDialog = ref(false);
const viewTab = ref("mandatory");
const isEditing = ref(false);
const editingId = ref(null);
const viewedProduct = ref(null);
const viewedProductItems = ref([]);
const viewedProductGroups = ref([]);
const items = ref([]);
const page = ref(1);
const totalPages = ref(1);
const limit = 10;
const totals = reactive({ total_products: "" });
const filters = reactive({ search: "" });

const headers = [
  { title: "Name", key: "name" },
  { title: "Description", key: "description" },
  { title: "Unit", key: "unit" },
  { title: "Price", key: "price" },
  { title: "Actions", key: "actions" },
];

const selectionModes = [
  { text: "Any Combination", value: "ANY" },
  { text: "Exactly One", value: "EXACTLY_ONE" },
  { text: "At Least One", value: "AT_LEAST_ONE" },
];

const state = reactive({
  name: "",
  description: "",
  unit: "",
  price: "",
  items: [], // Mandatory ingredients
  groups: [], // Ingredient groups
});

// Validation rules
const hasAtLeastOneItem = helpers.withMessage(
  "At least one mandatory ingredient is required",
  (v) => Array.isArray(v) && v.length > 0,
);
const validItems = helpers.withMessage(
  "Each mandatory ingredient must have item and quantity",
  (v) =>
    Array.isArray(v) &&
    v.every(
      (it) =>
        it.item_id && it.quantity_per_unit && Number(it.quantity_per_unit) > 0,
    ),
);

const rules = {
  name: { required },
  unit: { required },
  price: { required, minValue: minValue(1) },
  items: { hasAtLeastOneItem, validItems },
};
const v$ = useVuelidate(rules, state);

// Computed properties
const summaryText = computed(() => {
  const mandatoryCount = state.items.length;
  const groupCount = state.groups.length;
  const incompleteMandatory = state.items.filter(
    (it) => !it.item_id || !it.quantity_per_unit,
  ).length;
  const incompleteGroups = state.groups.filter(
    (g) => !g.name || g.options.length === 0,
  ).length;

  if (mandatoryCount === 0 && groupCount === 0)
    return "No ingredients configured.";

  let text = `${mandatoryCount} mandatory ingredient(s)`;
  if (groupCount > 0) text += `, ${groupCount} group(s)`;
  if (incompleteMandatory > 0 || incompleteGroups > 0)
    text += ` - ${incompleteMandatory + incompleteGroups} incomplete`;

  return text;
});

const summaryColor = computed(() => {
  const incompleteMandatory = state.items.some(
    (it) => !it.item_id || !it.quantity_per_unit,
  );
  const incompleteGroups = state.groups.some(
    (g) => !g.name || g.options.length === 0,
  );
  return incompleteMandatory || incompleteGroups ? "error" : "success";
});

const groupValidationError = computed(() => {
  for (const group of state.groups) {
    if (!group.name) return "All groups must have a name";
    if (group.options.length === 0)
      return `Group "${group.name}" must have at least one option`;

    // Check if combinations have quantities for all included options
    for (const comb of group.combinations) {
      const includedOptions = getIncludedOptions(group, comb);
      for (const opt of includedOptions) {
        const quantity = getCombinationQuantityDirect(group, comb, opt.item_id);
        if (!quantity || quantity <= 0) {
          return `Combination "${comb.name}" must have quantity for ${getItemName(opt.item_id)}`;
        }
      }
    }

    // Check if mandatory groups have default combinations
    if (group.is_mandatory && !group.combinations.some((c) => c.is_default)) {
      return `Mandatory group "${group.name}" must have a default combination`;
    }
  }
  return null;
});

const hasGroupErrors = computed(() => !!groupValidationError.value);

// Helper functions
const getSelectionModeDescription = (mode) => {
  const descriptions = {
    ANY: "Any combination of options allowed",
    EXACTLY_ONE: "Must select exactly one option",
    AT_LEAST_ONE: "Must select at least one option",
  };
  return descriptions[mode] || "";
};

const getCombinationCount = (group) => {
  const optionCount = group.options.filter((opt) => opt.item_id).length;
  if (group.selection_mode === "EXACTLY_ONE") return optionCount;
  if (group.selection_mode === "AT_LEAST_ONE")
    return Math.pow(2, optionCount) - 1;
  return Math.pow(2, optionCount) - 1; // ANY mode
};

const getItemName = (itemId) => {
  const item = items.value.find((i) => i.id === itemId);
  return item ? item.name : "Unknown Item";
};

const getItemNameForView = (options, itemId) => {
  const option = options.find((o) => o.item_id === itemId);
  return option ? option.item_name : "Unknown Item";
};

const getIncludedOptions = (group, combination) => {
  return group.options.filter((opt, index) => {
    return combination.combination_mask & (1 << index);
  });
};

const getExcludedOptionsCount = (group, combination) => {
  return group.options.length - getIncludedOptions(group, combination).length;
};

// Combination management
// Replace the generateCombinations function with this corrected version:
const generateCombinations = (groupIndex) => {
  const group = state.groups[groupIndex];
  const validOptions = group.options.filter((opt) => opt.item_id);

  if (validOptions.length === 0) {
    group.combinations = [];
    return;
  }

  const allCombinations = [];

  // Generate all possible combinations (2^n - 1, excluding empty set)
  const totalCombinations = Math.pow(2, validOptions.length);

  for (let i = 1; i < totalCombinations; i++) {
    const combinationMask = i;
    const includedOptions = [];

    // Determine which options are included in this combination
    for (let j = 0; j < validOptions.length; j++) {
      if (combinationMask & (1 << j)) {
        includedOptions.push(validOptions[j]);
      }
    }

    // Generate combination name
    const combinationName = includedOptions
      .map((opt) => getItemName(opt.item_id))
      .join(" + ");

    // Check if this combination already exists
    const existingCombination = group.combinations.find(
      (c) => c.combination_mask === combinationMask,
    );

    if (existingCombination) {
      // Update existing combination name and keep quantities
      existingCombination.name = combinationName;
      // Ensure all included options have quantity entries
      includedOptions.forEach((opt) => {
        if (
          !existingCombination.quantities.find((q) => q.item_id === opt.item_id)
        ) {
          existingCombination.quantities.push({
            item_id: opt.item_id,
            quantity_per_unit: "",
          });
        }
      });
      // Remove quantities for options not in this combination
      existingCombination.quantities = existingCombination.quantities.filter(
        (q) => includedOptions.some((opt) => opt.item_id === q.item_id),
      );

      allCombinations.push(existingCombination);
    } else {
      // Create new combination
      const quantities = includedOptions.map((opt) => ({
        item_id: opt.item_id,
        quantity_per_unit: "",
      }));

      allCombinations.push({
        name: combinationName,
        combination_mask: combinationMask,
        is_default: allCombinations.length === 0 && group.is_mandatory, // First one is default for mandatory groups
        notes: "",
        quantities,
      });
    }
  }

  // Apply selection mode filtering AFTER generating all combinations
  let filteredCombinations = allCombinations;

  if (group.selection_mode === "EXACTLY_ONE") {
    filteredCombinations = allCombinations.filter((comb) => {
      const includedCount = getIncludedOptions(group, comb).length;
      return includedCount === 1;
    });
  } else if (group.selection_mode === "AT_LEAST_ONE") {
    filteredCombinations = allCombinations.filter((comb) => {
      const includedCount = getIncludedOptions(group, comb).length;
      return includedCount >= 1;
    });
  }

  // Ensure at least one default combination for mandatory groups
  if (
    group.is_mandatory &&
    filteredCombinations.length > 0 &&
    !filteredCombinations.some((c) => c.is_default)
  ) {
    filteredCombinations[0].is_default = true;
  }

  group.combinations = filteredCombinations;
};

const getCombinationQuantity = (groupIndex, combIndex, itemId) => {
  const combination = state.groups[groupIndex].combinations[combIndex];
  const quantity = combination.quantities.find((q) => q.item_id === itemId);
  return quantity ? quantity.quantity_per_unit : "";
};

const getCombinationQuantityDirect = (group, combination, itemId) => {
  const quantity = combination.quantities.find((q) => q.item_id === itemId);
  return quantity ? quantity.quantity_per_unit : "";
};

const setCombinationQuantity = (groupIndex, combIndex, itemId, value) => {
  const combination = state.groups[groupIndex].combinations[combIndex];
  const quantity = combination.quantities.find((q) => q.item_id === itemId);

  if (quantity) {
    quantity.quantity_per_unit = value;
  } else {
    // Create new quantity entry if it doesn't exist
    combination.quantities.push({
      item_id: itemId,
      quantity_per_unit: value,
    });
  }
};

// Item management functions
function availableMandatoryItems(index) {
  const selectedIds = state.items
    .map((it, i) => (i !== index ? it.item_id : null))
    .filter(Boolean);
  const groupSelectedIds = state.groups
    .flatMap((g) => g.options.map((o) => o.item_id))
    .filter(Boolean);
  const allSelectedIds = [...selectedIds, ...groupSelectedIds];
  return items.value.filter((i) => !allSelectedIds.includes(i.id));
}

function availableGroupItems(groupIndex, optionIndex) {
  const currentGroup = state.groups[groupIndex];
  const selectedInGroup = currentGroup.options
    .map((opt, idx) => (idx !== optionIndex ? opt.item_id : null))
    .filter(Boolean);

  const selectedInOtherGroups = state.groups
    .flatMap((g, idx) =>
      idx !== groupIndex ? g.options.map((o) => o.item_id) : [],
    )
    .filter(Boolean);

  const selectedInMandatory = state.items
    .map((it) => it.item_id)
    .filter(Boolean);

  const allSelectedIds = [
    ...selectedInGroup,
    ...selectedInOtherGroups,
    ...selectedInMandatory,
  ];
  return items.value.filter((i) => !allSelectedIds.includes(i.id));
}

function onMandatoryItemChange(it) {
  const selected = items.value.find((i) => i.id === it.item_id);
  it.unit = selected ? selected.unit : "";
}

function onGroupItemChange(groupIndex, optionIndex) {
  const option = state.groups[groupIndex].options[optionIndex];
  const selected = items.value.find((i) => i.id === option.item_id);
  option.item_name = selected ? selected.name : "";
  option.unit = selected ? selected.unit : "";

  if (option.item_id) {
    generateCombinations(groupIndex);
  }
}

// Mandatory items management
function addMandatoryItem() {
  state.items.push({ item_id: "", quantity_per_unit: "", unit: "" });
}

function removeMandatoryItem(index) {
  state.items.splice(index, 1);
}

// Group management
function addGroup() {
  state.groups.push({
    name: "",
    description: "",
    is_mandatory: true,
    selection_mode: "ANY",
    options: [],
    combinations: [],
  });
}

function removeGroup(index) {
  state.groups.splice(index, 1);
}

function addGroupOption(groupIndex) {
  state.groups[groupIndex].options.push({
    item_id: "",
    item_name: "",
    position: state.groups[groupIndex].options.length + 1,
    unit: "",
  });
}

function removeGroupOption(groupIndex, optionIndex) {
  state.groups[groupIndex].options.splice(optionIndex, 1);
  generateCombinations(groupIndex);
}

function removeCombination(groupIndex, combIndex) {
  state.groups[groupIndex].combinations.splice(combIndex, 1);
}

// Data functions
async function loadItems() {
  const res = await fetch("/items");
  items.value = await res.json();
}

async function loadValues() {
  loading.value = true;
  const params = new URLSearchParams({ page: page.value, limit });
  if (filters.search) params.append("search", filters.search);
  try {
    const res = await fetch(`/products?${params}`);
    const data = await res.json();
    values.value = data.data || [];
    totalPages.value = data.totalPages || 1;
    totals.total_products = data.totalRecords || 0;
  } finally {
    loading.value = false;
  }
}

// Filters
function applyFilters() {
  page.value = 1;
  loadValues();
}

function resetFilters() {
  filters.search = "";
  page.value = 1;
  loadValues();
}

// Dialog control
function activateAddDialog() {
  isEditing.value = false;
  Object.assign(state, {
    name: "",
    description: "",
    unit: "",
    price: "",
    items: [],
    groups: [],
  });
  dialog.value = true;
  v$.value.$reset();
}

async function activateEditDialog(item) {
  isEditing.value = true;
  editingId.value = item.id;
  loading.value = true;
  try {
    const res = await fetch(`/products/${item.id}`);
    const data = await res.json();
    const product = data.product || data;
    Object.assign(state, {
      name: product.name,
      description: product.description,
      unit: product.unit,
      price: product.price,
      items: (data.items || []).map((i) => ({
        item_id: i.item_id,
        quantity_per_unit: i.quantity_per_unit,
        unit: i.unit,
      })),
      groups: (data.groups || []).map((g) => ({
        name: g.name,
        description: g.description,
        is_mandatory: g.is_mandatory,
        selection_mode: g.selection_mode,
        options: g.options || [],
        combinations: g.combinations || [],
      })),
    });
    dialog.value = true;
  } finally {
    loading.value = false;
  }
}

// View ingredients
async function viewIngredients(item) {
  viewedProduct.value = item;
  const res = await fetch(`/products/${item.id}`);
  const data = await res.json();
  viewedProductItems.value = data.items || [];
  viewedProductGroups.value = data.groups || [];
  viewTab.value = "mandatory";
  viewDialog.value = true;
}

// Save & delete
async function saveProduct() {
  v$.value.$touch();
  if (v$.value.$invalid || hasGroupErrors.value) return;

  loading.value = true;
  const formData = new FormData();
  formData.append("name", state.name);
  formData.append("description", state.description);
  formData.append("unit", state.unit);
  formData.append("price", state.price);
  formData.append("items", JSON.stringify(state.items));
  formData.append("groups", JSON.stringify(state.groups));

  const url = isEditing.value ? `/products/${editingId.value}` : "/products";
  const method = isEditing.value ? "PUT" : "POST";
  try {
    const res = await fetch(url, { method, body: formData });
    if (!res.ok) throw new Error("Failed to save");
    dialog.value = false;
    loadValues();
    store.commit("setMessage", {
      type: "success",
      text: isEditing.value ? "Product updated!" : "Product added!",
    });
  } catch {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to save product",
    });
  } finally {
    loading.value = false;
  }
}

async function removeProduct() {
  loading.value = true;
  await fetch(`/products/${editingId.value}`, { method: "DELETE" });
  confirmDeleteDialog.value = false;
  dialog.value = false;
  loadValues();
  store.commit("setMessage", { type: "success", text: "Product deleted!" });
  loading.value = false;
}

onMounted(() => {
  loadValues();
  loadItems();
});
</script>

<style scoped>
.v-alert strong {
  font-weight: 600;
}
</style>
