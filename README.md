# Novel Forge — SillyTavern Extension

一键将当前 SillyTavern 聊天转换为中文小说，以悬浮窗形式直接在酒馆内操作，无需跳转网页。

## 安装步骤

### 1. 在酒馆中安装拓展

打开 SillyTavern → **拓展（Extensions）** → **安装拓展（Install Extension）**，粘贴：

```
https://github.com/blueeu7/novel-forge-st
```

点击安装，等待完成后重启 SillyTavern。

### 2. 配置 Novel Forge 地址

安装后，在拓展面板中找到 **📖 Novel Forge** 展开项，在输入框中填入你的 Novel Forge 应用地址：

- 如果使用公共演示版，保持默认地址即可
- 如果自己部署了 Novel Forge，填入你的 Replit 部署地址

### 3. 使用

1. 在酒馆中打开任意角色聊天
2. 在拓展面板点击 **打开 Novel Forge · 转小说**
3. **Novel Forge 以悬浮窗形式直接在酒馆内打开**（无弹窗拦截问题）
4. 聊天内容自动同步至 Novel Forge
5. 选择楼层范围、配置章节风格，开始生成小说
6. 点击右上角 ✕ 或按 ESC 关闭悬浮窗

## 特性

- ✅ **悬浮窗模式**：直接在酒馆内显示，无需跳转或弹窗
- ✅ 自动同步当前聊天（无需手动导出文件）
- ✅ 支持选择楼层范围（第 N 楼 到 第 M 楼）
- ✅ 传递角色设定、人物描述、场景信息
- ✅ 支持 swipes 自动取最新版本
- ✅ 支持多章节连续生成、单章重生成、断点续写
- ✅ 按 ESC 或点击背景快速关闭

## 注意事项

- API Key 仅存储在你本地浏览器中，不会上传到任何服务器
- 悬浮窗内的 Novel Forge 与酒馆主页面完全独立，关闭后不影响聊天
- 若切换角色或发送新消息，关闭后重新点击即可同步最新聊天
