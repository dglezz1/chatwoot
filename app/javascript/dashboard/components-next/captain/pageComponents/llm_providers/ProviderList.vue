<script setup>
import ProviderCard from './ProviderCard.vue';

defineProps({
  providers: { type: Array, required: true },
  available: { type: Array, default: () => [] },
});

defineEmits(['edit', 'delete', 'set-default', 'validate']);
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <ProviderCard
      v-for="provider in providers"
      :key="provider.id"
      :provider="provider"
      :available="available"
      @edit="$emit('edit', provider)"
      @delete="$emit('delete', provider)"
      @set-default="$emit('set-default', provider)"
      @validate="$emit('validate', provider)"
    />
  </div>
</template>
