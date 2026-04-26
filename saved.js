const SAVED_CHATS_KEY = "cgptx-saved-chats";
const SAVE_PREFS_KEY = "cgptx-save-preferences";
const SAVED_OPEN_RECORD_KEY = "cgptx-open-saved-chat";
const ROLE_LABELS = {
  user: "用户",
  assistant: "助手"
};

const elements = {
  title: document.querySelector('[data-role="title"]'),
  meta: document.querySelector('[data-role="meta"]'),
  main: document.querySelector('[data-role="main"]')
};

let savedChats = {};
let openedRecord = null;

void init();

async function init() {
  await loadSavedChats();

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }

    const { action, key, index } = target.dataset;

    if (action === "show-list") {
      history.pushState(null, "", "saved.html");
      renderList();
      return;
    }

    if (action === "close-tab") {
      window.close();
      return;
    }

    if (action === "open-record") {
      history.pushState(null, "", `saved.html?key=${encodeURIComponent(key)}`);
      renderRecord(key);
      return;
    }

    if (action === "delete-record") {
      void deleteRecord(key);
      return;
    }

    if (action === "copy-message") {
      void copyMessage(key, Number(index), target);
      return;
    }

    if (action === "toggle-feedback") {
      toggleFeedback(target);
    }
  });

  window.addEventListener("popstate", renderFromLocation);
  renderFromLocation();
}

async function loadSavedChats() {
  const stored = await chrome.storage.local.get([SAVED_CHATS_KEY, SAVED_OPEN_RECORD_KEY]);
  savedChats = stored[SAVED_CHATS_KEY] || {};
  openedRecord = normalizeOpenedRecord(stored[SAVED_OPEN_RECORD_KEY]);
  if (openedRecord && !savedChats[openedRecord.key]) {
    savedChats = {
      ...savedChats,
      [openedRecord.key]: openedRecord.record
    };
  }
}

function renderFromLocation() {
  const key = new URLSearchParams(location.search).get("key");
  if (key) {
    renderRecord(key);
  } else {
    renderList();
  }
}

