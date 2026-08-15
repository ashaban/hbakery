// The basket, held in memory and mirrored to Capacitor Preferences so a
// half-built order survives the app being backgrounded and killed —
// which on Android happens routinely, and losing a 12-line order to it
// would be infuriating.
//
// Prices here are only ever used to show the customer a running total.
// The authoritative total is recalculated by the server when the order
// is placed, so a stale cached price can never become a charged price.

import { computed, reactive, watch } from "vue";
import { Preferences } from "@capacitor/preferences";
import { api } from "./api";

const CART_KEY = "hanein.customer.cart";

export const cart = reactive({ lines: [], loaded: false });

export const cartCount = computed(() =>
  cart.lines.reduce((sum, line) => sum + line.quantity, 0),
);

export const cartTotal = computed(() =>
  cart.lines.reduce((sum, line) => sum + line.quantity * Number(line.price), 0),
);

export async function loadCart () {
  try {
    const { value } = await Preferences.get({ key: CART_KEY });
    if (value) cart.lines = JSON.parse(value);
  } catch {
    cart.lines = [];
  } finally {
    cart.loaded = true;
  }
}

watch(
  () => cart.lines,
  lines => {
    if (!cart.loaded) return;
    Preferences.set({ key: CART_KEY, value: JSON.stringify(lines) }).catch(
      () => {},
    );
  },
  { deep: true },
);

export function lineFor (productId) {
  return cart.lines.find(line => line.product_id === productId);
}

export function addToCart (product, quantity = 1) {
  const existing = lineFor(product.id);
  if (existing) {
    existing.quantity += quantity;
    return;
  }
  cart.lines.push({
    product_id: product.id,
    name: product.name,
    unit: product.unit,
    price: Number(product.price),
    quantity,
  });
}

export function setQuantity (productId, quantity) {
  const line = lineFor(productId);
  if (!line) return;
  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  line.quantity = quantity;
}

export function removeFromCart (productId) {
  const index = cart.lines.findIndex(line => line.product_id === productId);
  if (index !== -1) cart.lines.splice(index, 1);
}

export function clearCart () {
  cart.lines = [];
}

export async function placeOrder (notes) {
  const order = await api("/shop/orders", {
    method: "POST",
    body: {
      notes: notes || null,
      items: cart.lines.map(line => ({
        product_id: line.product_id,
        quantity: line.quantity,
      })),
    },
  });
  clearCart();
  return order.data;
}
