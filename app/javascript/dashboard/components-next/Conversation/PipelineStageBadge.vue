<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'dashboard/composables/store';
import { useI18n } from 'vue-i18n';
import PipelineAPI from 'dashboard/api/pipeline/contacts';

import MultiselectDropdown from 'shared/components/ui/MultiselectDropdown.vue';

const props = defineProps({
  contactId: { type: Number, default: null },
});

const store = useStore();
const { t } = useI18n();

const currentStage = ref(null);
const availableStages = ref([]);
const isLoading = ref(false);
const isSaving = ref(false);

const stageColorMap = {
  nuevo: '#3B82F6',
  contactado: '#8B5CF6',
  calificado: '#F59E0B',
  'cita-agendada': '#06B6D4',
  'propuesta-enviada': '#F97316',
  ganado: '#10B981',
  perdido: '#EF4444',
};

const currentContact = computed(() => {
  if (!props.contactId) return null;
  return store.getters['contacts/getContactById']?.(props.contactId) || null;
});

const refresh = async () => {
  if (!props.contactId) return;
  isLoading.value = true;
  try {
    const { data } = await PipelineAPI.get();
    availableStages.value = data.stages.map(s => ({
      id: s.key,
      name: humanize(s.key),
      color: s.color || stageColorMap[s.key] || '#94A3B8',
    }));
    currentStage.value = currentContact.value?.custom_attributes?.pipeline_stage || null;
  } catch (err) {
    // Pipeline API not deployed yet — silently no-op
  } finally {
    isLoading.value = false;
  }
};

const humanize = key => {
  const map = {
    nuevo: 'Nuevo',
    contactado: 'Contactado',
    calificado: 'Calificado',
    'cita-agendada': 'Cita agendada',
    'propuesta-enviada': 'Propuesta enviada',
    ganado: 'Ganado',
    perdido: 'Perdido',
  };
  return map[key] || key;
};

const onChange = async newStage => {
  if (!newStage || newStage === currentStage.value) return;
  isSaving.value = true;
  try {
    await PipelineAPI.update({ contactId: props.contactId, pipelineStage: newStage });
    currentStage.value = newStage;
    // Update the contact in the store
    if (currentContact.value) {
      const updated = {
        ...currentContact.value,
        custom_attributes: {
          ...(currentContact.value.custom_attributes || {}),
          pipeline_stage: newStage,
        },
      };
      store.dispatch('contacts/update', updated);
    }
  } catch (err) {
    // silent
  } finally {
    isSaving.value = false;
  }
};

const selectedStage = computed(() => {
  return availableStages.value.find(s => s.id === currentStage.value) || null;
});

watch(() => props.contactId, refresh, { immediate: true });
onMounted(refresh);
</script>

<template>
  <div
    v-if="contactId && availableStages.length"
    class="px-4 py-2 border-b border-n-weak"
  >
    <p class="text-xs font-medium text-n-slate-11 mb-1.5">
      {{ t('CONVERSATION.PIPELINE.STAGE', { defaultValue: 'Etapa del pipeline' }) }}
    </p>
    <MultiselectDropdown
      :options="availableStages"
      :selected-item="selectedStage"
      :multiselector-title="
        t('CONVERSATION.PIPELINE.STAGE_SELECT', {
          defaultValue: 'Mover a etapa',
        })
      "
      :input-placeholder="
        t('CONVERSATION.PIPELINE.SEARCH', { defaultValue: 'Buscar etapa…' })
      "
      :is-loading="isSaving"
      @select="onChange"
    >
      <template #default>
        <div
          v-if="selectedStage"
          class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-n-alpha-1 border border-n-weak text-sm"
        >
          <span
            class="size-2 rounded-full"
            :style="{ backgroundColor: selectedStage.color }"
          />
          <span class="text-n-slate-12">{{ selectedStage.name }}</span>
        </div>
        <div
          v-else
          class="text-xs text-n-slate-10 italic"
        >
          {{ t('CONVERSATION.PIPELINE.NO_STAGE', { defaultValue: 'Sin etapa' }) }}
        </div>
      </template>
    </MultiselectDropdown>
  </div>
</template>
