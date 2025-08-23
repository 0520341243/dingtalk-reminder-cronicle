<template>
  <div class="not-found">
    <el-result
      icon="warning"
      title="404"
      sub-title="页面不存在"
    >
      <template #extra>
        <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
      </template>
    </el-result>
  </div>
</template>

<script setup>
// NotFound 组件逻辑
</script>

<style scoped>
.not-found {
  padding: 50px;
  text-align: center;
}
</style>