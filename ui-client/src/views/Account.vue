<template>
  <div>
    <v-app-bar color="primary" flat>
      <v-app-bar-title class="font-weight-bold">Your account</v-app-bar-title>
    </v-app-bar>

    <v-container fluid>
      <div class="text-center my-6">
        <v-avatar color="primary" size="72">
          <v-icon color="white" size="40">mdi-store</v-icon>
        </v-avatar>
        <div class="text-h6 font-weight-bold mt-3">
          {{ session.customer?.name }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ session.customer?.phone }}
        </div>
      </div>

      <!-- DELIVERY ADDRESS -->
      <div class="text-overline text-medium-emphasis">Delivery address</div>
      <v-card class="mb-4" variant="outlined">
        <v-card-text>
          <div class="text-body-2">
            {{ session.customer?.town }}, {{ session.customer?.district_name }}
          </div>
          <div class="text-body-2 text-medium-emphasis">
            {{ session.customer?.region_name }}
          </div>
          <div v-if="session.customer?.landmark" class="text-body-2 mt-2">
            <v-icon size="18" start>mdi-sign-direction</v-icon>
            {{ session.customer.landmark }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" variant="text" @click="openEdit">
            <v-icon start>mdi-pencil</v-icon>
            Edit
          </v-btn>
        </v-card-actions>
      </v-card>

      <v-list class="mb-4" density="comfortable">
        <v-list-item prepend-icon="mdi-lock-reset" @click="showPassword = true">
          <v-list-item-title>Change password</v-list-item-title>
        </v-list-item>
        <v-list-item
          base-color="error"
          prepend-icon="mdi-logout"
          @click="confirmSignOut = true"
        >
          <v-list-item-title>Sign out</v-list-item-title>
        </v-list-item>
      </v-list>

      <div style="height: 80px" />
    </v-container>

    <!-- EDIT ADDRESS -->
    <v-dialog v-model="showEdit" max-width="520" scrollable>
      <v-card>
        <v-card-title>Delivery address</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" autocomplete="off" label="Shop / business name" />
          <v-select
            v-model="form.region_id"
            item-title="name"
            item-value="id"
            :items="regions"
            label="Region"
            @update:model-value="form.district_id = null"
          />
          <v-select
            v-model="form.district_id"
            :disabled="!form.region_id"
            item-title="name"
            item-value="id"
            :items="districtsForRegion"
            label="District"
          />
          <v-text-field v-model="form.town" autocomplete="off" label="Town or street" />
          <v-textarea
            v-model="form.landmark"
            auto-grow
            autocomplete="off"
            label="Nearby landmark"
            rows="2"
            variant="outlined"
          />
          <v-alert
            v-if="editError"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ editError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEdit = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveProfile">
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- CHANGE PASSWORD -->
    <v-dialog v-model="showPassword" max-width="420">
      <v-card>
        <v-card-title>Change password</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="passwordForm.current"
            autocomplete="off"
            label="Current password"
            type="password"
          />
          <v-text-field
            v-model="passwordForm.next"
            autocomplete="off"
            label="New password"
            type="password"
          />
          <v-alert
            v-if="passwordError"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ passwordError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showPassword = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="!passwordForm.current || !passwordForm.next"
            :loading="changingPassword"
            @click="savePassword"
          >
            Change
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- SIGN OUT -->
    <v-dialog v-model="confirmSignOut" max-width="400">
      <v-card>
        <v-card-title>Sign out?</v-card-title>
        <v-card-text>
          You'll need your phone number and password to sign back in.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmSignOut = false">Stay</v-btn>
          <v-btn color="error" @click="doSignOut">Sign out</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
  import { computed, reactive, ref } from "vue";
  import { useRouter } from "vue-router";
  import { api } from "@/lib/api";
  import { changePassword, session, signOut, updateProfile } from "@/lib/auth";
  import { notify, notifyError } from "@/lib/toast";

  const router = useRouter();

  const regions = ref([]);
  const allDistricts = ref([]);

  const showEdit = ref(false);
  const saving = ref(false);
  const editError = ref("");

  const form = reactive({
    name: "",
    region_id: null,
    district_id: null,
    town: "",
    landmark: "",
  });

  const districtsForRegion = computed(() =>
    allDistricts.value.filter(d => d.region_id === form.region_id),
  );

  async function openEdit () {
    editError.value = "";
    Object.assign(form, {
      name: session.customer?.name || "",
      region_id: session.customer?.region_id || null,
      district_id: session.customer?.district_id || null,
      town: session.customer?.town || "",
      landmark: session.customer?.landmark || "",
    });
    showEdit.value = true;

    if (regions.value.length === 0) {
      try {
        const [regionData, districtData] = await Promise.all([
          api("/geo/regions"),
          api("/geo/districts"),
        ]);
        regions.value = regionData.data;
        allDistricts.value = districtData.data;
      } catch (error) {
        editError.value = error.message;
      }
    }
  }

  async function saveProfile () {
    editError.value = "";
    saving.value = true;
    try {
      await updateProfile({ ...form });
      showEdit.value = false;
      notify("Address updated");
    } catch (error) {
      editError.value = error.message;
    } finally {
      saving.value = false;
    }
  }

  const showPassword = ref(false);
  const changingPassword = ref(false);
  const passwordError = ref("");
  const passwordForm = reactive({ current: "", next: "" });

  async function savePassword () {
    passwordError.value = "";
    changingPassword.value = true;
    try {
      await changePassword(passwordForm.current, passwordForm.next);
      showPassword.value = false;
      passwordForm.current = "";
      passwordForm.next = "";
      notify("Password changed");
    } catch (error) {
      passwordError.value = error.message;
    } finally {
      changingPassword.value = false;
    }
  }

  const confirmSignOut = ref(false);

  async function doSignOut () {
    try {
      await signOut();
      confirmSignOut.value = false;
      router.replace("/welcome");
    } catch (error) {
      notifyError(error);
    }
  }
</script>
