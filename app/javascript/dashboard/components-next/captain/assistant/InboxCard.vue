<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { useToggle } from '@vueuse/core';
import { useI18n } from 'vue-i18n';

import CardLayout from 'dashboard/components-next/CardLayout.vue';
import DropdownMenu from 'dashboard/components-next/dropdown-menu/DropdownMenu.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import Policy from 'dashboard/components/policy.vue';
import { INBOX_TYPES, getInboxIconByType } from 'dashboard/helper/inbox';

import InboxSettingsDialog from 'dashboard/components-next/captain/pageComponents/inbox/InboxSettingsDialog.vue';
import OpenwaLiveOpsDialog from 'dashboard/components-next/captain/pageComponents/inbox/OpenwaLiveOpsDialog.vue';

const props = defineProps({
  id: {
    type: Number,
    required: true,
  },
  inbox: {
    type: Object,
    required: true,
  },
  assistantId: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['action', 'updated']);

const { t } = useI18n();

const [showActionsDropdown, toggleDropdown] = useToggle();
const [showSettingsDialog, toggleSettingsDialog] = useToggle();
const [showLiveOpsDialog, toggleLiveOpsDialog] = useToggle();

const settingsDialogRef = ref(null);
const liveOpsDialogRef = ref(null);

const isOpenwaInbox = computed(
  () => props.inbox.channel_type === 'Channel::Whatsapp'
    && props.inbox.provider === 'openwa'
);

const inboxName = computed(() => {
  const inbox = props.inbox;
  if (!inbox?.name) {
    return '';
  }

  const isTwilioChannel = inbox.channel_type === INBOX_TYPES.TWILIO;
  const isWhatsAppChannel = inbox.channel_type === INBOX_TYPES.WHATSAPP;
  const isEmailChannel = inbox.channel_type === INBOX_TYPES.EMAIL;

  if (isTwilioChannel || isWhatsAppChannel) {
    const identifier = inbox.messaging_service_sid || inbox.phone_number;
    return identifier ? `${inbox.name} (${identifier})` : inbox.name;
  }

  if (isEmailChannel && inbox.email) {
    return `${inbox.name} (${inbox.email})`;
  }

  return inbox.name;
});

const menuItems = computed(() => {
  const items = [];

  if (isOpenwaInbox.value) {
    items.push({
      label: t('CAPTAIN.INBOXES.OPTIONS.LIVE_OPS'),
      value: 'liveops',
      action: 'liveops',
      icon: 'i-lucide-qr-code',
    });
  }

  items.push({
    label: t('CAPTAIN.INBOXES.OPTIONS.SETTINGS'),
    value: 'settings',
    action: 'settings',
    icon: 'i-lucide-settings',
  });
  items.push({
    label: t('CAPTAIN.INBOXES.OPTIONS.DISCONNECT'),
    value: 'delete',
    action: 'delete',
    icon: 'i-lucide-trash',
  });

  return items;
});

const icon = computed(() => {
  const { medium, channel_type: type } = props.inbox;
  return getInboxIconByType(type, medium, 'outline');
});

const handleAction = ({ action, value }) => {
  toggleDropdown(false);
  if (action === 'settings') {
    toggleSettingsDialog(true);
    return;
  }
  if (action === 'liveops') {
    toggleLiveOpsDialog(true);
    return;
  }
  emit('action', { action, value, id: props.id });
};

const handleSettingsClose = () => {
  toggleSettingsDialog(false);
};

const handleLiveOpsClose = () => {
  toggleLiveOpsDialog(false);
};

const handleSettingsUpdated = () => {
  emit('updated', { inboxId: props.inbox.id });
};

// OpenwaLiveOpsDialog wraps a native <dialog> which needs an explicit
// open() call. Drive it from a watcher on the toggle, with nextTick so
// the inner Dialog has actually mounted (its dialogRef is available).
watch(showLiveOpsDialog, async isOpen => {
  if (!isOpen) return;
  await nextTick();
  liveOpsDialogRef.value?.dialogRef?.open?.();
});
</script>

<template>
  <CardLayout>
    <div class="flex justify-between w-full gap-1">
      <span
        class="text-base text-n-slate-12 line-clamp-1 flex items-center gap-2"
      >
        <span :class="icon" />
        {{ inboxName }}
      </span>
      <div class="flex items-center gap-2">
        <Policy
          v-on-clickaway="() => toggleDropdown(false)"
          :permissions="['administrator']"
          class="relative flex items-center group"
        >
          <Button
            icon="i-lucide-ellipsis-vertical"
            color="slate"
            size="xs"
            class="rounded-md group-hover:bg-n-alpha-2"
            @click="toggleDropdown()"
          />
          <DropdownMenu
            v-if="showActionsDropdown"
            :menu-items="menuItems"
            class="mt-1 ltr:right-0 rtl:left-0 top-full"
            @action="handleAction($event)"
          />
        </Policy>
      </div>
    </div>

    <InboxSettingsDialog
      v-if="showSettingsDialog"
      ref="settingsDialogRef"
      :assistant-id="assistantId"
      :inbox-id="inbox.id"
      :inbox-name="inboxName"
      @close="handleSettingsClose"
      @updated="handleSettingsUpdated"
    />

    <OpenwaLiveOpsDialog
      v-if="showLiveOpsDialog && isOpenwaInbox"
      ref="liveOpsDialogRef"
      :channel-id="inbox.channel_id"
      :inbox-name="inboxName"
      @close="handleLiveOpsClose"
    />
  </CardLayout>
</template>
