# ChatGPT Sidebar Navigator

一个最小可运行的 Chrome Extension MVP，用来在 ChatGPT 会话页右侧注入消息侧栏，支持：

- 搜索当前会话消息
- 高亮侧栏和原消息块中的搜索词
- 一键滚动跳转到对应消息
- 按用户 / 助手 / 收藏筛选
- 在原消息块上悬浮收藏
- 收藏消息并按会话持久化到本地
- 导出当前会话收藏为 Markdown / JSON
- 快捷键开关侧栏
- 拖拽调整侧栏宽度
- 拖拽整个侧栏位置

## 文件结构

```text
GPT-extension/
├── content.js
├── manifest.json
├── README.md
└── sidebar.css
```

## 安装方式

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前目录：`/Users/wushuo/Desktop/GPT-extension`
5. 打开 `https://chatgpt.com/` 或 `https://chat.openai.com/`

## 当前实现

- 侧栏会自动扫描 `main` 区域里带有 `data-message-author-role` 的消息节点
- 点击侧栏条目会平滑滚动到原消息开头，并做临时高亮
- 收藏数据保存在 `chrome.storage.local`
- 收藏是按 `location.pathname` 维度隔离的
- 默认快捷键是 `Alt/Option + Shift + S`
- 侧栏宽度会记住上一次拖拽结果
- 侧栏位置也会记住上一次拖拽结果
- 收起后的悬浮按钮也可以直接拖动位置
- 收起时显示悬浮入口按钮，点击展开侧边栏；展开后在侧边栏右上角点击“收起”关闭
- `导出 Markdown` / `导出 JSON` 只在“收藏”筛选下显示
- 收藏导出只导出当前会话中已收藏的消息

## 已知限制

- 这是纯前端 DOM 注入方案，不依赖官方 API，也不读取账号历史
- 如果 ChatGPT 页面结构改动，消息选择器可能需要调整
- 搜索高亮是基于页面 DOM 的文本替换，超长会话下会比纯筛选更耗性能
- 导出功能当前只处理当前打开会话里已经抓取到的收藏消息

## 下一步可继续加的功能

- 给原消息块增加悬浮“收藏”按钮
- 支持导出收藏为 Markdown / JSON
- 支持高亮搜索词
- 支持快捷键打开侧栏
- 支持拖拽调整侧栏宽度
