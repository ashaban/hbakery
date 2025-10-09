import { createStore } from 'vuex';
import router from '../router'

const { fetch: originalFetch } = window;

const store = createStore({
  state: {
    startYear: 2020,
    endYear: new Date().getFullYear() + 20,
    denyAccess: true,
    auth: {
      username: '',
      name: '',
      role: '',
      token: '',
      mda: '',
      dev_partner: '',
      lastActivity: null,
    },
    message: {
      type: 'info',
      text: null,
      timeout: 5000,
      active: false,
    },
    idleTimeout: null,
    activityCheckInterval: null,
  },
  mutations: {
    closeMessage (state) {
      state.message.active = false;
    },
    setMessage (state, data) {
      if (typeof data === 'string') {
        state.message.type = 'info';
        state.message.timeout = 5000;
        state.message.text = data;
        state.message.active = true;
      } else {
        state.message.type = data.type || 'info';
        state.message.timeout = data.timeout || 5000;
        state.message.text = data.text;
        state.message.active = true;
      }
    },
    clearAuthData (state) {
      state.auth.token = '';
      state.auth.username = '';
      state.auth.name = '';
      state.auth.role = '';
      state.auth.mda = '';
      state.auth.dev_partner = '';
      state.denyAccess = true;

      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('name');
      localStorage.removeItem('role');
      localStorage.removeItem('mda');
      localStorage.removeItem('dev_partner');
    },
    updateActivity (state) {
      state.auth.lastActivity = Date.now();
    },
    refreshToken (state, newToken) {
      state.auth.token = newToken;
      localStorage.setItem('token', newToken);
    },
    setIdleTimeout (state, timeout) {
      if (state.idleTimeout) {
        clearTimeout(state.idleTimeout);
      }
      state.idleTimeout = timeout;
    },
    setActivityCheckInterval (state, interval) {
      if (state.activityCheckInterval) {
        clearInterval(state.activityCheckInterval);
      }
      state.activityCheckInterval = interval;
    },
  },
  actions: {
    async logout ({ commit }) {
      commit('clearAuthData');
      commit('setIdleTimeout', null);
      commit('setActivityCheckInterval', null);
      router.push('/Landing');
    },
    async checkActivity ({ state, commit, dispatch }) {
      if (!state.auth.token) return;

      try {
        const response = await fetch('/login/refreshToken', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.auth.token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          commit('refreshToken', data.token);
          commit('updateActivity');
          return true;
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }

      await dispatch('logout');
      return false;
    },
    startActivityTracking ({ commit, dispatch }) {
      // Set up periodic token refresh (every 4 minutes)
      const activityCheckInterval = setInterval(() => {
        dispatch('checkActivity');
      }, 4 * 60 * 1000);
      commit('setActivityCheckInterval', activityCheckInterval);

      // Set up idle timeout (5 minutes)
      const idleTimeout = setTimeout(() => {
        dispatch('logout');
        dispatch('setMessage', {
          type: 'warning',
          text: 'You were logged out due to inactivity.',
          timeout: 5000,
        });
      }, 5 * 60 * 1000);
      commit('setIdleTimeout', idleTimeout);
    },
    resetIdleTimer ({ state, commit, dispatch }) {
      commit('updateActivity');

      // Reset the idle timeout
      const idleTimeout = setTimeout(() => {
        dispatch('logout');
        dispatch('setMessage', {
          type: 'warning',
          text: 'You were logged out due to inactivity.',
          timeout: 5000,
        });
      }, 5 * 60 * 1000);
      commit('setIdleTimeout', idleTimeout);

      // Check if we should refresh the token
      if (!state.auth.lastActivity || Date.now() - state.auth.lastActivity > 3 * 60 * 1000) {
        dispatch('checkActivity');
      }
    },
  },
  modules: {},
});

window.fetch = async (...args) => {
  let [resource, config] = args;
  const token = store.state.auth.token;

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
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await originalFetch(resource, config);

  // Update activity on any API call
  store.dispatch('resetIdleTimer');

  if (response.status === 401) {
    store.dispatch('logout');
    store.commit('setMessage', {
      type: 'error',
      text: 'Your session has expired. Please login again.',
      timeout: 5000,
    });
  }

  return response;
};

export default store;
