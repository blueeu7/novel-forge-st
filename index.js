/**
 * Novel Forge — SillyTavern Extension
 * ────────────────────────────────────
 * Convert the current SillyTavern chat into a Chinese novel directly inside
 * a floating window. No external service needed — uses either SillyTavern's
 * own configured model, or a custom OpenAI-compatible API.
 *
 * Install URL (in SillyTavern → Extensions → Install Extension):
 *   https://github.com/blueeu7/novel-forge-st
 */

import { getContext } from '../../../extensions.js';

// ── Storage keys ──────────────────────────────────────────────────────────────
const FILTERS_KEY = 'novel_forge_filters';
const WINDOW_KEY = 'novel_forge_window';
const API_KEY_NAME = 'novel_forge_api';
const STYLE_KEY = 'novel_forge_style';
const GEN_KEY = 'novel_forge_gen';
const OUTPUT_KEY = 'novel_forge_output';

const DEFAULT_FILTERS = {
  startFloor: '',
  endFloor: '',
  includeSystem: false,
  includeSwipes: false,
};

const DEFAULT_API = {
  source: 'tavern',          // 'tavern' | 'custom'
  baseUrl: '',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.85,
  maxTokens: 4096,
};

const DEFAULT_STYLE = {
  presetId: '言情',
  customPrompt: '',
};

const DEFAULT_GEN = {
  mode: 'single',            // 'single' | 'chapter'
  chapterFloors: 20,
  carryContext: true,        // 多章节模式下把前一章末尾作为上下文
};

// ── Style presets ─────────────────────────────────────────────────────────────
const STYLE_PRESETS = {
  '言情': '你是一名擅长言情小说的中文作家。请把对话改写成细腻流畅的中文小说，注重人物心理、感官描写与情绪推进，对白自然生活化，叙述节奏舒缓而有张力。',
  '玄幻': '你是一名擅长玄幻仙侠的中文作家。请把对话改写成中文长篇小说，设定恢弘，节奏紧凑，注重打斗与法术描写，气氛凌厉。',
  '古风': '你是一名擅长古风小说的中文作家。请把对话改写成带文言色彩的中文小说，意境优美，意象古雅，可适度引用诗词，对白半文半白。',
  '现实': '你是一名擅长现实主义的中文作家。请把对话改写成中文小说，朴素白描，注重生活细节与真实质感，避免华丽辞藻。',
  '悬疑': '你是一名擅长悬疑小说的中文作家。请把对话改写成中文小说，节奏紧凑，注重氛围与伏笔，留有悬念。',
  '历史': '你是一名擅长历史小说的中文作家。请把对话改写成中文小说，注重时代背景与人物身份，语言典雅克制，细节考究。',
  '自定义': '',
};

// ── Storage helpers ───────────────────────────────────────────────────────────
function load(key, defaults) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return { ...defaults, ...raw };
  } catch {
    return { ...defaults };
  }
}
function save(key, patch, defaults) {
  const merged = { ...load(key, defaults), ...patch };
  localStorage.setItem(key, JSON.stringify(merged));
  return merged;
}
const getFilters = () => load(FILTERS_KEY, DEFAULT_FILTERS);
const saveFilters = (p) => save(FILTERS_KEY, p, DEFAULT_FILTERS);
const getApi = () => load(API_KEY_NAME, DEFAULT_API);
const saveApi = (p) => save(API_KEY_NAME, p, DEFAULT_API);
const getStyle = () => load(STYLE_KEY, DEFAULT_STYLE);
const saveStyle = (p) => save(STYLE_KEY, p, DEFAULT_STYLE);
const getGen = () => load(GEN_KEY, DEFAULT_GEN);
const saveGen = (p) => save(GEN_KEY, p, DEFAULT_GEN);

