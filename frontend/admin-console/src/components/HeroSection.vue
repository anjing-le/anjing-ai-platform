<script setup lang="ts">
import InfrastructureField from '@/components/InfrastructureField.vue'
</script>

<template>
  <section class="hero-section" aria-labelledby="platform-title">
    <InfrastructureField />
    <header class="topbar">
      <span class="brand-mark">anjing</span>
      <nav class="topbar-nav" aria-label="页面导航">
        <a href="#/console/overview">Console</a>
        <a href="https://github.com/anjing-le/anjing-ai-platform" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </header>

    <div class="hero-copy">
      <p class="eyebrow">Public open-source infrastructure for AI applications</p>
      <h1 id="platform-title">Anjing AI Infra Platform</h1>
      <p class="hero-lede">
        一个面向 AI 应用、Agent、内部工具和业务系统的基础设施底座。V1 先用模块化单体把
        Gateway、IAM、LLM、Skill、Audit、Quota 和 Credential 收到同一套清晰边界里。
      </p>
      <div class="hero-actions">
        <a class="hero-action hero-action--primary" href="#/console/overview">
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
        <span>gateway</span>
        <span>iam</span>
        <span>llm</span>
        <span>skill</span>
        <span>audit</span>
      </div>
    </div>

    <a class="section-cue" href="#/console/overview" aria-label="进入控制台">
      <span>Console</span>
      <span class="section-cue__line" />
    </a>
  </section>
</template>
