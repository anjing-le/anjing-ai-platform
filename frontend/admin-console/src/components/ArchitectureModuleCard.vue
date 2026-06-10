<script setup lang="ts">
import type { PlatformModule } from '@/types/platformModule'

defineProps<{
  module: PlatformModule
  active: boolean
}>()

const emit = defineEmits<{
  select: [module: PlatformModule]
}>()
</script>

<template>
  <article
    class="module-card"
    :class="{ 'module-card--active': active }"
    :style="{ '--module-accent': module.accent }"
    tabindex="0"
    @mouseenter="emit('select', module)"
    @focusin="emit('select', module)"
    @click="emit('select', module)"
  >
    <div class="module-card__header">
      <span class="module-card__name">{{ module.name }}</span>
      <span class="module-card__layer">{{ module.layer }}</span>
    </div>
    <h3>{{ module.title }}</h3>
    <p>{{ module.summary }}</p>
    <div class="module-card__hover">
      <strong>{{ module.role }}</strong>
      <ul>
        <li v-for="item in module.responsibilities" :key="item">{{ item }}</li>
      </ul>
    </div>
  </article>
</template>

