<script setup lang="ts">
import type { AdminPageDefinition, AdminTable } from '@/types/adminPage'

defineProps<{
  page: AdminPageDefinition
}>()

function tableColumns(table: AdminTable) {
  return {
    '--admin-table-columns': `repeat(${table.columns.length}, minmax(120px, 1fr))`
  }
}
</script>

<template>
  <section :class="['admin-page', `admin-page--${page.id}`]" :aria-labelledby="`${page.id}-title`">
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

    <nav class="admin-tabs" aria-label="页面分区">
      <button v-for="tab in page.tabs" :key="tab" type="button">{{ tab }}</button>
    </nav>

    <div class="admin-metric-grid" aria-label="关键指标">
      <article v-for="metric in page.metrics" :key="metric.label" class="admin-metric">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <p>{{ metric.note }}</p>
      </article>
    </div>

    <div v-if="page.flow" class="admin-flow" aria-label="模块工作流">
      <article v-for="step in page.flow" :key="`${page.id}-${step.label}`" class="admin-flow__step">
        <span>{{ step.label }}</span>
        <strong>{{ step.title }}</strong>
        <p>{{ step.note }}</p>
      </article>
    </div>

    <div :class="['admin-workspace-grid', `admin-workspace-grid--${page.layout}`]">
      <section class="admin-table-panel" :aria-label="page.primaryTable.title">
        <div class="admin-panel__heading">
          <span>{{ page.primaryTable.eyebrow }}</span>
          <strong>{{ page.primaryTable.title }}</strong>
        </div>
        <div class="admin-table" :style="tableColumns(page.primaryTable)">
          <div class="admin-table__row admin-table__row--head">
            <span v-for="column in page.primaryTable.columns" :key="column">{{ column }}</span>
          </div>
          <div
            v-for="(row, rowIndex) in page.primaryTable.rows"
            :key="`${page.id}-primary-${rowIndex}`"
            class="admin-table__row"
          >
            <span v-for="(cell, cellIndex) in row" :key="`${page.id}-primary-${rowIndex}-${cellIndex}`">
              {{ cell }}
            </span>
          </div>
        </div>
      </section>

      <aside class="admin-side-stack" aria-label="侧边管理面板">
        <section v-for="panel in page.panels" :key="panel.title" class="admin-panel">
          <div class="admin-panel__heading">
            <span>{{ panel.eyebrow }}</span>
            <strong>{{ panel.title }}</strong>
          </div>
          <div class="admin-panel-list">
            <article v-for="item in panel.items" :key="`${panel.title}-${item.label}`" class="admin-panel-list__item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <p>{{ item.note }}</p>
            </article>
          </div>
        </section>
      </aside>
    </div>

    <section v-if="page.secondaryTable" class="admin-table-panel admin-table-panel--secondary" :aria-label="page.secondaryTable.title">
      <div class="admin-panel__heading">
        <span>{{ page.secondaryTable.eyebrow }}</span>
        <strong>{{ page.secondaryTable.title }}</strong>
      </div>
      <div class="admin-table" :style="tableColumns(page.secondaryTable)">
        <div class="admin-table__row admin-table__row--head">
          <span v-for="column in page.secondaryTable.columns" :key="column">{{ column }}</span>
        </div>
        <div
          v-for="(row, rowIndex) in page.secondaryTable.rows"
          :key="`${page.id}-secondary-${rowIndex}`"
          class="admin-table__row"
        >
          <span v-for="(cell, cellIndex) in row" :key="`${page.id}-secondary-${rowIndex}-${cellIndex}`">
            {{ cell }}
          </span>
        </div>
      </div>
    </section>
  </section>
</template>
