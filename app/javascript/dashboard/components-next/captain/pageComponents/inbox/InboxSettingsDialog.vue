<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'dashboard/composables/store';
import { useAlert } from 'dashboard/composables';
import { useI18n } from 'vue-i18n';

import Dialog from 'dashboard/components-next/dialog/Dialog.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';
import TextArea from 'dashboard/components-next/textarea/TextArea.vue';

import CaptainInboxesAPI from 'dashboard/api/captain/inboxes';

const props = defineProps({
  assistantId: { type: Number, required: true },
  inboxId: { type: Number, required: true },
  inboxName: { type: String, default: '' },
});

const emit = defineEmits(['close', 'updated']);
const { t } = useI18n();

const dialogRef = ref(null);
const isLoading = ref(false);
const isFetching = ref(false);

const config = ref({
  auto_reply_mode: 'off',
  min_response_delay_seconds: 15,
  max_response_delay_seconds: 45,
  debounce_window_seconds: 20,
  welcome_message: '',
  away_message: '',
  handoff_keywords: [],
  require_human_acknowledgment: true,
  block_list: [],
  daily_reply_cap: 50,
  business_hours: null,
});

const assistantDefaults = ref({
  welcome_message: '',
  handoff_message: '',
  resolution_message: '',
});

const keywordInput = ref('');
const blockListInput = ref('');

const modes = [
  {
    value: 'off',
    label: 'Desactivado (kill switch)',
    description: 'El bot no responde. Tú respondes manualmente. RECOMENDADO para nuevos inboxes.',
    color: 'red',
  },
  {
    value: 'welcome_only',
    label: 'Solo mensajes predefinidos',
    description: 'El bot solo envía mensajes preestablecidos. No consume tokens. Útil como filtro inicial.',
    color: 'amber',
  },
  {
    value: 'ai',
    label: 'IA (respuesta automática con LLM)',
    description: 'El bot responde usando el agente Captain después del mensaje de bienvenida.',
    color: 'blue',
  },
];

const selectedMode = computed({
  get: () => config.value.auto_reply_mode,
  set: v => {
    config.value.auto_reply_mode = v;
  },
});

const fetchConfig = async () => {
  isFetching.value = true;
  try {
    const { data } = await CaptainInboxesAPI.show({
      assistantId: props.assistantId,
      inboxId: props.inboxId,
    });
    const effective = data.config?.effective_config || {};
    config.value = {
      auto_reply_mode: effective.auto_reply_mode || 'off',
      min_response_delay_seconds: effective.min_response_delay_seconds || 15,
      max_response_delay_seconds: effective.max_response_delay_seconds || 45,
      debounce_window_seconds: effective.debounce_window_seconds || 20,
      welcome_message: effective.welcome_message || '',
      away_message: effective.away_message || '',
      handoff_keywords: effective.handoff_keywords || [],
      require_human_acknowledgment: effective.require_human_acknowledgment !== false,
      block_list: effective.block_list || [],
      daily_reply_cap: effective.daily_reply_cap || 50,
      business_hours: effective.business_hours || null,
    };
    assistantDefaults.value = {
      welcome_message: data.assistant?.welcome_message || '',
      handoff_message: data.assistant?.handoff_message || '',
      resolution_message: data.assistant?.resolution_message || '',
    };
  } catch (error) {
    useAlert('No se pudo cargar la configuración');
  } finally {
    isFetching.value = false;
  }
};

const addKeyword = () => {
  const kw = keywordInput.value.trim();
  if (!kw) return;
  if (!config.value.handoff_keywords.includes(kw)) {
    config.value.handoff_keywords.push(kw);
  }
  keywordInput.value = '';
};

const removeKeyword = kw => {
  config.value.handoff_keywords = config.value.handoff_keywords.filter(k => k !== kw);
};

const addBlockedNumber = () => {
  const num = blockListInput.value.trim().replace(/[^\d]/g, '');  // strip non-digits
  if (!num) return;
  if (!config.value.block_list.includes(num)) {
    config.value.block_list.push(num);
  }
  blockListInput.value = '';
};

