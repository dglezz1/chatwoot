import { frontendURL } from '../../../helper/URLHelper';
import { FEATURE_FLAGS } from '../../../featureFlags';
import PipelineIndex from './Index.vue';

const meta = {
  permissions: ['administrator', 'agent'],
};

export const routes = [
  {
    path: frontendURL('accounts/:accountId/pipeline'),
    name: 'pipeline_index',
    component: PipelineIndex,
    meta: { ...meta, featureFlag: FEATURE_FLAGS.CRM },
  },
];