function getWindowState() {
  try { return JSON.parse(localStorage.getItem(WINDOW_KEY) || 'null'); } catch { return null; }
}
function saveWindowState(state) {
  localStorage.setItem(WINDOW_KEY, JSON.stringify(state));
}
function getLastOutput() {
  return localStorage.getItem(OUTPUT_KEY) || '';
}
function saveLastOutput(text) {
  try { localStorage.setItem(OUTPUT_KEY, text); } catch {}
}

// ── Drawer (settings) UI ──────────────────────────────────────────────────────
const DRAWER_HTML = `
<div class="inline-drawer" id="novel-forge-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>📖 Novel Forge · 小说工坊</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content">
    <div id="novel-forge-panel">

      <label class="nf-label">生成来源</label>
      <div class="nf-radio-row">
        <label class="nf-radio">
          <input type="radio" name="nf-api-source" value="tavern" />
          <span>酒馆当前模型</span>
        </label>
        <label class="nf-radio">
          <input type="radio" name="nf-api-source" value="custom" />
          <span>自定义 API</span>
        </label>
      </div>

      <div id="nf-custom-api" class="nf-collapsible">
        <label class="nf-label">Base URL</label>
        <input id="nf-api-base" class="text_pole" type="url" placeholder="https://api.openai.com/v1" />
        <label class="nf-label">API Key</label>
        <input id="nf-api-key" class="text_pole" type="password" placeholder="sk-..." />
        <label class="nf-label">模型</label>
        <input id="nf-api-model" class="text_pole" type="text" placeholder="gpt-4o-mini" />
        <div class="nf-pair">
          <div>
            <label class="nf-label">温度</label>
            <input id="nf-api-temp" class="text_pole nf-num" type="number" min="0" max="2" step="0.05" />
          </div>
          <div>
            <label class="nf-label">最大 tokens</label>
            <input id="nf-api-maxtok" class="text_pole nf-num" type="number" min="256" step="128" />
          </div>
        </div>
      </div>

      <label class="nf-label">风格预设</label>
      <select id="nf-style-preset" class="text_pole">
        <option value="言情">言情</option>
        <option value="玄幻">玄幻</option>
        <option value="古风">古风</option>
        <option value="现实">现实</option>
        <option value="悬疑">悬疑</option>
        <option value="历史">历史</option>
        <option value="自定义">自定义</option>
      </select>
      <label class="nf-label">附加风格说明（追加在预设之后）</label>
      <textarea id="nf-style-custom" class="text_pole" rows="3"
        placeholder="比如：第一人称视角；不要总结对话，要扩写细节；保留所有人物对白等..."></textarea>

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
        <span>包含 swipes 候选</span>
      </label>

      <label class="nf-label">生成模式</label>
      <div class="nf-radio-row">
        <label class="nf-radio">
          <input type="radio" name="nf-gen-mode" value="single" />
          <span>一次性</span>
        </label>
        <label class="nf-radio">
          <input type="radio" name="nf-gen-mode" value="chapter" />
          <span>多章节</span>
        </label>
      </div>
      <div id="nf-chapter-opts" class="nf-collapsible">
        <label class="nf-label">每章楼层数</label>
        <input id="nf-chapter-floors" class="text_pole nf-num" type="number" min="2" max="200" />
        <label class="nf-toggle">
          <input id="nf-carry-context" type="checkbox" />
          <span>把前一章末尾作为上下文（保持连续）</span>
        </label>
      </div>

      <div id="nf-preview" class="nf-hint">—</div>
      <div id="nf-open-btn" class="menu_button menu_button_icon">
        <i class="fa-solid fa-book-open"></i>
        <span>打开小说工坊</span>
      </div>
      <div id="nf-status"></div>
    </div>
  </div>
</div>
`;

