<script setup lang="ts">
import { computed, ref } from 'vue'

import ConsoleEntryCard from '@/components/ConsoleEntryCard.vue'
import { consoleEntries, platformRoles } from '@/data/accessModel'
import type { ConsoleEntry, PlatformRoleId } from '@/types/accessModel'

const activeRoleId = ref<PlatformRoleId>('platform-owner')

const activeRole = computed(() => platformRoles.find((role) => role.id === activeRoleId.value) || platformRoles[0])
const visibleEntries = computed(() => consoleEntries.filter((entry) => entry.roles.includes(activeRoleId.value)))

function roleNames(entry: ConsoleEntry) {
  return platformRoles.filter((role) => entry.roles.includes(role.id))
}

function isVisibleForActiveRole(entry: ConsoleEntry) {
  return entry.roles.includes(activeRoleId.value)
}
</script>

<template>
  <section id="console-entry" class="console-entry-section" aria-labelledby="console-entry-title">
    <div class="console-entry-heading">
      <p class="eyebrow">Console entry</p>
      <h2 id="console-entry-title">先定义谁进来，看见什么</h2>
      <p>
        这一屏先作为权限模型的前置草图。现在只做角色标记和模块入口，后续接入 IAM 后再把这些定义
        落到真实 RBAC、API Key 和菜单权限里。
      </p>
    </div>

    <div class="console-entry-layout">
      <aside class="role-panel" aria-label="用户角色">
        <button
          v-for="role in platformRoles"
          :key="role.id"
          class="role-button"
          :class="{ 'role-button--active': role.id === activeRoleId }"
          type="button"
          @click="activeRoleId = role.id"
        >
          <span>{{ role.label }}</span>
          <strong>{{ role.name }}</strong>
        </button>
      </aside>

      <div class="console-entry-grid" aria-label="模块入口">
        <ConsoleEntryCard
          v-for="entry in consoleEntries"
          :key="entry.id"
          :entry="entry"
          :roles="roleNames(entry)"
          :active-role-id="activeRoleId"
          :visible-for-role="isVisibleForActiveRole(entry)"
        />
      </div>

      <aside class="role-detail" aria-live="polite">
        <span class="role-detail__label">Current role</span>
        <h3>{{ activeRole.label }}</h3>
        <p>{{ activeRole.purpose }}</p>
        <div class="role-detail__count">
          <strong>{{ visibleEntries.length }}</strong>
          <span>visible entries</span>
        </div>
        <ul>
          <li v-for="entry in visibleEntries" :key="entry.id">{{ entry.title }}</li>
        </ul>
      </aside>
    </div>
  </section>
</template>

