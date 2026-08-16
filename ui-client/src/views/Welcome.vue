<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8">
        <div class="text-center mb-10">
          <v-avatar class="mb-4" color="primary" size="88">
            <v-icon color="white" size="48">mdi-bread-slice</v-icon>
          </v-avatar>
          <h1 class="text-h4 font-weight-bold">{{ $t("app.name") }}</h1>
          <p class="text-body-1 text-medium-emphasis mt-2">
            {{ $t("welcome.tagline") }}
          </p>
        </div>

        <v-btn
          block
          color="primary"
          size="large"
          @click="$router.push('/register')"
        >
          {{ $t("welcome.createAccount") }}
        </v-btn>

        <v-btn
          block
          class="mt-3"
          color="primary"
          size="large"
          variant="outlined"
          @click="$router.push('/sign-in')"
        >
          {{ $t("welcome.haveAccount") }}
        </v-btn>

        <!-- Offered before sign-up, not just in Account: someone who
             wants English shouldn't have to register in Kiswahili first
             to find the setting. -->
        <div class="text-center mt-8">
          <v-btn-toggle
            border
            color="primary"
            density="compact"
            divided
            :model-value="language"
            mandatory
            @update:model-value="changeLanguage"
          >
            <v-btn
              v-for="option in SUPPORTED_LANGUAGES"
              :key="option.code"
              size="small"
              :value="option.code"
            >
              {{ option.label }}
            </v-btn>
          </v-btn-toggle>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
  import { ref } from "vue";
  import {
    SUPPORTED_LANGUAGES,
    currentLanguage,
    setLanguage,
  } from "@/lib/i18n";

  const language = ref(currentLanguage());

  async function changeLanguage (code) {
    if (!code || code === language.value) return;
    await setLanguage(code);
    language.value = code;
  }
</script>
