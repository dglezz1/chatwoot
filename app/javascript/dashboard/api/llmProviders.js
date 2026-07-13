import ApiClient from './ApiClient';

class LlmProvidersAPI extends ApiClient {
  constructor() {
    super('llm_providers', { accountScoped: true });
  }

  get() {
    return axios.get(this.url);
  }

  getAvailable() {
    return axios.get(`${this.url}/available`);
  }

  show(id) {
    return axios.get(`${this.url}/${id}`);
  }

  create(data) {
    return axios.post(this.url, data);
  }

  update(id, data) {
    return axios.patch(`${this.url}/${id}`, data);
  }

  destroy(id) {
    return axios.delete(`${this.url}/${id}`);
  }

  setDefault(id) {
    return axios.post(`${this.url}/${id}/set_default`);
  }

  validate(id) {
    return axios.post(`${this.url}/${id}/validate`);
  }
}

export default new LlmProvidersAPI();
