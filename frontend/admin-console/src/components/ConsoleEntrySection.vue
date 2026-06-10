<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import ConsoleEntryCard from '@/components/ConsoleEntryCard.vue'
import { consoleEntries, platformRoles } from '@/data/accessModel'
import type { ConsoleEntry, PlatformRoleId } from '@/types/accessModel'

const activeRoleId = ref<PlatformRoleId>('admin')
const selectedEntry = ref<ConsoleEntry>(consoleEntries[0])

const activeRole = computed(() => platformRoles.find((role) => role.id === activeRoleId.value) || platformRoles[0])
const visibleEntries = computed(() => consoleEntries.filter((entry) => entry.roles.includes(activeRoleId.value)))
const selectedEntryRoles = computed(() => roleNames(selectedEntry.value))

function roleNames(entry: ConsoleEntry) {
  return platformRoles.filter((role) => entry.roles.includes(role.id))
}

function isVisibleForActiveRole(entry: ConsoleEntry) {
  return entry.roles.includes(activeRoleId.value)
}

async function openEntry(entry: ConsoleEntry) {
  if (!isVisibleForActiveRole(entry)) {
    return
  }
  selectedEntry.value = entry
  await nextTick()
  document.getElementById('console-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(activeRoleId, () => {
  if (!selectedEntry.value.roles.includes(activeRoleId.value)) {
    selectedEntry.value = visibleEntries.value[0] || consoleEntries[0]
  }
})
</script>

<template>
  <section id="console-entry" class="console-entry-section" aria-labelledby="console-entry-title">
    <div class="console-entry-heading">
      <p class="eyebrow">Console entry</p>
      <h2 id="console-entry-title">一个管理员，三类角色</h2>
      <p>
        这一屏先作为权限模型的前置草图。管理员可以看全部；使用用户看接入和调用；开发人员看大部分配置；
        运维人员看运行配置与指标，但不进入网关这类关键开发配置。
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
          :selected="selectedEntry.id === entry.id"
          @enter="openEntry"
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

    <section id="console-workspace" class="console-workspace" aria-live="polite">
      <div>
        <span class="console-workspace__route">{{ selectedEntry.route }}</span>
        <h3>{{ selectedEntry.name }}</h3>
        <p>{{ selectedEntry.summary }}</p>
      </div>
      <div class="console-workspace__meta">
        <span>{{ selectedEntry.status }}</span>
        <strong>{{ activeRole.label }}视角</strong>
      </div>
      <div class="console-workspace__body">
        <div class="console-workspace__panel">
          <span>当前入口</span>
          <strong>{{ selectedEntry.title }}</strong>
          <p>
            这里先作为模块进入后的占位工作区。后续每个模块会在这里继续拆成独立页面、表格、表单和调试面板。
          </p>
        </div>
        <div class="console-workspace__panel">
          <span>可见角色</span>
          <div class="role-chip-list">
            <span
              v-for="role in selectedEntryRoles"
              :key="role.id"
              class="role-chip"
              :class="{ 'role-chip--active': role.id === activeRoleId }"
            >
              {{ role.label }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
