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
      <h2 id="architecture-title">模块化单体，边界先清楚</h2>
      <p>
        前端统一为一个 `admin-console`，后端统一为一个 `platform-api`。模块先在同一进程内协作，
        通过 contracts、schemas 和明确 API 边界保持可拆分。
      </p>
    </div>

    <div class="architecture-layout">
      <aside class="platform-stack" aria-label="平台分层">
        <div class="stack-row">
          <span>frontend/admin-console</span>
          <strong>统一运营入口</strong>
        </div>
        <div class="stack-row stack-row--primary">
          <span>backend/platform-api</span>
          <strong>模块化单体核心</strong>
        </div>
        <div class="stack-row">
          <span>contracts/docs/examples</span>
          <strong>公共契约与示例</strong>
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

