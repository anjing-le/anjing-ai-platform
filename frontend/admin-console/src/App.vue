<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ConsoleShell from '@/components/ConsoleShell.vue'
import HeroSection from '@/components/HeroSection.vue'

const currentHash = ref(window.location.hash)

function syncHash() {
  currentHash.value = window.location.hash
}

onMounted(() => {
  window.addEventListener('hashchange', syncHash)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncHash)
})

const currentRoute = computed(() => currentHash.value.replace(/^#/, ''))
const isConsole = computed(() => currentRoute.value.startsWith('/console'))
</script>

<template>
  <ConsoleShell v-if="isConsole" :current-route="currentRoute" />
  <main v-else class="platform-home">
    <HeroSection />
  </main>
</template>
