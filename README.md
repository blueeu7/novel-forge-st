# Novel Forge — SillyTavern Extension

一键将当前 SillyTavern 聊天转换为中文小说。

## 安装步骤

### 1. 准备 Novel Forge 应用

Novel Forge 是一个运行在浏览器中的独立 Web 应用（可部署到 Replit）。
如果你已经有部署好的 Novel Forge URL，跳至第 2 步。

### 2. 将本拓展上传到 GitHub

在 GitHub 新建一个公开仓库（如 `novel-forge-st`），然后将此文件夹中的以下三个文件上传：

```
manifest.json
index.js
style.css
```

### 3. 在酒馆中安装

打开 SillyTavern → **拓展** → **安装拓展（从 URL）**，粘贴以下地址（替换为你的 GitHub 用户名和仓库名）：

```
https://raw.githubusercontent.com/blueeu7/novel-forge-st/main
```

安装后重启 SillyTavern。

### 4. 配置 Novel Forge 地址

拓展安装后，在 SillyTavern 的扩展面板中找到 **Novel Forge** 区域，填入你的 Novel Forge 部署地址（默认已填入 Replit 官方演示地址）。

### 5. 使用

1. 打开任意角色聊天
2. 点击 **📖 打开 Novel Forge（转小说）**
3. Novel Forge 将在弹窗中打开，并自动接收当前聊天内容
4. 在 Novel Forge 中选择楼层范围、配置生成参数，然后开始生成

## 特性

- ✅ 自动同步当前聊天（无需导出文件）
- ✅ 传递角色设定、场景描述
- ✅ 支持 swipes（多回答）自动选取正确版本
- ✅ 在 Novel Forge 中可选择任意楼层范围
- ✅ 支持多章节连续生成、单章重生成、断点续写

## 注意事项

- Novel Forge 弹窗需要浏览器允许弹出窗口
- API Key 仅存储在你本地浏览器中，不会上传到任何服务器
- 如遇弹窗被拦截，请在地址栏右侧允许此站点的弹窗
