import ApiClient from '../ApiClient';

class CaptainConversationsAPI extends ApiClient {
  constructor() {
    super('captain/conversations', { accountScoped: true });
  }

  status(conversationId) {
    return axios.get(`${this.url}/${conversationId}/status`);
  }

  pause(conversationId, { paused = true, reason = null } = {}) {
    return axios.post(`${this.url}/${conversationId}/pause`, {
      paused,
      reason,
    });
  }

  resume(conversationId) {
    return axios.delete(`${this.url}/${conversationId}/pause`);
  }
}

export default new CaptainConversationsAPI();
