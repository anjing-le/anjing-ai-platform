<script setup lang="ts">
import InfrastructureField from '@/components/InfrastructureField.vue'
</script>

<template>
  <section class="hero-section" aria-labelledby="platform-title">
    <InfrastructureField />
    <header class="topbar">
      <span class="brand-mark">anjing</span>
      <nav class="topbar-nav" aria-label="页面导航">
        <a href="#/console/home">Console</a>
        <a href="https://github.com/anjing-le/anjing-ai-platform" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </header>

    <div class="hero-copy">
      <p class="eyebrow">Public open-source infrastructure for AI applications</p>
      <h1 id="platform-title">Anjing AI Infra Platform</h1>
      <p class="hero-lede">
        一个面向 AI 应用、Agent、内部工具和业务系统的基础设施底座。后续工程落地以
        DVSkyFolding 为基线：React 统一大前端，Go 服务边界，PostgreSQL 数据底座。
      </p>
      <div class="hero-actions">
        <a class="hero-action hero-action--primary" href="#/console/home">
          <span>进入控制台</span>
          <span class="hero-action__arrow" aria-hidden="true" />
        </a>
        <a
          class="hero-action hero-action--ghost"
          href="https://github.com/anjing-le/anjing-ai-platform"
          target="_blank"
          rel="noreferrer"
        >
          查看仓库
        </a>
      </div>
      <div class="hero-tags" aria-label="核心模块">
        <span>React + Vite</span>
        <span>Go commands</span>
        <span>PostgreSQL</span>
        <span>gateway-api</span>
        <span>ops-api</span>
      </div>
    </div>

    <a class="section-cue" href="#/console/home" aria-label="进入控制台">
      <span>Console</span>
      <span class="section-cue__line" />
    </a>
  </section>
</template>
