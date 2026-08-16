<template>
  <v-avatar class="staff-avatar" :color="color" :size="size">
    <span class="staff-avatar__text" :style="{ fontSize: `${Math.round(size * 0.4)}px` }">
      {{ initials }}
    </span>
    <v-tooltip v-if="tooltip && name" activator="parent" location="top">{{ name }}</v-tooltip>
  </v-avatar>
</template>

<script setup>
  import { computed } from "vue";

  const props = defineProps({
    name: { type: String, default: "" },
    size: { type: Number, default: 32 },
    tooltip: { type: Boolean, default: true },
  });

  const initials = computed(() =>
    (props.name || "?")
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase(),
  );

  // A stable colour per person, so the same face is the same colour on
  // every card — picked from the name rather than stored, since there is
  // no avatar image to fall back to.
  const PALETTE = [
    "#1867C0", "#2E7D32", "#C62828", "#EF6C00",
    "#6A1B9A", "#00838F", "#558B2F", "#4E342E",
  ];

  const color = computed(() => {
    const key = props.name || "?";
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return PALETTE[hash % PALETTE.length];
  });
</script>

<style scoped>
.staff-avatar__text {
  color: #fff;
  font-weight: 700;
  line-height: 1;
}
</style>
