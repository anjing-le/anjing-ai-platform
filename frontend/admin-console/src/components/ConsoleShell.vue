<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AdminPageView from '@/components/AdminPageView.vue'
import { adminPages } from '@/data/adminPages'
import { consoleEntries, platformRoles } from '@/data/accessModel'
import type { PlatformRoleId } from '@/types/accessModel'

const props = defineProps<{
  currentRoute: string
}>()

const activeRoleId = ref<PlatformRoleId>('admin')

const activeRole = computed(() => platformRoles.find((role) => role.id === activeRoleId.value) || platformRoles[0])
const visibleEntries = computed(() => consoleEntries.filter((entry) => entry.roles.includes(activeRoleId.value)))

const activeEntry = computed(() => {
  const normalizedRoute = props.currentRoute === '/console' ? '/console/overview' : props.currentRoute
  return consoleEntries.find((entry) => entry.route === normalizedRoute) || visibleEntries.value[0] || consoleEntries[0]
})

const activePage = computed(() => {
  return adminPages.find((page) => page.id === activeEntry.value.id) || adminPages[0]
})

function navigateTo(route: string) {
  window.location.hash = route
}

watch(activeRoleId, () => {
  if (!activeEntry.value.roles.includes(activeRoleId.value)) {
    navigateTo((visibleEntries.value[0] || consoleEntries[0]).route)
  }
})
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
          <p>{{ activeRole.purpose }}</p>
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
        <AdminPageView :page="activePage" />
      </main>
    </div>
  </div>
</template>
