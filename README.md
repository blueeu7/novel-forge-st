# Novel Forge — SillyTavern Extension

把当前 SillyTavern 聊天直接转成中文小说，**全程在酒馆内的悬浮窗里完成**，不依赖任何外部网页。

## 安装

打开 SillyTavern → **拓展（Extensions）** → **安装拓展（Install Extension）**，粘贴：

```
https://github.com/blueeu7/novel-forge-st
```

安装后在拓展面板里找到 **📖 Novel Forge · 小说工坊**。

## 使用

1. 在 Novel Forge 抽屉里选择 **生成来源**：
   - **酒馆当前模型**：直接用酒馆已配置好的 API（最省事）
   - **自定义 API**：填 OpenAI 兼容的 Base URL / API Key / 模型名
2. 选择风格预设（言情 / 玄幻 / 古风 / 现实 / 悬疑 / 历史 / 自定义），可在下方文本框追加风格细节
3. 设定楼层范围、是否分多章节
4. 点击 **打开小说工坊** → **开始生成**，正文会流式出现在悬浮窗里

## 特性

- ✅ **完全本地**：不需要部署任何后端，浮窗里直接生成
- ✅ **两种 API**：酒馆当前模型 / 自定义 OpenAI 兼容接口
- ✅ **6 个内置风格预设** + 自定义追加 prompt
- ✅ **一次性 / 多章节** 两种生成模式，多章节模式会自动把前一章末尾作为衔接上下文
- ✅ **流式输出**（自定义 API 模式）+ 中途停止 + 单章重生成
- ✅ **楼层范围选择**、最近 N 条快捷、可选包含 system 消息和 swipes 候选
- ✅ **悬浮窗可拖动 / 可缩放 / 最大化**，位置尺寸自动记忆
- ✅ **导出**：复制当前章 / 下载全部为 .txt

## 注意事项

- API Key 仅保存在你本地浏览器的 localStorage 中，不会上传任何服务器
- 自定义 API 必须支持 OpenAI 兼容的 `/v1/chat/completions` 流式响应
- 「酒馆当前模型」模式依赖 SillyTavern 暴露的 `generateRaw` / `generateQuietPrompt`；如果你的版本太旧没有这些方法，请改用自定义 API
