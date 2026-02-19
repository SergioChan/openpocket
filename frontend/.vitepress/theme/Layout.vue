<script setup lang="ts">
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";

const { Layout } = DefaultTheme;
const { frontmatter } = useData();
const installCommand = "npm install -g openpocket";
</script>

<template>
  <Layout>
    <template v-if="frontmatter.layout === 'home'" #home-hero-info-after>
      <div class="op-hero-install" aria-label="Install OpenPocket with npm">
        <p class="op-hero-install-label">Install with npm</p>
        <code class="op-hero-install-code">{{ installCommand }}</code>
      </div>
    </template>
  </Layout>
</template>
