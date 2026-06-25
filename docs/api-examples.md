---
outline: deep
---

# Runtime API Examples

This page demonstrates usage of some of the runtime APIs provided by VitePress. The main `useData()` API can be used to access site metadata and info for the current doc.

## Basic Usage

```vue
<script setup>
import { useData } from 'vitepress'

const { page, frontmatter } = useData()
</script>

<div v-if="frontmatter.test">
  {{ page.filePath }}
</div>
```

## Result

<div class="result">
  <p>Current page file path: <code>{{ page.filePath }}</code></p>
</div>
