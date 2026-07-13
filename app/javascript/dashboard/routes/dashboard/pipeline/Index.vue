<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
import { useAlert } from 'dashboard/composables';
import Draggable from 'vuedraggable';

import PipelineAPI from 'dashboard/api/pipeline/contacts';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const route = useRoute();
const router = useRouter();
const store = useStore();
const { t } = useI18n();

const stages = ref([]);
const columns = ref({});
const isLoading = ref(false);
const totalCount = ref(0);
const inboxFilter = ref(route.query.inbox_id ? Number(route.query.inbox_id) : null);
const availableInboxes = computed(() => store.getters['inboxes/getInboxes'] || []);

const stageTranslations = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
  'cita-agendada': 'Cita agendada',
  'propuesta-enviada': 'Propuesta enviada',
  ganado: 'Ganado',
  perdido: 'Perdido',
};

const humanizeStage = key => {
  if (stageTranslations[key]) return stageTranslations[key];
  // fall back: capitalize, replace dashes
  return key
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const loadPipeline = async () => {
  isLoading.value = true;
  try {
    const params = {};
    if (inboxFilter.value) params.inbox_id = inboxFilter.value;
    const { data } = await PipelineAPI.get(params);
    stages.value = data.stages;
    columns.value = data.columns;
    totalCount.value = data.total_count;
  } catch (err) {
    useAlert(
      err.response?.data?.error ||
        t('PIPELINE.LOAD_ERROR', { defaultValue: 'No se pudo cargar el pipeline' })
    );
  } finally {
    isLoading.value = false;
  }
};

const onContactMoved = async (event, targetStage) => {
  // vuedraggable emits a few events; we use 'add' which fires when an item
  // is dropped into a new list (the column).
  const { newIndex, item } = event.added || {};
  if (newIndex === undefined || !item) return;
  // `item` is the contact object Vue was dragging around. The new list
  // is targetStage. We send a PATCH to persist the move.
  const contactId = item.id;
  try {
    await PipelineAPI.update({ contactId, pipelineStage: targetStage });
  } catch (err) {
    useAlert(
      err.response?.data?.error ||
        t('PIPELINE.MOVE_ERROR', { defaultValue: 'No se pudo mover el contacto' })
    );
    // Revert locally by reloading
    await loadPipeline();
  }
};

const onContactClick = contact => {
  router.push({
    name: 'contacts_dashboard_show',
    params: { contactId: contact.id },
  });
};

const stageColor = stageKey => {
  const stage = stages.value.find(s => s.key === stageKey);
  return stage?.color || '#94A3B8';
};

const stageCount = stageKey => (columns.value[stageKey] || []).length;

const totalInBoard = computed(() => {
  return Object.values(columns.value).reduce(
    (sum, contacts) => sum + (contacts?.length || 0),
    0
  );
});

const conversionRate = computed(() => {
  const gained = columns.value['ganado']?.length || 0;
  if (totalInBoard.value === 0) return 0;
  return Math.round((gained / totalInBoard.value) * 100);
});

watch(inboxFilter, () => loadPipeline());

onMounted(async () => {
  await store.dispatch('inboxes/get');
  await loadPipeline();
});
</script>

<template>
  <div class="flex flex-col gap-4 h-full overflow-hidden px-6 py-4">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-n-slate-12">
          {{ t('PIPELINE.TITLE', { defaultValue: 'Pipeline de Ventas' }) }}
        </h1>
        <p class="text-sm text-n-slate-11 mt-1">
          {{ totalInBoard }}
          {{ t('PIPLEANEL.CONTACTS_IN_BOARD', { defaultValue: 'contactos en el tablero' }) }}
          ·
          {{ conversionRate }}%
          {{ t('PIPELINE.CONVERSION', { defaultValue: 'conversión a ganado' }) }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="inboxFilter"
          class="bg-n-alpha-1 text-n-slate-12 border border-n-weak rounded-md px-3 py-1.5 text-sm"
        >
          <option :value="null">
            {{ t('PIPELINE.ALL_INBOXES', { defaultValue: 'Todos los inboxes' }) }}
          </option>
          <option
            v-for="inbox in availableInboxes"
            :key="inbox.id"
            :value="inbox.id"
          >
            {{ inbox.name }}
          </option>
        </select>
        <Button
          color="slate"
          size="sm"
          :is-loading="isLoading"
          @click="loadPipeline"
        >
          {{ t('PIPELINE.REFRESH', { defaultValue: 'Refrescar' }) }}
        </Button>
      </div>
    </header>

    <div
      v-if="isLoading && totalInBoard === 0"
      class="flex items-center justify-center h-64"
    >
      <Spinner />
    </div>

    <div
      v-else
      class="flex gap-4 overflow-x-auto pb-4 flex-1 items-stretch"
    >
      <div
        v-for="stage in stages"
        :key="stage.key"
        class="flex-shrink-0 w-72 flex flex-col bg-n-alpha-1 rounded-lg border border-n-weak"
      >
        <header
          class="px-3 py-2.5 border-b border-n-weak flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <span
              class="size-2 rounded-full"
              :style="{ backgroundColor: stage.color }"
            />
            <h2 class="text-sm font-medium text-n-slate-12">
              {{ humanizeStage(stage.key) }}
            </h2>
          </div>
          <span class="text-xs text-n-slate-11">
            {{ stageCount(stage.key) }}
          </span>
        </header>

        <Draggable
          :list="columns[stage.key] || []"
          group="pipeline-contacts"
          item-key="id"
          ghost-class="opacity-50"
          drag-class="rotate-2"
          class="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px]"
          @add="evt => onContactMoved(evt, stage.key)"
        >
          <template #item="{ element: contact }">
            <article
              class="bg-n-background rounded-md border border-n-weak p-3 cursor-grab hover:border-n-brand transition-colors"
              @click="onContactClick(contact)"
            >
              <h3 class="text-sm font-medium text-n-slate-12 line-clamp-1">
                {{ contact.name || t('PIPELINE.UNNAMED_CONTACT', { defaultValue: 'Sin nombre' }) }}
              </h3>
              <p
                v-if="contact.phone_number"
                class="text-xs text-n-slate-11 mt-0.5"
              >
                {{ contact.phone_number }}
              </p>
              <p
                v-else-if="contact.email"
                class="text-xs text-n-slate-11 mt-0.5"
              >
                {{ contact.email }}
              </p>
              <div
                v-if="contact.last_activity_at"
                class="text-[10px] text-n-slate-10 mt-2"
              >
                {{ t('PIPELINE.LAST_ACTIVITY', { defaultValue: 'Última actividad' }) }}:
                {{ new Date(contact.last_activity_at).toLocaleDateString() }}
              </div>
            </article>
          </template>
          <template #footer>
            <div
              v-if="(columns[stage.key] || []).length === 0"
              class="text-center text-xs text-n-slate-10 py-6 border-2 border-dashed border-n-weak rounded-md"
            >
              {{ t('PIPELINE.DROP_HERE', { defaultValue: 'Arrastra un contacto aquí' }) }}
            </div>
          </template>
        </Draggable>
      </div>
    </div>
  </div>
</template>
