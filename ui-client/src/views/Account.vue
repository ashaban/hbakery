<template>
  <div>
    <v-app-bar color="primary" flat>
      <v-app-bar-title class="font-weight-bold">
        {{ $t("account.title") }}
      </v-app-bar-title>
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
      <div class="text-overline text-medium-emphasis">
        {{ $t("account.deliveryAddress") }}
      </div>
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
            {{ $t("account.edit") }}
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- LANGUAGE -->
      <div class="text-overline text-medium-emphasis">
        {{ $t("common.language") }}
      </div>
      <v-card class="mb-4" variant="outlined">
        <v-card-text>
          <v-btn-toggle
            border
            color="primary"
            divided
            :model-value="language"
            mandatory
            @update:model-value="changeLanguage"
          >
            <v-btn
              v-for="option in SUPPORTED_LANGUAGES"
              :key="option.code"
              :value="option.code"
            >
              {{ option.label }}
            </v-btn>
          </v-btn-toggle>
        </v-card-text>
      </v-card>

      <v-list class="mb-4" density="comfortable">
        <v-list-item prepend-icon="mdi-lock-reset" @click="showPassword = true">
          <v-list-item-title>{{ $t("account.changePassword") }}</v-list-item-title>
        </v-list-item>
        <v-list-item
          base-color="error"
          prepend-icon="mdi-logout"
          @click="confirmSignOut = true"
        >
          <v-list-item-title>{{ $t("account.signOut") }}</v-list-item-title>
        </v-list-item>
      </v-list>

      <div style="height: 80px" />
    </v-container>

    <!-- EDIT ADDRESS -->
    <v-dialog v-model="showEdit" max-width="520" scrollable>
      <v-card>
        <v-card-title>{{ $t("account.deliveryAddress") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="form.name"
            autocomplete="off"
            :label="$t('register.shopName')"
          />
          <v-select
            v-model="form.region_id"
            item-title="name"
            item-value="id"
            :items="regions"
            :label="$t('register.region')"
            @update:model-value="form.district_id = null"
          />
          <v-select
            v-model="form.district_id"
            :disabled="!form.region_id"
            item-title="name"
            item-value="id"
            :items="districtsForRegion"
            :label="$t('register.district')"
          />
          <v-text-field
            v-model="form.town"
            autocomplete="off"
            :label="$t('register.town')"
          />
          <v-textarea
            v-model="form.landmark"
            auto-grow
            autocomplete="off"
            :label="$t('register.landmark')"
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
          <v-btn variant="text" @click="showEdit = false">
            {{ $t("common.cancel") }}
          </v-btn>
          <v-btn color="primary" :loading="saving" @click="saveProfile">
            {{ $t("common.save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- CHANGE PASSWORD -->
    <v-dialog v-model="showPassword" max-width="420">
      <v-card>
        <v-card-title>{{ $t("account.changePassword") }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="passwordForm.current"
            autocomplete="off"
            :label="$t('account.currentPassword')"
            type="password"
          />
          <v-text-field
            v-model="passwordForm.next"
            autocomplete="off"
            :label="$t('account.newPassword')"
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
          <v-btn variant="text" @click="showPassword = false">
            {{ $t("common.cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!passwordForm.current || !passwordForm.next"
            :loading="changingPassword"
            @click="savePassword"
          >
            {{ $t("account.change") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- SIGN OUT -->
    <v-dialog v-model="confirmSignOut" max-width="400">
      <v-card>
        <v-card-title>{{ $t("account.signOutTitle") }}</v-card-title>
        <v-card-text>
          {{ $t("account.signOutBody") }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmSignOut = false">
            {{ $t("account.stay") }}
          </v-btn>
          <v-btn color="error" @click="doSignOut">
            {{ $t("account.signOut") }}
          </v-btn>
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
  import {
    SUPPORTED_LANGUAGES,
    currentLanguage,
    setLanguage,
    t,
  } from "@/lib/i18n";
  import { notify, notifyError } from "@/lib/toast";

  const router = useRouter();

  // Tracked separately from i18n's own locale ref so the toggle stays a
  // controlled component and reflects a change made anywhere else.
  const language = ref(currentLanguage());

  async function changeLanguage (code) {
    if (!code || code === language.value) return;
    await setLanguage(code);
    language.value = code;
    notify(t("account.languageChanged"));
  }

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
      notify(t("account.addressUpdated"));
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
      notify(t("account.passwordChanged"));
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
