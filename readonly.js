const state = {
  questions: [],
  manifest: null,
  view: "browse",
  search: "",
  section: "",
  type: "",
  setName: "",
  duplicateSection: "",
  duplicateType: "",
  duplicateLevel: "all",
  selectedId: "",
  duplicateGroups: [],
  quickCheckText: "",
  screenshotUrl: "",
};

const OFFICIAL_SET_PATTERN = /^(?:official)?20\d{6}[a-z0-9]*$/i;

const els = {
  publishMeta: document.querySelector("#publishMeta"),
  headerStats: document.querySelector("#headerStats"),
  searchInput: document.querySelector("#searchInput"),
  sectionFilter: document.querySelector("#sectionFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  setFilter: document.querySelector("#setFilter"),
  resultList: document.querySelector("#resultList"),
  detailPanel: document.querySelector("#detailPanel"),
  viewTabs: document.querySelector("#viewTabs"),
  duplicatePanel: document.querySelector("#duplicatePanel"),
  duplicateSectionFilter: document.querySelector("#duplicateSectionFilter"),
  duplicateTypeFilter: document.querySelector("#duplicateTypeFilter"),
  duplicateLevelFilter: document.querySelector("#duplicateLevelFilter"),
  duplicateSummary: document.querySelector("#duplicateSummary"),
  duplicateList: document.querySelector("#duplicateList"),
  exportDuplicates: document.querySelector("#exportDuplicates"),
  checkerPanel: document.querySelector("#checkerPanel"),
  screenshotInput: document.querySelector("#screenshotInput"),
  screenshotPreview: document.querySelector("#screenshotPreview"),
  quickCheckText: document.querySelector("#quickCheckText"),
  runQuickCheck: document.querySelector("#runQuickCheck"),
  quickCheckResults: document.querySelector("#quickCheckResults"),
};

function normalize(value) {
  return String(value || "").trim();
}

function isOfficialQuestion(question) {
  const setName = normalize(question?.setName || question?.sheetName).replace(/\s+/g, "");
  return OFFICIAL_SET_PATTERN.test(setName);
}

function compact(value) {
  return normalize(value)
    .toLowerCase()
    .replace(/[_\-–—]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function tokenize(value) {
  const normalized = normalize(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ");
  const words = normalized.split(/\s+/).filter((word) => word.length >= 3);
  const compacted = compact(value);
  const chunks = [];
  for (let index = 0; index <= compacted.length - 5; index += 2) {
    chunks.push(compacted.slice(index, index + 5));
  }
  return [...new Set([...words, ...chunks])];
}

function similarity(left, right) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  const containment = overlap / Math.min(leftTokens.length, rightTokens.length);
  const jaccard = overlap / new Set([...leftTokens, ...rightTokens]).size;
  return Math.round(Math.max(containment, jaccard) * 100);
}

function escapeHtml(value) {
  return normalize(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function uniq(values) {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function firstUsefulSentence(value) {
  return normalize(value)
    .replace(/\s+/g, " ")
    .split(/[.!?。！？]/)
    .map(normalize)
    .find((item) => item.length > 8);
}

function displayTitle(question) {
  return (
    normalize(question.title) ||
    firstUsefulSentence(question.prompt) ||
    firstUsefulSentence(question.passage) ||
    firstUsefulSentence(question.transcript) ||
    normalize(question.displayNo) ||
    normalize(question.questionId) ||
    "未命名题目"
  ).slice(0, 90);
}

function previewText(question) {
  return normalize(question.prompt || question.passage || question.transcript || question.instruction || "")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function searchText(question) {
  return [
    question.id,
    question.questionId,
    question.displayNo,
    question.setName,
    question.section,
    question.questionType,
    question.title,
    question.instruction,
    question.passage,
    question.transcript,
    question.prompt,
    question.explanation,
    ...(question.answers || []),
    ...(question.options || []).map((option) => option.text),
  ]
    .map(normalize)
    .join(" ")
    .toLowerCase();
}

function questionMatchText(question) {
  return [
    question.title,
    question.instruction,
    question.passage,
    question.transcript,
    question.prompt,
    question.explanation,
    ...(question.answers || []),
    ...(question.options || []).map((option) => option.text),
  ]
    .map(normalize)
    .filter(Boolean)
    .join("\n");
}

function duplicateSourceText(question) {
  const type = normalize(question.questionType).toLowerCase();
  if (type.includes("academic discussion")) return question.prompt || question.instruction || "";
  if (type.includes("email")) return [question.instruction, question.prompt].filter(Boolean).join("\n");
  if (type.includes("build a sentence")) return question.prompt || question.passage || "";
  return question.passage || question.transcript || question.prompt || question.instruction || "";
}

function duplicateFingerprint(question) {
  const source = compact(duplicateSourceText(question));
  if (source.length < 24) return "";
  return source;
}

function duplicateLevel(group) {
  if (group.items.length >= 5 || group.dayCount >= 3 || group.setCount >= 4) return "high";
  if (group.items.length >= 3 || group.dayCount >= 2 || group.setCount >= 2) return "medium";
  return "low";
}

function dateInfo(question) {
  const values = [question.setName, question.sheetName, question.questionId, question.displayNo, question.meta?.source].map(normalize).join(" ");
  const match = values.match(/20\d{6}/);
  if (!match) return null;
  const raw = match[0].replace(/\D/g, "");
  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  return {
    dayKey: `${year}-${month}-${day}`,
    dayLabel: `${month}/${day}`,
    monthKey: `${year}-${month}`,
  };
}

function questionLabel(question) {
  return normalize(question.displayNo || question.questionId || question.id);
}

function formatTime(value) {
  if (!value) return "尚未发布";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "尚未发布";
  return time.toLocaleString("zh-CN", { hour12: false });
}

function setOptions(select, values, allLabel, currentValue) {
  select.innerHTML = [
    `<option value="">${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}"${value === currentValue ? " selected" : ""}>${escapeHtml(value)}</option>`),
  ].join("");
}

function filteredQuestions() {
  const query = state.search.toLowerCase();
  return state.questions.filter((question) => {
    if (state.section && question.section !== state.section) return false;
    if (state.type && question.questionType !== state.type) return false;
    if (state.setName && question.setName !== state.setName) return false;
    if (query && !searchText(question).includes(query)) return false;
    return true;
  });
}

function duplicateGroupsForFilters() {
  return state.duplicateGroups.filter((group) => {
    if (state.duplicateSection && group.section !== state.duplicateSection) return false;
    if (state.duplicateType && group.questionType !== state.duplicateType) return false;
    if (state.duplicateLevel !== "all" && group.level !== state.duplicateLevel) return false;
    return true;
  });
}

function assetUrl(url) {
  const value = normalize(url);
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/media/")) return `..${value}`;
  return value;
}

function renderFilters() {
  const sections = uniq(state.questions.map((question) => question.section)).sort();
  const types = uniq(
    state.questions
      .filter((question) => !state.section || question.section === state.section)
      .map((question) => question.questionType),
  ).sort();
  const sets = uniq(state.questions.map((question) => question.setName)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  setOptions(els.sectionFilter, sections, "全部科目", state.section);
  setOptions(els.typeFilter, types, "全部题型", state.type);
  setOptions(els.setFilter, sets, "全部套题", state.setName);

  const duplicateSections = uniq(state.duplicateGroups.map((group) => group.section)).sort();
  const duplicateTypes = uniq(
    state.duplicateGroups
      .filter((group) => !state.duplicateSection || group.section === state.duplicateSection)
      .map((group) => group.questionType),
  ).sort();
  setOptions(els.duplicateSectionFilter, duplicateSections, "全部科目", state.duplicateSection);
  setOptions(els.duplicateTypeFilter, duplicateTypes, "全部题型", state.duplicateType);
}

function renderHeader() {
  const manifest = state.manifest || {};
  const sections = uniq(state.questions.map((question) => question.section)).length;
  const types = uniq(state.questions.map((question) => question.questionType)).length;
  els.publishMeta.textContent = `最后发布：${formatTime(manifest.publishedAt)} · 发布人：${manifest.publishedBy || "未记录"}`;
  els.headerStats.innerHTML = `
    <span class="stat-pill">${state.questions.length} 题</span>
    <span class="stat-pill">${manifest.setCount || uniq(state.questions.map((question) => question.setName)).length} 套</span>
    <span class="stat-pill">${sections} 科目</span>
    <span class="stat-pill">${types} 题型</span>
    <span class="stat-pill warning">${state.duplicateGroups.length} 复用组</span>
  `;
}

function renderTabs() {
  els.viewTabs.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  const browsing = state.view === "browse";
  document.querySelector(".toolbar").hidden = !browsing;
  document.querySelector(".readonly-grid").hidden = !browsing;
  els.duplicatePanel.hidden = state.view !== "duplicates";
  els.checkerPanel.hidden = state.view !== "checker";
}

function renderList() {
  const questions = filteredQuestions();
  if (!questions.some((question) => question.id === state.selectedId)) {
    state.selectedId = questions[0]?.id || "";
  }
  els.resultList.innerHTML =
    questions
      .slice(0, 500)
      .map(
        (question) => `
          <button class="result-row${question.id === state.selectedId ? " active" : ""}" type="button" data-id="${escapeHtml(question.id)}">
            <strong>${escapeHtml(displayTitle(question))}</strong>
            <div class="row-tags">
              <span class="pill">${escapeHtml(question.section || "未分科目")}</span>
              <span class="pill type">${escapeHtml(question.questionType || "未标注题型")}</span>
            </div>
            <p>${escapeHtml(questionLabel(question))} · ${escapeHtml(question.setName || "未标注套题")}</p>
            <p>${escapeHtml(previewText(question))}</p>
          </button>
        `,
      )
      .join("") || `<div class="empty">当前筛选下没有题目</div>`;
  if (questions.length > 500) {
    els.resultList.insertAdjacentHTML("beforeend", `<div class="empty">已显示前 500 题，请继续搜索缩小范围。</div>`);
  }
  els.resultList.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.id;
      render();
    });
  });
}

function detailBlock(title, value) {
  const text = normalize(value);
  if (!text) return "";
  return `<section class="detail-section"><h3>${escapeHtml(title)}</h3><div class="text-box">${escapeHtml(text)}</div></section>`;
}

function renderOptions(question) {
  if (!Array.isArray(question.options) || !question.options.length) return "";
  return `
    <section class="detail-section">
      <h3>选项</h3>
      ${question.options
        .map((option, index) => {
          const key = normalize(option.key) || String.fromCharCode(65 + index);
          return `<div class="option-row"><span class="option-key">${escapeHtml(key)}</span><span>${escapeHtml(option.text)}</span></div>`;
        })
        .join("")}
    </section>
  `;
}

function renderMedia(question) {
  const audioUrl = assetUrl(question.audio?.url);
  const imageUrl = assetUrl(question.image?.url);
  return `
    ${imageUrl ? `<section class="detail-section"><h3>图片</h3><img class="text-box" src="${escapeHtml(imageUrl)}" alt="题目图片" /></section>` : ""}
    ${audioUrl ? `<section class="detail-section"><h3>音频</h3><audio controls src="${escapeHtml(audioUrl)}"></audio></section>` : ""}
  `;
}

function renderDetail() {
  const question = state.questions.find((item) => item.id === state.selectedId);
  if (!question) {
    els.detailPanel.innerHTML = `<div class="empty">请选择一道题目</div>`;
    return;
  }
  els.detailPanel.innerHTML = `
    <h2>${escapeHtml(displayTitle(question))}</h2>
    <div class="detail-tags">
      <span class="pill">${escapeHtml(question.setName || "未标注套题")}</span>
      <span class="pill">${escapeHtml(question.section || "未分科目")}</span>
      <span class="pill type">${escapeHtml(question.questionType || "未标注题型")}</span>
      <span class="pill">${escapeHtml(questionLabel(question))}</span>
    </div>
    ${renderMedia(question)}
    ${detailBlock("题型指令", question.instruction)}
    ${detailBlock("共用材料", question.passage || question.transcript)}
    ${detailBlock("题干", question.prompt)}
    ${renderOptions(question)}
    ${
      question.answers?.length
        ? `<section class="detail-section"><h3>答案</h3><div class="answer-list">${question.answers
            .map((answer) => `<span class="pill">${escapeHtml(answer)}</span>`)
            .join("")}</div></section>`
        : ""
    }
    ${detailBlock("解析", question.explanation)}
  `;
}

function buildDuplicateGroups() {
  const buckets = new Map();
  state.questions.forEach((question) => {
    const fingerprint = duplicateFingerprint(question);
    if (!fingerprint) return;
    const key = `${question.section || "未分科目"}::${question.questionType || "未标注题型"}::${fingerprint}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(question);
  });

  state.duplicateGroups = [...buckets.values()]
    .filter((items) => items.length > 1)
    .map((items) => {
      const dates = new Set(items.map(dateInfo).filter(Boolean).map((date) => date.dayKey));
      const sets = new Set(items.map((question) => normalize(question.setName || question.sheetName || "未标注套题")));
      const primary = items[0];
      const group = {
        id: duplicateFingerprint(primary).slice(0, 80),
        section: primary.section || "未分科目",
        questionType: primary.questionType || "未标注题型",
        title: displayTitle(primary),
        preview: duplicateSourceText(primary).replace(/\s+/g, " ").slice(0, 260),
        items,
        dayCount: dates.size,
        setCount: sets.size,
        sets: [...sets].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
      };
      group.level = duplicateLevel(group);
      return group;
    })
    .sort((a, b) => b.items.length - a.items.length || b.dayCount - a.dayCount || b.setCount - a.setCount);
}

function levelLabel(level) {
  if (level === "high") return "高频信号";
  if (level === "medium") return "中频复用";
  if (level === "low") return "低频复用";
  return "全部";
}

function duplicatePercent(groups = state.duplicateGroups) {
  const affected = new Set(groups.flatMap((group) => group.items.map((question) => question.id))).size;
  if (!state.questions.length) return "0%";
  return `${Math.round((affected / state.questions.length) * 1000) / 10}%`;
}

function renderDuplicateSnapshot() {
  const groups = duplicateGroupsForFilters();
  const affected = new Set(groups.flatMap((group) => group.items.map((question) => question.id))).size;
  const high = groups.filter((group) => group.level === "high").length;
  const crossDay = groups.filter((group) => group.dayCount > 1).length;
  els.duplicateSummary.innerHTML = `
    <div class="snapshot-metric"><strong>${groups.length}</strong><span>复用组</span></div>
    <div class="snapshot-metric"><strong>${affected}</strong><span>涉及题目</span></div>
    <div class="snapshot-metric"><strong>${duplicatePercent(groups)}</strong><span>复用占比</span></div>
    <div class="snapshot-metric"><strong>${high}</strong><span>高频信号</span></div>
    <div class="snapshot-metric"><strong>${crossDay}</strong><span>跨天复用</span></div>
  `;

  els.duplicateList.innerHTML =
    groups
      .slice(0, 120)
      .map((group, index) => {
        const primary = group.items[0];
        const rest = group.items.slice(1);
        return `
          <article class="duplicate-card">
            <div class="duplicate-card-head">
              <div>
                <span class="rank">#${index + 1}</span>
                <h3>${escapeHtml(group.title)}</h3>
                <p>${escapeHtml(group.section)} · ${escapeHtml(group.questionType)}</p>
              </div>
              <div class="duplicate-score ${group.level}">
                <strong>${group.items.length}</strong>
                <span>${levelLabel(group.level)}</span>
              </div>
            </div>
            <div class="duplicate-tags">
              <span class="pill warning">${group.items.length} 次出现</span>
              <span class="pill">${group.setCount} 套题</span>
              <span class="pill">${group.dayCount || 0} 天</span>
              <span class="pill type">同材料匹配</span>
            </div>
            <p class="duplicate-preview">${escapeHtml(group.preview)}</p>
            <div class="occurrence-block">
              <strong>主编号：${escapeHtml(questionLabel(primary))}</strong>
              <span>${escapeHtml(primary.setName || "未标注套题")}</span>
            </div>
            <details>
              <summary>查看其余出现位置（${rest.length}）</summary>
              <div class="occurrence-grid">
                ${rest
                  .map((question) => {
                    const date = dateInfo(question);
                    return `
                      <div>
                        <strong>${escapeHtml(questionLabel(question))}</strong>
                        <span>${escapeHtml(question.setName || "未标注套题")}${date ? ` · ${escapeHtml(date.dayLabel)}` : ""}</span>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </details>
          </article>
        `;
      })
      .join("") || `<div class="empty">当前筛选下没有复用内容。</div>`;

  if (groups.length > 120) {
    els.duplicateList.insertAdjacentHTML("beforeend", `<div class="empty">已显示前 120 组，请用科目、题型或频率继续缩小范围。</div>`);
  }
}

function renderQuickCheckResults() {
  const text = normalize(state.quickCheckText);
  if (text.length < 12) {
    els.quickCheckResults.innerHTML = `<div class="empty">请输入至少 12 个字符，才能开始匹配。</div>`;
    return;
  }
  const matches = state.questions
    .map((question) => ({
      question,
      score: similarity(text, questionMatchText(question)),
    }))
    .filter((item) => item.score >= 18)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);

  els.quickCheckResults.innerHTML =
    matches
      .map(({ question, score }) => `
        <article class="quick-match-card">
          <div>
            <strong>${escapeHtml(displayTitle(question))}</strong>
            <p>${escapeHtml(questionLabel(question))} · ${escapeHtml(question.setName || "未标注套题")}</p>
          </div>
          <span class="match-score">${score}%</span>
          <p>${escapeHtml(previewText(question))}</p>
          <button type="button" data-open-question="${escapeHtml(question.id)}">打开题目</button>
        </article>
      `)
      .join("") || `<div class="empty">没有找到明显相似内容，可以换一段更长的题干或材料再试。</div>`;

  els.quickCheckResults.querySelectorAll("[data-open-question]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.openQuestion;
      state.view = "browse";
      render();
    });
  });
}

function csvEscape(value) {
  return `"${normalize(value).replace(/"/g, '""')}"`;
}

function exportDuplicateCsv() {
  const rows = [["标题", "科目", "题型", "出现次数", "复用级别", "跨天数", "套题数", "主编号", "出现位置"]];
  duplicateGroupsForFilters().forEach((group) => {
    rows.push([
      group.title,
      group.section,
      group.questionType,
      group.items.length,
      levelLabel(group.level),
      group.dayCount,
      group.setCount,
      questionLabel(group.items[0]),
      group.items.map((question) => `${questionLabel(question)} / ${question.setName || "未标注套题"}`).join("；"),
    ]);
  });
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `toefl-usage-patterns-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function render() {
  renderHeader();
  renderTabs();
  if (state.view === "browse") {
    renderList();
    renderDetail();
  } else if (state.view === "duplicates") {
    renderDuplicateSnapshot();
  }
}

async function boot() {
  try {
    const [manifestResponse, dataResponse] = await Promise.all([
      fetch("./data/manifest.json", { cache: "no-store" }),
      fetch("./data/questions.json", { cache: "no-store" }),
    ]);
    state.manifest = manifestResponse.ok ? await manifestResponse.json() : {};
    const data = dataResponse.ok ? await dataResponse.json() : { questions: [] };
    state.questions = Array.isArray(data.questions) ? data.questions.filter(isOfficialQuestion) : [];
    state.manifest = {
      ...state.manifest,
      questionCount: state.questions.length,
      setCount: new Set(state.questions.map((question) => question.setName).filter(Boolean)).size,
    };
    buildDuplicateGroups();
    renderFilters();
    render();
  } catch (error) {
    els.resultList.innerHTML = `<div class="empty">公开版尚未发布，或数据文件读取失败。</div>`;
    els.detailPanel.innerHTML = `<div class="empty">${escapeHtml(error.message || "读取失败")}</div>`;
  }
}

els.viewTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  render();
});

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});
els.sectionFilter.addEventListener("change", (event) => {
  state.section = event.target.value;
  state.type = "";
  renderFilters();
  render();
});
els.typeFilter.addEventListener("change", (event) => {
  state.type = event.target.value;
  render();
});
els.setFilter.addEventListener("change", (event) => {
  state.setName = event.target.value;
  render();
});
els.duplicateSectionFilter.addEventListener("change", (event) => {
  state.duplicateSection = event.target.value;
  state.duplicateType = "";
  renderFilters();
  render();
});
els.duplicateTypeFilter.addEventListener("change", (event) => {
  state.duplicateType = event.target.value;
  render();
});
els.duplicateLevelFilter.addEventListener("change", (event) => {
  state.duplicateLevel = event.target.value;
  render();
});
els.exportDuplicates.addEventListener("click", exportDuplicateCsv);
els.runQuickCheck.addEventListener("click", () => {
  state.quickCheckText = els.quickCheckText.value;
  renderQuickCheckResults();
});
els.quickCheckText.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    state.quickCheckText = els.quickCheckText.value;
    renderQuickCheckResults();
  }
});
els.screenshotInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (state.screenshotUrl) URL.revokeObjectURL(state.screenshotUrl);
  state.screenshotUrl = file ? URL.createObjectURL(file) : "";
  els.screenshotPreview.innerHTML = state.screenshotUrl
    ? `<img src="${escapeHtml(state.screenshotUrl)}" alt="上传的截图" /><p>已加载截图。当前版本不会自动 OCR，请把截图中的文字粘贴到下方文本框查重。</p>`
    : "截图预览区";
});

boot();