function renderList() {
  const records = getSavedChatEntries();

  elements.title.textContent = "本地聊天记录";
  elements.meta.textContent = `${records.length} 条记录`;

  if (!records.length) {
    elements.main.innerHTML = `
      <section class="saved-empty">
        <h1>还没有本地聊天记录</h1>
        <p>在 ChatGPT 页面侧栏打开“保存本会话”后，会话会保存到这里。</p>
      </section>
    `;
    return;
  }

  elements.main.innerHTML = `
    <section class="saved-list">
      ${records
        .map(
          ({ key, record }) => `
            <article class="saved-card">
              <button type="button" class="saved-card-main" data-action="open-record" data-key="${escapeHtml(key)}">
                <h2>${escapeHtml(record.title || "未命名记录")}</h2>
                <p>${escapeHtml(record.snippet || "无内容预览")}</p>
                <div class="saved-card-meta">${escapeHtml(formatSavedTime(record.updatedAt))} · ${record.messageCount || 0} 条消息</div>
              </button>
              <button type="button" class="saved-delete" data-action="delete-record" data-key="${escapeHtml(key)}">删除</button>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function renderRecord(key, retryCount = 0) {
  const entry = resolveSavedChatEntry(key);
  const record = entry?.record;
  if (!record) {
    if (retryCount < 12) {
      elements.title.textContent = "正在读取本地记录";
      elements.meta.textContent = "同步 Chrome 本地存储...";
      elements.main.innerHTML = `
        <section class="saved-empty">
          <h1>正在读取这条聊天记录</h1>
          <p>如果刚刚保存，Chrome 本地存储可能需要短暂同步。</p>
        </section>
      `;
      window.setTimeout(() => {
        void retryRenderRecord(key, retryCount + 1);
      }, 250);
      return;
    }

    elements.title.textContent = "记录不存在";
    elements.meta.textContent = "可能已被删除";
    elements.main.innerHTML = `
      <section class="saved-empty">
        <h1>找不到这条聊天记录</h1>
        <p>它可能已经从本地存储中删除。</p>
        <button type="button" data-action="show-list">查看记录列表</button>
      </section>
    `;
    return;
  }

  if (entry.key !== key) {
    history.replaceState(null, "", `saved.html?key=${encodeURIComponent(entry.key)}`);
  }

  elements.title.textContent = record.title || "本地聊天记录";
  elements.meta.textContent = `${formatSavedTime(record.updatedAt)} · ${record.messageCount || 0} 条消息`;
  elements.main.innerHTML = `
    <section class="saved-thread">
      ${(record.messages || []).map((message) => renderMessage(entry.key, message)).join("")}
    </section>
  `;
}

async function retryRenderRecord(key, retryCount) {
  await loadSavedChats();
  renderRecord(key, retryCount);
}

function getSavedChatEntries() {
  return Object.entries(savedChats)
    .filter(([, record]) => record && typeof record === "object")
    .map(([key, record]) => ({ key, record }))
    .sort((left, right) => new Date(right.record.updatedAt).getTime() - new Date(left.record.updatedAt).getTime());
}

function resolveSavedChatEntry(requestedKey) {
  if (!requestedKey) {
    return null;
  }

  if (savedChats[requestedKey]) {
    return { key: requestedKey, record: savedChats[requestedKey] };
  }

  if (openedRecord && keysMatch(openedRecord.key, requestedKey)) {
    return openedRecord;
  }

  const normalizedRequestedKey = normalizeSavedChatKey(requestedKey);
  const entry = Object.entries(savedChats).find(([key, record]) => {
    if (keysMatch(key, normalizedRequestedKey)) {
      return true;
    }
    if (keysMatch(record?.conversationKey, normalizedRequestedKey)) {
      return true;
    }
    return keysMatch(record?.url, normalizedRequestedKey);
  });

  return entry ? { key: entry[0], record: entry[1] } : null;
}

function normalizeOpenedRecord(value) {
  if (!value?.key || !value?.record) {
    return null;
  }
  return {
    key: String(value.key),
    record: value.record
  };
}

function keysMatch(left, right) {
  return normalizeSavedChatKey(left) === normalizeSavedChatKey(right);
}

function normalizeSavedChatKey(value) {
  if (!value) {
    return "";
  }

  let key = String(value);
  try {
    key = decodeURIComponent(key);
  } catch {
    // Keep the original value if it is not URI-encoded.
  }

  try {
    key = new URL(key).pathname;
  } catch {
    // Plain storage keys like /c/... are expected.
  }

  key = key.replace(/\/$/, "") || "/";
  return key === "/" ? "/new-chat" : key;
}

function renderMessage(conversationKey, message) {
  const role = message.role === "user" ? "user" : "assistant";
  const roleLabel = ROLE_LABELS[role] || role;
  const actions =
    role === "assistant"
      ? `
        <div class="saved-assistant-actions" aria-label="助手回复操作">
          <button
            type="button"
            class="saved-action-button"
            data-action="copy-message"
            data-key="${escapeHtml(conversationKey)}"
            data-index="${message.index}"
            title="复制"
            aria-label="复制这条回复"
          >
            <span class="saved-action-icon" aria-hidden="true">${COPY_ICON}</span>
            <span class="saved-action-text">复制</span>
          </button>
          <button
            type="button"
            class="saved-action-button"
            data-action="toggle-feedback"
            data-feedback="up"
            title="好回复"
            aria-label="好回复"
          >
            <span class="saved-action-icon" aria-hidden="true">${THUMBS_UP_ICON}</span>
          </button>
          <button
            type="button"
            class="saved-action-button"
            data-action="toggle-feedback"
            data-feedback="down"
            title="差回复"
            aria-label="差回复"
          >
            <span class="saved-action-icon" aria-hidden="true">${THUMBS_DOWN_ICON}</span>
          </button>
        </div>
      `
      : "";

  return `
    <article class="saved-message" data-role="${role}">
      ${role === "assistant" ? '<div class="saved-avatar" aria-hidden="true">AI</div>' : ""}
      <div class="saved-body">
        <div class="saved-role">${escapeHtml(roleLabel)} · #${message.index}</div>
        <div class="saved-content">${renderMessageBody(message, role)}</div>
        ${actions}
      </div>
    </article>
  `;
}

function renderMessageBody(message, role) {
  if (role === "user") {
    return `<div class="saved-text">${renderPlainText(message?.text || "")}</div>`;
  }

  if (message?.html) {
    const html = sanitizeSavedHtml(message.html);
    if (hasRenderableHtml(html)) {
      return `<div class="saved-html">${html}</div>`;
    }
  }

  return `<div class="saved-text">${renderPlainText(message?.text || "")}</div>`;
}

function sanitizeSavedHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");

  template.content
    .querySelectorAll("script, style, button, textarea, input, nav, svg, [data-cgptx-inline-favorite-wrap]")
    .forEach((element) => element.remove());

  const contentRoot = getSavedMessageContentRoot(template.content);
  const output = document.createElement("div");
  if (contentRoot) {
    output.appendChild(contentRoot.cloneNode(true));
  } else {
    output.appendChild(template.content.cloneNode(true));
  }

  output.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();

      if (
        name === "id" ||
        name === "contenteditable" ||
        name.startsWith("on") ||
        name.startsWith("data-cgptx") ||
        (["href", "src"].includes(name) && value.startsWith("javascript:"))
      ) {
        element.removeAttribute(attribute.name);
      }
    });
    cleanSnapshotInlineStyle(element);
  });

  return output.innerHTML;
}