const removeBlockedNumber = num => {
  config.value.block_list = config.value.block_list.filter(n => n !== num);
};

const validate = () => {
  const c = config.value;
  if (c.min_response_delay_seconds < 0 || c.min_response_delay_seconds > 600) {
    return 'El delay mínimo debe estar entre 0 y 600 segundos';
  }
  if (c.max_response_delay_seconds < c.min_response_delay_seconds) {
    return 'El delay máximo debe ser mayor o igual al mínimo';
  }
  if (c.max_response_delay_seconds > 600) {
    return 'El delay máximo no puede ser mayor a 600 segundos (10 min)';
  }
  if (c.debounce_window_seconds < 5 || c.debounce_window_seconds > 120) {
    return 'La ventana de agrupación debe estar entre 5 y 120 segundos';
  }
  if (c.daily_reply_cap < 0 || c.daily_reply_cap > 10000) {
    return 'El cap diario debe estar entre 0 y 10000 (0 = ilimitado)';
  }
  return null;
};

const validationError = computed(() => validate());

const sampleDelay = computed(() => {
  const min = config.value.min_response_delay_seconds || 0;
  const max = config.value.max_response_delay_seconds || min;
  return `${min}-${max}s`;
});

const sampleResponseTime = computed(() => {
  if (config.value.auto_reply_mode === 'off') return 'Bot desactivado';
  const delay = Math.round(
    (config.value.min_response_delay_seconds + config.value.max_response_delay_seconds) / 2
  );
  const debounce = config.value.debounce_window_seconds;
  return `${delay + debounce}s (${delay}s delay + ${debounce}s agrupar)`;
});

const isBotOn = computed(() => config.value.auto_reply_mode !== 'off');

const handleSubmit = async () => {
  if (validationError.value) {
    useAlert(validationError.value);
    return;
  }
  isLoading.value = true;
  try {
    await CaptainInboxesAPI.update({
      assistantId: props.assistantId,
      inboxId: props.inboxId,
      config: {
        auto_reply_mode: config.value.auto_reply_mode,
        min_response_delay_seconds: config.value.min_response_delay_seconds,
        max_response_delay_seconds: config.value.max_response_delay_seconds,
        debounce_window_seconds: config.value.debounce_window_seconds,
        welcome_message: config.value.welcome_message || null,
        away_message: config.value.away_message || null,
        handoff_keywords: config.value.handoff_keywords,
        require_human_acknowledgment: config.value.require_human_acknowledgment,
        block_list: config.value.block_list,
        daily_reply_cap: config.value.daily_reply_cap,
        business_hours: config.value.business_hours,
      },
    });
    useAlert(isBotOn.value ? 'Bot activado' : 'Bot desactivado');
    emit('updated');
    dialogRef.value.close();
  } catch (error) {
    const msg = error?.response?.data?.error || error?.message || 'No se pudo guardar la configuración';
    useAlert(msg);
  } finally {
    isLoading.value = false;
  }
};

const handleCancel = () => dialogRef.value.close();

const useDefaultWelcome = () => {
  config.value.welcome_message = assistantDefaults.value.welcome_message || '';
};

onMounted(() => fetchConfig());

defineExpose({ dialogRef });
</script>

