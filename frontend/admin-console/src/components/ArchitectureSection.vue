<script setup lang="ts">
import { computed, ref } from 'vue'

import ArchitectureModuleCard from '@/components/ArchitectureModuleCard.vue'
import { platformModules } from '@/data/platformModules'
import type { PlatformModule } from '@/types/platformModule'

const activeModule = ref<PlatformModule>(platformModules[0])

const selectedResponsibilities = computed(() => activeModule.value.responsibilities)

function selectModule(module: PlatformModule) {
  activeModule.value = module
}
</script>

<template>
  <section id="architecture" class="architecture-section" aria-labelledby="architecture-title">
    <div class="architecture-heading">
      <p class="eyebrow">V1 software design</p>
      <h2 id="architecture-title">DVSkyFolding 基线，Go 服务边界先清楚</h2>
      <p>
        当前 Vue 控制台先验证信息架构；正式工程以 React + TypeScript + Vite 大前端和 Go command 后端为基线。
        部署可以先 all 模式，代码边界从第一天按 control、gateway、billing、ops 拆清楚。
      </p>
    </div>

    <div class="architecture-layout">
      <aside class="platform-stack" aria-label="平台分层">
        <div class="stack-row">
          <span>apps/console</span>
          <strong>React 统一大前端</strong>
        </div>
        <div class="stack-row stack-row--primary">
          <span>cmd/* Go services</span>
          <strong>control / gateway / billing / ops</strong>
        </div>
        <div class="stack-row">
          <span>infra/postgres + contracts</span>
          <strong>PostgreSQL 与公共契约</strong>
        </div>
      </aside>

      <div class="module-board" aria-label="平台模块">
        <ArchitectureModuleCard
          v-for="module in platformModules"
          :key="module.id"
          :module="module"
          :active="module.id === activeModule.id"
          @select="selectModule"
        />
      </div>

      <aside
        class="module-detail"
        :style="{ '--module-accent': activeModule.accent }"
        aria-live="polite"
      >
        <span class="module-detail__source">{{ activeModule.source }}</span>
        <h3>{{ activeModule.name }}</h3>
        <p>{{ activeModule.role }}</p>
        <ul>
          <li v-for="item in selectedResponsibilities" :key="item">{{ item }}</li>
        </ul>
      </aside>
    </div>
  </section>
</template>
