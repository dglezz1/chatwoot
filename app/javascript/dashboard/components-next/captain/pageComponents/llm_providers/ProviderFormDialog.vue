<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import LlmProvidersAPI from 'dashboard/api/llmProviders';

import Button from 'dashboard/components-next/button/Button.vue';
import Dialog from 'dashboard/components-next/dialog/Dialog.vue';
import Input from 'dashboard/components-next/input/Input.vue';
import TextArea from 'next/textarea/TextArea.vue';

const props = defineProps({
  provider: { type: Object, default: null },
  available: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'saved']);
const { t } = useI18n();

const form = ref({
  provider: 'minimax',
  label: '',
  api_base: '',
  api_key: '',
  chat_model: '',
  vision_model: '',
  audio_transcription_model: '',
  embedding_model: '',
  enabled: true,
  is_default: false,
});

const isSaving = ref(false);
const errors = ref({});
const isEditing = computed(() => !!props.provider);

const selectedPreset = computed(() => {
  return props.available.find(p => p.slug === form.value.provider) || {};
});

const applyPreset = slug => {
  const preset = props.available.find(p => p.slug === slug);
  if (!preset) return;
  form.value.api_base = preset.api_base || form.value.api_base;
  form.value.chat_model = preset.default_chat_model || '';
  form.value.vision_model = preset.default_vision_model || '';
  form.value.audio_transcription_model = preset.default_audio_transcription_model || '';
  form.value.embedding_model = preset.default_embedding_model || '';
  form.value.label = form.value.label || preset.label || '';
};

onMounted(async () => {
  if (isEditing.value) {
    const { data } = await LlmProvidersAPI.show(props.provider.id);
    form.value = {
      provider: data.provider,
      label: data.label || '',
      api_base: data.api_base || '',
      api_key: data.api_key || '',
      chat_model: data.chat_model || '',
      vision_model: data.vision_model || '',
      audio_transcription_model: data.audio_transcription_model || '',
      embedding_model: data.embedding_model || '',
      enabled: data.enabled,
      is_default: data.is_default,
    };
  } else {
    applyPreset('minimax');
  }
});

const onProviderChange = () => applyPreset(form.value.provider);

const save = async () => {
  isSaving.value = true;
  errors.value = {};
  try {
    if (isEditing.value) {
      await LlmProvidersAPI.update(props.provider.id, form.value);
    } else {
      await LlmProvidersAPI.create(form.value);
    }
    useAlert(t('LLM_PROVIDERS.SAVED', { defaultValue: 'Proveedor guardado' }));
    emit('saved');
  } catch (err) {
    if (err.response?.data?.errors) {
      errors.value = Object.fromEntries(
        err.response.data.errors.map(e => e.split(' ').length > 1 ? [e.split(' ')[0], e] : ['base', e])
      );
    } else {
      useAlert(t('LLM_PROVIDERS.SAVE_ERROR', { defaultValue: 'No se pudo guardar' }));
    }
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <Dialog
    type="modal"
    :title="isEditing ? $t('LLM_PROVIDERS.EDIT_TITLE', { defaultValue: 'Editar proveedor' }) : $t('LLM_PROVIDERS.ADD_TITLE', { defaultValue: 'Agregar proveedor de IA' })"
    :show-cancel-button="false"
    :show-confirm-button="false"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-4 p-2 max-w-xl" @submit.prevent="save">
      <div>
        <label class="text-sm font-medium text-n-slate-12">
          {{ $t('LLM_PROVIDERS.PROVIDER', { defaultValue: 'Proveedor' }) }}
        </label>
        <select
          v-model="form.provider"
          :disabled="isEditing"
          class="mt-1 w-full bg-n-alpha-1 text-n-slate-12 border border-n-weak rounded-md px-3 py-2 text-sm"
          @change="onProviderChange"
        >
          <option v-for="preset in available" :key="preset.slug" :value="preset.slug">
            {{ preset.label }}
          </option>
        </select>
        <p
          v-if="selectedPreset.api_base"
          class="text-xs text-n-slate-11 mt-1"
        >
          {{ $t('LLM_PROVIDERS.DEFAULT_BASE', { defaultValue: 'Base por defecto' }) }}: {{ selectedPreset.api_base }}
        </p>
      </div>

      <div>
        <label class="text-sm font-medium text-n-slate-12">
          {{ $t('LLM_PROVIDERS.LABEL', { defaultValue: 'Etiqueta visible' }) }}
        </label>
        <Input v-model="form.label" placeholder="Mi MiniMax" class="mt-1" />
      </div>

      <div>
        <label class="text-sm font-medium text-n-slate-12">
          {{ $t('LLM_PROVIDERS.API_BASE', { defaultValue: 'API base URL' }) }}
        </label>
        <Input v-model="form.api_base" placeholder="https://api.minimaxi.com/v1" class="mt-1" />
      </div>

      <div>
        <label class="text-sm font-medium text-n-slate-12">
          {{ $t('LLM_PROVIDERS.API_KEY', { defaultValue: 'API Key' }) }}
        </label>
        <Input
          v-model="form.api_key"
          type="password"
          :placeholder="isEditing ? '(sin cambios)' : 'eyJhbGciOi...'"
          class="mt-1"
        />
        <p class="text-xs text-n-slate-11 mt-1">
          {{ $t('LLM_PROVIDERS.API_KEY_HINT', { defaultValue: 'Se cifra en reposo con AES-256-GCM. Solo tú puedes verla.' }) }}
        </p>
      </div>

      <details class="bg-n-alpha-1 rounded-md p-3">
        <summary class="text-sm font-medium text-n-slate-12 cursor-pointer">
          {{ $t('LLM_PROVIDERS.MODELS', { defaultValue: 'Modelos (opcional — autocompletados del preset)' }) }}
        </summary>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-n-slate-11">Chat</label>
            <Input v-model="form.chat_model" class="mt-0.5" />
          </div>
          <div>
            <label class="text-xs text-n-slate-11">Visión (imágenes)</label>
            <Input v-model="form.vision_model" class="mt-0.5" />
          </div>
          <div>
            <label class="text-xs text-n-slate-11">Transcripción de audio</label>
            <Input v-model="form.audio_transcription_model" class="mt-0.5" />
          </div>
          <div>
            <label class="text-xs text-n-slate-11">Embeddings (RAG)</label>
            <Input v-model="form.embedding_model" class="mt-0.5" />
          </div>
        </div>
      </details>

      <div class="flex items-center gap-2">
        <input v-model="form.is_default" type="checkbox" id="is_default" />
        <label for="is_default" class="text-sm text-n-slate-12">
          {{ $t('LLM_PROVIDERS.SET_DEFAULT_LABEL', { defaultValue: 'Usar como predeterminado para Captain' }) }}
        </label>
      </div>

      <div class="flex justify-end gap-2 pt-3 border-t border-n-weak">
        <Button color="slate" :disabled="isSaving" @click="emit('close')">
          {{ $t('LLM_PROVIDERS.CANCEL', { defaultValue: 'Cancelar' }) }}
        </Button>
        <Button color="teal" type="submit" :is-loading="isSaving" @click="save">
          {{ isEditing ? $t('LLM_PROVIDERS.SAVE', { defaultValue: 'Guardar cambios' }) : $t('LLM_PROVIDERS.CREATE', { defaultValue: 'Crear proveedor' }) }}
        </Button>
      </div>
    </form>
  </Dialog>
</template>
