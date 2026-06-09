# 贡献指南

感谢你对 deepseek-proxy 的关注！这份指南说明了项目的分支管理和贡献流程。

## 分支模型

本项目采用简化版 Git Flow，包含两条永久分支和四类临时分支：

### 永久分支

| 分支 | 用途 | 保护 |
|------|------|------|
| `main` | 生产就绪代码，仅通过 PR 合入，使用 tag 标记版本 | 禁止直接推送 |
| `develop` | 开发集成分支，所有功能和修复先合入此分支 | 建议通过 PR 合入 |

### 临时分支

| 分支 | 命名示例 | 从哪拉 | 合到哪 |
|------|----------|--------|--------|
| `feature/<name>` | `feature/add-login` | develop | develop |
| `fix/<name>` | `fix/memory-leak` | develop | develop |
| `release/<version>` | `release/v1.0.0` | develop | main |
| `hotfix/<name>` | `hotfix/crash-loop` | main | main |

临时分支在合入后应删除。

## 开发流程

### 1. 开发新功能

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
# 开发、提交
git push -u origin feature/my-feature
# 在 GitHub 创建 PR，目标分支选择 develop
# 代码审查通过后，Squash 合入
# 删除 feature 分支
```

### 2. 修复 Bug

```bash
git checkout develop
git checkout -b fix/my-bug
# 修复、提交
git push -u origin fix/my-bug
# 创建 PR 到 develop，Squash 合入
```

### 3. 发布版本

```bash
git checkout develop
git checkout -b release/v1.0.0
# 修改版本号（package.json 等）
# 最后验证、修复小问题
git push -u origin release/v1.0.0
# 创建 PR 到 main（使用 Merge Commit，保留 release 分支历史）
# 合入后在 main 上打 tag：git tag -a v1.0.0 -m "Release v1.0.0"
# 将 main 回集到 develop：git checkout develop && git merge main
```

### 4. 紧急修复

```bash
git checkout main
git checkout -b hotfix/critical-fix
# 紧急修复
git push -u origin hotfix/critical-fix
# 创建 PR 到 main（Merge Commit）
# 合入后打 tag：git tag -a v1.0.1 -m "Hotfix v1.0.1"
# 务必回集到 develop：git checkout develop && git merge main
```

## Commit Message 规范

推荐使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <description>

feat(proxy): add request forwarding
fix(auth): correct token refresh logic
docs(readme): update installation guide
chore(deps): upgrade dependencies
```

## Pull Request 规范

- 一个 PR 只做一件事
- PR 标题简洁明确
- 关联相关 Issue（`Closes #42`）
- 确保 CI 通过后再请求审查

## 问题反馈

- Bug 报告：使用 Bug Report 模板
- 功能建议：使用 Feature Request 模板
