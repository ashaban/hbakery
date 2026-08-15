<template>
  <div>
    <v-app-bar color="primary" flat>
      <v-app-bar-title class="font-weight-bold">Your basket</v-app-bar-title>
      <v-btn v-if="cart.lines.length" icon @click="confirmClear = true">
        <v-icon>mdi-delete-sweep</v-icon>
      </v-btn>
    </v-app-bar>

    <v-container fluid>
      <div
        v-if="cart.lines.length === 0"
        class="text-center py-12 text-medium-emphasis"
      >
        <v-icon size="56">mdi-cart-outline</v-icon>
        <div class="text-h6 mt-3">Your basket is empty</div>
        <div class="text-body-2 mt-1">Add products to place an order.</div>
        <v-btn class="mt-6" color="primary" @click="$router.push('/shop')">
          Browse products
        </v-btn>
      </div>

      <template v-else>
        <v-card
          v-for="line in cart.lines"
          :key="line.product_id"
          class="mb-3"
          variant="outlined"
        >
          <v-card-text>
            <div class="d-flex align-center mb-3">
              <div class="flex-grow-1">
                <div class="text-subtitle-1 font-weight-bold">
                  {{ line.name }}
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  {{ money(line.price) }} per {{ line.unit || "unit" }}
                </div>
              </div>
              <v-btn
                color="error"
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                @click="removeFromCart(line.product_id)"
              />
            </div>

            <div class="d-flex align-center">
              <v-btn
                icon="mdi-minus"
                size="small"
                variant="tonal"
                @click="setQuantity(line.product_id, line.quantity - 1)"
              />
              <!-- Typing the number directly matters here: a shop
                   ordering 200 loaves should not tap + 200 times. -->
              <v-text-field
                class="mx-3"
                density="compact"
                hide-details
                inputmode="numeric"
                :model-value="line.quantity"
                style="max-width: 90px"
                type="number"
                @update:model-value="onQuantityTyped(line, $event)"
              />
              <v-btn
                icon="mdi-plus"
                size="small"
                variant="tonal"
                @click="setQuantity(line.product_id, line.quantity + 1)"
              />
              <v-spacer />
              <div class="text-subtitle-1 font-weight-bold">
                {{ money(line.quantity * line.price) }}
              </div>
            </div>
          </v-card-text>
        </v-card>

        <v-textarea
          v-model="notes"
          auto-grow
          autocomplete="off"
          class="mt-4"
          hint="Anything we should know, e.g. a preferred delivery time"
          label="Note for the bakery (optional)"
          rows="2"
          variant="outlined"
        />

        <v-card class="mt-4" color="primary" variant="tonal">
          <v-card-text>
            <div class="d-flex align-center">
              <div class="text-subtitle-1">Total</div>
              <v-spacer />
              <div class="text-h5 font-weight-bold">{{ money(cartTotal) }}</div>
            </div>
            <div class="text-caption text-medium-emphasis mt-1">
              We'll confirm your delivery day after you place the order.
            </div>
          </v-card-text>
        </v-card>

        <v-btn
          block
          class="mt-4"
          color="primary"
          :loading="placing"
          size="large"
          @click="submit"
        >
          Place order
        </v-btn>

        <div style="height: 80px" />
      </template>
    </v-container>

    <v-dialog v-model="confirmClear" max-width="400">
      <v-card>
        <v-card-title>Empty your basket?</v-card-title>
        <v-card-text>
          This removes everything you've added. It can't be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmClear = false">Keep it</v-btn>
          <v-btn color="error" @click="doClear">Empty basket</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
  import { ref } from "vue";
  import { useRouter } from "vue-router";
  import {
    cart,
    cartTotal,
    clearCart,
    placeOrder,
    removeFromCart,
    setQuantity,
  } from "@/lib/cart";
  import { money } from "@/lib/format";
  import { notify, notifyError } from "@/lib/toast";

  const router = useRouter();

  const notes = ref("");
  const placing = ref(false);
  const confirmClear = ref(false);

  function onQuantityTyped (line, value) {
    const n = Number(value);
    // An empty or half-typed field must not delete the line out from
    // under the customer mid-edit; only a deliberate 0 removes it.
    if (value === "" || Number.isNaN(n)) return;
    setQuantity(line.product_id, Math.max(0, Math.floor(n)));
  }

  function doClear () {
    clearCart();
    confirmClear.value = false;
    notify("Basket emptied", "info");
  }

  async function submit () {
    placing.value = true;
    try {
      const order = await placeOrder(notes.value);
      notes.value = "";
      notify("Order placed — we'll confirm your delivery day shortly");
      router.push(`/orders/${order.id}`);
    } catch (error) {
      notifyError(error);
    } finally {
      placing.value = false;
    }
  }
</script>
