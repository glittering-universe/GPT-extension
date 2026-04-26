(() => {
  const INSTALL_FLAG = "__CGPTX_SIDEBAR_INSTALLED__";
  const UI_KEY = "cgptx-ui";
  const FAVORITES_KEY = "cgptx-favorites";
  const SAVE_PREFS_KEY = "cgptx-save-preferences";
  const SAVED_CHATS_KEY = "cgptx-saved-chats";
  const SAVED_OPEN_RECORD_KEY = "cgptx-open-saved-chat";
  const DEFAULT_PANEL_TOP = 76;
  const DEFAULT_PANEL_RIGHT = 16;
  const DEFAULT_PANEL_WIDTH = 360;
  const MIN_PANEL_WIDTH = 300;
  const MAX_PANEL_WIDTH = 520;
  const MIN_PANEL_HEIGHT = 320;
  const PANEL_GUTTER = 12;
  const TOGGLE_DRAG_THRESHOLD = 6;
  const TOGGLE_TOP_OFFSET = 12;
  const HOTKEY_LABEL = "Alt/Option + Shift + S";
  const ROLE_LABELS = {
    all: "全部",
    user: "用户",
    assistant: "助手",
    favorites: "收藏"
  };
  const SNAPSHOT_STYLE_PROPS = [
    "display",
    "box-sizing",
    "align-items",
    "align-self",
    "justify-content",
    "justify-self",
    "flex",
    "flex-direction",
    "flex-wrap",
    "gap",
    "row-gap",
    "column-gap",
    "grid-template-columns",
    "grid-template-rows",
    "grid-column",
    "grid-row",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-decoration-line",
    "white-space",
    "word-break",
    "overflow-wrap",
    "overflow-x",
    "overflow-y",
    "list-style-type",
    "list-style-position",
    "border-collapse",
    "vertical-align",
    "max-width",
    "min-width"
  ];

  if (window[INSTALL_FLAG]) {
    return;
  }
  window[INSTALL_FLAG] = true;

  const state = {
    activeId: null,
    conversationKey: getConversationKey(),
    favorites: new Set(),
    filter: "all",
    highlightTimer: null,
    messages: [],
    observer: null,
    panelRight: DEFAULT_PANEL_RIGHT,
    panelTop: DEFAULT_PANEL_TOP,
    panelWidth: DEFAULT_PANEL_WIDTH,
    path: location.pathname,
    query: "",
    refreshTimer: null,
    saveEnabled: false,
    saveTimer: null,
    savedChats: {},
    savedDetailKey: null,
    scrollTimer: null,
    suppressOpenClick: false,
    view: "current",
    uiOpen: true
  };

  const elements = {};

  void init();

  async function init() {
    injectPageStyles();
    mountSidebar();
    bindEvents();
    await loadUiState();
    await loadFavorites();
    await loadSavedState();
    syncUi();
    refreshMessages();
    observeConversation();
    watchRouteChanges();
    window.addEventListener("resize", handleWindowResize, { passive: true });
  }

  function mountSidebar() {
    const host = document.createElement("div");
    host.id = "cgptx-host";
    document.documentElement.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: "open" });
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = chrome.runtime.getURL("sidebar.css");

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <button type="button" class="cgptx-toggle" data-open="true" data-action="open-panel" title="点击展开聊天导航">
        打开导航
      </button>
      <aside class="cgptx-panel" data-open="true">
        <div class="cgptx-resizer" data-action="resize-panel" title="拖拽调整宽度"></div>

        <header class="cgptx-header">
          <div class="cgptx-header-main">
            <div class="cgptx-drag-handle" title="拖动侧栏位置"></div>
            <div class="cgptx-title-wrap">
              <strong class="cgptx-title">ChatGPT 聊天导航</strong>
              <span class="cgptx-subtitle">搜索、跳转、收藏，快捷键 ${HOTKEY_LABEL}</span>
            </div>
          </div>
          <div class="cgptx-actions">
            <button type="button" class="cgptx-icon-btn" data-action="close-panel">收起</button>
          </div>
        </header>

        <div class="cgptx-search">
          <div class="cgptx-search-box">
            <input class="cgptx-search-input" type="search" placeholder="搜索消息 / 关键词" />
            <button type="button" class="cgptx-search-clear" data-action="clear-search">清空</button>
          </div>
        </div>

        <div class="cgptx-filters">
          <button type="button" class="cgptx-filter-btn" data-filter="all">全部</button>
          <button type="button" class="cgptx-filter-btn" data-filter="user">用户</button>
          <button type="button" class="cgptx-filter-btn" data-filter="assistant">助手</button>
          <button type="button" class="cgptx-filter-btn" data-filter="favorites">收藏</button>
        </div>

        <div class="cgptx-storage-bar">
          <label class="cgptx-save-toggle">
            <input type="checkbox" data-role="save-toggle" />
            <span class="cgptx-save-switch" aria-hidden="true"></span>
            <span data-role="save-label">保存本会话</span>
          </label>
          <button type="button" class="cgptx-storage-link" data-action="toggle-saved-view">本地记录</button>
        </div>

        <div class="cgptx-meta">
          <span data-role="count-label">正在读取消息...</span>
          <div class="cgptx-meta-side">
            <span data-role="conversation-label"></span>
            <button
              type="button"
              class="cgptx-meta-refresh"
              data-action="refresh-list"
              aria-label="刷新消息列表"
              title="刷新消息列表"
            >&#8635;</button>
          </div>
        </div>

        <div class="cgptx-favorites-tools" data-open="false" data-role="favorites-tools">
          <button type="button" class="cgptx-icon-btn cgptx-export-btn" data-action="export-md">导出 Markdown</button>
          <button type="button" class="cgptx-icon-btn cgptx-export-btn" data-action="export-json">导出 JSON</button>
        </div>

        <div class="cgptx-list">
          <div class="cgptx-list-inner" data-role="message-list"></div>
        </div>
      </aside>
    `;

    shadowRoot.append(stylesheet, wrapper);

    elements.host = host;
    elements.shadowRoot = shadowRoot;
    elements.toggle = shadowRoot.querySelector(".cgptx-toggle");
    elements.panel = shadowRoot.querySelector(".cgptx-panel");
    elements.dragHandle = shadowRoot.querySelector(".cgptx-drag-handle");
    elements.favoritesTools = shadowRoot.querySelector('[data-role="favorites-tools"]');
    elements.resizer = shadowRoot.querySelector(".cgptx-resizer");
    elements.searchInput = shadowRoot.querySelector(".cgptx-search-input");
    elements.countLabel = shadowRoot.querySelector('[data-role="count-label"]');
    elements.conversationLabel = shadowRoot.querySelector('[data-role="conversation-label"]');
    elements.exportButtons = Array.from(shadowRoot.querySelectorAll(".cgptx-export-btn"));
    elements.saveToggle = shadowRoot.querySelector('[data-role="save-toggle"]');
    elements.saveLabel = shadowRoot.querySelector('[data-role="save-label"]');
    elements.savedViewButton = shadowRoot.querySelector('[data-action="toggle-saved-view"]');
    elements.list = shadowRoot.querySelector('[data-role="message-list"]');
    elements.filters = Array.from(shadowRoot.querySelectorAll(".cgptx-filter-btn"));
  }

  function bindEvents() {
    elements.shadowRoot.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action], [data-filter], [data-jump-id], [data-favorite-id]");
      if (!target) {
        return;
      }

      const { action, filter, jumpId, favoriteId } = target.dataset;

      if (action === "open-panel") {
        if (state.suppressOpenClick) {
          state.suppressOpenClick = false;
          return;
        }
        togglePanel(true);
        return;
      }

      if (action === "close-panel") {
        togglePanel(false);
        return;
      }

      if (action === "refresh-list") {
        refreshMessages();
        return;
      }

      if (action === "clear-search") {
        state.query = "";
        elements.searchInput.value = "";
        renderList();
        syncUi();
        void saveUiState();
        if (state.view === "current") {
          scheduleSearchHighlightUpdate();
        } else {
          withObserverPaused(clearSearchHighlights);
        }
        return;
      }

      if (action === "toggle-saved-view") {
        state.view = state.view === "saved" ? "current" : "saved";
        state.savedDetailKey = null;
        renderList();
        syncUi();
        void saveUiState();
        if (state.view === "current") {
          scheduleSearchHighlightUpdate();
        } else {
          withObserverPaused(clearSearchHighlights);
        }
        return;
      }

      if (action === "back-saved-list") {
        state.savedDetailKey = null;
        renderList();
        syncUi();
        return;
      }

      if (action === "open-saved-viewer") {
        openSavedChatViewer(target.dataset.savedKey);
        return;
      }

      if (action === "export-md") {
        exportFavorites("md");
        return;
      }

      if (action === "export-json") {
        exportFavorites("json");
        return;
      }

      if (action === "view-saved-chat") {
        openSavedChatViewer(target.dataset.savedKey);
        return;
      }

      if (action === "delete-saved-chat") {
        event.preventDefault();
        event.stopPropagation();
        void deleteSavedChat(target.dataset.savedKey);
        return;
      }

      if (filter) {
        state.view = "current";
        state.savedDetailKey = null;
        state.filter = filter;
        renderList();
        syncUi();
        void saveUiState();
        scheduleSearchHighlightUpdate();
        return;
      }

      if (favoriteId) {
        event.preventDefault();
        event.stopPropagation();
        void toggleFavorite(favoriteId);
        return;
      }

      if (jumpId) {
        jumpToMessage(jumpId);
      }
    });

    elements.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim();
      renderList();
      syncUi();
      void saveUiState();
      if (state.view === "current") {
        scheduleSearchHighlightUpdate();
      } else {
        withObserverPaused(clearSearchHighlights);
      }
    });

    elements.saveToggle.addEventListener("change", (event) => {
      void setSaveEnabled(event.target.checked);
    });

    elements.resizer.addEventListener("pointerdown", startResize);
    elements.dragHandle.addEventListener("pointerdown", startPanelDrag);
    elements.toggle.addEventListener("pointerdown", startToggleDrag);

    document.addEventListener(
      "click",
      (event) => {
        const viewerAction = event.target.closest("[data-cgptx-viewer-action]");
        if (viewerAction) {
          event.preventDefault();
          event.stopPropagation();
          closeSavedChatViewer();
          return;
        }

        const target = event.target.closest("[data-cgptx-inline-favorite]");
        if (!target) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        void toggleFavorite(target.dataset.favoriteId);
      },
      true
    );

    window.addEventListener(
      "scroll",
      () => {
        window.clearTimeout(state.scrollTimer);
        state.scrollTimer = window.setTimeout(updateActiveFromViewport, 80);
      },
      { passive: true }
    );

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.getElementById("cgptx-saved-reader")) {
        closeSavedChatViewer();
        return;
      }

      if (!matchesHotkey(event) || isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      togglePanel(!state.uiOpen);
    });
  }

  function matchesHotkey(event) {
    return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === "KeyS";
  }

  function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
  }

  function startResize(event) {
    if (!state.uiOpen) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = elements.panel.getBoundingClientRect().width;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const handleMove = (moveEvent) => {
      const nextWidth = startWidth + (startX - moveEvent.clientX);
      state.panelWidth = clampPanelWidth(nextWidth);
      syncUi();
    };

    const handleUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      void saveUiState();
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function startPanelDrag(event) {
    if (!state.uiOpen) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startTop = state.panelTop;
    const startRight = state.panelRight;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "move";
    document.body.style.userSelect = "none";

    const handleMove = (moveEvent) => {
      const nextTop = startTop + (moveEvent.clientY - startY);
      const nextRight = startRight - (moveEvent.clientX - startX);
      const position = clampPanelPosition(nextTop, nextRight, state.panelWidth);
      state.panelTop = position.top;
      state.panelRight = position.right;
      syncUi();
    };

    const handleUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      void saveUiState();
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function startToggleDrag(event) {
    if (state.uiOpen) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startTop = state.panelTop;
    const startRight = state.panelRight;
    const previousCursor = document.body.style.cursor;
    let moved = false;

    document.body.style.cursor = "move";
    document.body.style.userSelect = "none";

    const handleMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (!moved && Math.hypot(deltaX, deltaY) < TOGGLE_DRAG_THRESHOLD) {
        return;
      }

      moved = true;
      state.suppressOpenClick = true;

      const position = clampPanelPosition(startTop + deltaY, startRight - deltaX, state.panelWidth);
      state.panelTop = position.top;
      state.panelRight = position.right;
      syncUi();
    };

    const handleUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      if (moved) {
        void saveUiState();
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function togglePanel(nextOpen) {
    state.uiOpen = nextOpen;
    syncUi();
    void saveUiState();

    if (state.uiOpen) {
      window.setTimeout(() => {
        elements.searchInput?.focus();
      }, 40);
    }
  }

  function handleWindowResize() {
    const clampedWidth = clampPanelWidth(state.panelWidth);
    const position = clampPanelPosition(state.panelTop, state.panelRight, clampedWidth);
    let shouldSave = false;
    if (clampedWidth !== state.panelWidth) {
      state.panelWidth = clampedWidth;
      shouldSave = true;
    }
    if (position.top !== state.panelTop || position.right !== state.panelRight) {
      state.panelTop = position.top;
      state.panelRight = position.right;
      shouldSave = true;
    }
    if (shouldSave) {
      void saveUiState();
    }
    syncUi();
  }

  function observeConversation() {
    if (!state.observer) {
      state.observer = new MutationObserver(() => {
        window.clearTimeout(state.refreshTimer);
        state.refreshTimer = window.setTimeout(refreshMessages, 220);
      });
    }

    resumeConversationObserver();
  }

  function resumeConversationObserver() {
    if (!state.observer || !document.body) {
      return;
    }
    state.observer.observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true
    });
  }

  function withObserverPaused(callback) {
    if (!state.observer) {
      callback();
      return;
    }

    state.observer.disconnect();
    try {
      callback();
    } finally {
      resumeConversationObserver();
    }
  }

  function watchRouteChanges() {
    window.setInterval(() => {
      if (state.path !== location.pathname) {
        state.path = location.pathname;
        state.conversationKey = getConversationKey();
        state.activeId = null;
        state.savedDetailKey = null;
        void Promise.all([loadFavorites(), loadSavedState()]).then(() => {
          refreshMessages();
          syncUi();
        });
      }
    }, 800);
  }

  function refreshMessages() {
    state.messages = collectMessages();
    if (!state.messages.some((message) => message.id === state.activeId)) {
      state.activeId = state.messages[0]?.id ?? null;
    }
    renderList();
    syncUi();
    syncInlineFavoriteButtons();
    applySearchHighlights();
    scheduleSaveCurrentChat();
    updateActiveFromViewport();
  }

  function collectMessages() {
    const nodes = Array.from(document.querySelectorAll("main [data-message-author-role]"));
    const messages = [];
    const occurrences = new Map();

    nodes.forEach((node) => {
      const parentRoleNode = node.parentElement?.closest("[data-message-author-role]");
      if (parentRoleNode) {
        return;
      }

      const role = node.getAttribute("data-message-author-role");
      if (!["user", "assistant"].includes(role)) {
        return;
      }

      const rawText = extractText(node).replace(/\u00a0/g, " ").trim();
      const text = normalizeText(rawText);
      if (!text) {
        return;
      }

      const signature = hashString(`${role}:${text}`);
      const occurrence = (occurrences.get(signature) || 0) + 1;
      occurrences.set(signature, occurrence);

      const index = messages.length + 1;
      const id = `msg-${signature}-${occurrence}`;
      node.setAttribute("data-cgptx-turn-id", id);

      messages.push({
        html: extractHtml(node),
        id,
        index,
        node,
        rawText,
        role,
        snippet: text.length > 180 ? `${text.slice(0, 180)}...` : text,
        text
      });
    });

    return messages;
  }

  function extractText(node) {
    const clone = node.cloneNode(true);
    sanitizeMessageClone(clone);
    return clone.textContent || "";
  }

  function extractHtml(node) {
    const clone = node.cloneNode(true);
    inlineSnapshotStyles(node, clone);
    sanitizeMessageClone(clone);
    return clone.outerHTML || clone.innerHTML || "";
  }

  function inlineSnapshotStyles(sourceRoot, cloneRoot) {
    applySnapshotStyle(sourceRoot, cloneRoot);

    const sourceWalker = document.createTreeWalker(sourceRoot, NodeFilter.SHOW_ELEMENT);
    const cloneWalker = document.createTreeWalker(cloneRoot, NodeFilter.SHOW_ELEMENT);
    let sourceNode = sourceWalker.nextNode();
    let cloneNode = cloneWalker.nextNode();

    while (sourceNode && cloneNode) {
      applySnapshotStyle(sourceNode, cloneNode);
      sourceNode = sourceWalker.nextNode();
      cloneNode = cloneWalker.nextNode();
    }
  }

  function applySnapshotStyle(sourceElement, cloneElement) {
    if (!(sourceElement instanceof Element) || !(cloneElement instanceof Element)) {
      return;
    }

    const computed = window.getComputedStyle(sourceElement);
    const declarations = [];

    SNAPSHOT_STYLE_PROPS.forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (!value || shouldSkipSnapshotStyle(property, value)) {
        return;
      }
      declarations.push(`${property}: ${value}`);
    });

    if (declarations.length) {
      const currentStyle = cloneElement.getAttribute("style");
      cloneElement.setAttribute("style", [currentStyle, ...declarations].filter(Boolean).join("; "));
    }
  }

  function shouldSkipSnapshotStyle(property, value) {
    if (value === "normal" && ["letter-spacing", "font-style", "text-decoration-line"].includes(property)) {
      return true;
    }

    if (property === "background-color" && ["rgba(0, 0, 0, 0)", "transparent"].includes(value)) {
      return true;
    }

    if (property.startsWith("border") && value === "0px") {
      return true;
    }

    return false;
  }

  function sanitizeMessageClone(root) {
    root.querySelectorAll('[data-cgptx-search-mark="true"]').forEach((mark) => {
      mark.replaceWith(document.createTextNode(mark.textContent || ""));
    });

    root
      .querySelectorAll("script, style, button, textarea, input, nav, svg, [data-cgptx-inline-favorite-wrap]")
      .forEach((element) => element.remove());

    const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll("*")] : Array.from(root.querySelectorAll("*"));

    elements.forEach((element) => {
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
    });
  }

  function normalizeText(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function getFilteredMessages() {
    const query = state.query.toLowerCase();

    return state.messages.filter((message) => {
      if (state.filter === "favorites" && !state.favorites.has(message.id)) {
        return false;
      }

      if (state.filter === "user" && message.role !== "user") {
        return false;
      }

      if (state.filter === "assistant" && message.role !== "assistant") {
        return false;
      }

      if (!query) {
        return true;
      }

      return message.text.toLowerCase().includes(query);
    });
  }

  function renderList() {
    if (!elements.list) {
      return;
    }

    if (state.view === "saved") {
      renderSavedView();
      return;
    }

    const scrollTop = elements.list.parentElement?.scrollTop ?? 0;
    const visibleMessages = getFilteredMessages();

    if (!state.messages.length) {
      elements.list.innerHTML = `
        <div class="cgptx-empty">
          <div class="cgptx-empty-title">还没有可索引的消息</div>
          <div class="cgptx-empty-text">打开一个聊天会话后，侧栏会自动读取用户和助手消息。</div>
          <button type="button" class="cgptx-empty-btn" data-action="refresh-list">重新扫描</button>
        </div>
      `;
      syncUi();
      return;
    }

    if (!visibleMessages.length) {
      const emptyText =
        state.filter === "favorites" && !state.query
          ? "当前会话还没有收藏消息。你可以在消息卡片右上角或原消息块上点击收藏。"
          : `试试更短的关键词，或者切换到 ${ROLE_LABELS.all} 筛选。`;

      elements.list.innerHTML = `
        <div class="cgptx-empty">
          <div class="cgptx-empty-title">没有匹配结果</div>
          <div class="cgptx-empty-text">${escapeHtml(emptyText)}</div>
          <button type="button" class="cgptx-empty-btn" data-action="clear-search">清空搜索</button>
        </div>
      `;
      syncUi();
      return;
    }

    elements.list.innerHTML = visibleMessages
      .map((message) => {
        const isFavorite = state.favorites.has(message.id);
        const isActive = state.activeId === message.id;

        return `
          <article class="cgptx-item" data-active="${String(isActive)}">
            <button type="button" class="cgptx-item-jump" data-jump-id="${message.id}">
              <div class="cgptx-item-main">
                <div class="cgptx-item-head">
                  <span class="cgptx-item-index">#${message.index}</span>
                  <span class="cgptx-item-role" data-role="${message.role}">${escapeHtml(ROLE_LABELS[message.role])}</span>
                </div>
                <div class="cgptx-item-text">${renderHighlightedHtml(message.snippet, state.query)}</div>
              </div>
            </button>
            <div class="cgptx-item-actions">
              <button
                type="button"
                class="cgptx-item-star"
                data-favorite-id="${message.id}"
                data-favorite="${String(isFavorite)}"
                aria-label="${isFavorite ? "取消收藏" : "收藏消息"}"
                title="${isFavorite ? "取消收藏" : "收藏消息"}"
              >★</button>
            </div>
          </article>
        `;
      })
      .join("");

    if (elements.list.parentElement) {
      elements.list.parentElement.scrollTop = scrollTop;
    }

    syncUi();
  }

  function renderSavedView() {
    const entries = getFilteredSavedChatEntries();

    if (state.savedDetailKey) {
      const detailKey = resolveSavedChatKey(state.savedDetailKey);
      const record = detailKey ? state.savedChats[detailKey] : null;
      if (!record) {
        state.savedDetailKey = null;
        renderSavedView();
        return;
      }
      state.savedDetailKey = detailKey;

      elements.list.innerHTML = `
        <div class="cgptx-saved-detail-head">
          <button type="button" class="cgptx-saved-back" data-action="back-saved-list">返回本地记录</button>
          <div class="cgptx-saved-detail-actions">
            <button
              type="button"
              class="cgptx-saved-open"
              data-action="open-saved-viewer"
              data-saved-key="${escapeHtml(detailKey)}"
            >新标签打开</button>
            <button
              type="button"
              class="cgptx-saved-delete"
              data-action="delete-saved-chat"
              data-saved-key="${escapeHtml(detailKey)}"
            >删除</button>
          </div>
        </div>
        <article class="cgptx-saved-detail-meta">
          <strong>${escapeHtml(record.title || "未命名记录")}</strong>
          <span>${escapeHtml(formatSavedTime(record.updatedAt))} · ${record.messageCount || 0} 条消息</span>
        </article>
        <div class="cgptx-saved-reader-hint">已保存会话会在新标签页按 ChatGPT 阅读布局打开。</div>
        ${(record.messages || [])
          .map(
            (message) => `
              <article class="cgptx-saved-message">
                <div class="cgptx-item-head">
                  <span class="cgptx-item-index">#${message.index}</span>
                  <span class="cgptx-item-role" data-role="${message.role}">${escapeHtml(ROLE_LABELS[message.role] || message.role)}</span>
                </div>
                <div class="cgptx-saved-message-text">${renderSavedMessageBody(message)}</div>
              </article>
            `
          )
          .join("")}
      `;
      return;
    }

    if (!entries.length) {
      const hasAnySaved = Object.keys(state.savedChats).length > 0;
      elements.list.innerHTML = `
        <div class="cgptx-empty">
          <div class="cgptx-empty-title">${hasAnySaved ? "没有匹配的本地记录" : "还没有本地聊天记录"}</div>
          <div class="cgptx-empty-text">${hasAnySaved ? "换个关键词再试。" : "打开“保存本会话”后，当前会话会保存到本地。"}</div>
        </div>
      `;
      return;
    }

    elements.list.innerHTML = entries
      .map(
        ({ key, record }) => `
          <article class="cgptx-saved-chat">
            <button
              type="button"
              class="cgptx-saved-chat-main"
              data-action="view-saved-chat"
              data-saved-key="${escapeHtml(key)}"
            >
              <div class="cgptx-saved-chat-head">
                <strong>${escapeHtml(record.title || "未命名记录")}</strong>
                <span>${escapeHtml(formatSavedTime(record.updatedAt))}</span>
              </div>
              <div class="cgptx-saved-chat-text">${escapeHtml(record.snippet || "无内容预览")}</div>
              <div class="cgptx-saved-chat-foot">${record.messageCount || 0} 条消息</div>
            </button>
            <button
              type="button"
              class="cgptx-saved-delete"
              data-action="delete-saved-chat"
              data-saved-key="${escapeHtml(key)}"
              title="删除本地记录"
            >删除</button>
          </article>
        `
      )
      .join("");
  }

  function openSavedChatViewer(conversationKey) {
    const storageKey = resolveSavedChatKey(conversationKey);
    if (!storageKey) {
      return;
    }

    void persistSavedChatOpenRecord(storageKey);
    const url = chrome.runtime.getURL(`saved.html?key=${encodeURIComponent(storageKey)}`);
    window.open(url, "_blank", "noopener");
  }

  async function persistSavedChatOpenRecord(storageKey) {
    const record = state.savedChats[storageKey];
    if (!record) {
      return;
    }

    try {
      await storageSet({
        [SAVED_OPEN_RECORD_KEY]: {
          key: storageKey,
          openedAt: new Date().toISOString(),
          record
        }
      });
      await saveSavedChats();
    } catch (error) {
      console.warn("[ChatGPT Sidebar Navigator] Failed to persist saved chat before opening.", error);
    }
  }

  function closeSavedChatViewer() {
    const reader = document.getElementById("cgptx-saved-reader");
    if (reader) {
      reader.remove();
    }
  }

  function renderSavedViewerMessage(message) {
    const role = message.role === "user" ? "user" : "assistant";
    const roleLabel = ROLE_LABELS[role] || role;

    if (message.html) {
      return `
        <article class="cgptx-reader-native-message" data-role="${role}">
          ${sanitizeSavedHtml(message.html)}
        </article>
      `;
    }

    return `
      <article class="cgptx-reader-message" data-role="${role}">
        <div class="cgptx-reader-avatar" aria-hidden="true">${role === "user" ? "你" : "AI"}</div>
        <div class="cgptx-reader-content">
          <div class="cgptx-reader-role">${escapeHtml(roleLabel)} · #${message.index}</div>
          <div class="cgptx-reader-text">${renderSavedMessageBody(message)}</div>
        </div>
      </article>
    `;
  }

  function renderSavedMessageBody(message) {
    if (message?.html) {
      return `<div class="cgptx-saved-html">${sanitizeSavedHtml(message.html)}</div>`;
    }

    return renderSavedChatContent(message?.text || "");
  }

  function sanitizeSavedHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    sanitizeMessageClone(template.content);
    return template.innerHTML;
  }

  function renderSavedChatContent(text) {
    const value = String(text || "");
    const codePattern = /```([\w-]*)\n?([\s\S]*?)```/g;
    let cursor = 0;
    let html = "";
    let match = codePattern.exec(value);

    while (match) {
      html += renderSavedPlainText(value.slice(cursor, match.index));
      const language = match[1] ? `<div class="cgptx-reader-code-lang">${escapeHtml(match[1])}</div>` : "";
      html += `<pre class="cgptx-reader-code">${language}<code>${escapeHtml(match[2].trim())}</code></pre>`;
      cursor = match.index + match[0].length;
      match = codePattern.exec(value);
    }

    html += renderSavedPlainText(value.slice(cursor));
    return html || "<p></p>";
  }

  function renderSavedPlainText(text) {
    return text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function syncUi() {
    if (elements.panel) {
      const panelWidth = clampPanelWidth(state.panelWidth);
      const position = clampPanelPosition(state.panelTop, state.panelRight, panelWidth);
      elements.panel.dataset.open = String(state.uiOpen);
      elements.panel.style.width = `${panelWidth}px`;
      elements.panel.style.top = `${position.top}px`;
      elements.panel.style.right = `${position.right}px`;
      elements.panel.style.height = `${calcPanelHeight(position.top)}px`;
    }
    if (elements.toggle) {
      const position = clampPanelPosition(state.panelTop, state.panelRight, state.panelWidth);
      elements.toggle.dataset.open = String(state.uiOpen);
      elements.toggle.textContent = "打开导航";
      elements.toggle.title = `点击展开聊天导航，拖动可移动位置，快捷键 ${HOTKEY_LABEL}`;
      elements.toggle.setAttribute("aria-label", "展开聊天导航");
      elements.toggle.style.top = `${position.top + TOGGLE_TOP_OFFSET}px`;
      elements.toggle.style.right = `${position.right}px`;
      elements.toggle.style.left = "auto";
    }
    if (elements.searchInput && elements.searchInput.value !== state.query) {
      elements.searchInput.value = state.query;
    }
    if (elements.countLabel) {
      if (state.view === "saved") {
        const totalSaved = Object.keys(state.savedChats).length;
        const visibleSaved = getFilteredSavedChatEntries().length;
        elements.countLabel.textContent = state.savedDetailKey
          ? "查看本地记录"
          : `本地记录 ${visibleSaved} / ${totalSaved}`;
      } else {
        const visibleCount = getFilteredMessages().length;
        elements.countLabel.textContent = state.messages.length
          ? `显示 ${visibleCount} / ${state.messages.length} 条消息`
          : "等待聊天内容出现";
      }
    }
    if (elements.conversationLabel) {
      elements.conversationLabel.textContent = state.view === "saved" ? "本地查看" : simplifyConversationKey(state.conversationKey);
    }
    if (elements.filters) {
      elements.filters.forEach((button) => {
        button.dataset.active = String(state.view === "current" && button.dataset.filter === state.filter);
      });
    }
    if (elements.favoritesTools) {
      const favoriteCount = state.messages.filter((message) => state.favorites.has(message.id)).length;
      const showFavoriteTools = state.view === "current" && state.filter === "favorites";
      elements.favoritesTools.dataset.open = String(showFavoriteTools);
      elements.exportButtons.forEach((button) => {
        button.disabled = favoriteCount === 0;
        button.title = favoriteCount === 0 ? "当前没有可导出的收藏消息" : button.textContent;
      });
    }
    if (elements.saveToggle) {
      elements.saveToggle.checked = state.saveEnabled;
      elements.saveToggle.disabled = state.view === "saved";
    }
    if (elements.saveLabel) {
      elements.saveLabel.textContent = state.saveEnabled ? "已保存本会话" : "保存本会话";
    }
    if (elements.savedViewButton) {
      elements.savedViewButton.textContent = state.view === "saved" ? "当前会话" : "本地记录";
      elements.savedViewButton.dataset.active = String(state.view === "saved");
    }
  }

  function simplifyConversationKey(key) {
    if (key === "/new-chat") {
      return "新会话";
    }
    const segments = key.split("/").filter(Boolean);
    return segments.slice(-2).join(" / ");
  }

  function jumpToMessage(id) {
    const message = state.messages.find((item) => item.id === id);
    if (!message) {
      return;
    }

    state.activeId = id;
    renderList();
    message.node.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    flashMessage(message.node);
  }

  function flashMessage(node) {
    const selector = '[data-cgptx-highlight="true"]';
    document.querySelectorAll(selector).forEach((element) => element.removeAttribute("data-cgptx-highlight"));
    node.setAttribute("data-cgptx-highlight", "true");
    window.setTimeout(() => {
      node.removeAttribute("data-cgptx-highlight");
    }, 1800);
  }

  function updateActiveFromViewport() {
    if (!state.messages.length) {
      return;
    }

    const viewportAnchor = 120;
    let activeMessage = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    state.messages.forEach((message) => {
      const rect = message.node.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        return;
      }
      const distance = Math.abs(rect.top - viewportAnchor);
      if (distance < bestDistance) {
        bestDistance = distance;
        activeMessage = message;
      }
    });

    if (activeMessage && state.activeId !== activeMessage.id) {
      state.activeId = activeMessage.id;
      renderList();
    }
  }

  async function toggleFavorite(id) {
    if (!id) {
      return;
    }

    if (state.favorites.has(id)) {
      state.favorites.delete(id);
    } else {
      state.favorites.add(id);
    }

    await saveFavorites();
    renderList();
    syncUi();
    syncInlineFavoriteButtons();
  }

  async function setSaveEnabled(nextEnabled) {
    state.saveEnabled = nextEnabled;
    await saveSavePreference();

    if (state.saveEnabled) {
      await saveCurrentChatSnapshot();
    } else {
      delete state.savedChats[state.conversationKey];
      await saveSavedChats();
    }

    renderList();
    syncUi();
  }

  function scheduleSaveCurrentChat() {
    if (!state.saveEnabled || !state.messages.length) {
      return;
    }

    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => {
      void saveCurrentChatSnapshot();
    }, 500);
  }

  async function saveCurrentChatSnapshot() {
    if (!state.saveEnabled || !state.messages.length) {
      return;
    }

    const snapshot = buildCurrentChatSnapshot();
    state.savedChats[state.conversationKey] = snapshot;
    await saveSavedChats();
    syncUi();
  }

  function buildCurrentChatSnapshot() {
    const messages = state.messages.map((message) => ({
      html: message.html,
      id: message.id,
      index: message.index,
      role: message.role,
      text: message.rawText
    }));

    const firstUserMessage = state.messages.find((message) => message.role === "user");
    const titleSource = firstUserMessage?.text || document.title || simplifyConversationKey(state.conversationKey);
    const title = titleSource.length > 48 ? `${titleSource.slice(0, 48)}...` : titleSource;
    const snippetSource = messages.find((message) => message.text)?.text || "";
    const snippet = normalizeText(snippetSource).slice(0, 140);

    return {
      conversationKey: state.conversationKey,
      formatVersion: 2,
      messageCount: messages.length,
      messages,
      savedAt: state.savedChats[state.conversationKey]?.savedAt || new Date().toISOString(),
      snippet,
      title,
      updatedAt: new Date().toISOString(),
      url: location.href
    };
  }

  function getFilteredSavedChatEntries() {
    const query = state.query.toLowerCase();

    return Object.entries(state.savedChats)
      .filter(([, record]) => record && typeof record === "object")
      .map(([key, record]) => ({ key, record }))
      .filter(({ record }) => {
        if (!query) {
          return true;
        }

        const haystack = [
          record.title,
          record.snippet,
          ...(Array.isArray(record.messages) ? record.messages.map((message) => message.text) : [])
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((left, right) => new Date(right.record.updatedAt).getTime() - new Date(left.record.updatedAt).getTime());
  }

  function resolveSavedChatKey(requestedKey) {
    if (!requestedKey) {
      return null;
    }

    if (state.savedChats[requestedKey]) {
      return requestedKey;
    }

    const normalizedRequestedKey = normalizeSavedChatKey(requestedKey);
    const entry = Object.entries(state.savedChats).find(([key, record]) => {
      if (normalizeSavedChatKey(key) === normalizedRequestedKey) {
        return true;
      }
      if (normalizeSavedChatKey(record?.conversationKey) === normalizedRequestedKey) {
        return true;
      }
      return normalizeSavedChatKey(record?.url) === normalizedRequestedKey;
    });

    return entry?.[0] || null;
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

  async function deleteSavedChat(conversationKey) {
    const storageKey = resolveSavedChatKey(conversationKey);
    if (!storageKey) {
      return;
    }

    const record = state.savedChats[storageKey];
    delete state.savedChats[storageKey];

    if (storageKey === state.conversationKey || record?.conversationKey === state.conversationKey) {
      state.saveEnabled = false;
      await saveSavePreference();
    }

    if (state.savedDetailKey === storageKey) {
      state.savedDetailKey = null;
    }

    await saveSavedChats();
    renderList();
    syncUi();
  }

  function syncInlineFavoriteButtons() {
    withObserverPaused(() => {
      const validIds = new Set(state.messages.map((message) => message.id));

      document.querySelectorAll("[data-cgptx-inline-favorite-wrap]").forEach((wrap) => {
        const button = wrap.querySelector("[data-cgptx-inline-favorite]");
        const favoriteId = button?.dataset.favoriteId;
        if (!favoriteId || !validIds.has(favoriteId)) {
          wrap.remove();
        }
      });

      state.messages.forEach((message) => {
        let wrap = message.node.querySelector(":scope > [data-cgptx-inline-favorite-wrap]");
        if (!wrap) {
          wrap = document.createElement("div");
          wrap.setAttribute("data-cgptx-inline-favorite-wrap", "true");

          const button = document.createElement("button");
          button.type = "button";
          button.className = "cgptx-inline-favorite";
          button.setAttribute("data-cgptx-inline-favorite", "true");
          wrap.appendChild(button);
          message.node.appendChild(wrap);
        }

        const button = wrap.querySelector("[data-cgptx-inline-favorite]");
        const isFavorite = state.favorites.has(message.id);
        wrap.dataset.favorite = String(isFavorite);
        button.dataset.favoriteId = message.id;
        button.dataset.favorite = String(isFavorite);
        button.textContent = isFavorite ? "★ 已收藏" : "☆ 收藏";
        button.title = isFavorite ? "取消收藏" : "收藏消息";
        button.setAttribute("aria-label", isFavorite ? "取消收藏" : "收藏消息");
      });
    });
  }

  function scheduleSearchHighlightUpdate() {
    window.clearTimeout(state.highlightTimer);
    state.highlightTimer = window.setTimeout(() => {
      applySearchHighlights();
    }, 80);
  }

  function applySearchHighlights() {
    withObserverPaused(() => {
      clearSearchHighlights();

      if (!state.query) {
        return;
      }

      const normalizedQuery = state.query.toLowerCase();
      state.messages.forEach((message) => {
        if (!message.text.toLowerCase().includes(normalizedQuery)) {
          return;
        }
        highlightQueryInNode(message.node, state.query);
      });
    });
  }

  function clearSearchHighlights() {
    const marks = Array.from(document.querySelectorAll('[data-cgptx-search-mark="true"]'));
    const parents = new Set();

    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) {
        return;
      }
      parents.add(parent);
      mark.replaceWith(document.createTextNode(mark.textContent || ""));
    });

    parents.forEach((parent) => {
      if (typeof parent.normalize === "function") {
        parent.normalize();
      }
    });
  }

  function highlightQueryInNode(root, query) {
    const lowerQuery = query.toLowerCase();
    const textNodes = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const value = node.nodeValue;
          const parent = node.parentElement;

          if (!value || !value.trim() || !parent) {
            return NodeFilter.FILTER_REJECT;
          }

          if (parent.closest('[data-cgptx-inline-favorite-wrap], [data-cgptx-search-mark="true"]')) {
            return NodeFilter.FILTER_REJECT;
          }

          if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          return value.toLowerCase().includes(lowerQuery) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach((node) => {
      replaceTextNodeWithHighlights(node, query);
    });
  }

  function replaceTextNodeWithHighlights(textNode, query) {
    const text = textNode.nodeValue || "";
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let searchIndex = 0;
    let matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) {
      return;
    }

    const fragment = document.createDocumentFragment();

    while (matchIndex !== -1) {
      if (matchIndex > searchIndex) {
        fragment.appendChild(document.createTextNode(text.slice(searchIndex, matchIndex)));
      }

      const mark = document.createElement("mark");
      mark.setAttribute("data-cgptx-search-mark", "true");
      mark.textContent = text.slice(matchIndex, matchIndex + query.length);
      fragment.appendChild(mark);

      searchIndex = matchIndex + query.length;
      matchIndex = lowerText.indexOf(lowerQuery, searchIndex);
    }

    if (searchIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(searchIndex)));
    }

    textNode.replaceWith(fragment);
  }

  function renderHighlightedHtml(text, query) {
    if (!query) {
      return escapeHtml(text);
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let searchIndex = 0;
    let matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) {
      return escapeHtml(text);
    }

    let html = "";

    while (matchIndex !== -1) {
      if (matchIndex > searchIndex) {
        html += escapeHtml(text.slice(searchIndex, matchIndex));
      }

      html += `<mark class="cgptx-match">${escapeHtml(text.slice(matchIndex, matchIndex + query.length))}</mark>`;
      searchIndex = matchIndex + query.length;
      matchIndex = lowerText.indexOf(lowerQuery, searchIndex);
    }

    if (searchIndex < text.length) {
      html += escapeHtml(text.slice(searchIndex));
    }

    return html;
  }

  function renderSavedText(text) {
    return escapeHtml(text || "").replace(/\n/g, "<br>");
  }

  function formatSavedTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "未知时间";
    }
    return date.toLocaleString();
  }

  async function loadUiState() {
    const stored = await storageGet(UI_KEY);
    const uiState = stored?.[UI_KEY];
    if (!uiState) {
      return;
    }

    state.filter = ["all", "user", "assistant", "favorites"].includes(uiState.filter) ? uiState.filter : "all";
    state.panelRight = typeof uiState.panelRight === "number" ? uiState.panelRight : DEFAULT_PANEL_RIGHT;
    state.panelTop = typeof uiState.panelTop === "number" ? uiState.panelTop : DEFAULT_PANEL_TOP;
    state.query = typeof uiState.query === "string" ? uiState.query : "";
    state.view = ["current", "saved"].includes(uiState.view) ? uiState.view : "current";
    state.uiOpen = typeof uiState.uiOpen === "boolean" ? uiState.uiOpen : true;
    state.panelWidth = clampPanelWidth(typeof uiState.panelWidth === "number" ? uiState.panelWidth : DEFAULT_PANEL_WIDTH);
    const position = clampPanelPosition(state.panelTop, state.panelRight, state.panelWidth);
    state.panelTop = position.top;
    state.panelRight = position.right;
  }

  function saveUiState() {
    return storageSet({
      [UI_KEY]: {
        filter: state.filter,
        panelRight: state.panelRight,
        panelTop: state.panelTop,
        panelWidth: clampPanelWidth(state.panelWidth),
        query: state.query,
        view: state.view,
        uiOpen: state.uiOpen
      }
    });
  }

  async function loadFavorites() {
    const stored = await storageGet(FAVORITES_KEY);
    const allFavorites = stored?.[FAVORITES_KEY] || {};
    const favoritesForConversation = allFavorites[state.conversationKey];
    state.favorites = new Set(Array.isArray(favoritesForConversation) ? favoritesForConversation : []);
  }

  async function saveFavorites() {
    const stored = await storageGet(FAVORITES_KEY);
    const allFavorites = stored?.[FAVORITES_KEY] || {};
    allFavorites[state.conversationKey] = Array.from(state.favorites);
    await storageSet({
      [FAVORITES_KEY]: allFavorites
    });
  }

  async function loadSavedState() {
    const stored = await storageGet([SAVE_PREFS_KEY, SAVED_CHATS_KEY]);
    const savePrefs = stored?.[SAVE_PREFS_KEY] || {};
    state.savedChats = stored?.[SAVED_CHATS_KEY] || {};
    state.saveEnabled = Boolean(savePrefs[state.conversationKey]);
  }

  async function saveSavePreference() {
    const stored = await storageGet(SAVE_PREFS_KEY);
    const savePrefs = stored?.[SAVE_PREFS_KEY] || {};

    if (state.saveEnabled) {
      savePrefs[state.conversationKey] = true;
    } else {
      delete savePrefs[state.conversationKey];
    }

    await storageSet({
      [SAVE_PREFS_KEY]: savePrefs
    });
  }

  function saveSavedChats() {
    return storageSet({
      [SAVED_CHATS_KEY]: state.savedChats
    });
  }

  function exportFavorites(format) {
    const favoriteMessages = state.messages
      .filter((message) => state.favorites.has(message.id))
      .sort((left, right) => left.index - right.index);

    if (!favoriteMessages.length) {
      window.alert("当前会话还没有收藏消息。");
      return;
    }

    const exportedAt = new Date();
    const conversationLabel = simplifyConversationKey(state.conversationKey) || "chat";
    const fileBase = sanitizeFileName(`chatgpt-favorites-${conversationLabel}`) || "chatgpt-favorites";
    const timestamp = formatExportTimestamp(exportedAt);

    if (format === "md") {
      const content = buildMarkdownExport(favoriteMessages, exportedAt);
      downloadTextFile(`${fileBase}-${timestamp}.md`, content, "text/markdown;charset=utf-8");
      return;
    }

    const content = JSON.stringify(
      {
        conversationKey: state.conversationKey,
        exportedAt: exportedAt.toISOString(),
        messages: favoriteMessages.map((message) => ({
          id: message.id,
          index: message.index,
          role: message.role,
          text: message.rawText
        }))
      },
      null,
      2
    );

    downloadTextFile(`${fileBase}-${timestamp}.json`, content, "application/json;charset=utf-8");
  }

  function buildMarkdownExport(messages, exportedAt) {
    const lines = [
      "# ChatGPT Favorites",
      "",
      `- 会话: ${simplifyConversationKey(state.conversationKey)}`,
      `- 导出时间: ${exportedAt.toLocaleString()}`,
      `- 收藏条数: ${messages.length}`,
      ""
    ];

    messages.forEach((message) => {
      lines.push(`## #${message.index} ${ROLE_LABELS[message.role]}`);
      lines.push("");
      lines.push(...message.rawText.split("\n").map((line) => `> ${line}`));
      lines.push("");
    });

    return lines.join("\n");
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function sanitizeFileName(value) {
    return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  function formatExportTimestamp(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("") + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function clampPanelWidth(width) {
    const viewportMax = Math.max(280, Math.min(MAX_PANEL_WIDTH, window.innerWidth - 24));
    const viewportMin = Math.min(MIN_PANEL_WIDTH, viewportMax);
    return Math.min(viewportMax, Math.max(viewportMin, width));
  }

  function clampPanelPosition(top, right, width) {
    const panelWidth = clampPanelWidth(width);
    const maxTop = Math.max(PANEL_GUTTER, window.innerHeight - MIN_PANEL_HEIGHT - PANEL_GUTTER);
    const maxRight = Math.max(PANEL_GUTTER, window.innerWidth - panelWidth - PANEL_GUTTER);

    return {
      top: Math.min(maxTop, Math.max(PANEL_GUTTER, top)),
      right: Math.min(maxRight, Math.max(PANEL_GUTTER, right))
    };
  }

  function calcPanelHeight(top) {
    return Math.max(MIN_PANEL_HEIGHT, window.innerHeight - top - PANEL_GUTTER);
  }

  function getConversationKey() {
    const path = location.pathname.replace(/\/$/, "") || "/";
    return path === "/" ? "/new-chat" : path;
  }

  function injectPageStyles() {
    if (document.getElementById("cgptx-runtime-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "cgptx-runtime-style";
    style.textContent = `
      [data-cgptx-turn-id] {
        position: relative;
        scroll-margin-top: 92px;
      }

      [data-cgptx-highlight="true"] {
        position: relative;
        border-radius: 16px;
        background: rgba(191, 219, 254, 0.26) !important;
        box-shadow:
          0 0 0 2px rgba(59, 130, 246, 0.4),
          0 22px 40px rgba(59, 130, 246, 0.12);
        transition: box-shadow 180ms ease, background 180ms ease;
      }

      [data-cgptx-inline-favorite-wrap] {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 2;
        opacity: 0;
        transform: translateY(-4px);
        transition: opacity 140ms ease, transform 140ms ease;
      }

      [data-cgptx-turn-id]:hover [data-cgptx-inline-favorite-wrap],
      [data-cgptx-inline-favorite-wrap][data-favorite="true"],
      [data-cgptx-inline-favorite-wrap]:focus-within {
        opacity: 1;
        transform: translateY(0);
      }

      [data-cgptx-inline-favorite-wrap] .cgptx-inline-favorite {
        appearance: none;
        border: 0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.94);
        color: #0f172a;
        cursor: pointer;
        font: 600 12px/1 "SF Pro Display", "PingFang SC", "Segoe UI", sans-serif;
        padding: 10px 12px;
        box-shadow:
          0 10px 28px rgba(15, 23, 42, 0.12),
          inset 0 0 0 1px rgba(148, 163, 184, 0.18);
      }

      [data-cgptx-inline-favorite-wrap] .cgptx-inline-favorite[data-favorite="true"] {
        background: rgba(255, 247, 237, 0.98);
        color: #b45309;
      }

      [data-cgptx-search-mark="true"] {
        background: rgba(250, 204, 21, 0.34);
        color: inherit;
        border-radius: 4px;
        padding: 0 2px;
      }

      #cgptx-saved-reader {
        position: fixed;
        inset: 0;
        z-index: 2147483645;
        background: rgba(255, 255, 255, 0.98);
        color: #0f172a;
        font-family: "SF Pro Display", "PingFang SC", "Segoe UI", sans-serif;
      }

      #cgptx-saved-reader .cgptx-reader-shell {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      #cgptx-saved-reader .cgptx-reader-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-height: 66px;
        padding: 12px 24px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(14px);
      }

      #cgptx-saved-reader .cgptx-reader-header div {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      #cgptx-saved-reader .cgptx-reader-header strong {
        overflow: hidden;
        color: #0f172a;
        font-size: 16px;
        font-weight: 700;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #cgptx-saved-reader .cgptx-reader-header span {
        color: #64748b;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.35;
      }

      #cgptx-saved-reader .cgptx-reader-header button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        background: #0f172a;
        color: #ffffff;
        cursor: pointer;
        font: 600 13px/1 "SF Pro Display", "PingFang SC", "Segoe UI", sans-serif;
        padding: 11px 14px;
      }

      #cgptx-saved-reader .cgptx-reader-main {
        flex: 1;
        overflow-y: auto;
        padding: 36px max(24px, calc((100vw - 820px) / 2)) 64px;
      }

      #cgptx-saved-reader .cgptx-reader-message {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr);
        gap: 14px;
        margin: 0 auto 28px;
        max-width: 820px;
      }

      #cgptx-saved-reader .cgptx-reader-native-message {
        margin: 0 auto 28px;
        max-width: 820px;
      }

      #cgptx-saved-reader .cgptx-reader-native-message[data-role="user"] {
        display: flex;
        justify-content: flex-end;
      }

      #cgptx-saved-reader .cgptx-reader-native-message[data-role="assistant"] {
        display: block;
      }

      #cgptx-saved-reader .cgptx-reader-native-message [data-message-author-role="user"] {
        max-width: min(680px, 100%);
      }

      #cgptx-saved-reader .cgptx-reader-native-message [data-message-author-role="assistant"] {
        max-width: 100%;
      }

      #cgptx-saved-reader .cgptx-reader-message[data-role="user"] {
        grid-template-columns: minmax(0, 1fr) 34px;
      }

      #cgptx-saved-reader .cgptx-reader-message[data-role="user"] .cgptx-reader-avatar {
        grid-column: 2;
        grid-row: 1;
        background: #0f172a;
        color: #ffffff;
      }

      #cgptx-saved-reader .cgptx-reader-message[data-role="user"] .cgptx-reader-content {
        grid-column: 1;
        grid-row: 1;
        justify-self: end;
        max-width: min(680px, 100%);
        border-radius: 18px;
        background: #f1f5f9;
        padding: 14px 16px;
      }

      #cgptx-saved-reader .cgptx-reader-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
        font-size: 12px;
        font-weight: 700;
      }

      #cgptx-saved-reader .cgptx-reader-content {
        min-width: 0;
      }

      #cgptx-saved-reader .cgptx-reader-role {
        margin-bottom: 8px;
        color: #64748b;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.4;
      }

      #cgptx-saved-reader .cgptx-reader-text {
        color: #1e293b;
        font-size: 15px;
        font-weight: 500;
        line-height: 1.72;
        word-break: break-word;
      }

      #cgptx-saved-reader .cgptx-reader-text p {
        margin: 0 0 12px;
      }

      #cgptx-saved-reader .cgptx-reader-text p:last-child {
        margin-bottom: 0;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) :where(h1, h2, h3, h4, h5, h6) {
        margin: 16px 0 8px;
        color: #0f172a;
        font-weight: 700;
        line-height: 1.35;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) :where(ul, ol) {
        margin: 10px 0 14px;
        padding-left: 24px;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) li {
        margin: 4px 0;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) blockquote {
        margin: 14px 0;
        border-left: 3px solid #cbd5e1;
        color: #475569;
        padding-left: 12px;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) table {
        width: 100%;
        margin: 14px 0;
        border-collapse: collapse;
        font-size: 13px;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) :where(th, td) {
        border: 1px solid #cbd5e1;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) th {
        background: #f1f5f9;
        font-weight: 700;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) code:not(pre code) {
        border-radius: 5px;
        background: #f1f5f9;
        color: #0f172a;
        font: 600 0.92em/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 2px 5px;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) pre {
        margin: 14px 0;
        overflow-x: auto;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        background: #f8fafc !important;
        color: #0f172a !important;
        font: 500 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 14px;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) pre code,
      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) pre code * {
        background: transparent !important;
        color: #0f172a !important;
        padding: 0;
      }

      #cgptx-saved-reader :where(.cgptx-saved-html, .cgptx-reader-native-message) img {
        max-width: 100%;
        border-radius: 10px;
      }

      #cgptx-saved-reader .cgptx-reader-code {
        margin: 14px 0;
        overflow-x: auto;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        background: #f8fafc !important;
        color: #0f172a !important;
        font: 500 13px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        padding: 14px;
      }

      #cgptx-saved-reader .cgptx-reader-code-lang {
        margin: -2px 0 8px;
        color: #94a3b8;
        font: 700 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        text-transform: uppercase;
      }

      @media (max-width: 720px) {
        #cgptx-saved-reader .cgptx-reader-header {
          padding: 10px 14px;
        }

        #cgptx-saved-reader .cgptx-reader-main {
          padding: 24px 14px 48px;
        }

        #cgptx-saved-reader .cgptx-reader-message,
        #cgptx-saved-reader .cgptx-reader-message[data-role="user"] {
          grid-template-columns: 30px minmax(0, 1fr);
          gap: 10px;
        }

        #cgptx-saved-reader .cgptx-reader-message[data-role="user"] .cgptx-reader-avatar {
          grid-column: 1;
        }

        #cgptx-saved-reader .cgptx-reader-message[data-role="user"] .cgptx-reader-content {
          grid-column: 2;
          justify-self: stretch;
        }

        #cgptx-saved-reader .cgptx-reader-avatar {
          width: 30px;
          height: 30px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function storageGet(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (value) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(value);
      });
    });
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(value, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }
})();
