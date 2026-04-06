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
// Default to the deployed Novel Forge app — user can change in panel
const DEFAULT_URL = 'https://novel-forge-web.replit.app/';

const getSavedUrl = () => localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
const saveUrl = (url) => localStorage.setItem(STORAGE_KEY, url.trim());

// ── Extension settings drawer ─────────────────────────────────────────────────
const DRAWER_HTML = `
<div class="inline-drawer" id="novel-forge-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>📖 Novel Forge</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content">
    <div id="novel-forge-panel">
      <label class="nf-label">Novel Forge 地址</label>
      <div class="nf-url-row">
        <input id="nf-url-input" class="text_pole" type="text"
               placeholder="https://your-app.replit.app/" />
      </div>
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
        <button id="nf-close-btn" title="关闭">✕</button>
      </div>
    </div>
    <div id="nf-loading">
      <div class="nf-spinner"></div>
      <p>正在加载 Novel Forge…</p>
    </div>
    <iframe id="nf-iframe" src="${escapeAttr(url)}" allow="clipboard-write"></iframe>
  </div>
</div>`;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
jQuery(async () => {
  $('#extensions_settings2').append(DRAWER_HTML);
  $('#nf-url-input').val(getSavedUrl());
  $('#nf-url-input').on('input', () => saveUrl($('#nf-url-input').val()));
  $('#nf-open-btn').on('click', openNovelForge);
});

// ── Open / close overlay ──────────────────────────────────────────────────────
let pendingPayload = null;

function openNovelForge() {
  const url = getSavedUrl();
  if (!url) { setStatus('⚠️ 请填写 Novel Forge 地址'); return; }

  const context = getContext();
  const { chat, characters, characterId, name1, name2 } = context;
  if (!chat || chat.length === 0) {
    setStatus('⚠️ 当前没有聊天记录，请先开始一段对话');
    return;
  }

  const character = characters?.[characterId];
  pendingPayload = buildPayload({ chat, character, name1, name2 });

  // Remove any existing overlay then inject a fresh one
  $('#nf-overlay').remove();
  $('body').append(buildOverlay(url));

  const iframe = document.getElementById('nf-iframe');

  // Show loading indicator until iframe loads
  iframe.addEventListener('load', () => {
    $('#nf-loading').hide();
    sendPayload(iframe);
  });

  // Also react to Novel Forge's READY signal (fired by stBridge)
  window.addEventListener('message', handleReady);

  // Reload button resends the current chat data
  $(document).on('click', '#nf-reload-btn', () => sendPayload(iframe));

  // Close on ✕ button or backdrop click
  $(document).on('click', '#nf-close-btn', closeOverlay);
  $(document).on('click', '#nf-overlay', (e) => {
    if (e.target.id === 'nf-overlay') closeOverlay();
  });

  // ESC key to close
  $(document).on('keydown.nfoverlay', (e) => {
    if (e.key === 'Escape') closeOverlay();
  });

  setStatus(`已加载（${chat.length} 条消息）`);
}

function sendPayload(iframe) {
  if (!pendingPayload || !iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(pendingPayload, '*');
  } catch (e) {
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
  $('#nf-overlay').remove();
  $(document).off('keydown.nfoverlay');
  $(document).off('click', '#nf-close-btn');
  $(document).off('click', '#nf-reload-btn');
  $(document).off('click', '#nf-overlay');
  window.removeEventListener('message', handleReady);
  pendingPayload = null;
}

// ── Build chat payload ────────────────────────────────────────────────────────
function buildPayload({ chat, character, name1, name2 }) {
  return {
    type: 'NOVEL_FORGE_CHAT',
    characterName: name2 || character?.name || '角色',
    userName: name1 || '用户',
    description: character?.description || '',
    scenario: character?.scenario || '',
    fileName: `${name2 || 'chat'} - ${new Date().toLocaleDateString('zh-CN')}.jsonl`,
    messages: chat.map((msg, idx) => ({
      index: idx,
      name: msg.is_user
        ? (name1 || '用户')
        : (name2 || character?.name || '角色'),
      is_user:   Boolean(msg.is_user),
      is_system: Boolean(msg.is_system),
      mes:       msg.mes || '',
      send_date: msg.send_date || '',
      swipes:    Array.isArray(msg.swipes) ? msg.swipes : undefined,
      swipe_id:  typeof msg.swipe_id === 'number' ? msg.swipe_id : undefined,
      extra:     msg.extra || undefined,
    })),
  };
}

function setStatus(msg) {
  $('#nf-status').text(msg);
}
