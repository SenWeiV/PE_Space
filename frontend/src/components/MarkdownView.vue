<template>
  <div v-html="html" />
</template>

<script setup>
import { computed } from "vue";
import { marked } from "marked";

const props = defineProps({
  content: {
    type: String,
    default: "",
  },
});

const html = computed(() => {
  // marked.parse returns HTML string; rendered via v-html.
  // If you later find untrusted markdown input, add sanitization.
  return marked.parse(props.content || "");
});
</script>

