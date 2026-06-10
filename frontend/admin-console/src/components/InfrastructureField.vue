<script setup lang="ts">
const nodes = [
  { label: 'App', x: 12, y: 20, size: 'lg' },
  { label: 'Agent', x: 13, y: 73, size: 'md' },
  { label: 'Gateway', x: 76, y: 30, size: 'xl' },
  { label: 'IAM', x: 61, y: 17, size: 'md' },
  { label: 'LLM', x: 86, y: 48, size: 'lg' },
  { label: 'Skill', x: 63, y: 76, size: 'lg' },
  { label: 'Audit', x: 88, y: 72, size: 'md' }
]

const links = [
  { from: 0, to: 2 },
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 2, to: 4 },
  { from: 2, to: 5 },
  { from: 4, to: 6 },
  { from: 5, to: 6 }
]

function linkStyle(fromIndex: number, toIndex: number) {
  const from = nodes[fromIndex]
  const to = nodes[toIndex]
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)

  return {
    left: `${from.x}%`,
    top: `${from.y}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`
  }
}
</script>

<template>
  <div class="infrastructure-field" aria-hidden="true">
    <span
      v-for="(link, index) in links"
      :key="`${link.from}-${link.to}-${index}`"
      class="field-link"
      :style="linkStyle(link.from, link.to)"
    />
    <span
      v-for="node in nodes"
      :key="node.label"
      class="field-node"
      :class="`field-node--${node.size}`"
      :style="{ left: `${node.x}%`, top: `${node.y}%` }"
    >
      <span class="field-node__pulse" />
      <span class="field-node__label">{{ node.label }}</span>
    </span>
  </div>
</template>
