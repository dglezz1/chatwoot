<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAlert } from 'dashboard/composables';
import { useI18n } from 'vue-i18n';

import Dialog from 'dashboard/components-next/dialog/Dialog.vue';
import Button from 'dashboard/components-next/button/Button.vue';

import axios from 'axios';

const props = defineProps({
  channelId: { type: Number, required: true },
  inboxName: { type: String, default: '' },
});
const emit = defineEmits(['close']);
const { t } = useI18n();

const dialogRef = ref(null);
const status = ref({ status: 'loading', phone: null });
const qrCode = ref(null);
const qrError = ref(null);
const isWorking = ref(false);
const pollTimer = ref(null);

const statusColor = computed(() => {
  switch (status.value.status) {
    case 'ready':
      return 'bg-green-100 text-green-800';
    case 'initializing':
      return 'bg-amber-100 text-amber-800';
    case 'stopped':
    case 'unreachable':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-blue-100 text-blue-800';
  }
});

const statusLabel = computed(() => {
  switch (status.value.status) {
    case 'ready':
      return `Conectado — ${status.value.phone || ''}`.trim();
    case 'initializing':
      return 'Esperando escaneo de QR…';
    case 'stopped':
      return 'Sesión detenida — escanea el QR para reconectar';
    case 'unreachable':
      return 'OpenWA no responde';
    default:
      return status.value.status || 'cargando…';
  }
});

// QR is only shown when the user explicitly requests a reconnect (qrReconnectRequested).
// The default view shows the status pill + connect/disconnect button only. This matches
// Chambeabot's flow where the session is pre-linked externally and the QR should never
// appear in the live ops dialog.
const qrReconnectRequested = ref(false);

const showQr = computed(
  () =>
    qrReconnectRequested.value &&
    qrCode.value &&
    status.value.status !== 'ready'
);

const i18nKey = 'CAPTAIN.OPENWA_LIVE_OPS';

const fetchStatus = async () => {
  try {
    const { data } = await axios.get(
      `/api/v2/whatsapp/openwa/channels/${props.channelId}`
    );
    status.value = data;
  } catch (err) {
    status.value = { status: 'unreachable' };
  }
};

const fetchQr = async () => {
  qrError.value = null;
  try {
    const { data } = await axios.get(
      `/api/v2/whatsapp/openwa/channels/${props.channelId}/qr`
    );
    if (data.qrCode) {
      qrCode.value = data.qrCode;
    } else if (data.status?.status === 'ready') {
      qrCode.value = null;
    }
  } catch (err) {
    qrCode.value = null;
    // 400 is expected when already authenticated
    if (err.response?.status !== 400) {
      qrError.value =
        err.response?.data?.message || err.message || 'No se pudo obtener QR';
    }
  }
};

const startSession = async () => {
  isWorking.value = true;
  qrError.value = null;
  // Mark that the user wants a re-link — this gates the QR display via `showQr`.
  qrReconnectRequested.value = true;
  try {
    const { data } = await axios.post(
      `/api/v2/whatsapp/openwa/channels/${props.channelId}/start`
    );
    qrCode.value = data.qrCode || qrCode.value;
    status.value = { status: 'initializing', ...data };
    await fetchStatus();
    startPolling();
  } catch (err) {
    qrError.value =
      err.response?.data?.message || err.message || 'No se pudo iniciar';
  } finally {
    isWorking.value = false;
  }
};

const stopSession = async () => {
  isWorking.value = true;
  try {
    await axios.post(
      `/api/v2/whatsapp/openwa/channels/${props.channelId}/stop`
    );
    qrCode.value = null;
    status.value = { status: 'stopped' };
  } catch (err) {
    useAlert(err.response?.data?.message || 'No se pudo detener la sesión');
  } finally {
    isWorking.value = false;
  }
};

const refresh = async () => {
  isWorking.value = true;
  await fetchStatus();
  // Only fetch the QR if the user explicitly requested a reconnect.
  // Otherwise we just show the status pill + buttons.
  if (qrReconnectRequested.value && status.value.status !== 'ready') {
    await fetchQr();
  } else {
    qrCode.value = null;
  }
  isWorking.value = false;
};

const startPolling = () => {
  stopPolling();
  pollTimer.value = setInterval(async () => {
    await fetchStatus();
    if (status.value.status === 'ready') {
      qrCode.value = null;
      qrReconnectRequested.value = false;
      stopPolling();
    } else if (qrReconnectRequested.value) {
      // Re-fetch QR only if the user is mid-reconnect.
      await fetchQr();
    }
  }, 4000);
};

const stopPolling = () => {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
};

onMounted(async () => {
  // Just fetch status — do NOT auto-poll the QR. The QR is only shown when
  // the user explicitly clicks "reconnect" (qrReconnectRequested). Polling
  // a session that's already linked via wa.me/phone would just fetch a stale
  // QR and confuse the operator.
  isWorking.value = true;
  await fetchStatus();
  isWorking.value = false;
});

onUnmounted(() => stopPolling());

const handleClose = () => {
  stopPolling();
  emit('close');
};

const handleCancel = () => {
  dialogRef.value.close();
};

defineExpose({ dialogRef });
</script>

<template>
  <Dialog
    ref="dialogRef"
    type="modal"
    :title="$t(`${i18nKey}.TITLE`)"
    :description="inboxName"
    :show-cancel-button="false"
    :show-confirm-button="false"
    @close="handleClose"
  >
    <div class="flex flex-col gap-4">
      <!-- Status pill -->
      <div class="flex items-center justify-between">
        <span
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
          :class="statusColor"
        >
          <span class="size-2 rounded-full bg-current" />
          {{ statusLabel }}
        </span>
        <Button
          color="slate"
          size="xs"
          :is-loading="isWorking"
          @click="refresh"
        >
          {{ $t(`${i18nKey}.REFRESH`) }}
        </Button>
      </div>

      <!-- QR display -->
      <div v-if="showQr" class="flex flex-col items-center gap-3">
        <div class="bg-white p-4 rounded-lg border border-n-weak">
          <img :src="qrCode" alt="WhatsApp QR" class="size-72" />
        </div>
        <p class="text-sm text-n-slate-11 text-center max-w-sm">
          {{ $t(`${i18nKey}.QR_INSTRUCTIONS`) }}
        </p>
      </div>

      <!-- Authenticated -->
      <div
        v-else-if="status.status === 'ready'"
        class="flex flex-col items-center gap-3 py-6"
      >
        <span class="i-lucide-check-circle text-5xl text-green-500" />
        <p class="text-base font-medium">
          {{ $t(`${i18nKey}.CONNECTED_MESSAGE`) }}
        </p>
        <p class="text-sm text-n-slate-11">
          {{ status.phone }}
        </p>
      </div>

      <!-- Error -->
      <div
        v-if="qrError"
        class="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-md border border-red-200"
      >
        {{ qrError }}
      </div>

      <!-- Action buttons -->
      <div class="flex justify-end gap-2 pt-2 border-t border-n-weak">
        <Button
          v-if="status.status === 'ready'"
          color="ruby"
          :is-loading="isWorking"
          @click="stopSession"
        >
          {{ $t(`${i18nKey}.DISCONNECT`) }}
        </Button>
        <Button
          v-else
          color-slate="slate"
          :is-loading="isWorking"
          @click="startSession"
        >
          {{
            showQr ? $t(`${i18nKey}.RESTART_SESSION`) : $t(`${i18nKey}.CONNECT`)
          }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>
