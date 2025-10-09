<template>
  <v-container grid-list-xs />
</template>
<script>
  export default {
    mounted () {
      this.$store.dispatch('logout');
    },
  }
</script>
