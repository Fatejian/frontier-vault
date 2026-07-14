<script setup>
import { useData } from 'vitepress'

const { frontmatter } = useData()
</script>

<template>
  <div class="home">
    <div class="VPHero">
      <div class="container">
        <div class="main">
          <h1 class="name">{{ frontmatter.hero?.name }}</h1>
          <p class="text">{{ frontmatter.hero?.text }}</p>
          <p class="tagline">{{ frontmatter.hero?.tagline }}</p>
          <div class="actions">
            <a
              v-for="action in frontmatter.hero?.actions"
              :key="action.text"
              :href="action.link"
              :class="['VPButton', action.theme]"
            >
              {{ action.text }}
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="VPFeatures">
      <div class="container">
        <div class="items">
          <div
            v-for="feature in frontmatter.features"
            :key="feature.title"
            class="item"
          >
            <a v-if="feature.link" :href="feature.link" class="VPLink">
              <div class="box">
                <span v-if="feature.icon" class="icon">{{ feature.icon }}</span>
                <h3 class="title">{{ feature.title }}</h3>
                <p class="details">{{ feature.details }}</p>
              </div>
            </a>
            <div v-else class="box">
              <span v-if="feature.icon" class="icon">{{ feature.icon }}</span>
              <h3 class="title">{{ feature.title }}</h3>
              <p class="details">{{ feature.details }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  width: 100%;
}

.VPFeatures .icon {
  font-size: 1.75rem;
  margin-bottom: 0.75rem;
  display: inline-block;
  transition: transform 0.2s ease;
}

.VPFeatures .item .VPLink:hover .icon,
.VPFeatures .item .box:hover .icon {
  transform: scale(1.1);
}

.dark .VPFeatures .icon {
  opacity: 0.9;
}
</style>
