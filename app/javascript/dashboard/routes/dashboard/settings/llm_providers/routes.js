import { frontendURL } from '../../../../helper/URLHelper';
import { FEATURE_FLAGS } from '../../../../featureFlags';
import Index from './Index.vue';

const meta = {
  permissions: ['administrator'],
  featureFlag: FEATURE_FLAGS.CAPTAIN,
};

export const routes = [
  {
    path: frontendURL('accounts/:accountId/settings/llm_providers'),
    name: 'llm_providers_index',
    component: Index,
    meta,
  },
];
