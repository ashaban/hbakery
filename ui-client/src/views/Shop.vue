<template>
  <div>
    <v-app-bar color="primary" flat>
      <v-app-bar-title class="font-weight-bold">Our products</v-app-bar-title>
      <v-btn icon @click="load">
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </v-app-bar>

    <v-container fluid>
      <v-text-field
        v-model="search"
        autocomplete="off"
        class="mb-2"
        clearable
        density="compact"
        hide-details
        label="Search products"
        prepend-inner-icon="mdi-magnify"
      />

      <v-progress-linear v-if="loading" color="primary" indeterminate />

      <v-alert
        v-if="error"
        class="my-4"
        density="compact"
        type="error"
        variant="tonal"
      >
        {{ error }}
        <template #append>
          <v-btn size="small" variant="text" @click="load">Retry</v-btn>
        </template>
      </v-alert>

      <div
        v-if="!loading && !error && filtered.length === 0"
        class="text-center py-12 text-medium-emphasis"
      >
        <v-icon size="48">mdi-basket-off-outline</v-icon>
        <div class="mt-2">No products found.</div>
      </div>

      <v-card
        v-for="product in filtered"
        :key="product.id"
        class="mb-3"
        variant="outlined"
      >
        <v-card-text class="pb-2">
          <div class="d-flex align-center">
            <v-avatar class="mr-3" color="primary" size="44" variant="tonal">
              <v-icon>mdi-bread-slice</v-icon>
            </v-avatar>
            <div class="flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">
                {{ product.name }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ money(product.price) }} per {{ product.unit || "unit" }}
              </div>
            </div>
          </div>
          <div
            v-if="product.description"
            class="text-body-2 text-medium-emphasis mt-2"
          >
            {{ product.description }}
          </div>
        </v-card-text>

        <v-card-actions class="pt-0">
          <!-- Once it's in the basket the card turns into a stepper, so
               adjusting a quantity never means going to another screen. -->
          <template v-if="lineFor(product.id)">
            <v-btn
              icon="mdi-minus"
              size="small"
              variant="tonal"
              @click="decrement(product)"
            />
            <div class="mx-4 text-h6 font-weight-bold">
              {{ lineFor(product.id).quantity }}
            </div>
            <v-btn
              icon="mdi-plus"
              size="small"
              variant="tonal"
              @click="addToCart(product)"
            />
            <v-spacer />
            <div class="text-body-2 font-weight-bold">
              {{ money(lineFor(product.id).quantity * product.price) }}
            </div>
          </template>

          <template v-else>
            <v-spacer />
            <v-btn color="primary" @click="add(product)">
              <v-icon start>mdi-cart-plus</v-icon>
              Add
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>

      <!-- Room for the sticky bar + tab bar so the last card isn't
           trapped underneath them. -->
      <div style="height: 96px" />
    </v-container>

    <!-- Running total, always visible once something is in the basket -->
    <v-sheet v-if="cartCount > 0" class="cart-bar" color="primary" elevation="8">
      <div class="d-flex align-center pa-3">
        <div class="text-white">
          <div class="text-caption">
            {{ cartCount }} item{{ cartCount === 1 ? "" : "s" }}
          </div>
          <div class="text-h6 font-weight-bold">{{ money(cartTotal) }}</div>
        </div>
        <v-spacer />
        <v-btn color="white" variant="flat" @click="$router.push('/cart')">
          View basket
          <v-icon end>mdi-arrow-right</v-icon>
        </v-btn>
      </div>
    </v-sheet>
  </div>
</template>

<script setup>
  import { computed, onMounted, ref } from "vue";
  import { api } from "@/lib/api";
  import {
    addToCart,
    cartCount,
    cartTotal,
    lineFor,
    setQuantity,
  } from "@/lib/cart";
  import { money } from "@/lib/format";
  import { notify } from "@/lib/toast";

  const products = ref([]);
  const search = ref("");
  const loading = ref(false);
  const error = ref("");

  const filtered = computed(() => {
    const term = (search.value || "").trim().toLowerCase();
    if (!term) return products.value;
    return products.value.filter(p => p.name.toLowerCase().includes(term));
  });

  function add (product) {
    addToCart(product);
    notify(`${product.name} added`);
  }

  function decrement (product) {
    const line = lineFor(product.id);
    if (line) setQuantity(product.id, line.quantity - 1);
  }

  async function load () {
    loading.value = true;
    error.value = "";
    try {
      const data = await api("/shop/products");
      products.value = data.data;
    } catch (error_) {
      error.value = error_.message;
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);
</script>

<style scoped>
.cart-bar {
  position: fixed;
  left: 0;
  right: 0;
  /* Sits directly on top of the bottom tab bar. */
  bottom: calc(56px + env(safe-area-inset-bottom));
  z-index: 5;
}
</style>
