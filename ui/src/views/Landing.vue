<template>
  <v-app>
    <!-- Navigation Bar -->
    <v-app-bar
      app
      color="#18794f"
      elevate-on-scroll
      style="position: fixed;"
    >
      <v-app-bar-nav-icon class="ml-2">
        <img height="40" src="/mkate.jpeg" width="40">
      </v-app-bar-nav-icon>

      <v-app-bar-title class="text-center text-yellow font-weight-bold">
        WADAU KILIMO PORTAL
      </v-app-bar-title>

      <v-spacer />
      <div class="d-flex align-center mr-4">
        <v-btn
          v-for="item in navItems"
          :key="item.title"
          class="text-white mx-0"
          :href="item.link"
          variant="text"
          @click="item.action"
        >
          {{ item.title }}
        </v-btn>

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
          class="text-green-darken-4 font-weight-bold"
          color="yellow"
          @click="goToLogin"
        >
          Login
          <v-icon end>mdi-login</v-icon>
        </v-btn>
      </div>
    </v-app-bar>

    

    <!-- Footer -->
    <v-footer class="text-white" color="#18794f">
      <v-container>
        <v-row>
          <v-col cols="12" md="4">
            <h3 class="text-h5 text-yellow mb-4">WADAU KILIMO PORTAL</h3>
            <p class="text-body-2">
              Ministry of Agriculture<br>
              Government of Tanzania<br>
              P.O. Box 9192, Dar es Salaam
            </p>
          </v-col>

          <v-col cols="12" md="4">
            <h3 class="text-h5 text-yellow mb-4">Quick Links</h3>
            <v-list bg-color="transparent" class="text-white" density="compact">
              <v-list-item
                v-for="item in footerLinks"
                :key="item.title"
                class="text-white"
                :href="item.link"
                :title="item.title"
              />
            </v-list>
          </v-col>

          <v-col cols="12" md="4">
            <h3 class="text-h5 text-yellow mb-4">Contact Us</h3>
            <v-list bg-color="transparent" class="text-white" density="compact">
              <v-list-item prepend-icon="mdi-email" title="info@kilimo.go.tz" />
              <v-list-item prepend-icon="mdi-phone" title="+255 22 123 4567" />
              <v-list-item prepend-icon="mdi-map-marker" title="Dar es Salaam, Tanzania" />
            </v-list>
          </v-col>
        </v-row>

        <v-divider class="my-4" color="yellow" />

        <v-row>
          <v-col class="text-center" cols="12">
            <p class="text-body-2">
              &copy; {{ new Date().getFullYear() }} Ministry of Agriculture, Tanzania. All rights reserved.
            </p>
          </v-col>
        </v-row>
      </v-container>
    </v-footer>
  </v-app>
</template>

<script setup>
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { setI18nLanguage } from '@/i18n'
  import { useI18n } from 'vue-i18n'
  import StatusByCoverage from '@/components/reports/Charts/StatusByCoverage'

  const router = useRouter()
  const { locale } = useI18n()
  const language = ref('English')
  const reloadDashboards = ref(0)
  const benId = ref(1)

  const navItems = ref([
    { title: 'About', link: '#about', action: () => scrollTo('about') },
    { title: 'Dashboard', link: '#dashboard', action: () => scrollTo('dashboard') },
    { title: 'Genesis', link: '#genesis', action: () => scrollTo('genesis') },
    { title: 'Resources', link: '#resources', action: () => scrollTo('resources') },
    { title: 'Partners', link: '#partners', action: () => scrollTo('partners') },
  ])

  const objectives = ref([
    'Facilitate stakeholder collaboration in agriculture',
    'Provide real-time agricultural data and analytics',
    'Improve policy formulation and decision making',
    'Enhance transparency in agricultural programs',
    'Support digital transformation in agriculture',
  ])

  const stats = ref([
    { title: 'Registered Beneficiaries', value: '', icon: 'mdi-account-group' },
    { title: 'Agricultural Projects', value: '', icon: 'mdi-sprout' },
    { title: 'Partner Organizations', value: '', icon: 'mdi-handshake' },
  ])
  fetch(`/reports/getTotalBeneficiaries`).then(response => {
    response.json().then(response => {
      stats.value[0].value = response.total_beneficiaries
      stats.value[1].value = response.total_projects
    })
  })
  fetch(`/reports/getTotalPartners`).then(response => {
    response.json().then(response => {
      stats.value[2].value = response.dev_partners
    })
  })

  const resources = ref([
    {
      title: 'User Manuals',
      description: 'Comprehensive guides for using the portal',
      icon: 'mdi-book-open-variant',
      link: '/manuals.pdf',
    },
    {
      title: 'API Documentation',
      description: 'Technical documentation for developers',
      icon: 'mdi-api',
      link: '/api-docs.pdf',
    },
    {
      title: 'Annual Reports',
      description: 'Yearly performance and impact reports',
      icon: 'mdi-file-chart',
      link: '/reports.pdf',
    },
  ])

  const partners = ref([
    { name: 'AGRA', logo: '/logo.png', website: 'https://agra.org' },
    { name: 'World Bank', logo: '/world-bank.svg', website: 'https://worldbank.org' },
    { name: 'FAO', logo: '/fao-logo.svg', website: 'https://fao.org' },
    { name: 'IFAD', logo: '/ifad.png', website: 'https://ifad.org' },
    { name: 'EU', logo: '/eu.svg', website: 'https://europa.eu' },
  ])

  const footerLinks = ref([
    { title: 'Ministry Website', link: 'https://kilimo.go.tz' },
    { title: 'Agricultural Policy', link: '#' },
    { title: 'Research Publications', link: '#' },
    { title: 'Weather Data', link: '#' },
  ])

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
    try {
      await setI18nLanguage(newLocale)
      localStorage.setItem('user-locale', newLocale)
    } catch (e) {
      console.error('Failed to change language:', e)
    }
  }

  const scrollTo = sectionId => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const goToLogin = () => {
    router.push('/login')
  }

  const openPartnerWebsite = url => {
    window.open(url, '_blank')
  }
  onMounted(() => {
    benId.value++
    reloadDashboards.value++
  })
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

section {
  scroll-margin-top: 70px;
}
</style>
