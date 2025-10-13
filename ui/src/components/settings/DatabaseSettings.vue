<template>
  <v-container class="pa-4" fluid>
    <v-card class="rounded-xl elevation-3" min-height="80vh">
      <!-- Header -->
      <v-card-item class="bg-primary">
        <v-card-title class="text-white">
          <v-icon class="mr-3" icon="mdi-cog-outline" size="x-large" />
          <span class="text-h4 font-weight-bold">Database Configuration</span>
        </v-card-title>
        <v-card-subtitle class="text-white">Manage dropdown lists and reference data</v-card-subtitle>
      </v-card-item>

      <!-- Main Content -->
      <v-row class="h-100" no-gutters>
        <!-- Desktop Navigation -->
        <v-col class="bg-grey-lighten-4" cols="12" md="3">
          <v-list class="py-2" nav>
            <v-list-subheader class="text-h6 text-primary mt-2">SETTINGS MENU</v-list-subheader>
            <v-divider class="my-2" />

            <v-list-item
              v-for="(item, key) in menuItems"
              :key="key"
              :active="selectedComponent === key"
              class="my-1 mx-2"
              rounded="xl"
              :value="key"
              @click="loadComponent(key)"
            >
              <template #prepend>
                <v-icon :color="selectedComponent === key ? 'primary' : ''" :icon="item.icon" />
              </template>

              <v-list-item-title class="font-weight-medium">
                {{ item.label }}
              </v-list-item-title>

              <template v-if="selectedComponent === key" #append>
                <v-icon color="primary" icon="mdi-chevron-right" />
              </template>
            </v-list-item>
          </v-list>
        </v-col>

        <!-- Mobile Navigation -->
        <v-col class="d-md-none pa-2 bg-grey-lighten-4" cols="12">
          <v-slide-group
            v-model="selectedComponent"
            center-active
            show-arrows
          >
            <v-slide-group-item
              v-for="(item, key) in menuItems"
              :key="key"
              v-slot="{ isSelected, toggle }"
            >
              <v-btn
                class="ma-1 text-capitalize"
                :color="isSelected ? 'primary' : 'grey-lighten-3'"
                rounded="pill"
                :variant="isSelected ? 'flat' : 'text'"
                @click="() => { loadComponent(key); toggle(); }"
              >
                <v-icon :icon="item.icon" start />
                {{ item.label }}
              </v-btn>
            </v-slide-group-item>
          </v-slide-group>
        </v-col>

        <!-- Content Area -->
        <v-col class="pa-6" cols="12" md="9">
          <v-fade-transition mode="out-in">
            <div class="d-flex flex-column h-100">
              <div class="d-flex align-center mb-6">
                <v-icon class="mr-3" color="primary" :icon="currentItem.icon" size="large" />
                <h2 class="text-h4 font-weight-bold text-primary">{{ currentItem.label }}</h2>
              </div>

              <v-card class="flex-grow-1" rounded="lg" variant="outlined">
                <component :is="settingComponent" />
              </v-card>
            </div>
          </v-fade-transition>
        </v-col>
      </v-row>
    </v-card>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, ref } from 'vue'

  const selectedComponent = ref('ItemUnit')
  const settingComponent = ref(null)

  const menuItems = {
    ItemUnit: { label: 'Ingredients Units', icon: 'mdi-domain' },
    Item: { label: 'Ingredients', icon: 'mdi-domain' },
    Products: { label: 'Products', icon: 'mdi-domain' },
  }

  const currentItem = computed(() => menuItems[selectedComponent.value] || menuItems.ItemUnit)

  const loadComponent = async component => {
    try {
      // Dynamically import the component
      const module = await import(`../../components/settings/${component}.vue`)
      settingComponent.value = module.default
      selectedComponent.value = component
    } catch (error) {
      console.error(`Error loading component ${component}:`, error)
      // Fallback to default component
      const module = await import(`../../components/settings/ItemUnit.vue`)
      settingComponent.value = module.default
      selectedComponent.value = 'ItemUnit'
    }
  }

  onMounted(() => loadComponent('ItemUnit'))
</script>

<style scoped>
.v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
  color: rgb(var(--v-theme-primary)) !important;
}

.v-list-item--active .v-icon {
  color: rgb(var(--v-theme-primary)) !important;
}

.v-slide-group__content {
  padding: 4px 0;
}

.v-card {
  transition: all 0.3s ease;
}
</style>
