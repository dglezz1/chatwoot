<script setup>
import { ref, watch, nextTick, onMounted, computed, reactive } from 'vue';
import { useStore } from 'dashboard/composables/store';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import LlmProvidersAPI from 'dashboard/api/llmProviders';

import Button from 'dashboard/components-next/button/Button.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';
import ProviderCard from 'dashboard/components-next/captain/pageComponents/llm_providers/ProviderCard.vue';
import ProviderFormDialog from 'dashboard/components-next/captain/pageComponents/llm_providers/ProviderFormDialog.vue';
import ProviderList from 'dashboard/components-next/captain/pageComponents/llm_providers/ProviderList.vue';

const { t } = useI18n();
const store = useStore();
const formDialogRef = ref(null);

const providers = ref([]);
const available = ref([]);
const isLoading = ref(false);
const isDialogOpen = ref(false);
const editingProvider = ref(null);

// Open the native <dialog> when the v-if condition flips to true.
// The ProviderFormDialog auto-mounts on isDialogOpen=true (v-if),
// so we wait one tick for the template ref to be bound, then call
// .open() on its inner dialogRef (which calls showModal()).
watch(isDialogOpen, async open => {
  if (!open) return;
  await nextTick();
  formDialogRef.value?.open?.();
});

const loadProviders = async () => {
  isLoading.value = true;
  try {
    const [{ data: list }, { data: presets }] = await Promise.all([
      LlmProvidersAPI.get(),
      LlmProvidersAPI.getAvailable(),
    ]);
    providers.value = list;
    available.value = presets;
  } catch (err) {
    useAlert('No se pudieron cargar los proveedores LLM');
  } finally {
    isLoading.value = false;
  }
};

const openCreate = () => {
  editingProvider.value = null;
  isDialogOpen.value = true;
};

const openEdit = provider => {
  editingProvider.value = provider;
  isDialogOpen.value = true;
};

const onSaved = async () => {
  isDialogOpen.value = false;
  await loadProviders();
};

const onDelete = async provider => {
  if (!confirm(`¿Eliminar el proveedor "${provider.label || provider.provider}"?`)) return;
  try {
    await LlmProvidersAPI.destroy(provider.id);
    await loadProviders();
  } catch (err) {
    useAlert('No se pudo eliminar');
  }
};

const onSetDefault = async provider => {
  try {
    await LlmProvidersAPI.setDefault(provider.id);
    await loadProviders();
  } catch (err) {
    useAlert('No se pudo marcar como predeterminado');
  }
};

const onValidate = async provider => {
  try {
    const { data } = await LlmProvidersAPI.validate(provider.id);
    if (data.ok) {
      useAlert(`✅ Conectado. ${data.model_count} modelos disponibles.`);
    } else {
      useAlert(`❌ ${data.error}`);
    }
    await loadProviders();
  } catch (err) {
    useAlert('Error al validar');
  }
};

onMounted(loadProviders);
</script>

<template>
  <div class="flex flex-col gap-6 max-w-5xl mx-auto py-8 px-6">
    <header class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-n-slate-12">
          {{ t('LLM_PROVIDERS.TITLE', { defaultValue: 'Proveedores de IA' }) }}
        </h1>
        <p class="text-sm text-n-slate-11 mt-1 max-w-2xl">
          {{
            t('LLM_PROVIDERS.SUBTITLE', {
              defaultValue:
                'Conecta Chambeabot a MiniMax, OpenAI, OpenRouter u otros proveedores compatibles con OpenAI. Las claves se cifran en reposo. Captain las usará para chat, transcripción de audio, visión de imágenes y comprensión de video.',
            })
          }}
        </p>
      </div>
      <Button
        color="teal"
        :is-loading="isLoading"
        @click="openCreate"
      >
        + {{ t('LLM_PROVIDERS.ADD', { defaultValue: 'Agregar proveedor' }) }}
      </Button>
    </header>

    <div v-if="isLoading && providers.length === 0" class="flex items-center justify-center h-32">
      <Spinner />
    </div>

    <ProviderList
      v-else-if="providers.length"
      :providers="providers"
      :available="available"
      @edit="openEdit"
      @delete="onDelete"
      @set-default="onSetDefault"
      @validate="onValidate"
    />

    <div
      v-else
      class="border-2 border-dashed border-n-weak rounded-lg p-12 text-center"
    >
      <p class="text-n-slate-11 text-sm mb-3">
        {{ t('LLM_PROVIDERS.EMPTY', { defaultValue: 'No hay proveedores configurados. Captain usará las variables de entorno del sistema como respaldo.' }) }}
      </p>
      <Button color="slate" @click="openCreate">
        {{ t('LLM_PROVIDERS.ADD_FIRST', { defaultValue: 'Configurar el primero' }) }}
      </Button>
    </div>

    <ProviderFormDialog
      v-if="isDialogOpen"
      ref="formDialogRef"
      :provider="editingProvider"
      :available="available"
      @close="isDialogOpen = false"
      @saved="onSaved"
    />
  </div>
</template>
