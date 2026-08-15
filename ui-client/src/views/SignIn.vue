<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8">
        <v-btn
          class="mb-4"
          icon="mdi-arrow-left"
          size="small"
          variant="text"
          @click="$router.push('/welcome')"
        />

        <h1 class="text-h5 font-weight-bold mb-1">Welcome back</h1>
        <p class="text-body-2 text-medium-emphasis mb-6">
          Sign in with the phone number you registered with.
        </p>

        <v-form @submit.prevent="submit">
          <v-text-field
            v-model="phone"
            autocomplete="off"
            hint="e.g. 0712 345 678"
            inputmode="tel"
            label="Phone number"
            prepend-inner-icon="mdi-phone"
          />

          <v-text-field
            v-model="password"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            autocomplete="off"
            label="Password"
            prepend-inner-icon="mdi-lock"
            :type="showPassword ? 'text' : 'password'"
            @click:append-inner="showPassword = !showPassword"
          />

          <v-alert
            v-if="error"
            class="mb-4"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ error }}
          </v-alert>

          <v-btn
            block
            color="primary"
            :disabled="!phone || !password"
            :loading="loading"
            size="large"
            type="submit"
          >
            Sign in
          </v-btn>
        </v-form>

        <div class="text-center mt-6">
          <span class="text-body-2 text-medium-emphasis">
            Don't have an account?
          </span>
          <v-btn
            class="ml-1"
            color="primary"
            size="small"
            variant="text"
            @click="$router.push('/register')"
          >
            Register
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
  import { ref } from "vue";
  import { useRouter } from "vue-router";
  import { login } from "@/lib/auth";
  import { notify } from "@/lib/toast";

  const router = useRouter();

  const phone = ref("");
  const password = ref("");
  const showPassword = ref(false);
  const loading = ref(false);
  const error = ref("");

  async function submit () {
    error.value = "";
    loading.value = true;
    try {
      const customer = await login(phone.value, password.value);
      notify(`Welcome back, ${customer.name}`);
      router.replace("/shop");
    } catch (error_) {
      error.value = error_.message;
    } finally {
      loading.value = false;
    }
  }
</script>
