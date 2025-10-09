<template>
  <div class="nature-login-container">
    <!-- Background Elements -->
    <div class="nature-bg-overlay" />
    <div class="nature-bg-pattern" />

    <!-- Main Card -->
    <v-card class="nature-login-card" elevation="12">
      <!-- Left Side - Visual -->
      <div class="nature-visual-side">
        <div class="nature-illustration">
          <v-img
            class="nature-illustration-img"
            contain
            src="/mkate.jpeg"
          />
        </div>
      </div>

      <!-- Right Side - Form -->
      <div class="nature-form-side">
        <div class="nature-form-header">
          <v-icon color="success" size="40">mdi-bread-slice</v-icon>
          <h2>Welcome to Bakery Management System</h2>
          <p>Sign in to your account</p>
        </div>

        <v-alert
          v-if="authStatus"
          class="nature-alert"
          density="compact"
          type="error"
          variant="tonal"
        >
          <strong>Invalid credentials</strong> - Please try again
        </v-alert>

        <v-form class="nature-form" @submit.prevent="authenticate">
          <v-text-field
            v-model="state.username"
            class="nature-input"
            color="success"
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
            class="nature-input"
            color="success"
            :error-messages="v$.password.$errors.map(e => e.$message)"
            label="Password"
            prepend-inner-icon="mdi-lock-outline"
            :type="password_show ? 'text' : 'password'"
            variant="outlined"
            @blur="v$.password.$touch"
            @click:append-inner="password_show = !password_show"
            @input="v$.password.$touch"
          />

          <div class="nature-actions">
            <v-spacer />
            <v-btn
              color="success"
              size="small"
              variant="text"
              @click="showForgotPassword = true"
            >
              Forgot password?
            </v-btn>
          </div>

          <v-btn
            block
            class="nature-submit-btn"
            color="success"
            :disabled="v$.$invalid"
            :loading="loading"
            size="large"
            type="submit"
          >
            <v-icon left>mdi-login-variant</v-icon>
            Sign In
          </v-btn>
        </v-form>
      </div>
    </v-card>

    <!-- Forgot Password Dialog -->
    <v-dialog v-model="showForgotPassword" max-width="500">
      <v-card class="nature-dialog">
        <v-card-title class="nature-dialog-title">
          <v-icon class="mr-2" color="success">mdi-key-variant</v-icon>
          Password Assistance
        </v-card-title>
        <v-card-text>
          <p>Enter your email address to receive password reset instructions.</p>
          <v-text-field
            class="nature-dialog-input"
            label="Email address"
            prepend-inner-icon="mdi-email-outline"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="success"
            variant="flat"
            @click="showForgotPassword = false"
          >
            Send Instructions
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
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
      const rememberMe = ref(false)
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
        loading.value = true;

        const formData = new FormData();
        formData.append('username', state.username);
        formData.append('password', state.password);

        fetch('/login/authenticate', {
          method: 'POST',
          body: formData,
        })
          .then(response => response.json())
          .then(authResp => {
            if (!authResp.token) {
              authStatus.value = true;
              return;
            }

            // Update Vue store
            store.state.auth.token = authResp.token;
            store.state.auth.username = state.username;
            store.state.auth.name = authResp.name;
            store.state.auth.role = authResp.role;
            store.state.auth.mda = authResp.mda;
            store.state.auth.dev_partner = authResp.dev_partner;

            // Save to localStorage
            localStorage.setItem('token', authResp.token);
            localStorage.setItem('username', state.username);
            localStorage.setItem('name', authResp.name);
            localStorage.setItem('role', authResp.role);
            localStorage.setItem('mda', authResp.mda);
            localStorage.setItem('dev_partner', authResp.dev_partner);

            store.state.denyAccess = false;
            router.push('/ReportsBase');
          })
          .catch(err => {
            console.error(err);
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
        rememberMe,
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
.nature-login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f8faf7;
  position: relative;
  overflow: hidden;
  padding: 20px;
}

.nature-bg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(24, 121, 79, 0.05) 0%, rgba(46, 139, 87, 0.1) 100%);
  z-index: 0;
}

.nature-bg-pattern {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/agriculture-pattern.svg');
  background-size: 400px;
  opacity: 0.03;
  z-index: 0;
}

.nature-login-card {
  display: flex;
  max-width: 1000px;
  width: 100%;
  min-height: 600px;
  border-radius: 16px;
  overflow: hidden;
  z-index: 1;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.nature-visual-side {
  flex: 1;
  background: linear-gradient(135deg, #e70725 0%, #690512 100%);
  /* padding: 40px; */
  display: flex;
  /* flex-direction: column; */
  color: white;
}

.nature-logo-container {
  margin-bottom: 40px;
}

.nature-illustration {
  height: 100%;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nature-illustration-img {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.2));
}

.nature-quote {
  text-align: center;
  margin-top: auto;
  padding-top: 20px;
}

.nature-quote h3 {
  font-weight: 300;
  font-size: 1.2rem;
  margin-bottom: 10px;
}

.nature-quote p {
  font-weight: 500;
  font-size: 0.9rem;
  opacity: 0.8;
}

.nature-divider {
  margin: 15px auto;
  width: 60px;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

.nature-form-side {
  flex: 1;
  padding: 60px 50px;
  background: white;
  display: flex;
  flex-direction: column;
}

.nature-form-header {
  text-align: center;
  margin-bottom: 40px;
}

.nature-form-header h1 {
  font-size: 1.8rem;
  color: #2d3748;
  margin: 15px 0 5px;
}

.nature-form-header p {
  color: #718096;
  font-size: 0.9rem;
}

.nature-alert {
  margin-bottom: 25px;
}

.nature-form {
  flex: 1;
}

.nature-input {
  margin-bottom: 20px;
}

.nature-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.nature-submit-btn {
  font-weight: 600;
  letter-spacing: 0.5px;
  height: 48px;
  text-transform: none;
  font-size: 1rem;
  margin-bottom: 25px;
}

.nature-form-divider {
  margin: 25px 0;
  color: #a0aec0;
}

.nature-social-login {
  margin-bottom: 30px;
}

.nature-social-btn {
  width: 100%;
  height: 48px;
  text-transform: none;
}

.nature-footer {
  text-align: center;
  margin-top: auto;
  color: #718096;
  font-size: 0.85rem;
}

.nature-footer p {
  margin-bottom: 5px;
}

.nature-version {
  font-size: 0.75rem;
  opacity: 0.7;
}

.nature-dialog {
  padding: 20px;
}

.nature-dialog-title {
  display: flex;
  align-items: center;
  color: #18794f;
  font-weight: 600;
}

.nature-dialog-input {
  margin-top: 20px;
}

/* Responsive adjustments */
@media (max-width: 900px) {
  .nature-visual-side {
    display: none;
  }

  .nature-form-side {
    padding: 40px 30px;
  }
}

@media (max-width: 600px) {
  .nature-login-container {
    padding: 10px;
  }

  .nature-login-card {
    min-height: auto;
  }

  .nature-form-side {
    padding: 30px 20px;
  }

  .nature-form-header h1 {
    font-size: 1.5rem;
  }
}
</style>