// ── Overlay (novel workshop) UI ───────────────────────────────────────────────
function buildOverlay() {
  return `
<div id="nf-overlay">
  <div id="nf-modal">
    <div id="nf-header">
      <span id="nf-title">
        <i class="fa-solid fa-book-open" style="margin-right:6px;opacity:.8"></i>
        Novel Forge · 小说工坊
      </span>
      <div class="nf-header-actions">
        <button id="nf-min-btn" title="最小化"><i class="fa-solid fa-window-minimize"></i></button>
        <button id="nf-max-btn" title="最大化 / 还原"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>
        <button id="nf-close-btn" title="关闭">✕</button>
      </div>
    </div>

    <div id="nf-toolbar">
      <button id="nf-gen-btn" class="nf-primary"><i class="fa-solid fa-wand-magic-sparkles"></i><span>开始生成</span></button>
      <button id="nf-stop-btn" disabled><i class="fa-solid fa-stop"></i><span>停止</span></button>
      <span class="nf-divider"></span>
      <div id="nf-chapter-nav" class="nf-hidden">
        <button id="nf-prev-chapter" title="上一章"><i class="fa-solid fa-chevron-left"></i></button>
        <span id="nf-chapter-label">第 1 章 / 共 1 章</span>
        <button id="nf-next-chapter" title="下一章"><i class="fa-solid fa-chevron-right"></i></button>
        <button id="nf-regen-btn" title="重新生成本章"><i class="fa-solid fa-rotate-right"></i></button>
      </div>
      <span class="nf-flex-spacer"></span>
      <button id="nf-copy-btn" title="复制当前章"><i class="fa-solid fa-copy"></i></button>
      <button id="nf-download-btn" title="下载全部为 .txt"><i class="fa-solid fa-download"></i></button>
    </div>

    <div id="nf-meta">
      <span id="nf-meta-range">—</span>
      <span class="nf-divider"></span>
      <span id="nf-meta-style">—</span>
      <span class="nf-divider"></span>
      <span id="nf-meta-api">—</span>
    </div>

    <div id="nf-output-wrap">
      <textarea id="nf-output" placeholder="点击「开始生成」即可把所选聊天转写为小说..."></textarea>
    </div>

    <div id="nf-status-bar">
      <span id="nf-progress">就绪</span>
    </div>

    <div id="nf-resize-handle" title="拖动以缩放"></div>
    <div id="nf-drag-mask"></div>
  </div>

  <div id="nf-pill" title="点击恢复小说工坊">
    <div id="nf-pill-spinner"></div>
    <div id="nf-pill-text">
      <div id="nf-pill-title">📖 小说工坊</div>
      <div id="nf-pill-progress">已最小化</div>
    </div>
    <button id="nf-pill-close" title="关闭工坊">✕</button>
  </div>
</div>`;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
jQuery(async () => {
  $('#extensions_settings2').append(DRAWER_HTML);
  initDrawer();
  refreshPreview();
});

function initDrawer() {
  // API source
  const api = getApi();
  $(`input[name="nf-api-source"][value="${api.source}"]`).prop('checked', true);
  toggleCustomApi(api.source === 'custom');
  $('input[name="nf-api-source"]').on('change', () => {
    const source = $('input[name="nf-api-source"]:checked').val();
    saveApi({ source });
    toggleCustomApi(source === 'custom');
  });

  // Custom API fields
  $('#nf-api-base').val(api.baseUrl).on('input', () => saveApi({ baseUrl: $('#nf-api-base').val().trim() }));
  $('#nf-api-key').val(api.apiKey).on('input', () => saveApi({ apiKey: $('#nf-api-key').val().trim() }));
  $('#nf-api-model').val(api.model).on('input', () => saveApi({ model: $('#nf-api-model').val().trim() }));
  $('#nf-api-temp').val(api.temperature).on('input', () => saveApi({ temperature: parseFloat($('#nf-api-temp').val()) || 0 }));
  $('#nf-api-maxtok').val(api.maxTokens).on('input', () => saveApi({ maxTokens: parseInt($('#nf-api-maxtok').val(), 10) || 4096 }));

  // Style
  const style = getStyle();
  $('#nf-style-preset').val(style.presetId).on('change', () => saveStyle({ presetId: $('#nf-style-preset').val() }));
  $('#nf-style-custom').val(style.customPrompt).on('input', () => saveStyle({ customPrompt: $('#nf-style-custom').val() }));

  // Filters
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
    const total = safeGetChat().length;
    if (recent === 'all') {
      $('#nf-range-start').val(''); $('#nf-range-end').val('');
    } else {
      const n = Math.min(parseInt(recent, 10) || 0, total);
      $('#nf-range-start').val(total > 0 ? Math.max(0, total - n) : '');
      $('#nf-range-end').val(total > 0 ? total - 1 : '');
    }
    onFilterChange();
  });

  // Generation mode
  const gen = getGen();
  $(`input[name="nf-gen-mode"][value="${gen.mode}"]`).prop('checked', true);
  toggleChapterOpts(gen.mode === 'chapter');
  $('input[name="nf-gen-mode"]').on('change', () => {
    const mode = $('input[name="nf-gen-mode"]:checked').val();
    saveGen({ mode });
    toggleChapterOpts(mode === 'chapter');
    refreshPreview();
  });
  $('#nf-chapter-floors').val(gen.chapterFloors).on('input', () => {
    saveGen({ chapterFloors: parseInt($('#nf-chapter-floors').val(), 10) || 20 });
    refreshPreview();
  });
  $('#nf-carry-context').prop('checked', !!gen.carryContext).on('change', () => {
    saveGen({ carryContext: $('#nf-carry-context').is(':checked') });
  });

  $('#nf-open-btn').on('click', openWorkshop);
}

