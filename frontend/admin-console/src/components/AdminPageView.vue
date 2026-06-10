<script setup lang="ts">
import type { AdminPageDefinition } from '@/types/adminPage'

defineProps<{
  page: AdminPageDefinition
}>()
</script>

<template>
  <section class="admin-page" :aria-labelledby="`${page.id}-title`">
    <div class="admin-page__heading">
      <div>
        <span class="admin-page__eyebrow">{{ page.eyebrow }}</span>
        <h1 :id="`${page.id}-title`">{{ page.title }}</h1>
        <p>{{ page.description }}</p>
      </div>
      <div class="admin-page__actions">
        <button type="button">{{ page.primaryAction }}</button>
        <button class="admin-page__secondary-action" type="button">{{ page.secondaryAction }}</button>
      </div>
    </div>

    <div class="admin-metric-grid" aria-label="关键指标">
      <article v-for="metric in page.metrics" :key="metric.label" class="admin-metric">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <p>{{ metric.note }}</p>
      </article>
    </div>

    <div class="admin-content-grid">
      <section class="admin-panel" aria-label="关键功能">
        <div class="admin-panel__heading">
          <span>Focus</span>
          <strong>最重要功能</strong>
        </div>
        <div class="focus-list">
          <span v-for="item in page.focusItems" :key="item">{{ item }}</span>
        </div>
      </section>

      <section class="admin-panel admin-panel--table" aria-label="核心列表">
        <div class="admin-panel__heading">
          <span>Records</span>
          <strong>核心列表</strong>
        </div>
        <div class="admin-table">
          <div class="admin-table__row admin-table__row--head">
            <span>Name</span>
            <span>Type</span>
            <span>Owner</span>
            <span>Status</span>
          </div>
          <div v-for="record in page.records" :key="`${record.name}-${record.type}`" class="admin-table__row">
            <span>{{ record.name }}</span>
            <span>{{ record.type }}</span>
            <span>{{ record.owner }}</span>
            <span>{{ record.status }}</span>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

