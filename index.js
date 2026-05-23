/**
 * Novel Forge — SillyTavern Extension
 * ────────────────────────────────────
 * Reads the current SillyTavern chat and displays Novel Forge
 * in a floating overlay panel inside SillyTavern (no popup window).
 *
 * Install URL (in SillyTavern → Extensions → Install Extension):
 *   https://github.com/blueeu7/novel-forge-st
 */

import { getContext } from '../../../extensions.js';

const STORAGE_KEY = 'novel_forge_url';
const FILTERS_KEY = 'novel_forge_filters';
const WINDOW_KEY = 'novel_forge_window';

const DEFAULT_URL = '';
const DEFAULT_FILTERS = {
  startFloor: '',
  endFloor: '',
  includeSystem: false,
  includeSwipes: false,
};

const getSavedUrl = () => localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
const saveUrl = (url) => localStorage.setItem(STORAGE_KEY, url.trim());

function getFilters() {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}');
    return { ...DEFAULT_FILTERS, ...raw };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

function saveFilters(patch) {
  const merged = { ...getFilters(), ...patch };
  localStorage.setItem(FILTERS_KEY, JSON.stringify(merged));
  return merged;
}

function getWindowState() {
  try {
    return JSON.parse(localStorage.getItem(WINDOW_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveWindowState(state) {
  localStorage.setItem(WINDOW_KEY, JSON.stringify(state));
}

// ── Extension settings drawer ─────────────────────────────────────────────────
const DRAWER_HTML = `
<div class="inline-drawer" id="novel-forge-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>📖 Novel Forge</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content">
    <div id="novel-forge-panel">
      <label class="nf-label">Novel Forge 部署地址</label>
      <div class="nf-url-row">
        <input id="nf-url-input" class="text_pole" type="url"
               placeholder="https://xxxx.replit.app/" />
      </div>
      <p class="nf-hint">在 Replit 项目点击 Deploy 可找到部署地址</p>

      <label class="nf-label">楼层范围（留空 = 全部）</label>
      <div class="nf-range-row">
        <input id="nf-range-start" class="text_pole nf-num" type="number" min="0" placeholder="起" />
        <span class="nf-range-sep">—</span>
        <input id="nf-range-end" class="text_pole nf-num" type="number" min="0" placeholder="止" />
      </div>
      <div class="nf-quick-row">
        <button class="nf-chip" data-recent="10">最近10</button>
        <button class="nf-chip" data-recent="20">最近20</button>
        <button class="nf-chip" data-recent="50">最近50</button>
        <button class="nf-chip" data-recent="all">全部</button>
      </div>

      <label class="nf-toggle">
        <input id="nf-include-system" type="checkbox" />
        <span>包含 system 消息</span>
      </label>
      <label class="nf-toggle">
        <input id="nf-include-swipes" type="checkbox" />
        <span>包含 swipes 候选（仅当前 swipe 默认）</span>
      </label>

      <div id="nf-preview" class="nf-hint">—</div>

      <div id="nf-open-btn" class="menu_button menu_button_icon">
        <i class="fa-solid fa-book-open"></i>
        <span>打开 Novel Forge · 转小说</span>
      </div>
      <div id="nf-status"></div>
    </div>
  </div>
</div>
`;

// ── Floating overlay ──────────────────────────────────────────────────────────
function buildOverlay(url) {
  return `
<div id="nf-overlay">
  <div id="nf-modal">
    <div id="nf-header">
      <span id="nf-title">
        <i class="fa-solid fa-book-open" style="margin-right:6px;opacity:.8"></i>
        Novel Forge · 酒馆聊天转小说
      </span>
      <div style="display:flex;align-items:center;gap:8px">
        <button id="nf-reload-btn" title="重新发送聊天数据">
          <i class="fa-solid fa-rotate-right"></i>
        </button>
        <button id="nf-max-btn" title="最大化 / 还原">
          <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
        </button>
        <button id="nf-close-btn" title="关闭">✕</button>
      </div>
    </div>
    <div id="nf-loading">
      <div class="nf-spinner"></div>
      <p>正在加载 Novel Forge…</p>
    </div>
    <iframe id="nf-iframe" src="${escapeAttr(url)}" allow="clipboard-write"></iframe>
    <div id="nf-resize-handle" title="拖动以缩放"></div>
    <div id="nf-drag-mask"></div>
  </div>
</div>`;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
jQuery(async () => {
  $('#extensions_settings2').append(DRAWER_HTML);

  $('#nf-url-input').val(getSavedUrl());
  $('#nf-url-input').on('input', () => saveUrl($('#nf-url-input').val()));

  const f = getFilters();
  $('#nf-range-start').val(f.startFloor);
  $('#nf-range-end').val(f.endFloor);
  $('#nf-include-system').prop('checked', !!f.includeSystem);
  $('#nf-include-swipes').prop('checked', !!f.includeSwipes);

  const onFilterChange = () => {
    saveFilters({
      startFloor: $('#nf-range-start').val(),
      endFloor: $('#nf-range-end').val(),
      includeSystem: $('#nf-include-system').is(':checked'),
      includeSwipes: $('#nf-include-swipes').is(':checked'),
    });
    refreshPreview();
  };
  $('#nf-range-start, #nf-range-end').on('input', onFilterChange);
  $('#nf-include-system, #nf-include-swipes').on('change', onFilterChange);

  $('.nf-chip').on('click', (e) => {
    const recent = e.currentTarget.dataset.recent;
    const chat = safeGetChat();
    const total = chat?.length ?? 0;
    if (recent === 'all') {
      $('#nf-range-start').val('');
      $('#nf-range-end').val('');
    } else {
      const n = Math.min(parseInt(recent, 10) || 0, total);
      $('#nf-range-start').val(total > 0 ? Math.max(0, total - n) : '');
      $('#nf-range-end').val(total > 0 ? total - 1 : '');
    }
    onFilterChange();
  });

  $('#nf-open-btn').on('click', openNovelForge);

  refreshPreview();
});

function safeGetChat() {
  try { return getContext()?.chat ?? []; } catch { return []; }
}

function refreshPreview() {
  const chat = safeGetChat();
  if (!chat.length) {
    $('#nf-preview').text('当前没有聊天记录');
    return;
  }
  const filtered = applyFilters(chat, getFilters());
  $('#nf-preview').text(`将发送 ${filtered.length} / ${chat.length} 条消息`);
}

function applyFilters(chat, filters) {
  const total = chat.length;
  const startRaw = parseInt(filters.startFloor, 10);
  const endRaw = parseInt(filters.endFloor, 10);
  const start = Number.isFinite(startRaw) ? Math.max(0, startRaw) : 0;
  const end = Number.isFinite(endRaw) ? Math.min(total - 1, endRaw) : total - 1;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  let result = chat.slice(lo, hi + 1).map((msg, i) => ({ msg, index: lo + i }));
  if (!filters.includeSystem) {
    result = result.filter(({ msg }) => !msg.is_system);
  }
  return result;
}

// ── Open / close overlay ──────────────────────────────────────────────────────
let pendingPayload = null;

function openNovelForge() {
  const url = getSavedUrl();
  if (!url) { setStatus('⚠️ 请填写 Novel Forge 地址'); return; }
  if (!/^https?:\/\//i.test(url)) { setStatus('⚠️ 地址需要以 http(s):// 开头'); return; }

  const context = getContext();
  const { chat, characters, characterId, name1, name2 } = context;
  if (!chat || chat.length === 0) {
    setStatus('⚠️ 当前没有聊天记录，请先开始一段对话');
    return;
  }

  const character = characters?.[characterId];
  const filters = getFilters();
  const filtered = applyFilters(chat, filters);

  if (filtered.length === 0) {
    setStatus('⚠️ 当前过滤条件下没有可发送的消息');
    return;
  }

  pendingPayload = buildPayload({ filtered, character, name1, name2, filters });

  // Remove any existing overlay then inject a fresh one
  $('#nf-overlay').remove();
  $('body').append(buildOverlay(url));

  restoreWindowState();

  const iframe = document.getElementById('nf-iframe');

  iframe.addEventListener('load', () => {
    $('#nf-loading').hide();
    sendPayload(iframe);
  });

  window.addEventListener('message', handleReady);

  $(document).on('click', '#nf-reload-btn', () => {
    const ctx = getContext();
    const refilters = getFilters();
    const refresh = applyFilters(ctx.chat ?? [], refilters);
    pendingPayload = buildPayload({
      filtered: refresh,
      character: ctx.characters?.[ctx.characterId],
      name1: ctx.name1,
      name2: ctx.name2,
      filters: refilters,
    });
    sendPayload(iframe);
  });

  $(document).on('click', '#nf-max-btn', toggleMaximize);
  $(document).on('click', '#nf-close-btn', closeOverlay);
  $(document).on('click', '#nf-overlay', (e) => {
    if (e.target.id === 'nf-overlay') closeOverlay();
  });

  $(document).on('keydown.nfoverlay', (e) => {
    if (e.key === 'Escape') closeOverlay();
  });

  bindDragAndResize();

  setStatus(`已加载（${filtered.length} / ${chat.length} 条消息）`);
}

function sendPayload(iframe) {
  if (!pendingPayload || !iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(pendingPayload, '*');
  } catch {
    // cross-origin; Novel Forge will receive via READY handshake
  }
}

function handleReady(e) {
  if (e.data?.type !== 'NOVEL_FORGE_READY') return;
  const iframe = document.getElementById('nf-iframe');
  if (iframe) sendPayload(iframe);
  window.removeEventListener('message', handleReady);
}

function closeOverlay() {
  captureWindowState();
  $('#nf-overlay').remove();
  $(document).off('keydown.nfoverlay');
  $(document).off('click', '#nf-close-btn');
  $(document).off('click', '#nf-reload-btn');
  $(document).off('click', '#nf-max-btn');
  $(document).off('click', '#nf-overlay');
  window.removeEventListener('message', handleReady);
  pendingPayload = null;
}

// ── Window state (size / position / maximized) ────────────────────────────────
function restoreWindowState() {
  const state = getWindowState();
  const modal = document.getElementById('nf-modal');
  if (!modal) return;

  if (!state) return;

  if (state.maximized) {
    modal.classList.add('nf-maximized');
    return;
  }

  const w = clamp(state.width, 400, window.innerWidth);
  const h = clamp(state.height, 300, window.innerHeight);
  const left = clamp(state.left, 0, window.innerWidth - w);
  const top = clamp(state.top, 0, window.innerHeight - h);

  Object.assign(modal.style, {
    width: w + 'px',
    height: h + 'px',
    left: left + 'px',
    top: top + 'px',
    margin: 0,
    position: 'absolute',
  });
  document.getElementById('nf-overlay').classList.add('nf-positioned');
}

function captureWindowState() {
  const modal = document.getElementById('nf-modal');
  if (!modal) return;
  const maximized = modal.classList.contains('nf-maximized');
  if (maximized) {
    const prev = getWindowState() || {};
    saveWindowState({ ...prev, maximized: true });
    return;
  }
  const rect = modal.getBoundingClientRect();
  saveWindowState({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    maximized: false,
  });
}

function toggleMaximize() {
  const modal = document.getElementById('nf-modal');
  const overlay = document.getElementById('nf-overlay');
  if (!modal || !overlay) return;
  if (modal.classList.contains('nf-maximized')) {
    modal.classList.remove('nf-maximized');
    const state = getWindowState();
    if (state && !state.maximized) {
      Object.assign(modal.style, {
        width: state.width + 'px',
        height: state.height + 'px',
        left: state.left + 'px',
        top: state.top + 'px',
        margin: 0,
        position: 'absolute',
      });
      overlay.classList.add('nf-positioned');
    }
    saveWindowState({ ...(state || {}), maximized: false });
  } else {
    const rect = modal.getBoundingClientRect();
    saveWindowState({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      maximized: true,
    });
    modal.removeAttribute('style');
    overlay.classList.remove('nf-positioned');
    modal.classList.add('nf-maximized');
  }
}

function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

// ── Drag & resize ─────────────────────────────────────────────────────────────
function bindDragAndResize() {
  const header = document.getElementById('nf-header');
  const handle = document.getElementById('nf-resize-handle');
  const modal = document.getElementById('nf-modal');
  const overlay = document.getElementById('nf-overlay');
  if (!header || !handle || !modal || !overlay) return;

  const onHeaderDown = (e) => {
    if (e.target.closest('button')) return;
    if (modal.classList.contains('nf-maximized')) return;
    e.preventDefault();
    const pt = pointFromEvent(e);
    const rect = modal.getBoundingClientRect();
    const offsetX = pt.x - rect.left;
    const offsetY = pt.y - rect.top;
    overlay.classList.add('nf-positioned');
    showDragMask(true);

    const move = (ev) => {
      const p = pointFromEvent(ev);
      const left = clamp(p.x - offsetX, 0, window.innerWidth - rect.width);
      const top = clamp(p.y - offsetY, 0, window.innerHeight - rect.height);
      Object.assign(modal.style, {
        left: left + 'px',
        top: top + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
        margin: 0,
        position: 'absolute',
      });
    };
    const up = () => {
      showDragMask(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  };

  const onResizeDown = (e) => {
    if (modal.classList.contains('nf-maximized')) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = pointFromEvent(e);
    const rect = modal.getBoundingClientRect();
    overlay.classList.add('nf-positioned');
    showDragMask(true);

    const startW = rect.width;
    const startH = rect.height;
    const startX = pt.x;
    const startY = pt.y;

    const move = (ev) => {
      const p = pointFromEvent(ev);
      const w = clamp(startW + (p.x - startX), 400, window.innerWidth - rect.left);
      const h = clamp(startH + (p.y - startY), 300, window.innerHeight - rect.top);
      Object.assign(modal.style, {
        width: w + 'px',
        height: h + 'px',
        left: rect.left + 'px',
        top: rect.top + 'px',
        margin: 0,
        position: 'absolute',
      });
    };
    const up = () => {
      showDragMask(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  };

  header.addEventListener('mousedown', onHeaderDown);
  header.addEventListener('touchstart', onHeaderDown, { passive: false });
  handle.addEventListener('mousedown', onResizeDown);
  handle.addEventListener('touchstart', onResizeDown, { passive: false });
}

function pointFromEvent(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function showDragMask(show) {
  const mask = document.getElementById('nf-drag-mask');
  if (mask) mask.style.display = show ? 'block' : 'none';
}

// ── Build chat payload ────────────────────────────────────────────────────────
function buildPayload({ filtered, character, name1, name2, filters }) {
  return {
    type: 'NOVEL_FORGE_CHAT',
    characterName: name2 || character?.name || '角色',
    userName: name1 || '用户',
    description: character?.description || '',
    scenario: character?.scenario || '',
    fileName: `${name2 || 'chat'} - ${new Date().toLocaleDateString('zh-CN')}.jsonl`,
    messages: filtered.map(({ msg, index }) => ({
      index,
      name: msg.is_user
        ? (name1 || '用户')
        : (name2 || character?.name || '角色'),
      is_user:   Boolean(msg.is_user),
      is_system: Boolean(msg.is_system),
      mes:       msg.mes || '',
      send_date: msg.send_date || '',
      swipes:    filters.includeSwipes && Array.isArray(msg.swipes) ? msg.swipes : undefined,
      swipe_id:  typeof msg.swipe_id === 'number' ? msg.swipe_id : undefined,
      extra:     msg.extra || undefined,
    })),
  };
}

function setStatus(msg) {
  $('#nf-status').text(msg);
}
