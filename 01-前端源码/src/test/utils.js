// 统一挂载工具：注入 Element Plus 全量插件 + Pinia，减少各测试重复配置
import { mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { createPinia, setActivePinia } from 'pinia';

export function mountWith(component, options = {}) {
  const { global: globalOpts = {}, ...rest } = options;
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(component, {
    global: {
      ...globalOpts,
      plugins: [ElementPlus, pinia, ...(Array.isArray(globalOpts.plugins) ? globalOpts.plugins : [])],
    },
    ...rest,
  });
}
