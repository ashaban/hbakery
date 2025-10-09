<template>
  <v-app-bar app clipped-left clipped-right color="#18794f">
    <v-app-bar-nav-icon class="ml-2">
      <img height="40" src="/mkate.jpeg" width="40">
    </v-app-bar-nav-icon>

    <v-app-bar-title class="text-center text-yellow font-weight-bold">
      <!-- Hanein Investment | Bakery Management System -->
    </v-app-bar-title>

    <v-spacer />

    <div class="d-flex align-center">
      <v-btn
        class="mr-2"
        color="red"
        dark
        icon
        title="Help"
      >
        <v-icon>mdi-bell-badge-outline</v-icon>
      </v-btn>

      <div class="text-yellow font-weight-bold mr-2">
        {{ $store.state.auth.name }}
      </div>

      <v-menu offset-y>
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            class="text-lowercase mr-2"
            color="yellow"
            variant="text"
          >
            {{ language }}
          </v-btn>
        </template>
        <v-list>
          <v-list-item
            v-for="lang in availableLocales"
            :key="lang.value"
            @click="changeLanguage(lang.value)"
          >
            <v-list-item-title>{{ lang.text }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-btn
        color="white"
        dark
        icon
        title="Logout"
        @click="$router.push('/Logout')"
      >
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </div>
  </v-app-bar>
</template>

<script setup>
  import { ref } from 'vue'
  import { setI18nLanguage } from '@/i18n'
  import { useI18n } from 'vue-i18n'

  const { locale } = useI18n()
  const language = ref('English')
  const loading = ref(false)
  const availableLocales = ref([{
    text: 'English',
    value: 'en',
  }, {
    text: 'Kiswahili',
    value: 'sw',
  }])
  language.value = availableLocales.value.find(lang => {
    return lang.value === locale.value
  }).text

  const changeLanguage = async newLocale => {
    language.value = availableLocales.value.find(lang => {
      return lang.value === newLocale
    }).text
    loading.value = true
    try {
      await setI18nLanguage(newLocale)
      localStorage.setItem('user-locale', newLocale)
    } catch (e) {
      console.error('Failed to change language:', e)
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped>
.v-app-bar-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: fit-content;
}

.v-btn {
  min-width: 0 !important;
}
</style>