function toggleCustomApi(show) {
  $('#nf-custom-api').toggleClass('nf-open', !!show);
}
function toggleChapterOpts(show) {
  $('#nf-chapter-opts').toggleClass('nf-open', !!show);
}

function safeGetChat() {
  try { return getContext()?.chat ?? []; } catch { return []; }
}

function refreshPreview() {
  const chat = safeGetChat();
  if (!chat.length) { $('#nf-preview').text('当前没有聊天记录'); return; }
  const filtered = applyFilters(chat, getFilters());
  const gen = getGen();
  if (gen.mode === 'chapter') {
    const chapters = Math.max(1, Math.ceil(filtered.length / Math.max(1, gen.chapterFloors)));
    $('#nf-preview').text(`将发送 ${filtered.length} / ${chat.length} 条 · 分为 ${chapters} 章`);
  } else {
    $('#nf-preview').text(`将发送 ${filtered.length} / ${chat.length} 条`);
  }
}

function applyFilters(chat, filters) {
  const total = chat.length;
  const startRaw = parseInt(filters.startFloor, 10);
  const endRaw = parseInt(filters.endFloor, 10);
  const start = Number.isFinite(startRaw) ? Math.max(0, startRaw) : 0;
  const end = Number.isFinite(endRaw) ? Math.min(total - 1, endRaw) : total - 1;
  const lo = Math.min(start, end), hi = Math.max(start, end);
  let result = chat.slice(lo, hi + 1).map((msg, i) => ({ msg, index: lo + i }));
  if (!filters.includeSystem) result = result.filter(({ msg }) => !msg.is_system);
  return result;
}

function setStatus(msg) { $('#nf-status').text(msg); }
function setProgress(msg) {
  $('#nf-progress').text(msg);
  $('#nf-pill-progress').text(msg);
}

// ── Workshop state ────────────────────────────────────────────────────────────
let chapters = [];          // [{ text, range: [lo, hi], status: 'pending'|'done'|'error' }]
let currentChapterIdx = 0;
let activeAbort = null;     // AbortController for custom API
let isGenerating = false;

