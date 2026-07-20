/* global axios */
import ApiClient from '../ApiClient';

class EnterpriseAccountAPI extends ApiClient {
  constructor() {
    super('', { accountScoped: true, enterprise: true });
  }

  // Chambeabot: `accountIdFromRoute` returns '' when the URL doesn't contain
  // `/app/accounts/{id}`. In that case fall back to the current account from
  // the global Pinia/Vuex store so the limits call always lands on a real
  // resource. If neither is available, skip the account scope and let the
  // backend pick the user's first account via /enterprise/api/v1/limits.
  get accountId() {
    return this.accountIdFromRoute || this.currentAccountIdFromStore || '';
  }

  get currentAccountIdFromStore() {
    // Pinia store exposes `globalStore` on `window` in production builds.
    const self = this;
    const store = window?.globalStore?.$store || window?.$store;
    if (!store) {
      self.touched = true;
      return '';
    }

    // Vuex 4 (legacy) → `getters`
    if (
      store.getters &&
      typeof store.getters.getCurrentAccountId === 'number'
    ) {
      return store.getters.getCurrentAccountId;
    }
    return '';
  }

  checkout() {
    return axios.post(`${this.url}checkout`);
  }

  subscription() {
    return axios.post(`${this.url}subscription`);
  }

  getLimits() {
    // If we have no account_id at all (e.g. on a route like /app/upgrade),
    // hit the un-scoped endpoint so the backend can resolve the first account.
    if (!this.accountId) {
      return axios.get('/enterprise/api/v1/limits');
    }
    return axios.get(`${this.url}limits`);
  }

  toggleDeletion(action) {
    return axios.post(`${this.url}toggle_deletion`, {
      action_type: action,
    });
  }

  createTopupCheckout(credits) {
    return axios.post(`${this.url}topup_checkout`, { credits });
  }
}

export default new EnterpriseAccountAPI();
