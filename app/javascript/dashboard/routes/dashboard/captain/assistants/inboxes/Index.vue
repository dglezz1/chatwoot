<script setup>
import { computed, watch, ref, nextTick, onMounted } from 'vue';
import { useStore } from 'dashboard/composables/store';
import { useRoute } from 'vue-router';
import { FEATURE_FLAGS } from 'dashboard/featureFlags';

import DeleteDialog from 'dashboard/components-next/captain/pageComponents/DeleteDialog.vue';
import PageLayout from 'dashboard/components-next/captain/PageLayout.vue';
import ConnectInboxDialog from 'dashboard/components-next/captain/pageComponents/inbox/ConnectInboxDialog.vue';
import InboxCard from 'dashboard/components-next/captain/assistant/InboxCard.vue';
import InboxPageEmptyState from 'dashboard/components-next/captain/pageComponents/emptyStates/InboxPageEmptyState.vue';

const store = useStore();
const dialogType = ref('');
const route = useRoute();

const assistantId = computed(() => Number(route.params.assistantId));

// Read directly from store state via a wrapper that always returns an array.
// This avoids the `useMapGetter` reactivity edge case where the v-for
// silently fails to expand after the first render.
const captainInboxes = computed(() => {
  const list = store.state.captainInboxes?.records || [];
  return [...list].sort((a, b) => b.id - a.id);
});

const isFetchingAssistant = computed(
  () => !!store.state.captainAssistants?.uiFlags?.fetchingItem
);
const isFetching = computed(
  () => !!store.state.captainInboxes?.uiFlags?.fetchingList
);

const isEmpty = computed(() => captainInboxes.value.length === 0);

const selectedInbox = ref(null);
const disconnectInboxDialog = ref(null);

const handleDelete = () => {
  disconnectInboxDialog.value?.dialogRef?.open();
};

const connectInboxDialog = ref(null);

const handleCreate = () => {
  dialogType.value = 'create';
  nextTick(() => connectInboxDialog.value?.dialogRef?.open());
};

const handleAction = ({ action, id }) => {
  selectedInbox.value = captainInboxes.value.find(inbox => id === inbox.id);
  nextTick(() => {
    if (action === 'delete') {
      handleDelete();
    }
  });
};

const handleCreateClose = () => {
  dialogType.value = '';
  selectedInbox.value = null;
};

const loadInboxes = async () => {
  const newId = assistantId.value;
  if (!newId) return;
  try {
    await store.dispatch('captainInboxes/get', { assistantId: newId });
  } catch (e) {
    // swallow — UI shows empty state on no data
  }
};

watch(assistantId, loadInboxes, { immediate: false });

onMounted(loadInboxes);
</script>

<template>
  <PageLayout
    :header-title="$t('CAPTAIN.INBOXES.HEADER')"
    :button-label="$t('CAPTAIN.INBOXES.ADD_NEW')"
    :button-policy="['administrator']"
    :is-fetching="isFetchingAssistant || isFetching"
    :is-empty="isEmpty"
    :show-pagination-footer="false"
    :show-know-more="false"
    :feature-flag="FEATURE_FLAGS.CAPTAIN"
    @click="handleCreate"
  >
    <template #emptyState>
      <InboxPageEmptyState @click="handleCreate" />
    </template>

    <template #body>
      <div class="grid grid-cols-1 gap-4">
        <InboxCard
          v-for="captainInbox in captainInboxes"
          v-bind:key="captainInbox.id"
          :id="captainInbox.id"
          :inbox="captainInbox"
          :assistant-id="assistantId"
          @action="handleAction"
        />
      </div>
    </template>

    <DeleteDialog
      v-if="selectedInbox"
      ref="disconnectInboxDialog"
      :entity="selectedInbox"
      :delete-payload="{
        assistantId: assistantId,
        inboxId: selectedInbox.id,
      }"
      type="Inboxes"
    />

    <ConnectInboxDialog
      v-if="dialogType"
      ref="connectInboxDialog"
      :assistant-id="assistantId"
      :type="dialogType"
      @close="handleCreateClose"
    />
  </PageLayout>
</template>