function openWorkshop() {
  const chat = safeGetChat();
  if (!chat.length) { setStatus('⚠️ 当前没有聊天记录'); return; }

  const filtered = applyFilters(chat, getFilters());
  if (!filtered.length) { setStatus('⚠️ 过滤后没有可发送的消息'); return; }

  const api = getApi();
  if (api.source === 'custom') {
    if (!api.baseUrl || !api.apiKey || !api.model) {
      setStatus('⚠️ 自定义 API：请填写 Base URL / Key / 模型');
      return;
    }
    if (!/^https?:\/\//i.test(api.baseUrl)) { setStatus('⚠️ Base URL 需以 http(s):// 开头'); return; }
  }

  $('#nf-overlay').remove();
  $('body').append(buildOverlay());
  restoreWindowState();
  bindOverlayEvents();

  // Restore last output if any
  const last = getLastOutput();
  if (last) {
    $('#nf-output').val(last);
  }

  refreshMeta();
  setStatus(`已就绪（${filtered.length} 条消息）`);
}

function refreshMeta() {
  const filters = getFilters();
  const chat = safeGetChat();
  const filtered = applyFilters(chat, filters);
  const gen = getGen();
  const api = getApi();
  const style = getStyle();

  const rangeText = filtered.length
    ? `范围 ${filtered[0].index} – ${filtered[filtered.length - 1].index}（${filtered.length} 条）`
    : '无消息';
  $('#nf-meta-range').text(rangeText);
  $('#nf-meta-style').text(`风格：${style.presetId}${style.customPrompt ? ' +附加' : ''}`);
  $('#nf-meta-api').text(`来源：${api.source === 'tavern' ? '酒馆模型' : api.model || '自定义'}`);

  if (gen.mode === 'chapter') {
    $('#nf-chapter-nav').removeClass('nf-hidden');
    updateChapterLabel();
  } else {
    $('#nf-chapter-nav').addClass('nf-hidden');
  }
}

function updateChapterLabel() {
  const total = chapters.length || 1;
  $('#nf-chapter-label').text(`第 ${currentChapterIdx + 1} 章 / 共 ${total} 章`);
}

function bindOverlayEvents() {
  $(document).on('click', '#nf-close-btn', closeOverlay);
  $(document).on('click', '#nf-max-btn', toggleMaximize);
  $(document).on('click', '#nf-min-btn', minimizeOverlay);
  $(document).on('click', '#nf-pill', (e) => {
    if (e.target.closest('#nf-pill-close')) return;
    restoreOverlay();
  });
  $(document).on('click', '#nf-pill-close', closeOverlay);
  $(document).on('click', '#nf-overlay', (e) => {
    if (e.target.id === 'nf-overlay') closeOverlay();
  });
  $(document).on('keydown.nfoverlay', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#nf-overlay').hasClass('nf-minimized')) restoreOverlay();
    else closeOverlay();
  });

  $(document).on('click', '#nf-gen-btn', startGenerate);
  $(document).on('click', '#nf-stop-btn', stopGenerate);
  $(document).on('click', '#nf-copy-btn', copyCurrent);
  $(document).on('click', '#nf-download-btn', downloadAll);

  $(document).on('click', '#nf-prev-chapter', () => switchChapter(currentChapterIdx - 1));
  $(document).on('click', '#nf-next-chapter', () => switchChapter(currentChapterIdx + 1));
  $(document).on('click', '#nf-regen-btn', regenerateCurrentChapter);

  $(document).on('input', '#nf-output', () => {
    if (chapters[currentChapterIdx]) chapters[currentChapterIdx].text = $('#nf-output').val();
    saveLastOutput($('#nf-output').val());
  });

  bindDragAndResize();
}

function closeOverlay() {
  stopGenerate();
  captureWindowState();
  $('#nf-overlay').remove();
  $(document).off('keydown.nfoverlay');
  $(document).off('click', '#nf-close-btn');
  $(document).off('click', '#nf-max-btn');
  $(document).off('click', '#nf-min-btn');
  $(document).off('click', '#nf-pill');
  $(document).off('click', '#nf-pill-close');
  $(document).off('click', '#nf-overlay');
  $(document).off('click', '#nf-gen-btn');
  $(document).off('click', '#nf-stop-btn');
  $(document).off('click', '#nf-copy-btn');
  $(document).off('click', '#nf-download-btn');
  $(document).off('click', '#nf-prev-chapter');
  $(document).off('click', '#nf-next-chapter');
  $(document).off('click', '#nf-regen-btn');
  $(document).off('input', '#nf-output');
}