<template>
  <Dialog
    ref="dialogRef"
    type="edit"
    :title="`Bot: ${inboxName}`"
    description="Configura cómo el bot responde automáticamente en este inbox"
    :cancel-button-label="t('CAPTAIN.INBOXES.SETTINGS.CANCEL')"
    :confirm-button-label="isBotOn ? 'Guardar y mantener activo' : 'Guardar'"
    :is-loading="isLoading"
    :disable-confirm-button="isLoading || isFetching || !!validationError"
    width="3xl"
    @close="emit('close')"
    @confirm="handleSubmit"
    @cancel="handleCancel"
  >
    <div v-if="isFetching" class="flex justify-center py-8">
      <span class="i-lucide-loader-2 animate-spin text-2xl text-n-slate-10" />
    </div>

    <div v-else class="flex flex-col gap-6">
      <!-- Status banner -->
      <div
        class="rounded-lg p-3 text-sm flex items-start gap-2"
        :class="isBotOn
          ? 'bg-n-amber-2 text-n-amber-12 border border-n-amber-7'
          : 'bg-n-green-2 text-n-green-12 border border-n-green-7'"
      >
        <span :class="isBotOn ? 'i-lucide-bot text-lg' : 'i-lucide-shield-check text-lg'" />
        <div>
          <strong>{{ isBotOn ? 'Bot activo' : 'Bot desactivado (kill switch ON)' }}</strong>
          <div class="text-xs opacity-90 mt-0.5">
            {{ isBotOn
              ? 'El bot responderá automáticamente a mensajes de clientes. Ten cuidado con números random.'
              : 'El bot NO responderá automáticamente. Tú respondes manualmente. Recomendado para empezar.' }}
          </div>
        </div>
      </div>

      <!-- Auto-reply mode -->
      <section>
        <h3 class="text-sm font-semibold text-n-slate-12 mb-3">
          {{ t('CAPTAIN.INBOXES.SETTINGS.MODE_TITLE') }}
        </h3>
        <div class="flex flex-col gap-2">
          <label
            v-for="mode in modes"
            :key="mode.value"
            class="flex items-start gap-3 p-3 rounded-lg border border-n-weak cursor-pointer hover:border-n-slate-7 transition"
            :class="{ 'border-n-blue-9 bg-n-blue-1': selectedMode === mode.value }"
          >
            <input v-model="selectedMode" type="radio" :value="mode.value" class="mt-1" />
            <div>
              <div class="text-sm font-medium text-n-slate-12">{{ mode.label }}</div>
              <div class="text-xs text-n-slate-11 mt-0.5">{{ mode.description }}</div>
            </div>
          </label>
        </div>
      </section>

      <!-- Safety guards (only show when bot is enabled) -->
      <section v-if="isBotOn">
        <h3 class="text-sm font-semibold text-n-slate-12 mb-1">
          Guardas de seguridad
        </h3>
        <p class="text-xs text-n-slate-11 mb-3">
          Evita que el bot responda a números random o se descontrole.
        </p>

        <div class="space-y-3">
          <!-- Require human acknowledgment -->
          <label class="flex items-start gap-3 p-3 rounded-lg border border-n-weak">
            <input
              v-model="config.require_human_acknowledgment"
              type="checkbox"
              class="mt-1"
            />
            <div>
              <div class="text-sm font-medium text-n-slate-12">
                Solo responder a contactos conocidos
              </div>
              <div class="text-xs text-n-slate-11 mt-0.5">
                El bot NO responde a contactos que nunca han hablado con un humano en este inbox.
                Hasta que un agente humano abra la conversación, el bot se queda callado.
                <strong>Recomendado para producción.</strong>
              </div>
            </div>
          </label>

          <!-- Block list -->
          <div class="p-3 rounded-lg border border-n-weak">
            <div class="text-sm font-medium text-n-slate-12 mb-1">
              Block list (números que NUNCA reciben respuesta del bot)
            </div>
            <div class="text-xs text-n-slate-11 mb-2">
              Ingresa el número sin el signo +. Coincide por dígitos, así que
              "5215556667777" también bloquea "5556667777".
            </div>
            <div class="flex gap-2 mb-2">
              <Input
                v-model="blockListInput"
                placeholder="5215556667777"
                class="flex-1"
                @keyup.enter="addBlockedNumber"
              />
              <Button color="blue" size="sm" @click="addBlockedNumber">
                Bloquear
              </Button>
            </div>
            <div v-if="config.block_list.length" class="flex flex-wrap gap-2">
              <span
                v-for="num in config.block_list"
                :key="num"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-n-ruby-2 text-n-ruby-12 text-xs"
              >
                +{{ num }}
                <button
                  type="button"
                  class="i-lucide-x hover:text-n-ruby-9"
                  @click="removeBlockedNumber(num)"
                />
              </span>
            </div>
          </div>

          <!-- Daily cap -->
          <div class="p-3 rounded-lg border border-n-weak">
            <div class="text-sm font-medium text-n-slate-12 mb-1">
              Cap diario de respuestas
            </div>
            <div class="text-xs text-n-slate-11 mb-2">
              Máximo de respuestas automáticas que el bot puede enviar por día en este inbox.
              0 = ilimitado. Default: 50.
            </div>
            <Input
              v-model.number="config.daily_reply_cap"
              type="number"
              min="0"
              max="10000"
            />
          </div>
        </div>
      </section>

      <!-- Response delay -->
      <section v-if="isBotOn">
        <h3 class="text-sm font-semibold text-n-slate-12 mb-1">
          {{ t('CAPTAIN.INBOXES.SETTINGS.DELAY_TITLE') }}
        </h3>
        <p class="text-xs text-n-slate-11 mb-3">
          Random delay (en segundos) antes de que el bot responda. Hace que el bot se sienta humano.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-n-slate-11 block mb-1">Mínimo</label>
            <Input
              v-model.number="config.min_response_delay_seconds"
              type="number"
              min="0"
              max="600"
            />
          </div>
          <div>
            <label class="text-xs text-n-slate-11 block mb-1">Máximo</label>
            <Input
              v-model.number="config.max_response_delay_seconds"
              type="number"
              min="0"
              max="600"
            />
          </div>
        </div>
        <p class="text-xs text-n-slate-11 mt-2">Rango: <strong>{{ sampleDelay }}</strong></p>
      </section>

      <!-- Debounce window -->
      <section v-if="isBotOn">
        <h3 class="text-sm font-semibold text-n-slate-12 mb-1">
          {{ t('CAPTAIN.INBOXES.SETTINGS.DEBOUNCE_TITLE') }}
        </h3>
        <p class="text-xs text-n-slate-11 mb-3">
          Cuánto espera el bot por mensajes adicionales antes de responder.
        </p>
        <Input
          v-model.number="config.debounce_window_seconds"
          type="number"
          min="5"
          max="120"
        />
        <p class="text-xs text-n-slate-11 mt-2">
          Tiempo total: <strong>{{ sampleResponseTime }}</strong>
        </p>
      </section>

      <!-- Welcome message -->
      <section v-if="isBotOn">
        <h3 class="text-sm font-semibold text-n-slate-12 mb-1">
          Mensaje de bienvenida
        </h3>
        <p class="text-xs text-n-slate-11 mb-3">
          Enviado en el primer contacto. Déjalo vacío para usar el del Assistant.
        </p>
        <TextArea
          v-model="config.welcome_message"
          placeholder="Deja vacío para usar el del Assistant..."
          rows="3"
        />
        <Button
          v-if="assistantDefaults.welcome_message"
          size="xs"
          color="slate"
          variant="ghost"
          class="mt-2"
          @click="useDefaultWelcome"
        >
          Usar mensaje del Assistant
        </Button>
      </section>

      <!-- Handoff keywords -->
      <section v-if="isBotOn">
        <h3 class="text-sm font-semibold text-n-slate-12 mb-1">
          {{ t('CAPTAIN.INBOXES.SETTINGS.HANDOFF_TITLE') }}
        </h3>
        <p class="text-xs text-n-slate-11 mb-3">
          Si el cliente escribe estas palabras, el bot pausa y un humano toma el control.
        </p>
        <div class="flex gap-2 mb-2">
          <Input v-model="keywordInput" placeholder="hablar con humano" class="flex-1" @keyup.enter="addKeyword" />
          <Button color="blue" size="sm" @click="addKeyword">Agregar</Button>
        </div>
        <div v-if="config.handoff_keywords.length" class="flex flex-wrap gap-2">
          <span
            v-for="kw in config.handoff_keywords"
            :key="kw"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-n-alpha-2 text-xs"
          >
            {{ kw }}
            <button type="button" class="i-lucide-x text-n-slate-10 hover:text-n-slate-12" @click="removeKeyword(kw)" />
          </span>
        </div>
      </section>

      <p v-if="validationError" class="text-xs text-n-ruby-9 bg-n-ruby-2 px-3 py-2 rounded-md">
        {{ validationError }}
      </p>
    </div>
  </Dialog>
</template>
