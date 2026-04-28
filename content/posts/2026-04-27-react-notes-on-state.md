---
title: "React 笔记：什么时候该把状态往上提"
date: "2026-04-27"
summary: "不是所有状态都值得全局化。先判断共享范围，再判断更新频率，很多问题会简单不少。"
tags: ["React", "前端", "状态管理"]
featured: true
---

# 先看状态影响了谁

我现在处理 React 状态时，会先问一个问题：  
这个状态到底影响几个组件？

## 适合留在局部的状态

- 表单输入中的临时值
- 弹窗开关
- hover、focus、loading 这类短期 UI 状态

这类状态如果提前塞进全局，后面维护成本一般会更高。

## 适合往上提或共享的状态

- 需要兄弟组件同时读取的数据
- 页面级筛选条件
- 登录态、主题、权限这类跨区域状态

## 一个简单判断法

可以按这个顺序判断：

1. 只有一个组件关心吗？
2. 生命周期是不是很短？
3. 刷新后是否必须保留？

如果前两个答案都是“是”，大概率先别做全局。

## 示例

```tsx
function SearchPanel() {
  const [keyword, setKeyword] = useState("");

  return (
    <input
      value={keyword}
      onChange={(event) => setKeyword(event.target.value)}
      placeholder="搜索关键词"
    />
  );
}
```

这个 `keyword` 如果只影响当前组件，先局部放着通常是最稳的。

## 最后留下的规则

不要因为“以后可能会用到”就提前抽象。  
状态管理最容易复杂化的地方，就是把还没共享的东西过早共享了。
