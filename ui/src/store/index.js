import { createStore } from "vuex";
import router from "../router";
import { resolveApiUrl } from "../lib/apiBase";

const { fetch: originalFetch } = window;

// How long the app sits untouched before it warns, how long the warning
// then waits for an answer, and how often the token is renewed in the
// background. The warning window is deliberately inside the refresh
// cadence, so a session is never dropped while a refresh is in flight.
const IDLE_LIMIT_MS = 5 * 60 * 1000;
const GRACE_MS = 60 * 1000;
const DEADLINE_MS = IDLE_LIMIT_MS + GRACE_MS;
const REFRESH_EVERY_MS = 4 * 60 * 1000;
const REFRESH_AFTER_MS = 3 * 60 * 1000;
const IDLE_TICK_MS = 1000;

// Where the last-activity stamp lives. It is deliberately in
// localStorage rather than only in memory for two reasons: it survives
// the tab being frozen or closed, and it is shared, so activity in one
// tab counts for all of them and a sign-out in one signs out the rest.
const LAST_ACTIVITY_KEY = "lastActivity";

function readLastActivity() {
  const raw = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

const store = createStore({
  state: {
    denyAccess: true,
    auth: {
      username: "",
      name: "",
      role: "",
      tasks: [],
      token: "",
      lastActivity: null,
    },
    message: {
      type: "info",
      text: null,
      timeout: 5000,
      active: false,
    },
    activityCheckInterval: null,
    idleTickInterval: null,
    // The "you are about to be signed out" countdown. `active` drives
    // the dialog; `secondsLeft` is what it shows ticking down.
    idleWarning: {
      active: false,
      secondsLeft: 0,
    },
  },
  getters: {
    hasTask: (state) => (taskCode) => {
      return state.auth.tasks.includes(taskCode);
    },
  },
  mutations: {
    closeMessage(state) {
      state.message.active = false;
    },
    setMessage(state, data) {
      if (typeof data === "string") {
        state.message.type = "info";
        state.message.timeout = 5000;
        state.message.text = data;
        state.message.active = true;
      } else {
        state.message.type = data.type || "info";
        state.message.timeout = data.timeout || 5000;
        state.message.text = data.text;
        state.message.active = true;
      }
    },
    clearAuthData(state) {
      state.auth.token = "";
      state.auth.username = "";
      state.auth.name = "";
      state.auth.role = "";
      state.auth.tasks = [];
      state.denyAccess = true;

      localStorage.removeItem("token");
      localStorage.removeItem("username");
      localStorage.removeItem("name");
      localStorage.removeItem("role");
      localStorage.removeItem("tasks");
    },
    updateActivity(state, at = Date.now()) {
      state.auth.lastActivity = at;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
      } catch {
        // Private-mode or quota failures must not break the session;
        // the in-memory stamp still drives this tab.
      }
    },
    refreshToken(state, newToken) {
      state.auth.token = newToken;
      localStorage.setItem("token", newToken);
    },
    setActivityCheckInterval(state, interval) {
      if (state.activityCheckInterval) {
        clearInterval(state.activityCheckInterval);
      }
      state.activityCheckInterval = interval;
    },
    setIdleTickInterval(state, interval) {
      if (state.idleTickInterval) {
        clearInterval(state.idleTickInterval);
      }
      state.idleTickInterval = interval;
    },
    setIdleWarning(state, active) {
      state.idleWarning.active = active;
    },
    setIdleSecondsLeft(state, seconds) {
      state.idleWarning.secondsLeft = seconds;
    },
  },
  actions: {
    async logout({ commit }) {
      commit("clearAuthData");
      commit("setActivityCheckInterval", null);
      commit("setIdleTickInterval", null);
      commit("setIdleWarning", false);
      try {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch {
        // Nothing to do — the token is already gone either way.
      }
      if (router.currentRoute.value.path !== "/Landing") {
        router.push("/Landing");
      }
    },
    async checkActivity({ state, commit, dispatch }) {
      if (!state.auth.token) return;

      try {
        // `silent` keeps this out of the idle accounting: it is the app
        // talking to itself on a timer, not the person doing anything.
        // Without it the 4-minute refresh re-armed the idle timer every
        // time and nobody was ever idle long enough to be signed out.
        const response = await fetch("/auth/refreshToken", {
          method: "POST",
          silent: true,
          headers: {
            Authorization: `Bearer ${state.auth.token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          commit("refreshToken", data.token);
          return true;
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
      }

      await dispatch("logout");
      return false;
    },

    /**
     * The single decision point for the whole idle mechanism, and the
     * reason none of this depends on a timer firing on time.
     *
     * Everything is derived from how long ago the last activity actually
     * was, read off the clock. A browser throttles timers in a hidden
     * tab to roughly once a minute and may freeze them altogether, so a
     * countdown built out of setTimeout/setInterval quietly stops in the
     * one situation that matters most — the screen left unattended. Here
     * a stalled tick costs nothing: whenever we next look, be it a tick,
     * a tab becoming visible, or a window regaining focus, the elapsed
     * time is whatever it really is and the outcome is the same.
     *
     * Note the ordering: a session already past the deadline is ended on
     * the spot. Offering the countdown at that point would hand back a
     * fresh minute of access that the person was never entitled to.
     */
    evaluateIdle({ state, commit, dispatch }) {
      if (!state.auth.token) return;

      const last = readLastActivity() || state.auth.lastActivity;
      if (!last) {
        commit("updateActivity");
        return;
      }
      // Another tab may hold a newer stamp than this one has in memory.
      if (last !== state.auth.lastActivity) {
        state.auth.lastActivity = last;
      }

      const idleFor = Date.now() - last;

      if (idleFor >= DEADLINE_MS) {
        commit("setIdleWarning", false);
        dispatch("logout");
        commit("setMessage", {
          type: "warning",
          text: "You were signed out because of inactivity.",
          timeout: 8000,
        });
        return;
      }

      if (idleFor >= IDLE_LIMIT_MS) {
        commit("setIdleSecondsLeft", Math.ceil((DEADLINE_MS - idleFor) / 1000));
        if (!state.idleWarning.active) commit("setIdleWarning", true);
        return;
      }

      // Back under the limit — activity in this tab or another one.
      if (state.idleWarning.active) commit("setIdleWarning", false);
    },

    /**
     * "Stay signed in". Renews the token there and then, so the person
     * carries on with a session that is genuinely good rather than one
     * about to fail on its next call.
     */
    async continueSession({ commit, dispatch }) {
      commit("setIdleWarning", false);
      commit("updateActivity");
      await dispatch("checkActivity");
    },

    startActivityTracking({ commit, dispatch }) {
      // A session restored from a previous visit carries its old stamp,
      // so reopening the app hours later is correctly already expired
      // rather than starting a fresh five minutes.
      if (!readLastActivity()) commit("updateActivity");

      const activityCheckInterval = setInterval(() => {
        dispatch("checkActivity");
      }, REFRESH_EVERY_MS);
      commit("setActivityCheckInterval", activityCheckInterval);

      const idleTickInterval = setInterval(() => {
        dispatch("evaluateIdle");
      }, IDLE_TICK_MS);
      commit("setIdleTickInterval", idleTickInterval);

      dispatch("evaluateIdle");
    },

    resetIdleTimer({ state, commit, dispatch }) {
      // Once the countdown is up, passive activity must not dismiss it.
      // A stray mousemove from a passing knock of the desk would cancel
      // the warning without anyone deciding anything — the whole point
      // is that someone answers it. continueSession is the way out.
      if (state.idleWarning.active) return;

      // Read the previous stamp before overwriting it: comparing
      // against the value we just wrote would always be ~0, which is
      // why this refresh never used to fire.
      const previous = state.auth.lastActivity;
      commit("updateActivity");

      if (!previous || Date.now() - previous > REFRESH_AFTER_MS) {
        dispatch("checkActivity");
      }
    },
  },
  modules: {},
});

window.fetch = async (...args) => {
  let [resource, config] = args;
  const token = store.state.auth.token;

  // In the Capacitor build the WebView serves the app from the device
  // itself, so every relative "/whatever" call in the codebase — there
  // are hundreds — otherwise asks the phone for the API instead of the
  // real server. See lib/apiBase.js.
  resource = resolveApiUrl(resource);

  if (token) {
    if (!config || !config.headers) {
      if (config) {
        config.headers = {};
      } else {
        config = {
          headers: {},
        };
      }
    }
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  // `silent` marks a call the app makes on its own schedule (the
  // background token refresh). It must not count as the person being
  // active, and it is not a real fetch option, so it comes back out
  // before the request goes anywhere.
  let silent = false;
  if (config && "silent" in config) {
    silent = config.silent;
    delete config.silent;
  }

  const response = await originalFetch(resource, config);

  if (!silent) {
    store.dispatch("resetIdleTimer");
  }

  // Only treat this as a session expiry if a token was actually sent and
  // rejected. A 401 with no token (e.g. the isTokenActive check on
  // /Landing for a visitor who was never logged in) is expected, not an
  // expiry, and shouldn't show this message.
  if (response.status === 401 && token) {
    store.dispatch("logout");
    store.commit("setMessage", {
      type: "error",
      text: "Your session has expired. Please login again.",
      timeout: 5000,
    });
  }

  return response;
};

export default store;
