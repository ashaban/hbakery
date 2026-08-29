<template>
  <!--
    Renders nothing at all on the live site, so this can sit in the header
    unconditionally and no one has to remember to strip it before a release.
  -->
  <div
    v-if="label"
    class="instance-badge"
    :title="`You are on the ${label} instance — ${host}`"
  >
    {{ label }}
  </div>
</template>

<script setup>
  import { onMounted } from "vue";

  /**
   * Which instance this is, worked out from the address bar.
   *
   * Decided at runtime rather than at build time on purpose: the built SPA is
   * committed to the repo and the same commit is deployed to both instances,
   * so a build-time flag would either be wrong on one of them or force two
   * separate builds of identical code.
   *
   * VITE_INSTANCE_LABEL overrides it, for a future staging box that does not
   * happen to live under a test.* name.
   */
  function detectLabel () {
    const forced = import.meta.env.VITE_INSTANCE_LABEL;
    if (forced) return String(forced).toUpperCase();

    const host = window.location.hostname;
    if (host.startsWith("test.")) return "TEST";
    if (host.startsWith("staging.")) return "STAGING";
    // Localhost is a test system too, and mistaking it for production is the
    // same class of mistake this badge exists to prevent.
    if (host === "localhost" || host === "127.0.0.1") return "LOCAL";
    return "";
  }

  const label = detectLabel();
  const host = window.location.hostname;

  onMounted(() => {
    // The tab title as well: a tester with both sites open sees which is
    // which without switching to the tab first.
    if (label && !document.title.startsWith(label)) {
      document.title = `${label} — ${document.title}`;
    }
  });
</script>

<style scoped>
  /*
    Deliberately loud. A badge that blends into the header defeats the point:
    the cost of it being ugly is nil, and the cost of someone entering real
    orders into the test system is not.
  */
  .instance-badge {
    background: #fff;
    color: #d50000;
    font-size: 1.5rem;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.12em;
    padding: 4px 14px;
    border: 2px solid #d50000;
    border-radius: 6px;
    white-space: nowrap;
    flex: 0 0 auto;
  }

  @media (max-width: 600px) {
    .instance-badge {
      font-size: 1.05rem;
      padding: 3px 8px;
      letter-spacing: 0.08em;
    }
  }
</style>
