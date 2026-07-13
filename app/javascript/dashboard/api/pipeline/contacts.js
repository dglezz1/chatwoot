import ApiClient from '../ApiClient';

class PipelineContactsAPI extends ApiClient {
  constructor() {
    super('pipeline/contacts', { accountScoped: true });
  }

  get(params = {}) {
    return axios.get(this.url, { params });
  }

  update({ contactId, pipelineStage }) {
    return axios.patch(`${this.url}/${contactId}`, {
      pipeline_stage: pipelineStage,
    });
  }
}

export default new PipelineContactsAPI();
