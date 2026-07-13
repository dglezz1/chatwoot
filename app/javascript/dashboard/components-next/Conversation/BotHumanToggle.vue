<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'dashboard/composables/store';
import { useAlert } from 'dashboard/composables';
import { useI18n } from 'vue-i18n';
import CaptainConversationsAPI from 'dashboard/api/captain/conversations';

import Button from 'dashboard/components-next/button/Button.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';

const props = defineProps({
  conversationId: { type: Number, required: true },
  inboxId: { type: Number, default: null },
});

const store = useStore();
const { t } = useI18n();

const isPaused = ref(false);
const isLoading = ref(false);
const isWorking = ref(false);
const reason = ref('');
const lastChangedAt = ref(null);

const currentChat = computed(() => store.getters.getSelectedChat);
const isCaptainInbox = computed(() => {
  const inbox = currentChat.value?.inbox;
  return !!inbox?.captain_assistant;
});

const refresh = async () => {
  if (!props.conversationId) return;
  isLoading.value = true;
  try {
    const { data } = await CaptainConversationsAPI.status(props.conversationId);
    isPaused.value = !!data.captain_paused;
    lastChangedAt.value = data.captain_paused_at;
  } catch (err) {
    // Silent — don't break the sidebar if the API is missing on this build
    isPaused.value = false;
  } finally {
    isLoading.value = false;
  }
};

const toggle = async () => {
  isWorking.value = true;
  try {
    const target = !isPaused.value;
    const { data } = await (target
      ? CaptainConversations.pause
        ? CaptainConversationsAPI.pause(props.conversationId, {
            paused: true,
            reason: reason.value || null,
          })
        : CaptainConversationsAPI.pause(props.conversationId)
      : CaptainConversationsAPI.resume(props.conversationId));
    isPaused.value = !!data.captain_paused;
    lastChangedAt.value = data.captain_paused_at;
    reason.value = '';
    useAlert(
      target
        ? t('CONVERSATION.BOT_TOGGLE.PAUSED', {
            defaultValue: 'Bot pausado en esta conversación',
          })
        : t('CONVERSATION.BOT_TOGGLE.RESUMED', {
            defaultValue: 'Bot reactivado',
          })
    );
  } catch (err) {
    useAlert(
      err.response?.data?.error ||
        t('CONVERSATION.BOT_TOGGLE.ERROR', {
          defaultValue: 'No se pudo cambiar el estado del bot',
        })
    );
  } finally {
    isWorking.value = false;
  }
};

watch(
  () => props.conversationId,
  () => refresh()
);

onMounted(refresh);
</script>

<template>
  <div
    v-if="isCaptainInbox"
    class="px-4 py-3 border-b border-n-weak bg-n-alpha-1"
  >
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span
          class="size-2 rounded-full"
          :class="isPaused ? 'bg-n-amber-10' : 'bg-n-green-10'"
        />
        <span class="text-xs font-medium text-n-slate-12">
          {{
            isPaused
              ? t('CONVERSATION.BOT_TOGGLE.BOT_PAUSED', {
                  defaultValue: 'Bot pausado',
                })
              : t('CONVERSATION.BOT_TOGGLE.BOT_ACTIVE', {
                  defaultValue: 'Bot activo',
                })
          }}
        </span>
      </div>
      <Button
        size="xs"
        :color="isPaused ? 'teal' : 'amber'"
        :is-loading="isWorking"
        @click="toggle"
      >
        {{
          isPaused
            ? t('CONVERSATION.BOT_TOGGLE.RESUME', {
                defaultValue: 'Reanudar bot',
              })
            : t('CONVERSATION.BOT_TOGGLE.PAUSE', {
                defaultValue: 'Pausar bot',
              })
        }}
      </Button>
    </div>
    <p
      v-if="isPaused && lastChangedAt"
      class="text-[10px] text-n-slate-11 mt-1"
    >
      {{ t('CONVERSATION.BOT_TOGGLE.PAUSED_AT', { defaultValue: 'Pausado el' }) }}
      {{ new Date(lastChangedAt).toLocaleString() }}
    </p>
  </div>
</template>
