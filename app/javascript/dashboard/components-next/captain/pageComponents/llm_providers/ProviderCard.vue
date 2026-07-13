<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  provider: { type: Object, required: true },
  available: { type: Array, default: () => [] },
});

defineEmits(['edit', 'delete', 'set-default', 'validate']);

const { t } = useI18n();

const preset = computed(() => {
  return props.available.find(a => a.slug === props.provider.provider) || {};
});

const capabilities = computed(() => {
  return props.provider.capabilities || preset.value?.capabilities || {};
});

const capabilityChips = computed(() => {
  const chips = [];
  if (capabilities.value.text) chips.push({ key: 'text', label: 'Texto', icon: 'i-lucide-message-square' });
  if (capabilities.value.images) chips.push({ key: 'images', label: 'Imágenes', icon: 'i-lucide-image' });
  if (capabilities.value.audio_input) chips.push({ key: 'audio', label: 'Audio', icon: 'i-lucide-mic' });
  if (capabilities.value.video) chips.push({ key: 'video', label: 'Video', icon: 'i-lucide-video' });
  if (capabilities.value.embeddings) chips.push({ key: 'embeddings', label: 'Embeddings', icon: 'i-lucide-hash' });
  return chips;
});

const validationStatus = computed(() => {
  if (props.provider.last_validation_error) return { color: 'red', label: 'Error' };
  if (props.provider.last_validated_at) return { color: 'green', label: 'Validado' };
  return { color: 'amber', label: 'Sin validar' };
});

const validationColorMap = {
  red: 'bg-red-100 text-red-800',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
};
</script>

<template>
  <article class="bg-n-background border border-n-weak rounded-lg p-5 flex flex-col gap-3">
    <header class="flex items-start justify-between">
      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-base font-medium text-n-slate-12">
            {{ provider.label || preset.label || provider.provider }}
          </h3>
          <span
            v-if="provider.is_default"
            class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-100 text-teal-800"
          >
            Predeterminado
          </span>
        </div>
        <p class="text-xs text-n-slate-11 mt-0.5">{{ provider.api_base }}</p>
        <p class="text-xs text-n-slate-10 mt-0.5">
          Key: <code class="text-[10px] bg-n-alpha-1 px-1.5 py-0.5 rounded">{{ provider.api_key_masked || '••••' }}</code>
        </p>
      </div>
      <span
        class="px-2 py-0.5 rounded-full text-[10px] font-medium"
        :class="validationColorMap[validationStatus.color]"
      >
        {{ validationStatus.label }}
      </span>
    </header>

    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      <div v-if="provider.chat_model" class="flex flex-col">
        <span class="text-n-slate-10">Chat</span>
        <code class="text-n-slate-12 text-[11px]">{{ provider.chat_model }}</code>
      </div>
      <div v-if="provider.vision_model" class="flex flex-col">
        <span class="text-n-slate-10">Visión</span>
        <code class="text-n-slate-12 text-[11px]">{{ provider.vision_model }}</code>
      </div>
      <div v-if="provider.audio_transcription_model" class="flex flex-col">
        <span class="text-n-slate-10">Transcripción</span>
        <code class="text-n-slate-12 text-[11px]">{{ provider.audio_transcription_model }}</code>
      </div>
      <div v-if="provider.embedding_model" class="flex flex-col">
        <span class="text-n-slate-10">Embeddings</span>
        <code class="text-n-slate-12 text-[11px]">{{ provider.embedding_model }}</code>
      </div>
    </div>

    <div v-if="capabilityChips.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="chip in capabilityChips"
        :key="chip.key"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-n-alpha-1 text-n-slate-12"
      >
        <span :class="chip.icon" class="size-3" />
        {{ chip.label }}
      </span>
    </div>

    <p
      v-if="provider.last_validation_error"
      class="text-xs text-red-600 bg-red-50 rounded-md p-2"
    >
      {{ provider.last_validation_error }}
    </p>

    <footer class="flex items-center gap-2 pt-2 border-t border-n-weak">
      <Button size="xs" color="slate" @click="$emit('validate', provider)">
        {{ t('LLM_PROVIDERS.VALIDATE', { defaultValue: 'Validar' }) }}
      </Button>
      <Button
        v-if="!provider.is_default"
        size="xs"
        color="teal"
        @click="$emit('set-default', provider)"
      >
        {{ t('LLM_PROVIDERS.SET_DEFAULT', { defaultValue: 'Hacer predeterminado' }) }}
      </Button>
      <Button size="xs" color="slate" @click="$emit('edit', provider)">
        {{ t('LLM_PROVIDERS.EDIT', { defaultValue: 'Editar' }) }}
      </Button>
      <Button size="xs" color="ruby" @click="$emit('delete', provider)">
        {{ t('LLM_PROVIDERS.DELETE', { defaultValue: 'Eliminar' }) }}
      </Button>
    </footer>
  </article>
</template>
