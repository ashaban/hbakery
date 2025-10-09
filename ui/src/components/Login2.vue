<template>
  <v-container class="login-container">
    <v-row class="justify-center">
      <v-col cols="12" lg="6" md="8" xl="5">
        <v-card class="login-card" elevation="10">
          <!-- Header Section -->
          <div class="login-header">
            <v-row>
              <v-col cols="3">
                <v-img
                  class="mb-4"
                  contain
                  max-height="80"
                  src="/coat_arm.png"
                />
              </v-col>
              <v-col class="text-center" cols="6">
                <v-icon class="mb-2" color="white" size="40">mdi-leaf</v-icon>
                <h1 class="login-title">AgriTrack Portal</h1>
                <p class="login-subtitle">Ministry of Agriculture</p>
              </v-col>
              <v-col cols="3">
                <v-img
                  class="mb-4"
                  contain
                  max-height="80"
                  src="/logo.png"
                />
              </v-col>
            </v-row>
          </div>

          <!-- Error Message -->
          <v-alert
            v-if="authStatus"
            class="mb-4"
            type="error"
            variant="tonal"
          >
            <strong>Authentication Failed</strong> - Please check your credentials
          </v-alert>
          <br>

          <!-- Login Form -->
          <v-form
            ref="form"
            class="px-6 pb-6"
            @submit.prevent="authenticate"
          >
            <v-text-field
              v-model="state.username"
              class="mb-4"
              color="primary"
              :error-messages="v$.username.$errors.map(e => e.$message)"
              label="Username"
              prepend-inner-icon="mdi-account-outline"
              variant="outlined"
              @blur="v$.username.$touch"
              @input="v$.username.$touch"
            />

            <v-text-field
              v-model="state.password"
              :append-inner-icon="password_show ? 'mdi-eye' : 'mdi-eye-off'"
              class="mb-2"
              color="primary"
              :error-messages="v$.password.$errors.map(e => e.$message)"
              label="Password"
              prepend-inner-icon="mdi-lock-outline"
              :type="password_show ? 'text' : 'password'"
              variant="outlined"
              @blur="v$.password.$touch"
              @click:append-inner="password_show = !password_show"
              @input="v$.password.$touch"
            />

            <div class="text-right mb-6">
              <v-btn
                color="primary"
                size="small"
                variant="text"
                @click="showForgotPassword = true"
              >
                Forgot Password?
              </v-btn>
            </div>

            <v-btn
              block
              class="login-btn"
              color="primary"
              :disabled="v$.$invalid"
              :loading="loading"
              size="large"
              type="submit"
            >
              <v-icon left>mdi-login</v-icon>
              Sign In
            </v-btn>
          </v-form>

          <!-- Footer -->
          <v-card-actions class="login-footer px-6 pb-4">
            <v-spacer />
            <span class="text-caption text-medium-emphasis">
              v{{ appVersion }} © {{ new Date().getFullYear() }} Ministry of Agriculture
            </span>
            <v-spacer />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Forgot Password Dialog -->
    <v-dialog v-model="showForgotPassword" max-width="500">
      <v-card>
        <v-card-title class="d-flex justify-space-between">
          <span>Reset Password</span>
          <v-btn icon @click="showForgotPassword = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <p>Please contact the system administrator to reset your password.</p>
          <v-text-field
            class="mt-4"
            label="Email"
            prepend-inner-icon="mdi-email-outline"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" @click="showForgotPassword = false">
            Submit Request
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
  import { reactive, ref } from 'vue'
  import { useStore } from 'vuex'
  import { useRouter } from 'vue-router'
  import { useVuelidate } from '@vuelidate/core'
  import { required } from '@vuelidate/validators'
  import VueCookies from 'vue-cookies';

  export default {
    setup () {
      const store = useStore()
      const router = useRouter()
      const authStatus = ref(false)
      const password_show = ref(false)
      const loading = ref(false)
      const showForgotPassword = ref(false)
      const appVersion = ref(process.env.VUE_APP_VERSION || '1.0.0')

      const state = reactive({
        username: '',
        password: '',
      })

      const rules = {
        username: { required },
        password: { required },
      }

      const v$ = useVuelidate(rules, state)

      function authenticate () {
        loading.value = true
        const formData = new FormData();
        formData.append('username', state.username);
        formData.append('password', state.password);

        fetch('/login/authenticate', {
          body: formData,
          method: 'POST',
        })
          .then(response => {
            response.json().then(authResp => {
              store.state.auth.token = authResp.token;
              store.state.auth.username = state.username;
              store.state.auth.name = authResp.name;
              store.state.auth.role = authResp.role;
              store.state.auth.mda = authResp.mda;
              store.state.auth.dev_partner = authResp.dev_partner;

              VueCookies.config('30d');
              VueCookies.set('token', store.state.auth.token, 'infinity');
              VueCookies.set('name', store.state.auth.name, 'infinity');
              VueCookies.set('role', store.state.auth.role, 'infinity');
              VueCookies.set('mda', store.state.auth.mda, 'infinity');
              VueCookies.set('dev_partner', store.state.auth.dev_partner, 'infinity');
              VueCookies.set('username', store.state.auth.username, 'infinity');

              if (!authResp.token) {
                authStatus.value = true;
              } else {
                store.state.denyAccess = false;
                router.push('/ReportsBase');
              }
            })
          })
          .catch(err => {
            console.log(err);
            authStatus.value = true;
          })
          .finally(() => {
            loading.value = false;
          });
      }

      return {
        password_show,
        authStatus,
        loading,
        showForgotPassword,
        appVersion,
        state,
        authenticate,
        v$,
      }
    },
  };
</script>

<style scoped>
.login-container {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4f0f9 100%);
  height: 100vh;
  display: flex;
  align-items: center;
}

.login-card {
  border-radius: 16px;
  overflow: hidden;
  background: white;
}

.login-header {
  background: linear-gradient(135deg, #18794f 0%, #2e8b57 100%);
  padding: 2rem;
  color: white;
  text-align: center;
}

.login-title {
  color: white;
  font-weight: 700;
  font-size: 1.8rem;
  margin-bottom: 0.25rem;
}

.login-subtitle {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
  margin-bottom: 0;
}

.login-btn {
  font-weight: 600;
  letter-spacing: 0.5px;
  height: 48px;
  text-transform: none;
  font-size: 1rem;
}

.login-footer {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

/* Animation for form elements */
.v-text-field {
  transition: all 0.3s ease;
}

.v-text-field:focus-within {
  transform: translateY(-2px);
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .login-card {
    border-radius: 0;
  }

  .login-header {
    padding: 1.5rem;
  }

  .login-title {
    font-size: 1.5rem;
  }
}
</style>
