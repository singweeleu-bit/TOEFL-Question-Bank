const state = {
  questions: [],
  manifest: null,
  search: "",
  section: "",
  type: "",
  setName: "",
  selectedId: "",
};

const els = {
  publishMeta: document.querySelector("#publishMeta"),
  headerStats: document.querySelector("#headerStats"),
  searchInput: document.querySelector("#searchInput"),
  sectionFilter: document.querySelector("#sectionFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  setFilter: document.querySelector("#setFilter"),
  resultList: document.querySelector("#resultList"),
  detailPanel: document.querySelector("#detailPanel"),
};

function normalize(value) {
  return String(value || "").trim();
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

function displayTitle(question) {
  return (
    normalize(question.title) ||
    normalize(question.prompt).split(/[.!?。！？]/).find((item) => normalize(item).length > 8) ||
    normalize(question.passage).split(/[.!?。！？]/).find((item) => normalize(item).length > 8) ||
    normalize(question.transcript).split(/[.!?。！？]/).find((item) => normalize(item).length > 8) ||
    normalize(question.displayNo) ||
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

function formatTime(value) {
  if (!value) return "尚未发布";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
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

function assetUrl(url) {
  const value = normalize(url);
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/media/")) return `..${value}`;
  return value;
}

function renderFilters() {
  const sections = uniq(state.questions.map((question) => question.section)).sort();
  const types = uniq(state.questions.map((question) => question.questionType)).sort();
  const sets = uniq(state.questions.map((question) => question.setName)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  setOptions(els.sectionFilter, sections, "全部科目", state.section);
  setOptions(els.typeFilter, types, "全部题型", state.type);
  setOptions(els.setFilter, sets, "全部套题", state.setName);
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
  `;
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
              <span class="pill">${escapeHtml(question.section || "未分科")}</span>
              <span class="pill type">${escapeHtml(question.questionType || "未标注题型")}</span>
            </div>
            <p>${escapeHtml(question.displayNo || question.questionId || question.id)} · ${escapeHtml(question.setName || "未标注套题")}</p>
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
      <span class="pill">${escapeHtml(question.section || "未分科")}</span>
      <span class="pill type">${escapeHtml(question.questionType || "未标注题型")}</span>
      <span class="pill">${escapeHtml(question.displayNo || question.questionId || question.id)}</span>
    </div>
    ${renderMedia(question)}
    ${detailBlock("题型指令", question.instruction)}
    ${detailBlock("阅读材料 / 听力文本", question.passage || question.transcript)}
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

function render() {
  renderHeader();
  renderList();
  renderDetail();
}

async function boot() {
  try {
    const [manifestResponse, dataResponse] = await Promise.all([
      fetch("./data/manifest.json", { cache: "no-store" }),
      fetch("./data/questions.json", { cache: "no-store" }),
    ]);
    state.manifest = manifestResponse.ok ? await manifestResponse.json() : {};
    const data = dataResponse.ok ? await dataResponse.json() : { questions: [] };
    state.questions = Array.isArray(data.questions) ? data.questions : [];
    renderFilters();
    render();
  } catch (error) {
    els.resultList.innerHTML = `<div class="empty">公开版尚未发布，或数据文件读取失败。</div>`;
    els.detailPanel.innerHTML = `<div class="empty">${escapeHtml(error.message || "读取失败")}</div>`;
  }
}

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});
els.sectionFilter.addEventListener("change", (event) => {
  state.section = event.target.value;
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

boot();
