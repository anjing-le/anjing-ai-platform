<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AdminPageView from '@/components/AdminPageView.vue'
import ConsoleHomeView from '@/components/ConsoleHomeView.vue'
import { adminPages } from '@/data/adminPages'
import { consoleEntries, platformRoles } from '@/data/accessModel'
import type { PlatformRoleId } from '@/types/accessModel'

const props = defineProps<{
  currentRoute: string
}>()

const activeRoleId = ref<PlatformRoleId>('admin')

const activeRole = computed(() => platformRoles.find((role) => role.id === activeRoleId.value) || platformRoles[0])
const visibleEntries = computed(() => consoleEntries.filter((entry) => entry.roles.includes(activeRoleId.value)))

const normalizedRoute = computed(() => {
  if (props.currentRoute === '/console') {
    return '/console/home'
  }
  if (props.currentRoute === '/console/examples') {
    return '/console/docs'
  }
  return props.currentRoute
})

const activeEntry = computed(() => {
  return visibleEntries.value.find((entry) => entry.route === normalizedRoute.value) || visibleEntries.value[0] || consoleEntries[0]
})

const activePage = computed(() => {
  return adminPages.find((page) => page.id === activeEntry.value.id) || adminPages[0]
})
const isHome = computed(() => activeEntry.value.id === 'home')

function navigateTo(route: string) {
  window.location.hash = route
}

watch(
  [activeRoleId, normalizedRoute],
  () => {
    const routeVisible = visibleEntries.value.some((entry) => entry.route === normalizedRoute.value)
    if (!routeVisible) {
      navigateTo((visibleEntries.value[0] || consoleEntries[0]).route)
    }
  },
  { immediate: true }
)

watch(activeRoleId, () => {
  if (!visibleEntries.value.some((entry) => entry.id === activeEntry.value.id)) {
    navigateTo((visibleEntries.value[0] || consoleEntries[0]).route)
  }
})

watch(
  () => props.currentRoute,
  () => {
    window.scrollTo({ top: 0 })
  },
  { immediate: true }
)
</script>

<template>
  <div class="console-shell">
    <aside class="console-sidebar">
      <a class="console-sidebar__brand" href="#">
        <span>anjing</span>
        <strong>AI Platform</strong>
      </a>
      <nav class="console-sidebar__nav" aria-label="后台模块">
        <a
          v-for="entry in visibleEntries"
          :key="entry.id"
          :href="`#${entry.route}`"
          :class="{ 'console-sidebar__link--active': entry.id === activeEntry.id }"
          :aria-current="entry.id === activeEntry.id ? 'page' : undefined"
        >
          <span>{{ entry.name }}</span>
          <strong>{{ entry.title }}</strong>
        </a>
      </nav>
    </aside>

    <div class="console-main">
      <header class="console-topbar">
        <div>
          <span>{{ activeRole.name }} View</span>
          <strong>{{ activeEntry.title }}</strong>
        </div>
        <div class="console-role-switcher" aria-label="角色视角">
          <button
            v-for="role in platformRoles"
            :key="role.id"
            type="button"
            :class="{ 'console-role-switcher__button--active': role.id === activeRoleId }"
            @click="activeRoleId = role.id"
          >
            {{ role.label }}
          </button>
        </div>
      </header>

      <main class="console-content">
        <ConsoleHomeView v-if="isHome" :entries="visibleEntries" />
        <AdminPageView v-else :page="activePage" />
      </main>
    </div>
  </div>
</template>
