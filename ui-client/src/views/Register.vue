<template>
  <v-container fluid>
    <v-row justify="center">
      <v-col cols="12" sm="9">
        <v-btn
          class="mb-4"
          icon="mdi-arrow-left"
          size="small"
          variant="text"
          @click="$router.push('/welcome')"
        />

        <h1 class="text-h5 font-weight-bold mb-1">{{ $t("register.title") }}</h1>
        <p class="text-body-2 text-medium-emphasis mb-6">
          {{ $t("register.subtitle") }}
        </p>

        <v-form @submit.prevent="submit">
          <div class="text-overline text-medium-emphasis">
            {{ $t("register.yourDetails") }}
          </div>

          <v-text-field
            v-model="form.name"
            autocomplete="off"
            :hint="$t('register.shopNameHint')"
            :label="$t('register.shopName')"
            prepend-inner-icon="mdi-store"
          />

          <v-text-field
            v-model="form.phone"
            autocomplete="off"
            :hint="$t('register.phoneHint')"
            inputmode="tel"
            :label="$t('register.phone')"
            prepend-inner-icon="mdi-phone"
          />

          <v-text-field
            v-model="form.password"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            autocomplete="off"
            :label="$t('register.password')"
            prepend-inner-icon="mdi-lock"
            :type="showPassword ? 'text' : 'password'"
            @click:append-inner="showPassword = !showPassword"
          />

          <div class="text-overline text-medium-emphasis mt-4">
            {{ $t("register.whereYouAre") }}
          </div>

          <v-select
            v-model="form.region_id"
            item-title="name"
            item-value="id"
            :items="regions"
            :loading="loadingGeo"
            :label="$t('register.region')"
            prepend-inner-icon="mdi-map"
            @update:model-value="onRegionChange"
          />

          <v-select
            v-model="form.district_id"
            :disabled="!form.region_id"
            item-title="name"
            item-value="id"
            :items="districts"
            :label="$t('register.district')"
            prepend-inner-icon="mdi-map-marker-radius"
          />

          <v-text-field
            v-model="form.town"
            autocomplete="off"
            :label="$t('register.town')"
            prepend-inner-icon="mdi-road"
          />

          <v-textarea
            v-model="form.landmark"
            auto-grow
            autocomplete="off"
            :hint="$t('register.landmarkHint')"
            :label="$t('register.landmark')"
            persistent-hint
            prepend-inner-icon="mdi-sign-direction"
            rows="2"
            variant="outlined"
          />

          <v-alert
            v-if="error"
            class="mt-4"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ error }}
          </v-alert>

          <v-btn
            block
            class="mt-6 mb-8"
            color="primary"
            :disabled="!canSubmit"
            :loading="loading"
            size="large"
            type="submit"
          >
            {{ $t("register.submit") }}
          </v-btn>
        </v-form>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, reactive, ref } from "vue";
  import { useRouter } from "vue-router";
  import { api } from "@/lib/api";
  import { register } from "@/lib/auth";
  import { t } from "@/lib/i18n";
  import { notify } from "@/lib/toast";

  const router = useRouter();

  const regions = ref([]);
  const allDistricts = ref([]);
  const loadingGeo = ref(false);
  const loading = ref(false);
  const error = ref("");
  const showPassword = ref(false);

  const form = reactive({
    name: "",
    phone: "",
    password: "",
    region_id: null,
    district_id: null,
    town: "",
    landmark: "",
  });

  const districts = computed(() =>
    allDistricts.value.filter(d => d.region_id === form.region_id),
  );

  const canSubmit = computed(
    () =>
      form.name.trim() &&
      form.phone.trim() &&
      form.password.length >= 4 &&
      form.region_id &&
      form.district_id &&
      form.town.trim() &&
      form.landmark.trim(),
  );

  function onRegionChange () {
    // Whatever district was picked belongs to the old region, so it
    // can't stay selected.
    form.district_id = null;
  }

  // Both lists are fetched once up front: the whole set is small, and it
  // means changing region doesn't need a round trip on a slow phone.
  async function loadGeography () {
    loadingGeo.value = true;
    try {
      const [regionData, districtData] = await Promise.all([
        api("/geo/regions"),
        api("/geo/districts"),
      ]);
      regions.value = regionData.data;
      allDistricts.value = districtData.data;
    } catch (error_) {
      error.value = error_.message;
    } finally {
      loadingGeo.value = false;
    }
  }

  async function submit () {
    error.value = "";
    loading.value = true;
    try {
      const customer = await register({ ...form });
      notify(t("register.welcome", { name: customer.name }));
      router.replace("/shop");
    } catch (error_) {
      error.value = error_.message;
    } finally {
      loading.value = false;
    }
  }

  onMounted(loadGeography);
</script>
