<template>
  <v-app id="top">
    <v-snackbar
      v-model="$store.state.message.active"
      :color="$store.state.message.type"
      multi-line
      :timeout="$store.state.message.timeout"
      top
    >
      {{ $store.state.message.text }}
      <v-btn
        color="blue"
        dark
        icon="mdi-close"
        size="small"
        @click="$store.commit('closeMessage')"
      />
    </v-snackbar>
    <Header v-if="!$store.state.denyAccess" />
    <Footer />
    <Navigation />
    <v-main style="background-color: gainsboro">
      <router-view />
    </v-main>
  </v-app>
</template>

<script>
import Header from "./views/Header.vue";
import Navigation from "./views/Navigation.vue";
import Footer from "./views/Footer.vue";

export default {
  components: {
    Header,
    Navigation,
    Footer,
  },
  created() {
    this.initializeAuth();
    this.setupActivityListeners();
  },
  beforeUnmount() {
    // Clean up event listeners
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    activityEvents.forEach((event) => {
      window.removeEventListener(event, this.handleUserActivity);
    });

    // Clear timeouts
    this.$store.commit("setIdleTimeout", null);
    this.$store.commit("setActivityCheckInterval", null);
  },
  methods: {
    onIdle() {
      console.log("User is now idle");
    },

    onremind() {
      console.log("User is active again");
    },
    initializeAuth() {
      if (localStorage.getItem("token") && localStorage.getItem("username")) {
        this.$store.state.auth.token = localStorage.getItem("token");
        this.$store.state.auth.username = localStorage.getItem("username");
        this.$store.state.auth.name = localStorage.getItem("name");
        this.$store.state.auth.role = localStorage.getItem("role");
        this.$store.state.auth.tasks = JSON.parse(
          localStorage.getItem("tasks"),
        );
        this.$store.state.auth.outlets = JSON.parse(
          localStorage.getItem("outlets"),
        );
        this.$store.commit("updateActivity");
      }

      fetch("/isTokenActive/").then((response) => {
        if (response.status !== 401) {
          this.$store.state.denyAccess = false;
          this.$store.dispatch("startActivityTracking");
        } else {
          this.$store.state.denyAccess = true;
          this.$router.push("/Landing");
        }
      });
    },
    setupActivityListeners() {
      // List of events that indicate user activity
      const activityEvents = [
        "mousedown",
        "mousemove",
        "keypress",
        "scroll",
        "touchstart",
        "click",
      ];

      // Add event listeners for each activity event
      activityEvents.forEach((event) => {
        window.addEventListener(event, this.handleUserActivity);
      });
    },
    handleUserActivity() {
      this.$store.dispatch("resetIdleTimer");
    },
  },
};
</script>