function getSavedMessageContentRoot(fragment) {
  const selectors = [
    '[data-message-author-role="assistant"] .markdown',
    ".markdown",
    '[data-message-author-role] [dir="auto"]',
    '[data-message-author-role]'
  ];

  for (const selector of selectors) {
    const element = fragment.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return fragment.firstElementChild;
}

function cleanSnapshotInlineStyle(element) {
  if (!element.hasAttribute("style")) {
    return;
  }

  if (!isTextFormattingElement(element)) {
    element.removeAttribute("style");
    return;
  }

  const allowedProperties = new Set([
    "color",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "letter-spacing",
    "line-height",
    "list-style-position",
    "list-style-type",
    "overflow-wrap",
    "text-align",
    "text-decoration-line",
    "vertical-align",
    "white-space",
    "word-break"
  ]);

  const declarations = element
    .getAttribute("style")
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => {
      const property = declaration.split(":")[0]?.trim().toLowerCase();
      if (property === "color") {
        return false;
      }
      return allowedProperties.has(property);
    });

  if (declarations.length) {
    element.setAttribute("style", declarations.join("; "));
  } else {
    element.removeAttribute("style");
  }
}

function isTextFormattingElement(element) {
  return /^(a|b|blockquote|code|em|h[1-6]|i|li|ol|p|pre|s|span|strong|sub|sup|table|tbody|td|tfoot|th|thead|tr|u|ul)$/i.test(
    element.tagName
  );
}

function hasRenderableHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const text = template.content.textContent?.replace(/\s+/g, "").trim();
  return Boolean(text || template.content.querySelector("img, table, pre, code, ul, ol, blockquote"));
}

function renderPlainText(text) {
  const value = String(text || "");
  const codePattern = /```([\w-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let html = "";
  let match = codePattern.exec(value);

  while (match) {
    html += renderParagraphs(value.slice(cursor, match.index));
    html += `<pre class="saved-code"><code>${escapeHtml(match[2].trim())}</code></pre>`;
    cursor = match.index + match[0].length;
    match = codePattern.exec(value);
  }

  html += renderParagraphs(value.slice(cursor));
  return html || "<p></p>";
}

function renderParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

async function copyMessage(conversationKey, index, button) {
  const record = resolveSavedChatEntry(conversationKey)?.record;
  const message = record?.messages?.find((item) => item.index === index);
  if (!message) {
    return;
  }

  await writeClipboard(message.text || "");
  button.dataset.copied = "true";
  button.querySelector(".saved-action-text").textContent = "已复制";
  window.setTimeout(() => {
    button.dataset.copied = "false";
    button.querySelector(".saved-action-text").textContent = "复制";
  }, 1200);
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the textarea fallback for browser/profile clipboard edge cases.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function toggleFeedback(button) {
  const actions = button.closest(".saved-assistant-actions");
  actions?.querySelectorAll('[data-action="toggle-feedback"]').forEach((item) => {
    if (item !== button) {
      item.dataset.active = "false";
    }
  });
  button.dataset.active = button.dataset.active === "true" ? "false" : "true";
}

async function deleteRecord(key) {
  const entry = resolveSavedChatEntry(key);
  if (!entry) {
    return;
  }

  const stored = await chrome.storage.local.get(SAVE_PREFS_KEY);
  const savePrefs = stored[SAVE_PREFS_KEY] || {};
  delete savePrefs[entry.key];
  if (entry.record?.conversationKey) {
    delete savePrefs[entry.record.conversationKey];
  }
  delete savedChats[entry.key];
  await chrome.storage.local.set({
    [SAVE_PREFS_KEY]: savePrefs,
    [SAVED_CHATS_KEY]: savedChats
  });
  renderFromLocation();
}

function formatSavedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未知时间";
  }
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const COPY_ICON = `
  <svg viewBox="0 0 24 24" focusable="false">
    <path d="M8 8.5C8 7.67 8.67 7 9.5 7h7c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-7A1.5 1.5 0 0 1 8 15.5v-7Z" />
    <path d="M6 13.5H5.5C4.67 13.5 4 12.83 4 12V5.5C4 4.67 4.67 4 5.5 4H12c.83 0 1.5.67 1.5 1.5V6" />
  </svg>
`;

const THUMBS_UP_ICON = `
  <svg viewBox="0 0 24 24" focusable="false">
    <path d="M7 10v10H4.5A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10H7Z" />
    <path d="M9 20h6.2a3 3 0 0 0 2.93-2.35l1.05-4.73A2.4 2.4 0 0 0 16.84 10H14V6.9A2.9 2.9 0 0 0 11.1 4L9 10v10Z" />
  </svg>
`;

const THUMBS_DOWN_ICON = `
  <svg viewBox="0 0 24 24" focusable="false">
    <path d="M17 14V4h2.5A1.5 1.5 0 0 1 21 5.5v7a1.5 1.5 0 0 1-1.5 1.5H17Z" />
    <path d="M15 4H8.8a3 3 0 0 0-2.93 2.35L4.82 11.08A2.4 2.4 0 0 0 7.16 14H10v3.1a2.9 2.9 0 0 0 2.9 2.9L15 14V4Z" />
  </svg>
`;
