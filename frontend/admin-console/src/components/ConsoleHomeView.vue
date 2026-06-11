<script setup lang="ts">
import { computed } from 'vue'

import { useMockConsole } from '@/composables/useMockConsole'
import type { ConsoleEntry } from '@/types/accessModel'

const props = defineProps<{
  entries: ConsoleEntry[]
}>()

const consoleStore = useMockConsole()

const visibleBusinessEntries = computed(() => props.entries.filter((entry) => entry.id !== 'home'))

const pendingRecords = computed(() =>
  consoleStore.state.records
    .filter((record) => ['Pending', 'Warning', 'Watching', 'Investigating', 'Expiring'].includes(record.status))
    .slice(0, 4)
)

const homeMetrics = computed(() => [
  {
    label: '业务入口',
    value: `${visibleBusinessEntries.value.length}`,
    note: '按角色显示'
  },
  {
    label: '待处理',
    value: `${pendingRecords.value.length}`,
    note: '告警 / 审批 / 预算'
  },
  {
    label: '成功率',
    value: '99.21%',
    note: '近 24 小时'
  },
  {
    label: 'V1 服务',
    value: '1 + Worker',
    note: 'platform-api first'
  }
])

const moduleCards = computed(() =>
  visibleBusinessEntries.value.map((entry) => ({
    ...entry,
    stats: moduleStats[entry.id] || [],
    focus: moduleFocus[entry.id] || '查看关键数据与配置。'
  }))
)

const moduleStats: Record<string, string[]> = {
  overview: ['健康', '待办', '审计'],
  iam: ['用户', '角色', '凭据'],
  gateway: ['API', '模型', 'Skill'],
  quota: ['套餐', '用量', '预算'],
  examples: ['接入', 'API', 'FAQ']
}

const moduleFocus: Record<string, string> = {
  overview: '后台默认工作台，合并运行健康、调用日志、审计事件和关键待办。',
  iam: '定义谁能进入平台、能看什么、能配置什么，以及 API Key 与凭据边界。',
  gateway: '把 API 网关、模型路由、供应商和 Skill 调用收进一个运行入口。',
  quota: '统一看套餐、配额、项目用量、预算告警和未来计费闭环。',
  examples: '给使用者和开发者提供接入路径、API 文档、SDK 和 FAQ。'
}

const consolidation = [
  { title: '运营总览', source: 'Observability / Audit / Ops', route: '/console/overview' },
  { title: '用户与权限', source: 'IAM / API Key / Credential', route: '/console/iam' },
  { title: '网关与模型', source: 'Gateway / LLM / Skill', route: '/console/gateway' },
  { title: '计费与配额', source: 'Quota / Billing / Usage', route: '/console/quota' },
  { title: '帮助文档', source: 'Docs / Examples / Quickstart', route: '/console/docs' }
]

const backendPlan = [
  {
    label: 'V1',
    title: '1 个 platform-api',
    note: '模块化单体，先把访问控制、网关配置、用量和审计跑通。'
  },
  {
    label: 'V1 optional',
    title: '1 个 platform-worker',
    note: '只在接入真实调用后承接日志聚合、计量、预算告警和导出任务。'
  },
  {
    label: 'V2',
    title: '拆成 3 个服务',
    note: 'platform-api、gateway-runtime、metering-worker，等边界稳定后再拆。'
  }
]
</script>

<template>
  <section class="console-home" aria-labelledby="console-home-title">
    <div class="console-home__heading">
      <div>
        <span>Console Home</span>
        <h1 id="console-home-title">后台首页</h1>
        <p>进入控制台后先看这页：平台是否正常、当前角色能做什么、哪些模块需要进入、后端应该先怎么拆。</p>
      </div>
      <a href="#/console/docs">开始接入</a>
    </div>

    <div class="console-home__metrics" aria-label="平台关键状态">
      <article v-for="metric in homeMetrics" :key="metric.label">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <p>{{ metric.note }}</p>
      </article>
    </div>

    <div class="console-home__overview-grid">
      <section class="console-home__section" aria-labelledby="home-modules-title">
        <div class="console-home__section-heading">
          <span>Modules</span>
          <strong id="home-modules-title">模块入口</strong>
        </div>
        <div class="console-home__module-grid">
          <a v-for="entry in moduleCards" :key="entry.id" class="console-home__module" :href="`#${entry.route}`">
            <div>
              <span>{{ entry.name }}</span>
              <strong>{{ entry.title }}</strong>
              <p>{{ entry.focus }}</p>
            </div>
            <div class="console-home__chips">
              <span v-for="stat in entry.stats" :key="stat">{{ stat }}</span>
            </div>
          </a>
        </div>
      </section>

      <section class="console-home__section" aria-labelledby="home-pending-title">
        <div class="console-home__section-heading">
          <span>Focus</span>
          <strong id="home-pending-title">今日待办</strong>
        </div>
        <div class="console-home__pending-list">
          <a v-for="record in pendingRecords" :key="record.id" :href="`#${consoleStore.routeByModule[record.moduleId]}`">
            <span>{{ record.cells['来源'] || consoleStore.moduleLabel[record.moduleId] }}</span>
            <strong>{{ record.title }}</strong>
            <p>{{ record.status }} · {{ record.updatedAt }}</p>
          </a>
          <p v-if="pendingRecords.length === 0" class="console-home__empty">当前没有待处理事项</p>
        </div>
      </section>
    </div>

    <section class="console-home__section" aria-labelledby="home-boundary-title">
      <div class="console-home__section-heading">
        <span>Boundary</span>
        <strong id="home-boundary-title">整合后的后台边界</strong>
      </div>
      <div class="console-home__boundary">
        <a v-for="item in consolidation" :key="item.title" :href="`#${item.route}`">
          <strong>{{ item.title }}</strong>
          <span>{{ item.source }}</span>
        </a>
      </div>
    </section>

    <section class="console-home__section" aria-labelledby="home-service-title">
      <div class="console-home__section-heading">
        <span>Backend</span>
        <strong id="home-service-title">后端服务规划</strong>
      </div>
      <div class="console-home__service-plan">
        <article v-for="item in backendPlan" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.title }}</strong>
          <p>{{ item.note }}</p>
        </article>
      </div>
    </section>
  </section>
</template>
