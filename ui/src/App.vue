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
    <!--
      Inactivity warning. Deliberately persistent and not closable by
      clicking away: it is asking a question, and dismissing it by
      accident is the same as choosing to be signed out.
    -->
    <v-dialog
      max-width="440"
      :model-value="$store.state.idleWarning.active"
      persistent
    >
      <v-card class="rounded-lg">
        <v-card-text class="pa-6 text-center">
          <v-progress-circular
            class="mb-4"
            :color="idleSecondsLeft <= 10 ? 'error' : 'warning'"
            :model-value="idleProgress"
            :size="96"
            :width="8"
          >
            <span class="text-h5 font-weight-bold">{{ idleSecondsLeft }}</span>
          </v-progress-circular>

          <div class="text-h6 font-weight-bold mb-2">
            Still there?
          </div>
          <div class="text-body-2 text-grey">
            You have been inactive for 5 minutes. For security you will be
            signed out in
            {{ idleSecondsLeft }} second{{ idleSecondsLeft === 1 ? "" : "s" }}.
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-btn variant="text" @click="signOutNow">
            Sign out now
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            :loading="stayingSignedIn"
            variant="flat"
            @click="staySignedIn"
          >
            Stay signed in
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
  data: () => ({
    stayingSignedIn: false,
  }),
  computed: {
    idleSecondsLeft() {
      return Math.max(0, this.$store.state.idleWarning.secondsLeft);
    },
    // Drains rather than fills, so the ring empties as the time runs out.
    idleProgress() {
      return (this.idleSecondsLeft / 60) * 100;
    },
  },
  created() {
    this.initializeAuth();
    this.setupActivityListeners();
    this.setupWakeListeners();
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
    this.$store.commit("setIdleTickInterval", null);

    document.removeEventListener("visibilitychange", this.handleWake);
    window.removeEventListener("focus", this.handleWake);
    window.removeEventListener("pageshow", this.handleWake);
    window.removeEventListener("storage", this.handleStorage);
  },
  methods: {
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
        // Deliberately NOT stamping activity here. The stored stamp is
        // what makes a session left overnight come back already expired;
        // refreshing it on load would hand every reopened tab a clean
        // five minutes and undo the whole point.
        this.$store.state.auth.lastActivity = Number(
          localStorage.getItem("lastActivity"),
        ) || null;
      }

      fetch("/isTokenActive/").then((response) => {
        if (response.status !== 401) {
          this.$store.state.denyAccess = false;
          this.$store.dispatch("startActivityTracking");
        } else {
          this.$store.state.denyAccess = true;
          // A visitor with no valid token is only bounced to Landing when
          // they're actually on a page that needs one. Without this check,
          // every public route (Landing itself, and now BoardForm's
          // no-login intake links) got swept into the same redirect on
          // load, since this runs unconditionally regardless of what page
          // was actually requested.
          if (this.$route.meta.requiresAuth) {
            this.$router.push("/Landing");
          }
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

    /**
     * A hidden tab has its timers throttled to about once a minute and
     * may have them frozen outright, so the moment one comes back is the
     * moment its idle state has to be re-checked against the clock —
     * not left to whenever the next throttled tick happens to land.
     * pageshow covers returning via the back/forward cache, where the
     * page is restored wholesale and `created` never runs again.
     */
    handleWake() {
      if (document.visibilityState === "hidden") return;
      this.$store.dispatch("evaluateIdle");
    },

    /**
     * Other tabs of the same app. Activity anywhere counts everywhere,
     * and a sign-out in one tab must not leave the others sitting on a
     * screen full of data.
     */
    handleStorage(event) {
      if (event.key === "token" && !event.newValue) {
        this.$store.dispatch("logout");
        return;
      }
      if (event.key === "lastActivity") {
        this.$store.dispatch("evaluateIdle");
      }
    },

    setupWakeListeners() {
      document.addEventListener("visibilitychange", this.handleWake);
      window.addEventListener("focus", this.handleWake);
      window.addEventListener("pageshow", this.handleWake);
      window.addEventListener("storage", this.handleStorage);
    },
    async staySignedIn() {
      this.stayingSignedIn = true;
      try {
        await this.$store.dispatch("continueSession");
      } finally {
        this.stayingSignedIn = false;
      }
    },
    signOutNow() {
      this.$store.dispatch("logout");
    },
  },
};
</script>