function minimizeOverlay() {
  const overlay = document.getElementById('nf-overlay');
  if (!overlay) return;
  overlay.classList.add('nf-minimized');
  // reflect whether a generation is currently in flight
  $('#nf-pill').toggleClass('nf-pill-active', isGenerating);
}

function restoreOverlay() {
  const overlay = document.getElementById('nf-overlay');
  if (!overlay) return;
  overlay.classList.remove('nf-minimized');
}

// ── Generation ────────────────────────────────────────────────────────────────
async function startGenerate() {
  if (isGenerating) return;
  const chat = safeGetChat();
  const filtered = applyFilters(chat, getFilters());
  if (!filtered.length) { setProgress('过滤后没有消息'); return; }

  const gen = getGen();
  const context = getContext();
  const character = context.characters?.[context.characterId];

  // Build chapters by floor count (or one big chapter for single mode)
  const size = gen.mode === 'chapter' ? Math.max(2, gen.chapterFloors) : filtered.length;
  chapters = [];
  for (let i = 0; i < filtered.length; i += size) {
    chapters.push({
      text: '',
      slice: filtered.slice(i, i + size),
      status: 'pending',
    });
  }
  currentChapterIdx = 0;
  updateChapterLabel();
  $('#nf-output').val('');

  setGenerating(true);
  try {
    for (let i = 0; i < chapters.length; i++) {
      currentChapterIdx = i;
      updateChapterLabel();
      setProgress(`正在生成第 ${i + 1} / ${chapters.length} 章...`);
      $('#nf-output').val('');

      const prev = i > 0 ? chapters[i - 1].text : '';
      await generateChapter(chapters[i], { character, ctx: context, prev, index: i, total: chapters.length });
      if (!isGenerating) break;            // stopped
    }
    setProgress(chapters.every((c) => c.status === 'done') ? '✅ 全部完成' : '⚠️ 已停止');
  } catch (e) {
    setProgress(`❌ ${e.message || e}`);
  } finally {
    setGenerating(false);
  }
}

function stopGenerate() {
  if (activeAbort) try { activeAbort.abort(); } catch {}
  activeAbort = null;
  isGenerating = false;
  $('#nf-gen-btn').prop('disabled', false);
  $('#nf-stop-btn').prop('disabled', true);
}

function setGenerating(on) {
  isGenerating = on;
  $('#nf-gen-btn').prop('disabled', on);
  $('#nf-stop-btn').prop('disabled', !on);
  $('#nf-pill').toggleClass('nf-pill-active', on);
}

async function regenerateCurrentChapter() {
  if (isGenerating) return;
  const idx = currentChapterIdx;
  if (!chapters[idx]) return;
  const context = getContext();
  const character = context.characters?.[context.characterId];
  setGenerating(true);
  try {
    $('#nf-output').val('');
    setProgress(`重新生成第 ${idx + 1} 章...`);
    const prev = idx > 0 ? chapters[idx - 1].text : '';
    await generateChapter(chapters[idx], { character, ctx: context, prev, index: idx, total: chapters.length });
    setProgress(chapters[idx].status === 'done' ? '✅ 已重新生成' : '⚠️ 中止');
  } catch (e) {
    setProgress(`❌ ${e.message || e}`);
  } finally {
    setGenerating(false);
  }
}

function switchChapter(idx) {
  if (idx < 0 || idx >= chapters.length) return;
  // commit current edits
  if (chapters[currentChapterIdx]) chapters[currentChapterIdx].text = $('#nf-output').val();
  currentChapterIdx = idx;
  $('#nf-output').val(chapters[idx].text || '');
  updateChapterLabel();
}

