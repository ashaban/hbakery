<template>
  <v-dialog
    max-width="820"
    :model-value="modelValue"
    scrollable
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card class="rounded-lg">
      <v-toolbar color="primary" density="comfortable">
        <v-avatar class="mr-3" color="primary" size="40">
          <v-icon color="white">mdi-cog</v-icon>
        </v-avatar>
        <v-toolbar-title class="text-h6 font-weight-bold">
          Pay Structure
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-tabs v-model="tab" bg-color="grey-lighten-4">
        <v-tab value="components">Allowances</v-tab>
        <v-tab value="statutory">Statutory Deductions</v-tab>
        <v-tab value="staff">Staff Allowances</v-tab>
      </v-tabs>

      <v-card-text style="max-height: 65vh">
        <!-- ALLOWANCES -->
        <v-window v-model="tab">
          <v-window-item value="components">
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left">COMPONENT</th>
                  <th class="text-left">GROUP</th>
                  <th class="text-right">TAXABLE</th>
                  <th class="text-right">PENSIONABLE</th>
                  <th class="text-right">ACTIVE</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in components" :key="c.id">
                  <td>{{ c.display }}</td>
                  <td>{{ c.group_display }}</td>
                  <td class="text-right">
                    <v-checkbox-btn
                      :model-value="c.is_taxable"
                      @update:model-value="(v) => updateComponent(c, { is_taxable: v })"
                    />
                  </td>
                  <td class="text-right">
                    <v-checkbox-btn
                      :model-value="c.is_pensionable"
                      @update:model-value="(v) => updateComponent(c, { is_pensionable: v })"
                    />
                  </td>
                  <td class="text-right">
                    <v-checkbox-btn
                      :model-value="c.is_active"
                      @update:model-value="(v) => updateComponent(c, { is_active: v })"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div class="text-subtitle-2 font-weight-bold mt-6 mb-2">
              New allowance
            </div>
            <v-row dense>
              <v-col cols="12" sm="3">
                <v-text-field
                  v-model="newComponent.code"
                  density="compact"
                  label="Code"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="newComponent.display"
                  density="compact"
                  label="Name"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="12" sm="3">
                <v-select
                  v-model="newComponent.pay_group_id"
                  density="compact"
                  item-title="display"
                  item-value="id"
                  :items="groups"
                  label="Group"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="12" sm="2">
                <v-btn block color="primary" variant="tonal" @click="addComponent">
                  Add
                </v-btn>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- STATUTORY -->
          <v-window-item value="statutory">
            <v-alert class="mb-4" density="compact" type="warning" variant="tonal">
              These figures are a starting point only. Confirm rates and
              bands against the current Finance Act / NSSF circular
              before enabling any of them for a live payroll run.
            </v-alert>
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-left">DEDUCTION</th>
                  <th class="text-left">SIDE</th>
                  <th class="text-left">CALC</th>
                  <th class="text-right">RATE</th>
                  <th class="text-right">ACTIVE</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in statutory" :key="s.id">
                  <td>{{ s.display }}</td>
                  <td>{{ s.side === "EMPLOYEE" ? "Employee" : "Employer" }}</td>
                  <td>{{ s.calc_type }}</td>
                  <td class="text-right" style="width: 120px">
                    <v-text-field
                      v-if="s.calc_type !== 'BANDED'"
                      density="compact"
                      hide-details
                      :model-value="s.rate"
                      type="number"
                      variant="outlined"
                      @change="(e) => updateStatutory(s, { rate: e.target.value })"
                    />
                    <span v-else class="text-caption text-grey">bands</span>
                  </td>
                  <td class="text-right">
                    <v-checkbox-btn
                      :model-value="s.is_active"
                      @update:model-value="(v) => updateStatutory(s, { is_active: v })"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-window-item>

          <!-- STAFF ALLOWANCES -->
          <v-window-item value="staff">
            <v-autocomplete
              v-model="selectedStaffId"
              class="mb-4"
              density="compact"
              item-title="name"
              item-value="id"
              :items="staffList"
              label="Search staff"
              variant="outlined"
              @update:model-value="loadStaffComponents"
            />

            <template v-if="selectedStaffId">
              <v-row v-for="c in components.filter((c) => c.is_active)" :key="c.id" align="center" dense>
                <v-col cols="7">{{ c.display }}</v-col>
                <v-col cols="3">
                  <v-text-field
                    v-model="staffComponentAmounts[c.id]"
                    density="compact"
                    hide-details
                    type="number"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="2">
                  <v-btn
                    block
                    color="primary"
                    size="small"
                    variant="tonal"
                    @click="saveStaffComponent(c)"
                  >
                    Save
                  </v-btn>
                </v-col>
              </v-row>
            </template>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
  import { reactive, ref, watch } from "vue";
  import { useStore } from "vuex";

  const props = defineProps({ modelValue: { type: Boolean, default: false } });
  const emit = defineEmits(["update:modelValue"]);

  const store = useStore();
  const tab = ref("components");

  const groups = ref([]);
  const components = ref([]);
  const statutory = ref([]);
  const staffList = ref([]);
  const selectedStaffId = ref(null);
  const staffComponentAmounts = reactive({});

  const newComponent = reactive({ code: "", display: "", pay_group_id: null });

  async function loadGroups () {
    const res = await fetch("/payroll/pay-groups");
    const data = await res.json();
    groups.value = data.data || [];
    if (!newComponent.pay_group_id && groups.value.length) {
      newComponent.pay_group_id = groups.value[0].id;
    }
  }

  async function loadComponents () {
    const res = await fetch("/payroll/pay-components");
    const data = await res.json();
    components.value = data.data || [];
  }

  async function loadStatutory () {
    const res = await fetch("/payroll/statutory-deductions");
    const data = await res.json();
    statutory.value = data.data || [];
  }

  async function loadStaffList () {
    const res = await fetch("/staffs?limit=1000&status=Active");
    const data = await res.json();
    staffList.value = data.data || data.values || [];
  }

  async function updateComponent (component, patch) {
    const res = await fetch(`/payroll/pay-components/${component.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) Object.assign(component, patch);
  }

  async function addComponent () {
    if (!newComponent.code.trim() || !newComponent.display.trim() || !newComponent.pay_group_id) {
      store.commit("setMessage", { type: "error", text: "Code, name and group are required" });
      return;
    }
    const res = await fetch("/payroll/pay-components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newComponent),
    });
    const data = await res.json();
    if (!res.ok) {
      store.commit("setMessage", { type: "error", text: data.error });
      return;
    }
    newComponent.code = "";
    newComponent.display = "";
    await loadComponents();
    store.commit("setMessage", { type: "success", text: "Allowance added" });
  }

  async function updateStatutory (rule, patch) {
    const res = await fetch(`/payroll/statutory-deductions/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) Object.assign(rule, patch);
  }

  async function loadStaffComponents () {
    if (!selectedStaffId.value) return;
    const res = await fetch(`/payroll/staff/${selectedStaffId.value}/pay-components`);
    const data = await res.json();
    for (const key of Object.keys(staffComponentAmounts)) delete staffComponentAmounts[key];
    for (const row of data.data || []) staffComponentAmounts[row.component_id] = row.amount;
  }

  async function saveStaffComponent (component) {
    const amount = Number(staffComponentAmounts[component.id]) || 0;
    const res = await fetch(
      `/payroll/staff/${selectedStaffId.value}/pay-components/${component.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      },
    );
    if (res.ok) {
      store.commit("setMessage", {
        type: "success",
        text: amount > 0 ? `${component.display} set` : `${component.display} cleared`,
      });
    }
  }

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return;
      loadGroups();
      loadComponents();
      loadStatutory();
      loadStaffList();
    },
  );
</script>
