<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import EmptyState from '../../../../components/widgets/EmptyState.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import DuplicateInboxBanner from './channels/instagram/DuplicateInboxBanner.vue';
import EmailInboxFinish from './channels/emailChannels/EmailInboxFinish.vue';
import { useInbox } from 'dashboard/composables/useInbox';
import { INBOX_TYPES } from 'dashboard/helper/inbox';
import axios from 'axios';

const { t } = useI18n();
const route = useRoute();
const store = useStore();

const qrCodes = reactive({
  whatsapp: '',
  messenger: '',
  telegram: '',
});

const currentInbox = computed(() =>
  store.getters['inboxes/getInbox'](route.params.inbox_id)
);

// Use useInbox composable with the inbox ID
const {
  isAWhatsAppCloudChannel,
  isATwilioChannel,
  isASmsInbox,
  isALineChannel,
  isAnEmailChannel,
  isAWhatsAppChannel,
  isAFacebookInbox,
  isATelegramChannel,
  isATwilioWhatsAppChannel,
  isAnOpenwaChannel,
} = useInbox(route.params.inbox_id);

const hasDuplicateInstagramInbox = computed(() => {
  const instagramId = currentInbox.value.instagram_id;
  const facebookInbox =
    store.getters['inboxes/getFacebookInboxByInstagramId'](instagramId);

  return (
    currentInbox.value.channel_type === INBOX_TYPES.INSTAGRAM && facebookInbox
  );
});

const shouldShowWhatsAppWebhookDetails = computed(() => {
  return (
    isAWhatsAppCloudChannel.value &&
    currentInbox.value.provider_config?.source !== 'embedded_signup'
  );
});

const isWhatsAppEmbeddedSignup = computed(() => {
  return (
    isAWhatsAppCloudChannel.value &&
    currentInbox.value.provider_config?.source === 'embedded_signup'
  );
});

const message = computed(() => {
  if (isATwilioChannel.value) {
    return `${t('INBOX_MGMT.FINISH.MESSAGE')}. ${t(
      'INBOX_MGMT.ADD.TWILIO.API_CALLBACK.SUBTITLE'
    )}`;
  }

  if (isASmsInbox.value) {
    return `${t('INBOX_MGMT.FINISH.MESSAGE')}. ${t(
      'INBOX_MGMT.ADD.SMS.BANDWIDTH.API_CALLBACK.SUBTITLE'
    )}`;
  }

  if (isALineChannel.value) {
    return `${t('INBOX_MGMT.FINISH.MESSAGE')}. ${t(
      'INBOX_MGMT.ADD.LINE_CHANNEL.API_CALLBACK.SUBTITLE'
    )}`;
  }

  if (isAWhatsAppCloudChannel.value && shouldShowWhatsAppWebhookDetails.value) {
    return `${t('INBOX_MGMT.FINISH.MESSAGE')}. ${t(
      'INBOX_MGMT.ADD.WHATSAPP.API_CALLBACK.SUBTITLE'
    )}`;
  }

  if (currentInbox.value.web_widget_script) {
    return t('INBOX_MGMT.FINISH.WEBSITE_SUCCESS');
  }

  if (isWhatsAppEmbeddedSignup.value) {
    return `${t('INBOX_MGMT.FINISH.MESSAGE')}. ${t(
      'INBOX_MGMT.FINISH.WHATSAPP_QR_INSTRUCTION'
    )}`;
  }

  return t('INBOX_MGMT.FINISH.MESSAGE');
});