async function generateChapter(chapter, { character, ctx, prev, index, total }) {
  const style = getStyle();
  const api = getApi();
  const gen = getGen();

  const systemPrompt = buildSystemPrompt(style);
  const userPrompt = buildUserPrompt({
    chapter, character, ctx, prev: gen.carryContext ? prev : '', index, total, mode: gen.mode,
  });

  let accumulated = '';
  const onDelta = (delta) => {
    accumulated += delta;
    $('#nf-output').val(accumulated);
    const el = document.getElementById('nf-output');
    if (el) el.scrollTop = el.scrollHeight;
  };

  try {
    if (api.source === 'custom') {
      await streamCustomApi({
        systemPrompt, userPrompt,
        baseUrl: api.baseUrl, apiKey: api.apiKey, model: api.model,
        temperature: api.temperature, maxTokens: api.maxTokens,
        onDelta,
      });
    } else {
      const text = await generateViaTavern({ systemPrompt, userPrompt });
      onDelta(text);
    }
    chapter.text = accumulated;
    chapter.status = 'done';
    saveLastOutput(accumulated);
  } catch (e) {
    chapter.status = 'error';
    if (e.name === 'AbortError') return;
    throw e;
  }
}

function buildSystemPrompt(style) {
  const preset = STYLE_PRESETS[style.presetId] ?? '';
  const parts = [];
  if (preset) parts.push(preset);
  if (style.customPrompt) parts.push(style.customPrompt);
  parts.push('输出为中文小说正文。不要复述题目、不要解释你做了什么，直接输出小说文本。');
  return parts.join('\n\n');
}

function buildUserPrompt({ chapter, character, ctx, prev, index, total, mode }) {
  const name2 = ctx.name2 || character?.name || '角色';
  const name1 = ctx.name1 || '用户';

  const header = [];
  header.push(`角色：${name2}`);
  header.push(`用户：${name1}`);
  if (character?.description) header.push(`角色设定：${character.description}`);
  if (character?.scenario) header.push(`场景：${character.scenario}`);

  const dialog = chapter.slice.map(({ msg, index: idx }) => {
    const speaker = msg.is_user ? name1 : (msg.is_system ? '旁白' : name2);
    return `[${idx}] ${speaker}: ${msg.mes || ''}`;
  }).join('\n');

  const chapterHint = mode === 'chapter'
    ? `请把以下对话改写为长篇小说的第 ${index + 1} / ${total} 章。`
    : '请把以下对话改写为一篇完整的中文小说。';

  const prevHint = prev ? `\n上一章末尾内容（仅作衔接参考，不要重复）：\n${prev.slice(-1500)}\n` : '';

  return [
    header.join('\n'),
    '',
    chapterHint,
    prevHint,
    '对话原文：',
    dialog,
  ].join('\n');
}

