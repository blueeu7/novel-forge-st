/**
 * Novel Forge — SillyTavern Extension
 * ────────────────────────────────────
 * Reads the current SillyTavern chat and opens Novel Forge
 * in a popup window, passing the chat data via postMessage.
 *
 * Install:
 *   Extensions → Install Extension → enter the raw GitHub URL of this folder
 *   e.g. https://raw.githubusercontent.com/YOUR_USER/novel-forge-st/main/
 *
 * Config:
 *   Set NOVEL_FORGE_URL to your deployed Novel Forge app URL.
 */

import { getContext } from '../../../extensions.js';

// ── Default Novel Forge URL (user-configurable in the panel) ─────────────────
// Replace with your own deployed Novel Forge URL:
const DEFAULT_URL = 'https://novel-forge.replit.app/';
const STORAGE_KEY = 'novel_forge_url';

const getSavedUrl = () =>
  localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;

const saveUrl = (url) => localStorage.setItem(STORAGE_KEY, url);

// ── Panel HTML ────────────────────────────────────────────────────────────────
const panelHtml = `
<div id="novel-forge-panel">
  <div class="nf-url-row">
    <input
      id="novel-forge-url-input"
      class="text_pole"
      type="text"
      placeholder="Novel Forge 应用地址"
      title="输入 Novel Forge 部署的 URL"
    />
  </div>
  <div id="novel-forge-open-btn">📖 打开 Novel Forge（转小说）</div>
  <div id="novel-forge-status"></div>
</div>
`;

const drawerHtml = `
<div class="inline-drawer" id="novel-forge-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>📖 Novel Forge</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content">
    ${panelHtml}
  </div>
</div>
`;

// ── Init ──────────────────────────────────────────────────────────────────────
jQuery(async () => {
  // Append drawer to extensions settings panel
  $('#extensions_settings2').append(drawerHtml);

  // Fill saved URL
  $('#novel-forge-url-input').val(getSavedUrl());

  // Save URL on change
  $('#novel-forge-url-input').on('input', () => {
    saveUrl($('#novel-forge-url-input').val().trim());
  });

  // Open button
  $('#novel-forge-open-btn').on('click', openNovelForge);
});

// ── Main action ───────────────────────────────────────────────────────────────
function openNovelForge() {
  const url = getSavedUrl();
  if (!url) {
    setStatus('⚠️ 请先填写 Novel Forge 地址');
    return;
  }

  const context = getContext();
  const { chat, characters, characterId, name1, name2 } = context;

  if (!chat || chat.length === 0) {
    setStatus('⚠️ 当前没有聊天记录，请先开始一段对话');
    return;
  }

  const character = characters?.[characterId];

  // Build the chat payload in Novel Forge's expected format
  const chatPayload = {
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
      is_user: Boolean(msg.is_user),
      is_system: Boolean(msg.is_system),
      mes: msg.mes || '',
      send_date: msg.send_date || '',
      // pass swipes so Novel Forge can pick the active one
      swipes: Array.isArray(msg.swipes) ? msg.swipes : undefined,
      swipe_id: typeof msg.swipe_id === 'number' ? msg.swipe_id : undefined,
      extra: msg.extra || undefined,
    })),
  };

  setStatus(`正在打开 Novel Forge（${chat.length} 条消息）...`);

  // Open popup
  const popup = window.open(
    url,
    'novel-forge-popup',
    'width=1300,height=860,resizable=yes,scrollbars=yes',
  );

  if (!popup) {
    setStatus('❌ 弹窗被浏览器拦截，请允许弹窗后重试');
    return;
  }

  // Send chat data once the Novel Forge page has loaded.
  // We retry a few times because the page load time varies.
  let attempts = 0;
  const maxAttempts = 10;
  const interval = setInterval(() => {
    attempts++;
    try {
      popup.postMessage(chatPayload, '*');
    } catch (e) {
      // cross-origin errors are normal while the page is loading
    }
    if (attempts >= maxAttempts) {
      clearInterval(interval);
      setStatus(`✅ 已发送 ${chat.length} 条聊天记录`);
    }
  }, 800);

  popup.addEventListener('message', (e) => {
    if (e.data?.type === 'NOVEL_FORGE_READY') {
      clearInterval(interval);
      popup.postMessage(chatPayload, '*');
      setStatus(`✅ 已同步 ${chat.length} 条聊天记录`);
    }
  });
}

function setStatus(msg) {
  $('#novel-forge-status').text(msg);
}
