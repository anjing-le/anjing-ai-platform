<script setup lang="ts">
import { computed } from 'vue'

import { useMockConsole } from '@/composables/useMockConsole'
import type { ConsoleEntry } from '@/types/accessModel'

const props = defineProps<{
  entries: ConsoleEntry[]
}>()

const consoleStore = useMockConsole()

const moduleCards = computed(() =>
  props.entries
    .filter((entry) => entry.id !== 'home')
    .map((entry) => ({
      ...entry,
      stats: moduleStats[entry.id] || [],
      focus: moduleFocus[entry.id] || '查看关键数据与配置。'
    }))
)

const homeMetrics = computed(() => [
  {
    label: '今日调用',
    value: '128.4K',
    note: 'Gateway / Model / Skill'
  },
  {
    label: '成功率',
    value: '99.21%',
    note: '近 24 小时'
  },
  {
    label: '待处理',
    value: `${consoleStore.state.records.filter((record) => ['Pending', 'Warning', 'Investigating'].includes(record.status)).length}`,
    note: '告警 / 权限 / 预算'
  },
  {
    label: '本月成本',
    value: '$18.4K',
    note: 'estimated'
  }
])

const moduleStats: Record<string, string[]> = {
  overview: ['运营事件', '服务健康', '费用风险'],
  iam: ['用户', '权限', 'API Key'],
  gateway: ['API 路由', '模型路由', '请求日志'],
  quota: ['套餐', '用量', '预算'],
  examples: ['Quickstart', 'API 文档', 'FAQ']
}

const moduleFocus: Record<string, string> = {
  overview: '看平台今天是否正常，哪些告警、成本或审批需要处理。',
  iam: '管理谁可以访问平台，以及 API Key、角色和凭据如何被使用。',
  gateway: '统一配置 API 入口、模型路由、Skill 调用、限流和请求日志。',
  quota: '看套餐、配额、项目用量、预算告警和账单状态。',
  examples: '给使用者和开发者提供接入路径、API 文档、SDK 和 FAQ。'
}

const quickPath = [
  { label: '创建应用', route: '/console/docs', note: '从 Quickstart 开始' },
  { label: '签发 API Key', route: '/console/iam', note: '绑定角色与 scope' },
  { label: '配置网关', route: '/console/gateway', note: '路由到模型或 Skill' },
  { label: '查看用量', route: '/console/quota', note: '确认配额与成本' },
  { label: '运营追踪', route: '/console/overview', note: '看日志、告警和审计' }
]
</script>

<template>
  <section class="console-home" aria-labelledby="console-home-title">
    <div class="console-home__heading">
      <div>
        <span>Console Home</span>
        <h1 id="console-home-title">后台首页</h1>
        <p>这是 Anjing AI Platform 的控制台入口。先看平台状态，再进入对应模块处理最关键的事情。</p>
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

    <section class="console-home__section" aria-labelledby="home-path-title">
      <div class="console-home__section-heading">
        <span>Path</span>
        <strong id="home-path-title">推荐操作路径</strong>
      </div>
      <div class="console-home__path">
        <a v-for="item in quickPath" :key="item.label" :href="`#${item.route}`">
          <strong>{{ item.label }}</strong>
          <span>{{ item.note }}</span>
        </a>
      </div>
    </section>
  </section>
</template>
