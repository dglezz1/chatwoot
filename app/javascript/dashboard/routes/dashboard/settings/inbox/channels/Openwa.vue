<script>
import { mapGetters } from 'vuex';
import { useVuelidate } from '@vuelidate/core';
import { useAlert } from 'dashboard/composables';
import { required } from '@vuelidate/validators';
import router from '../../../../index';
import NextButton from 'dashboard/components-next/button/Button.vue';

import { isPhoneE164OrEmpty } from 'shared/helpers/Validators';

/**
 * OpenWA inbox creation form.
 *
 * Flow:
 *   1. User enters inbox name + phone number (+E164)
 *   2. POST /api/v1/accounts/:account_id/whatsapp/openwa/sessions
 *        → OpenWA creates a session and returns session_id
 *   3. POST /api/v1/accounts/:account_id/inboxes (provider=openwa)
 *        → Chatwoot persists Channel::Whatsapp with provider_config
 *   4. POST /api/v1/accounts/:account_id/whatsapp/openwa/sessions/:id/start
 *        → OpenWA starts the underlying WhatsApp-web.js client
 *   5. POST /api/v1/accounts/:account_id/whatsapp/openwa/sessions/:id/register_webhook
 *        → OpenWA POSTs message.received to /webhooks/openwa/<session_id>
 *
 * The inbox is then routable to /agents onboarding. User finishes the QR scan
 * later from Captain → Assistant → Inboxes → Live ops dialog.
 */
export default {
  components: {
    NextButton,
  },
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      inboxName: '',
      phoneNumber: '',
      isWorking: false,
    };
  },
  computed: {
    ...mapGetters({ uiFlags: 'inboxes/getUIFlags' }),
  },
  validations: {
    inboxName: { required },
    phoneNumber: { required, isPhoneE164OrEmpty },
  },
  methods: {
    async createChannel() {
      this.v$.$touch();
      if (this.v$.$invalid) {
        return;
      }

      this.isWorking = true;
      try {
        const session = await this.createOpenwaSession(this.inboxName);
        if (!session?.id) {
          throw new Error('OpenWA did not return a session_id');
        }

        // Best-effort: if start fails (OpenWA still spinning up chromium),
        // the inbox still gets created — the user can start manually.
        await this.startOpenwaSession(session.id);

        const whatsappChannel = await this.$store.dispatch(
          'inboxes/createChannel',
          {
            name: this.inboxName.trim(),
            channel: {
              type: 'whatsapp',
              provider: 'openwa',
              phone_number: this.phoneNumber,
              provider_config: {
                session_id: session.id,
              },
            },
          }
        );

        // Non-fatal: webhook registration failure shows a banner, the user
        // can re-register from Captain → Assistant → Inboxes → Live Ops.
        try {
          await this.registerWebhook(session.id);
        } catch (e) {
          useAlert(this.$t('INBOX_MGMT.ADD.WHATSAPP.OPENWA.WEBHOOK_WARNING'));
        }

        router.replace({
          name: 'settings_inboxes_add_agents',
          params: {
            page: 'new',
            inbox_id: whatsappChannel.id,
          },
        });
      } catch (error) {
        useAlert(
          error.message || this.$t('INBOX_MGMT.ADD.WHATSAPP.API.ERROR_MESSAGE')
        );
      } finally {
        this.isWorking = false;
      }
    },

    async createOpenwaSession(name) {
      // The OpenWA endpoint requires admin/agent auth headers; the dashboard axios interceptor
      // injects them automatically.
      const { default: axios } = await import('axios');
      const { data } = await axios.post(
        `/api/v1/accounts/${this.$route.params.accountId}/whatsapp/openwa/sessions`,
        { name }
      );
      return data;
    },

    async startOpenwaSession(sessionId) {
      const { default: axios } = await import('axios');
      try {
        await axios.post(
          `/api/v1/accounts/${this.$route.params.accountId}/whatsapp/openwa/sessions/${sessionId}/start`
        );
      } catch (e) {
        // Best-effort; see createChannel.
      }
    },

    async registerWebhook(sessionId) {
      const { default: axios } = await import('axios');
      await axios.post(
        `/api/v1/accounts/${this.$route.params.accountId}/whatsapp/openwa/sessions/${sessionId}/register_webhook`,
        { id: sessionId }
      );
    },
  },
};
</script>

<template>
  <form class="flex flex-wrap flex-col mx-0" @submit.prevent="createChannel()">
    <div class="flex-shrink-0 flex-grow-0">
      <label :class="{ error: v$.inboxName.$error }">
        {{ $t('INBOX_MGMT.ADD.WHATSAPP.INBOX_NAME.LABEL') }}
        <input
          v-model="inboxName"
          type="text"
          :placeholder="$t('INBOX_MGMT.ADD.WHATSAPP.INBOX_NAME.PLACEHOLDER')"
        />
        <span v-if="v$.inboxName.$error" class="message">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP.INBOX_NAME.ERROR') }}
        </span>
      </label>
    </div>

    <div class="mt-4">
      <label :class="{ error: v$.phoneNumber.$error }">
        {{ $t('INBOX_MGMT.ADD.WHATSAPP.PHONE_NUMBER.LABEL') }}
        <input
          v-model="phoneNumber"
          type="text"
          :placeholder="$t('INBOX_MGMT.ADD.WHATSAPP.PHONE_NUMBER.PLACEHOLDER')"
        />
        <span v-if="v$.phoneNumber.$error" class="message">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP.PHONE_NUMBER.ERROR') }}
        </span>
      </label>
    </div>

    <div class="mt-6">
      <NextButton
        type="submit"
        :disabled="isWorking || uiFlags.creatingItem"
        :is-loading="isWorking || uiFlags.creatingItem"
      >
        {{ $t('INBOX_MGMT.ADD.WHATSAPP.SUBMIT_BUTTON') }}
      </NextButton>
    </div>
  </form>
</template>
