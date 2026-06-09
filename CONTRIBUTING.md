# 贡献指南

## 分支模型

简化版 Git Flow：`main`（生产）+ `develop`（集成）+ 临时工作分支。

| 分支 | 用途 |
|------|------|
| `main` | 生产就绪，仅通过 PR 合入 |
| `develop` | 开发集成，所有功能先合入此分支 |
| `feature/<name>` | 新功能（从 develop 拉，合回 develop） |
| `fix/<name>` | Bug 修复（从 develop 拉，合回 develop） |

## 开发流程

```bash
git checkout develop
git checkout -b feature/my-feature
# 开发、提交
git push -u origin feature/my-feature
# 创建 PR → develop，Squash 合入
```

## Commit 规范

```
feat(scope): description      # 新功能
fix(scope): description       # Bug 修复
docs(scope): description      # 文档
refactor(scope): description   # 重构
test(scope): description      # 测试
chore(scope): description     # 工具/依赖
```

## 测试

```bash
npm test          # 运行全部测试
npx tsc --noEmit  # 类型检查
```