// ── Custom API (OpenAI-compatible, streaming) ────────────────────────────────
async function streamCustomApi({ systemPrompt, userPrompt, baseUrl, apiKey, model, temperature, maxTokens, onDelta }) {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  activeAbort = new AbortController();
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: activeAbort.signal,
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status} ${text.slice(0, 300)}`);
  }
  if (!r.body) throw new Error('响应没有 body');

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const data = JSON.parse(payload);
        const delta = data.choices?.[0]?.delta?.content
          ?? data.choices?.[0]?.message?.content
          ?? '';
        if (delta) onDelta(delta);
      } catch {}
    }
  }
}

// ── Tavern model (uses SillyTavern's configured backend) ─────────────────────
async function generateViaTavern({ systemPrompt, userPrompt }) {
  const ctx = getContext();
  const prompt = `${systemPrompt}\n\n${userPrompt}`;

  if (typeof ctx.generateRaw === 'function') {
    return await ctx.generateRaw(prompt, null, false, false, systemPrompt);
  }
  if (typeof ctx.generateQuietPrompt === 'function') {
    return await ctx.generateQuietPrompt(prompt, false, false);
  }
  // Fallback: try dynamic import
  try {
    const mod = await import('../../../../script.js');
    if (typeof mod.generateRaw === 'function') {
      return await mod.generateRaw(prompt, null, false, false, systemPrompt);
    }
    if (typeof mod.generateQuietPrompt === 'function') {
      return await mod.generateQuietPrompt(prompt, false, false);
    }
  } catch {}
  throw new Error('当前 SillyTavern 版本未暴露 generateRaw/generateQuietPrompt，请切换到「自定义 API」模式');
}

// ── Export ────────────────────────────────────────────────────────────────────
function copyCurrent() {
  const text = $('#nf-output').val();
  if (!text) { setProgress('当前章为空'); return; }
  navigator.clipboard?.writeText(text).then(
    () => setProgress('已复制当前章到剪贴板'),
    () => setProgress('复制失败，请手动选择文本'),
  );
}

function downloadAll() {
  const parts = chapters.length
    ? chapters.map((c, i) => `# 第 ${i + 1} 章\n\n${c.text || ''}`)
    : [$('#nf-output').val() || ''];
  if (!parts.join('').trim()) { setProgress('没有可导出的内容'); return; }
  const blob = new Blob([parts.join('\n\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name2 = getContext().name2 || 'novel';
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${name2}-${date}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setProgress('已下载');
}

// ── Window state (size / position / maximized) ────────────────────────────────
function restoreWindowState() {
  const state = getWindowState();
  const modal = document.getElementById('nf-modal');
  if (!modal || !state) return;

  if (state.maximized) { modal.classList.add('nf-maximized'); return; }

  const w = clamp(state.width, 480, window.innerWidth);
  const h = clamp(state.height, 360, window.innerHeight);
  const left = clamp(state.left, 0, window.innerWidth - w);
  const top = clamp(state.top, 0, window.innerHeight - h);
  Object.assign(modal.style, {
    width: w + 'px', height: h + 'px',
    left: left + 'px', top: top + 'px',
    margin: 0, position: 'absolute',
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
  saveWindowState({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, maximized: false });
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
        width: state.width + 'px', height: state.height + 'px',
        left: state.left + 'px', top: state.top + 'px',
        margin: 0, position: 'absolute',
      });
      overlay.classList.add('nf-positioned');
    }
    saveWindowState({ ...(state || {}), maximized: false });
  } else {
    const rect = modal.getBoundingClientRect();
    saveWindowState({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, maximized: true });
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
    const offsetX = pt.x - rect.left, offsetY = pt.y - rect.top;
    overlay.classList.add('nf-positioned');
    showDragMask(true);
    const move = (ev) => {
      const p = pointFromEvent(ev);
      const left = clamp(p.x - offsetX, 0, window.innerWidth - rect.width);
      const top = clamp(p.y - offsetY, 0, window.innerHeight - rect.height);
      Object.assign(modal.style, {
        left: left + 'px', top: top + 'px',
        width: rect.width + 'px', height: rect.height + 'px',
        margin: 0, position: 'absolute',
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
    e.preventDefault(); e.stopPropagation();
    const pt = pointFromEvent(e);
    const rect = modal.getBoundingClientRect();
    overlay.classList.add('nf-positioned');
    showDragMask(true);
    const startW = rect.width, startH = rect.height, startX = pt.x, startY = pt.y;
    const move = (ev) => {
      const p = pointFromEvent(ev);
      const w = clamp(startW + (p.x - startX), 480, window.innerWidth - rect.left);
      const h = clamp(startH + (p.y - startY), 360, window.innerHeight - rect.top);
      Object.assign(modal.style, {
        width: w + 'px', height: h + 'px',
        left: rect.left + 'px', top: rect.top + 'px',
        margin: 0, position: 'absolute',
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
