<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { useMockConsole, type ConsoleModuleId, type ConsoleRecord } from '@/composables/useMockConsole'
import type { AdminPageDefinition } from '@/types/adminPage'

const props = defineProps<{
  page: AdminPageDefinition
}>()

const consoleStore = useMockConsole()
const pageId = computed(() => props.page.id as ConsoleModuleId)
const activeTab = ref(props.page.tabs[0])
const searchQuery = ref('')
const statusFilter = ref('all')
const selectedRecord = ref<ConsoleRecord | null>(null)
const actionDialogOpen = ref(false)
const actionDraft = reactive<Record<string, string>>({})

const moduleTabs = computed(() => consoleStore.workspaceTabs[pageId.value])
const currentWorkspace = computed(() => {
  return moduleTabs.value[activeTab.value] || moduleTabs.value[Object.keys(moduleTabs.value)[0]]
})

const actionSpec = computed(() => consoleStore.actionSpecs[pageId.value])
const currentRecords = computed(() => {
  return consoleStore.state.records.filter((record) => record.moduleId === pageId.value && record.tab === activeTab.value)
})
const statusOptions = computed(() => Array.from(new Set(currentRecords.value.map((record) => record.status))))
const filteredRecords = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return currentRecords.value.filter((record) => {
    const statusMatched = statusFilter.value === 'all' || record.status === statusFilter.value
    const queryMatched =
      query.length === 0 ||
      record.title.toLowerCase().includes(query) ||
      Object.values(record.cells).some((value) => value.toLowerCase().includes(query))

    return statusMatched && queryMatched
  })
})

function tableColumns(columnCount: number) {
  return {
    '--admin-table-columns': `repeat(${columnCount}, minmax(86px, 1fr))`
  }
}

function setActiveTab(tab: string) {
  activeTab.value = tab
  statusFilter.value = 'all'
  searchQuery.value = ''
  selectedRecord.value = null
}

function resetDraft() {
  Object.keys(actionDraft).forEach((key) => {
    delete actionDraft[key]
  })

  actionSpec.value.fields.forEach((field) => {
    actionDraft[field.id] = field.defaultValue
  })
}

function openActionDialog() {
  resetDraft()
  actionDialogOpen.value = true
}

function submitAction() {
  consoleStore.executeAction(pageId.value, { ...actionDraft })
  actionDialogOpen.value = false
}

function markRecordDone(record: ConsoleRecord) {
  consoleStore.updateRecordStatus(record.id, 'Resolved')
  selectedRecord.value = record
}

function navigateTo(route: string) {
  window.location.hash = route
}

watch(
  () => props.page.id,
  () => {
    activeTab.value = props.page.tabs[0]
    searchQuery.value = ''
    statusFilter.value = 'all'
    selectedRecord.value = null
    actionDialogOpen.value = false
  }
)
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
        <button type="button" @click="openActionDialog">{{ page.primaryAction }}</button>
      </div>
    </div>

    <nav class="admin-tabs" aria-label="页面分区">
      <button
        v-for="tab in page.tabs"
        :key="tab"
        type="button"
        :class="{ 'admin-tabs__button--active': tab === activeTab }"
        @click="setActiveTab(tab)"
      >
        {{ tab }}
      </button>
    </nav>

    <div class="admin-metric-grid" aria-label="关键指标">
      <article v-for="metric in page.metrics" :key="metric.label" class="admin-metric">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <p>{{ metric.note }}</p>
      </article>
    </div>

    <div :class="['admin-workspace-grid', `admin-workspace-grid--${page.layout}`]">
      <section class="admin-table-panel" :aria-label="currentWorkspace.title">
        <div class="admin-panel__heading admin-panel__heading--workspace">
          <div>
            <span>{{ currentWorkspace.eyebrow }}</span>
            <strong>{{ currentWorkspace.title }}</strong>
            <p>{{ currentWorkspace.description }}</p>
          </div>
          <span>{{ filteredRecords.length }} / {{ currentRecords.length }}</span>
        </div>

        <div class="admin-toolbar">
          <label>
            <span>Search</span>
            <input v-model="searchQuery" type="search" placeholder="搜索当前分区" />
          </label>
          <label>
            <span>Status</span>
            <select v-model="statusFilter">
              <option value="all">全部状态</option>
              <option v-for="status in statusOptions" :key="status" :value="status">{{ status }}</option>
            </select>
          </label>
        </div>

        <div class="admin-table" :style="tableColumns(currentWorkspace.columns.length)">
          <div class="admin-table__row admin-table__row--head">
            <span v-for="column in currentWorkspace.columns" :key="column">{{ column }}</span>
          </div>
          <button
            v-for="record in filteredRecords"
            :key="record.id"
            class="admin-table__row admin-table__row--button"
            type="button"
            :aria-label="`查看 ${record.title} 详情`"
            @click="selectedRecord = record"
          >
            <span
              v-for="(column, cellIndex) in currentWorkspace.columns"
              :key="`${record.id}-${column}`"
              :class="{ 'admin-status-chip': cellIndex === currentWorkspace.columns.length - 1 }"
            >
              {{ record.cells[column] || '-' }}
            </span>
          </button>
          <div v-if="filteredRecords.length === 0" class="admin-empty-state">
            当前分区没有匹配记录
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

    <aside v-if="selectedRecord" class="admin-detail-drawer" aria-label="记录详情">
      <div class="admin-detail-drawer__header">
        <div>
          <span>{{ selectedRecord.tab }}</span>
          <strong>{{ selectedRecord.title }}</strong>
        </div>
        <button type="button" @click="selectedRecord = null">关闭</button>
      </div>
      <div class="admin-detail-grid">
        <div v-for="detail in selectedRecord.details" :key="`${selectedRecord.id}-${detail.label}`">
          <span>{{ detail.label }}</span>
          <strong>{{ detail.value }}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong>{{ selectedRecord.updatedAt }}</strong>
        </div>
      </div>
      <div class="admin-detail-actions">
        <button type="button" @click="markRecordDone(selectedRecord)">标记完成</button>
        <button
          v-for="link in selectedRecord.related"
          :key="`${selectedRecord.id}-${link.route}`"
          class="admin-page__secondary-action"
          type="button"
          @click="navigateTo(link.route)"
        >
          {{ link.label }}
        </button>
      </div>
    </aside>

    <div v-if="actionDialogOpen" class="admin-modal" role="dialog" aria-modal="true" :aria-label="actionSpec.title">
      <form class="admin-modal__panel" @submit.prevent="submitAction">
        <div class="admin-modal__heading">
          <div>
            <span>{{ page.title }}</span>
            <strong>{{ actionSpec.title }}</strong>
            <p>{{ actionSpec.description }}</p>
          </div>
          <button type="button" @click="actionDialogOpen = false">关闭</button>
        </div>

        <div class="admin-form-grid">
          <label v-for="field in actionSpec.fields" :key="field.id">
            <span>{{ field.label }}</span>
            <select v-if="field.options" v-model="actionDraft[field.id]">
              <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
            </select>
            <input v-else v-model="actionDraft[field.id]" type="text" />
          </label>
        </div>

        <div class="admin-impact-list">
          <span>提交后联动</span>
          <strong v-for="impact in actionSpec.impact" :key="impact">{{ impact }}</strong>
        </div>

        <div class="admin-modal__actions">
          <button class="admin-page__secondary-action" type="button" @click="actionDialogOpen = false">取消</button>
          <button type="submit">提交</button>
        </div>
      </form>
    </div>
  </section>
</template>
