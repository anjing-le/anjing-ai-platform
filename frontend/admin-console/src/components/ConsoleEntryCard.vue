<script setup lang="ts">
import type { ConsoleEntry, PlatformRole, PlatformRoleId } from '@/types/accessModel'

defineProps<{
  entry: ConsoleEntry
  roles: PlatformRole[]
  activeRoleId: PlatformRoleId
  visibleForRole: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  enter: [entry: ConsoleEntry]
}>()

function handleEnter(entry: ConsoleEntry, visibleForRole: boolean) {
  if (!visibleForRole) {
    return
  }
  emit('enter', entry)
}
</script>

<template>
  <article class="console-entry-card" :class="{ 'console-entry-card--muted': !visibleForRole }">
    <button
      class="console-entry-card__button"
      :class="{ 'console-entry-card__button--selected': selected }"
      type="button"
      :aria-disabled="!visibleForRole"
      @click="handleEnter(entry, visibleForRole)"
    >
      <div class="console-entry-card__top">
        <span class="console-entry-card__name">{{ entry.name }}</span>
        <span class="console-entry-card__status">{{ entry.status }}</span>
      </div>
      <h3>{{ entry.title }}</h3>
      <p>{{ entry.summary }}</p>
      <div class="console-entry-card__route">
        <span>{{ entry.route }}</span>
        <strong v-if="visibleForRole">进入</strong>
        <strong v-else>不可见</strong>
      </div>
      <div class="role-chip-list" aria-label="可见角色">
        <span
          v-for="role in roles"
          :key="role.id"
          class="role-chip"
          :class="{ 'role-chip--active': role.id === activeRoleId }"
        >
          {{ role.label }}
        </span>
      </div>
    </button>
  </article>
</template>