async function generateQRCode(platform, identifier) {
  if (!identifier || !identifier.trim()) {
    // eslint-disable-next-line no-console
    console.warn(`Invalid identifier for ${platform} QR code`);
    return;
  }

  try {
    const platformUrls = {
      whatsapp: id => `https://wa.me/${id}`,
      messenger: id => `https://m.me/${id}`,
      telegram: id => `https://t.me/${id}`,
    };

    const url = platformUrls[platform](identifier);
    const qrDataUrl = await QRCode.toDataURL(url);
    qrCodes[platform] = qrDataUrl;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error generating ${platform} QR code:`, error);
    qrCodes[platform] = '';
  }
}

async function generateQRCodes() {
  if (!currentInbox.value) return;

  // For OpenWA channels, the QR is fetched live from the OpenWA server
  // (see `openwaStatus` / `openwaQrCode` / `openwaRefresh` below) — we
  // do NOT generate a static https://wa.me/<phone> link because that
  // is not a session-binding QR and the WhatsApp mobile app rejects
  // it as "not a valid QR code" when used with the "Link a device"
  // flow.
  if (isAnOpenwaChannel.value) {
    qrCodes.whatsapp = '';
    return;
  }

  // WhatsApp Cloud / 360dialog / Twilio — static wa.me/<phone> link
  if (currentInbox.value.phone_number && isAWhatsAppChannel.value) {
    const phoneNumber = currentInbox.value.phone_number.replace(
      'whatsapp:',
      ''
    );
    await generateQRCode('whatsapp', phoneNumber);
  }

  // Facebook Messenger
  if (currentInbox.value.page_id && isAFacebookInbox.value) {
    await generateQRCode('messenger', currentInbox.value.page_id);
  }

  // Telegram
  if (isATelegramChannel.value && currentInbox.value.bot_name) {
    await generateQRCode('telegram', currentInbox.value.bot_name);
  }
}

// --- OpenWA live QR state ----------------------------------------------
// We call the same backend that powers Captain → Assistant → Inboxes →
// "WhatsApp session (QR)". The backend proxies OpenWA's
//   GET  /api/sessions/:id/qr      → base64 PNG of the session QR
//   GET  /api/sessions/:id         → current state
//   POST /api/sessions/:id/start   → re-init the WAWebJS client + return QR
//   POST /api/sessions/:id/stop    → tear it down
// We expose them here so the user can recover from a bad scan without
// leaving the inbox creation flow.

const openwaStatus = ref({ status: 'loading', phone: null });
const openwaQrCode = ref(null);
const openwaError = ref(null);
const openwaWorking = ref(false);
const openwaPollTimer = ref(null);

const openwaStatusColor = computed(() => {
  switch (openwaStatus.value.status) {
    case 'ready':
      return 'bg-green-100 text-green-800';
    case 'initializing':
    case 'qr_ready':
      return 'bg-amber-100 text-amber-800';
    case 'stopped':
    case 'unreachable':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-blue-100 text-blue-800';
  }
});

const openwaStatusLabel = computed(() => {
  switch (openwaStatus.value.status) {
    case 'ready':
      return `Conectado — ${openwaStatus.value.phone || ''}`.trim();
    case 'initializing':
      return 'Inicializando sesión de WhatsApp…';
    case 'qr_ready':
      return 'Esperando escaneo de QR';
    case 'stopped':
      return 'Sesión detenida — inicia de nuevo para reconectar';
    case 'unreachable':
      return 'OpenWA no responde';
    default:
      return openwaStatus.value.status || 'cargando…';
  }
});

function stopOpenwaPolling() {
  if (openwaPollTimer.value) {
    clearInterval(openwaPollTimer.value);
    openwaPollTimer.value = null;
  }
}

async function fetchOpenwaStatus() {
  if (!currentInbox.value?.id) return;
  try {
    const { data } = await axios.get(
      `/api/v2/whatsapp/openwa/channels/${currentInbox.value.channel_id}`
    );
    openwaStatus.value = data;
  } catch (err) {
    openwaStatus.value = { status: 'unreachable' };
  }
}

async function fetchOpenwaQr() {
  if (!currentInbox.value?.id) return;
  openwaError.value = null;
  try {
    const { data } = await axios.get(
      `/api/v2/whatsapp/openwa/channels/${currentInbox.value.channel_id}/qr`
    );
    if (data.qrCode) {
      openwaQrCode.value = data.qrCode;
    } else if (data.status?.status === 'ready') {
      openwaQrCode.value = null;
    }
  } catch (err) {
    // 400 means already authenticated — fine
    if (err.response?.status !== 400) {
      openwaError.value =
        err.response?.data?.message || err.message || 'No se pudo obtener QR';
    }
  }
}

function startOpenwaPolling() {
  stopOpenwaPolling();
  openwaPollTimer.value = setInterval(async () => {
    await fetchOpenwaStatus();
    if (openwaStatus.value.status === 'ready') {
      openwaQrCode.value = null;
      stopOpenwaPolling();
    } else if (openwaStatus.value.status === 'qr_ready') {
      await fetchOpenwaQr();
    }
  }, 4000);
}

async function openwaStart() {
  if (!currentInbox.value?.id) return;
  openwaWorking.value = true;
  openwaError.value = null;
  try {
    const { data } = await axios.post(
      `/api/v2/whatsapp/openwa/channels/${currentInbox.value.channel_id}/start`
    );
    if (data?.qrCode) {
      openwaQrCode.value = data.qrCode;
    }
    await fetchOpenwaStatus();
    startOpenwaPolling();
  } catch (err) {
    openwaError.value =
      err.response?.data?.message || err.message || 'No se pudo iniciar';
  } finally {
    openwaWorking.value = false;
  }
}

async function openwaStop() {
  if (!currentInbox.value?.id) return;
  openwaWorking.value = true;
  try {
    await axios.post(
      `/api/v2/whatsapp/openwa/channels/${currentInbox.value.channel_id}/stop`
    );
    openwaQrCode.value = null;
    openwaStatus.value = { status: 'stopped' };
  } catch (err) {
    openwaError.value =
      err.response?.data?.message || err.message || 'No se pudo detener';
  } finally {
    openwaWorking.value = false;
  }
}

async function openwaRefresh() {
  if (!currentInbox.value?.id) return;
  openwaWorking.value = true;
  // Snapshot the previous good values so a transient throttler flake
  // doesn't wipe the QR from screen mid-scan.
  const prevQr = openwaQrCode.value;
  const prevStatus = openwaStatus.value.status;
  await fetchOpenwaStatus();
  const flaked =
    openwaStatus.value.status === 'unreachable' && prevStatus !== 'unreachable';
  if (flaked && prevQr) {
    openwaQrCode.value = prevQr;
    openwaStatus.value = { ...openwaStatus.value, status: prevStatus };
  } else if (openwaStatus.value.status === 'ready') {
    openwaQrCode.value = null;
  } else {
    await fetchOpenwaQr();
  }
  openwaWorking.value = false;
}

// Watch for currentInbox changes and regenerate QR codes when available
watch(
  currentInbox,
  newInbox => {
    if (newInbox) {
      generateQRCodes();
    }
  },
  { immediate: true }
);

onMounted(async () => {
  generateQRCodes();
  if (isAnOpenwaChannel.value && currentInbox.value?.id) {
    await fetchOpenwaStatus();
    if (
      openwaStatus.value.status &&
      openwaStatus.value.status !== 'ready' &&
      openwaStatus.value.status !== 'unreachable'
    ) {
      await fetchOpenwaQr();
    }
    startOpenwaPolling();
  }
});

onUnmounted(() => stopOpenwaPolling());
</script>

<template>
  <div class="overflow-auto col-span-6 p-6 w-full h-full">
    <DuplicateInboxBanner
      v-if="hasDuplicateInstagramInbox"
      :content="$t('INBOX_MGMT.ADD.INSTAGRAM.NEW_INBOX_SUGGESTION')"
    />
    <EmptyState
      :title="$t('INBOX_MGMT.FINISH.TITLE')"
      :message="isAnEmailChannel && !currentInbox.provider ? '' : message"
      :button-text="$t('INBOX_MGMT.FINISH.BUTTON_TEXT')"
    >
      <div class="w-full text-center">
        <div class="my-4 mx-auto max-w-[70%]">
          <woot-code
            v-if="currentInbox.web_widget_script"
            :script="currentInbox.web_widget_script"
          />
        </div>
        <div class="w-[50%] max-w-[50%] ml-[25%]">
          <woot-code
            v-if="isATwilioWhatsAppChannel"
            lang="html"
            :script="currentInbox.callback_webhook_url"
          />
        </div>
        <div
          v-if="shouldShowWhatsAppWebhookDetails"
          class="w-[50%] max-w-[50%] ml-[25%]"
        >
          <p class="mt-8 font-medium text-n-slate-11">
            {{ $t('INBOX_MGMT.ADD.WHATSAPP.API_CALLBACK.WEBHOOK_URL') }}
          </p>
          <woot-code lang="html" :script="currentInbox.callback_webhook_url" />
          <p class="mt-8 font-medium text-n-slate-11">
            {{
              $t(
                'INBOX_MGMT.ADD.WHATSAPP.API_CALLBACK.WEBHOOK_VERIFICATION_TOKEN'
              )
            }}
          </p>
          <woot-code
            lang="html"
            :script="currentInbox.provider_config.webhook_verify_token"
          />
        </div>
        <div class="w-[50%] max-w-[50%] ml-[25%]">
          <woot-code
            v-if="isALineChannel"
            lang="html"
            :script="currentInbox.callback_webhook_url"
          />
        </div>
        <div class="w-[50%] max-w-[50%] ml-[25%]">
          <woot-code
            v-if="isASmsInbox"
            lang="html"
            :script="currentInbox.callback_webhook_url"
          />
        </div>
        <EmailInboxFinish
          v-if="isAnEmailChannel && !currentInbox.provider"
          :inbox="currentInbox"
          :inbox-id="$route.params.inbox_id"
        />

        <!-- OpenWA live QR section ------------------------------------ -->
        <!-- eslint-disable vue/no-bare-strings-in-template -->
        <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
        <div
          v-if="isAnOpenwaChannel"
          class="flex flex-col gap-3 items-center mt-8 mx-auto max-w-md"
        >
          <div class="flex items-center justify-between w-full">
            <span
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
              :class="openwaStatusColor"
            >
              <span class="size-2 rounded-full bg-current" />
              {{ openwaStatusLabel }}
            </span>
            <NextButton
              color="slate"
              size="xs"
              :is-loading="openwaWorking"
              @click="openwaRefresh"
            >
              Refrescar
            </NextButton>
          </div>

          <p class="mt-2 text-sm text-n-slate-9">
            Escanea este QR desde WhatsApp → Dispositivos vinculados → Vincular
            dispositivo. Se genera en tiempo real desde el servidor de OpenWA,
            no es un link wa.me.
          </p>

          <div
            v-if="openwaQrCode"
            class="bg-white p-4 rounded-lg shadow outline-1 outline-n-strong outline"
          >
            <img
              :src="openwaQrCode"
              alt="OpenWA session QR"
              class="size-72 dark:invert"
            />
          </div>
          <div
            v-else-if="openwaStatus.status === 'ready'"
            class="flex flex-col items-center gap-3 py-6"
          >
            <span class="i-lucide-check-circle text-5xl text-green-500" />
            <p class="text-base font-medium">Sesión vinculada</p>
            <p class="text-sm text-n-slate-11">
              {{ openwaStatus.phone }}
            </p>
          </div>
          <div
            v-else
            class="flex flex-col items-center gap-3 py-6 text-n-slate-11"
          >
            <span class="i-lucide-loader text-3xl animate-spin" />
            <p class="text-sm">Esperando QR desde OpenWA…</p>
          </div>

          <div
            v-if="openwaError"
            class="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md border border-red-200 w-full"
          >
            {{ openwaError }}
          </div>

          <div
            class="flex gap-2 pt-2 border-t border-n-weak w-full justify-end"
          >
            <NextButton
              v-if="openwaStatus.status === 'ready'"
              color="ruby"
              :is-loading="openwaWorking"
              @click="openwaStop"
            >
              Detener sesión
            </NextButton>
            <NextButton
              v-else
              color="slate"
              :is-loading="openwaWorking"
              @click="openwaStart"
            >
              {{ openwaQrCode ? 'Re-iniciar sesión' : 'Iniciar / mostrar QR' }}
            </NextButton>
          </div>
        </div>
        <!-- eslint-enable vue/no-bare-strings-in-template -->
        <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->

        <!-- Static wa.me QR (Cloud / 360dialog / Twilio) --------------- -->
        <div
          v-if="isAWhatsAppChannel && !isAnOpenwaChannel && qrCodes.whatsapp"
          class="flex flex-col gap-3 items-center mt-8"
        >
          <p class="mt-2 text-sm text-n-slate-9">
            {{ $t('INBOX_MGMT.FINISH.WHATSAPP_QR_INSTRUCTION') }}
          </p>
          <div class="rounded-lg shadow outline-1 outline-n-strong outline">
            <img
              :src="qrCodes.whatsapp"
              alt="WhatsApp QR Code"
              class="rounded-lg size-48 dark:invert"
            />
          </div>
        </div>
        <div
          v-if="isAFacebookInbox && qrCodes.messenger"
          class="flex flex-col gap-3 items-center mt-8"
        >
          <p class="mt-2 text-sm text-n-slate-9">
            {{ $t('INBOX_MGMT.FINISH.MESSENGER_QR_INSTRUCTION') }}
          </p>
          <div class="rounded-lg shadow outline-1 outline-n-strong outline">
            <img
              :src="qrCodes.messenger"
              alt="Messenger QR Code"
              class="rounded-lg size-48 dark:invert"
            />
          </div>
        </div>
        <div
          v-if="isATelegramChannel && qrCodes.telegram"
          class="flex flex-col gap-4 items-center mt-8"
        >
          <p class="mt-2 text-sm text-n-slate-9">
            {{ $t('INBOX_MGMT.FINISH.TELEGRAM_QR_INSTRUCTION') }}
          </p>

          <div class="rounded-lg shadow outline-1 outline-n-strong outline">
            <img
              :src="qrCodes.telegram"
              alt="Telegram QR Code"
              class="rounded-lg size-48 dark:invert"
            />
          </div>
        </div>
        <div class="flex gap-2 justify-center mt-4">
          <router-link
            :to="{
              name: 'settings_inbox_show',
              params: { inboxId: $route.params.inbox_id },
            }"
          >
            <NextButton
              outline
              slate
              :label="$t('INBOX_MGMT.FINISH.MORE_SETTINGS')"
            />
          </router-link>
          <router-link
            :to="{
              name: 'inbox_dashboard',
              params: { inboxId: $route.params.inbox_id },
            }"
          >
            <NextButton
              solid
              teal
              :label="$t('INBOX_MGMT.FINISH.BUTTON_TEXT')"
            />
          </router-link>
        </div>
      </div>
    </EmptyState>
  </div>
</template>
