<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="7">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-account-clock</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Shift Workers
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Who is on the floor, and when. Productions pick up their crew
                  from the shift that was running at the time.
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="5">
            <v-btn
              v-if="$store.getters.hasTask('can_manage_shifts')"
              color="primary"
              size="large"
              @click="openNew"
            >
              <v-icon start>mdi-plus</v-icon>
              New Shift
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- FILTERS -->
    <v-card class="mb-4" elevation="1">
      <v-card-text class="d-flex flex-wrap ga-3 align-center">
        <v-select
          v-model="filters.day"
          clearable
          density="comfortable"
          hide-details
          item-title="label"
          item-value="value"
          :items="DAYS"
          label="Runs on"
          style="max-width: 220px"
          variant="outlined"
        />
        <v-btn color="primary" variant="flat" @click="load">
          <v-icon start>mdi-magnify</v-icon>
          Search
        </v-btn>
        <v-btn color="grey" variant="outlined" @click="resetFilters">
          <v-icon start>mdi-refresh</v-icon>
          Reset
        </v-btn>
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

      <div v-if="!loading && !shifts.length" class="pa-12 text-center">
        <v-icon class="mb-4" color="grey-lighten-1" size="64">
          mdi-account-clock-outline
        </v-icon>
        <div class="text-h6 text-grey">No shifts recorded yet</div>
        <div class="text-body-2 text-grey">
          Create one so productions can pick up their crew automatically.
        </div>
      </div>

      <v-table v-else density="comfortable">
        <thead>
          <tr class="bg-grey-lighten-4">
            <th class="text-left">SHIFT</th>
            <th class="text-left">DAYS</th>
            <th class="text-left">HOURS</th>
            <th class="text-left">LEADER</th>
            <th class="text-left">CREW</th>
            <th class="text-right">COST / DAY</th>
            <th class="text-right">USED BY</th>
            <th class="text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in shifts" :key="s.id">
            <td class="font-weight-medium">{{ s.name || `Shift #${s.id}` }}</td>
            <td>
              <div class="d-flex flex-wrap ga-1">
                <v-chip
                  v-for="d in s.days_of_week"
                  :key="d"
                  color="primary"
                  size="x-small"
                  variant="tonal"
                >{{ DAY_SHORT[d] }}</v-chip>
              </div>
            </td>
            <td>
              {{ s.start_time }} – {{ s.end_time }}
              <div class="text-caption text-grey">
                {{ s.hours }}h<span v-if="s.end_day_offset > 0">
                  · ends {{ s.end_day_offset === 1 ? "next day" : `+${s.end_day_offset} days` }}
                </span>
              </div>
            </td>
            <td>{{ s.leader_name || "—" }}</td>
            <td>
              <div class="d-flex flex-wrap ga-1 py-1">
                <v-chip
                  v-for="m in s.members"
                  :key="m.staff_id"
                  :color="m.daily_rate ? 'primary' : 'warning'"
                  size="x-small"
                  variant="tonal"
                >
                  {{ m.staff_name }}
                  <v-tooltip activator="parent" location="top">
                    <span v-if="m.daily_rate">
                      {{ money(m.daily_rate) }} per day
                    </span>
                    <span v-else>
                      No daily rate set — this person adds nothing to the
                      shift's cost
                    </span>
                  </v-tooltip>
                </v-chip>
              </div>
            </td>
            <td class="text-right font-weight-medium text-green-darken-2">
              {{ money(s.daily_cost) }}
            </td>
            <td class="text-right">
              <span v-if="s.production_count" class="text-body-2">
                {{ s.production_count }} production(s)
              </span>
              <span v-else class="text-caption text-grey">—</span>
            </td>
            <td class="text-right">
              <v-btn size="small" variant="text" @click="openView(s)">
                <v-icon size="16" start>mdi-eye</v-icon>
                View
              </v-btn>
              <v-btn
                v-if="$store.getters.hasTask('can_manage_shifts')"
                size="small"
                variant="text"
                @click="openEdit(s)"
              >
                Edit
              </v-btn>
              <v-btn
                v-if="
                  $store.getters.hasTask('can_manage_shifts') &&
                    !s.production_count
                "
                color="error"
                icon
                size="x-small"
                variant="text"
                @click="confirmDelete(s)"
              >
                <v-icon size="18">mdi-delete</v-icon>
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- EDITOR -->
    <v-dialog v-model="dialog" max-width="720" scrollable>
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-account-clock</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ form.id ? "Edit Shift" : "New Shift" }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-alert
            v-if="formError"
            class="mb-4"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ formError }}
          </v-alert>

          <v-text-field
            v-model="form.name"
            class="mb-3"
            density="comfortable"
            hint="Optional — e.g. Night shift"
            label="Name"
            variant="outlined"
          />

          <div class="text-caption text-grey mb-1">DAYS OF THE WEEK</div>
          <v-chip-group
            v-model="form.days_of_week"
            class="mb-3"
            column
            multiple
            selected-class="text-primary"
          >
            <v-chip
              v-for="d in DAYS"
              :key="d.value"
              filter
              :value="d.value"
              variant="outlined"
            >{{ d.label }}</v-chip>
          </v-chip-group>

          <v-row dense>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="form.start_time"
                label="Start time"
                type="time"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="form.end_day_offset"
                item-title="label"
                item-value="value"
                :items="endDayOptions"
                label="Ends on"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="form.end_time"
                label="End time"
                type="time"
                variant="outlined"
              />
            </v-col>
          </v-row>

          <!--
            Spells the shift back out in full. The length is the check that
            catches a mis-set end day: a 25-hour shift looks obviously
            different from a 1-hour one.
          -->
          <v-alert
            class="mb-4"
            density="compact"
            :type="span.error ? 'error' : 'info'"
            variant="tonal"
          >
            {{ span.text }}
          </v-alert>

          <v-select
            v-model="form.leader_staff_id"
            class="mb-3"
            density="comfortable"
            item-title="label"
            item-value="id"
            :items="staffOptions"
            label="Shift Leader *"
            variant="outlined"
          />

          <v-select
            v-model="form.members"
            chips
            closable-chips
            density="comfortable"
            item-title="label"
            item-value="id"
            :items="staffOptions"
            label="Crew *"
            multiple
            variant="outlined"
          />

          <!--
            The leader is paid for the day like anyone else, so leaving them out
            of the crew would understate the shift. Saying so beats silently
            adding them and having the total not match the chips on screen.
          -->
          <v-alert
            v-if="form.leader_staff_id && !form.members.includes(form.leader_staff_id)"
            class="mb-3"
            density="compact"
            type="info"
            variant="tonal"
          >
            The shift leader is counted in the crew automatically.
          </v-alert>

          <v-alert
            v-if="unratedSelected.length"
            class="mb-3"
            density="compact"
            type="warning"
            variant="tonal"
          >
            No daily rate set for
            <strong>{{ unratedSelected.join(", ") }}</strong>. They will add
            nothing to this shift's cost until a rate is set on their staff
            record.
          </v-alert>

          <div class="d-flex align-center justify-space-between mt-2">
            <span class="text-body-2 text-grey">Cost of this shift</span>
            <span class="text-h6 font-weight-bold text-green-darken-2">
              {{ money(projectedCost) }}
            </span>
          </div>

          <v-textarea
            v-model="form.notes"
            class="mt-3"
            density="comfortable"
            label="Notes"
            rows="2"
            variant="outlined"
          />
        </v-card-text>

        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" variant="flat" @click="save">
            {{ form.id ? "Save Changes" : "Create Shift" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- MEMBERS -->
    <v-dialog v-model="viewDialog" max-width="640" scrollable>
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-account-group</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ viewing?.name || `Shift #${viewing?.id}` }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="viewDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text v-if="viewing" class="pa-6">
          <v-row class="mb-2" dense>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">DAYS</div>
              <div class="text-body-1">
                {{ (viewing.days_of_week || []).map((d) => DAY_SHORT[d]).join(", ") }}
              </div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">HOURS</div>
              <div class="text-body-1">
                {{ viewing.start_time }} – {{ viewing.end_time }}
                <span class="text-caption text-grey">
                  ({{ viewing.hours }}h<span v-if="viewing.end_day_offset > 0">, ends
                    {{ viewing.end_day_offset === 1 ? "next day" : `+${viewing.end_day_offset} days` }}</span>)
                </span>
              </div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">LEADER</div>
              <div class="text-body-1">{{ viewing.leader_name || "—" }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-grey">USED BY</div>
              <div class="text-body-1">
                {{ viewing.production_count || 0 }} production(s)
              </div>
            </v-col>
          </v-row>

          <v-alert
            v-if="viewing.notes"
            class="mb-4"
            density="compact"
            type="info"
            variant="tonal"
          >
            {{ viewing.notes }}
          </v-alert>

          <v-divider class="mb-3" />

          <div class="d-flex align-center mb-2">
            <span class="text-caption text-grey font-weight-bold">
              CREW ({{ viewing.members.length }})
            </span>
            <v-spacer />
            <span class="text-body-2 font-weight-bold text-green-darken-2">
              {{ money(viewing.daily_cost) }} for the day
            </span>
          </div>

          <v-table density="compact">
            <thead>
              <tr class="bg-grey-lighten-4">
                <th class="text-left">STAFF</th>
                <th class="text-left">POSITION</th>
                <th class="text-left">ROLE</th>
                <th class="text-right">DAILY RATE</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in viewing.members" :key="m.staff_id">
                <td class="font-weight-medium">{{ m.staff_name }}</td>
                <td class="text-body-2 text-grey">{{ m.position || "—" }}</td>
                <td>
                  <v-chip
                    v-if="m.staff_id === viewing.leader_staff_id"
                    color="primary"
                    size="x-small"
                    variant="tonal"
                  >
                    Team Leader
                  </v-chip>
                  <span v-else class="text-body-2 text-grey">Crew</span>
                </td>
                <td class="text-right">
                  <span v-if="m.daily_rate">{{ money(m.daily_rate) }}</span>
                  <!--
                    Called out rather than shown as 0: this person genuinely
                    adds nothing to the shift's cost until a rate is set, and
                    a 0 would read as a decision rather than a gap.
                  -->
                  <span v-else class="text-caption text-warning">
                    No rate set
                  </span>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td class="font-weight-bold" colspan="3">TOTAL</td>
                <td class="text-right font-weight-bold text-green-darken-2">
                  {{ money(viewing.daily_cost) }}
                </td>
              </tr>
            </tfoot>
          </v-table>
        </v-card-text>

        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="viewDialog = false">Close</v-btn>
          <v-btn
            v-if="$store.getters.hasTask('can_manage_shifts')"
            color="primary"
            variant="flat"
            @click="editFromView"
          >
            Edit Shift
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- DELETE CONFIRM -->
    <v-dialog v-model="showConfirm" max-width="480">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6">Delete this shift?</v-card-title>
        <v-card-text class="text-body-1 text-grey">
          {{ confirmMessage }}
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="outlined" @click="showConfirm = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="runDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, reactive, ref } from "vue";
  import { useStore } from "vuex";
  import moment from "moment";
  import { formatDMY } from "@/utils/date.js";
  // ISO weekday numbers, so they line up with Postgres EXTRACT(ISODOW).
  const DAYS = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
    { value: 7, label: "Sunday" },
  ];

  const DAY_SHORT = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun" };
  const DAY_FULL = Object.fromEntries(DAYS.map((d) => [d.value, d.label]));

  const store = useStore();

  const loading = ref(false);
  const saving = ref(false);
  const shifts = ref([]);
  const staff = ref([]);
  const dialog = ref(false);
  const formError = ref("");

  const filters = reactive({ day: null });

  const blankForm = () => ({
    id: null,
    name: "",
    leader_staff_id: null,
    days_of_week: [],
    start_time: "22:00",
    end_day_offset: 1,
    end_time: "06:00",
    members: [],
    notes: "",
  });
  const form = reactive(blankForm());

  const endDayOptions = [
    { value: 0, label: "The same day" },
    { value: 1, label: "The next day" },
    { value: 2, label: "2 days later" },
    { value: 3, label: "3 days later" },
    { value: 4, label: "4 days later" },
    { value: 5, label: "5 days later" },
    { value: 6, label: "6 days later" },
  ];

  const toMinutes = (t) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t || "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  /**
   * Spells the shift back out — "Monday 22:00 to Tuesday 23:00 · 25 hours".
   *
   * The length is the real safeguard here. Picking the wrong end day is easy
   * and looks harmless; seeing "25 hours" when you meant 8 does not.
   */
  const span = computed(() => {
    const a = toMinutes(form.start_time);
    const b = toMinutes(form.end_time);
    const off = Number(form.end_day_offset) || 0;

    if (a === null || b === null) {
      return { error: true, text: "Set a start and end time." };
    }
    if (off === 0 && b <= a) {
      return {
        error: true,
        text: "A shift ending the same day must end after it starts — choose a later end day.",
      };
    }

    const mins = off * 1440 + (b - a);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const length = `${h ? `${h} hour${h === 1 ? "" : "s"}` : ""}${m ? ` ${m} min` : ""}`.trim();

    const days = [...form.days_of_week].sort((x, y) => x - y);
    if (!days.length) {
      return { error: false, text: `${length} long. Pick the day(s) it starts.` };
    }

    // Name real weekdays for one start day; with several, show the first as
    // an example so the pattern is concrete without implying it is the only one.
    const startName = DAY_FULL[days[0]];
    const endName = DAY_FULL[((days[0] - 1 + off) % 7) + 1];
    const example = `${startName} ${form.start_time} to ${endName} ${form.end_time}`;
    return {
      error: false,
      text:
        days.length === 1
          ? `${example} · ${length}`
          : `${length}, e.g. ${example}. Runs on ${days.length} days a week.`,
    };
  });


  const staffOptions = computed(() =>
    staff.value.map((s) => ({
      id: s.id,
      label: s.daily_salary
        ? `${s.name} — ${money(s.daily_salary)}/day`
        : `${s.name} — no daily rate`,
      daily_salary: s.daily_salary,
      name: s.name,
    })),
  );

  /** Everyone on this shift, leader included, with no duplicates. */
  const selectedIds = computed(() => {
    const ids = new Set(form.members);
    if (form.leader_staff_id) ids.add(form.leader_staff_id);
    return [...ids];
  });

  const unratedSelected = computed(() =>
    staffOptions.value
      .filter((s) => selectedIds.value.includes(s.id) && !s.daily_salary)
      .map((s) => s.name),
  );

  const projectedCost = computed(() =>
    staffOptions.value
      .filter((s) => selectedIds.value.includes(s.id))
      .reduce((sum, s) => sum + (Number(s.daily_salary) || 0), 0),
  );

  function money (v) {
    return Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }



  async function load () {
    loading.value = true;
    try {
      const params = new URLSearchParams();
      if (filters.day) params.append("day", filters.day);

      const res = await fetch(`/shifts?${params}`);
      if (!res.ok) throw new Error("Failed to load shifts");
      shifts.value = (await res.json()).data || [];
    } catch {
      store.commit("setMessage", { type: "error", text: "Failed to load shifts" });
    } finally {
      loading.value = false;
    }
  }

  async function loadStaff () {
    try {
      const res = await fetch("/staffs?limit=500");
      const data = await res.json();
      staff.value = (data.data || data || []).filter((s) => s.status === "Active");
    } catch {
      staff.value = [];
    }
  }

  function resetFilters () {
    filters.start_date = "";
    filters.end_date = "";
    load();
  }

  function openNew () {
    Object.assign(form, blankForm());
    // Default to a shift starting now, so the common case is one edit not four.
    form.days_of_week = [];
    form.start_time = "22:00";
    form.end_day_offset = 1;
    form.end_time = "06:00";
    formError.value = "";
    dialog.value = true;
  }

  function openEdit (s) {
    Object.assign(form, {
      id: s.id,
      name: s.name || "",
      leader_staff_id: s.leader_staff_id,
      days_of_week: [...(s.days_of_week || [])],
      start_time: s.start_time || "22:00",
      end_day_offset: s.end_day_offset ?? 1,
      end_time: s.end_time || "06:00",
      members: (s.members || []).map((m) => m.staff_id),
      notes: s.notes || "",
    });
    formError.value = "";
    dialog.value = true;
  }



  async function save () {
    formError.value = "";
    const payload = {
      name: form.name || null,
      leader_staff_id: form.leader_staff_id,
      days_of_week: [...form.days_of_week].sort((a, b) => a - b),
      start_time: form.start_time,
      end_day_offset: Number(form.end_day_offset) || 0,
      end_time: form.end_time,
      members: selectedIds.value,
      notes: form.notes || null,
    };

    if (!payload.days_of_week.length) {
      formError.value = "Pick at least one day of the week";
      return;
    }
    if (!payload.start_time || !payload.end_time) {
      formError.value = "A start and end time are required";
      return;
    }
    if (span.value.error) {
      formError.value = span.value.text;
      return;
    }

    saving.value = true;
    try {
      const res = await fetch(form.id ? `/shifts/${form.id}` : "/shifts", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save shift");

      store.commit("setMessage", {
        type: "success",
        text: form.id ? "Shift updated" : "Shift created",
      });
      dialog.value = false;
      await load();
    } catch (error) {
      formError.value = error.message;
    } finally {
      saving.value = false;
    }
  }

  const viewDialog = ref(false);
  const viewing = ref(null);

  function openView (row) {
    viewing.value = row;
    viewDialog.value = true;
  }

  function editFromView () {
    const row = viewing.value;
    viewDialog.value = false;
    openEdit(row);
  }

  const showConfirm = ref(false);
  const confirmMessage = ref("");
  let pendingDelete = null;

  function confirmDelete (s) {
    pendingDelete = s;
    confirmMessage.value = `Delete ${s.name || `shift #${s.id}`}? This cannot be undone.`;
    showConfirm.value = true;
  }

  async function runDelete () {
    try {
      const res = await fetch(`/shifts/${pendingDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete shift");
      store.commit("setMessage", { type: "info", text: "Shift deleted" });
      await load();
    } catch (error) {
      store.commit("setMessage", { type: "error", text: error.message });
    } finally {
      showConfirm.value = false;
    }
  }

  onMounted(() => {
    filters.start_date = formatDMY(moment().subtract(30, "days").toDate());
    filters.end_date = formatDMY(moment().add(7, "days").toDate());
    loadStaff();
    load();
  });
</script>
