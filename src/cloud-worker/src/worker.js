/**
 * 知乎早报 + 创作周报 · Cloudflare Worker（StackChan 黑客松定制代码）。
 *
 * 定时触发或 POST /api/refresh 时：
 *   调知乎开放平台 HTTP API（Bearer Access Secret）拉热榜/创作数据
 *   → 直答总结（限流时降级为热榜摘要）/ AI 建议（失败回退规则）
 *   → 在 Worker 内用 EdgeTTS 协议合成中文语音
 *   → 数据与音频存 KV，页面由本 Worker 直接提供。
 *
 * 凭证：ZHIHU_ACCESS_SECRET（wrangler secret put，用户本人输入）
 *       REFRESH_KEY（手动刷新口令）
 */
import { morningPage, creatorPage } from "./html.js";

const ZHIHU = "https://developer.zhihu.com";
const TYPES = { answer: "回答", pin: "想法" };
const DAY_MS = 86400000;

const bjDate = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const bjNow = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16).replace("T", " ");

function zhHeaders(env) {
  // 与本机 curl 验证成功的最小头一致；多余浏览器指纹头可能触发知乎 WAF 一致性校验
  return {
    Authorization: `Bearer ${env.ZHIHU_ACCESS_SECRET}`,
    "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
  };
}

async function zhGet(env, path) {
  const r = await fetch(ZHIHU + path, { headers: zhHeaders(env) });
  const j = await r.json();
  if (j.Code !== 0) throw new Error(`知乎接口 ${path}: ${j.Message || r.status}`);
  return j.Data;
}

async function zhida(env, query) {
  const r = await fetch(ZHIHU + "/v1/chat/completions", {
    method: "POST",
    headers: { ...zhHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "zhida-fast-1p5",
      stream: false,
      messages: [{ role: "user", content: query }],
    }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || j.error.code || "zhida error");
  return j.choices[0].message.content.trim();
}

/* ---------- 语音合成（EdgeTTS HTTP 接口：微软翻译公共鉴权换临时 token） ---------- */

function concatChunks(chunks) {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

function splitText(text, maxLen = 1500) {
  const parts = [];
  let buf = "";
  for (const seg of text.split(/(?<=[。！？；\n])/)) {
    if ((buf + seg).length > maxLen && buf) {
      parts.push(buf);
      buf = seg;
    } else {
      buf += seg;
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts.filter((p) => p.trim());
}

const MT_KEY_B64 =
  "oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==";
let tokenInfo = { token: null, expiredAt: 0, endpoint: null };

const b64ToBytes = (b64) => {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};
const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));

async function mtSign(urlStr) {
  const encodedUrl = encodeURIComponent(urlStr.split("://")[1]);
  const uuidStr = crypto.randomUUID().replace(/-/g, "");
  const date = (new Date().toUTCString().replace(/GMT/, "").trim() + " GMT").toLowerCase();
  const msg = `MSTranslatorAndroidApp${encodedUrl}${date}${uuidStr}`.toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw", b64ToBytes(MT_KEY_B64), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return `MSTranslatorAndroidApp::${bytesToB64(new Uint8Array(sig))}::${date}::${uuidStr}`;
}

async function getEndpoint() {
  const now = Date.now() / 1000;
  if (tokenInfo.token && now < tokenInfo.expiredAt - 60) return tokenInfo.endpoint;
  const url = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Accept-Language": "zh-Hans",
      "X-ClientVersion": "4.0.530a 5fe1dc6c",
      "X-UserId": "0f04d16a175c411e",
      "X-HomeGeographicRegion": "zh-Hans-CN",
      "X-ClientTraceId": crypto.randomUUID().replace(/-/g, ""),
      "X-MT-Signature": await mtSign(url),
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
  if (!r.ok) throw new Error("获取 TTS token 失败: " + r.status);
  const data = await r.json();
  const exp = JSON.parse(atob(data.t.split(".")[1])).exp;
  tokenInfo = { token: data.t, expiredAt: exp, endpoint: data };
  return data;
}

function ssml(text, style) {
  const esc = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  return (
    `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN">` +
    `<voice name="zh-CN-YunyangNeural"><mstts:express-as style="${style}" styledegree="2.0" role="default">` +
    `<prosody rate="+0%" pitch="+0Hz" volume="+0%">${esc}</prosody>` +
    `</mstts:express-as></voice></speak>`
  );
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function ttsChunk(seg, style = "newscast") {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const ep = await getEndpoint();
    const r = await fetch(`https://${ep.r}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        Authorization: ep.t,
        "Content-Type": "application/ssml+xml",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: ssml(seg, style),
    });
    if (r.ok) return new Uint8Array(await r.arrayBuffer());
    if (r.status === 400 && style !== "general") return ttsChunk(seg, "general");
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      await delay(500 * (attempt + 1));
      continue;
    }
    throw new Error(`TTS 合成失败: ${r.status} ${(await r.text()).slice(0, 120)}`);
  }
  throw new Error("TTS 重试次数用尽");
}

async function tts(text) {
  const chunks = [];
  for (const seg of splitText(text)) chunks.push(await ttsChunk(seg));
  if (!chunks.length) throw new Error("TTS 文本为空");
  return concatChunks(chunks);
}

/* ---------- 早报流水线 ---------- */

const summaryPrompt = (title) =>
  `知乎热榜问题：「${title}」。请总结这个问题下高赞回答的主要观点，` +
  "用100字以内的口语化中文，适合语音播报，不要分点、不要链接、不要书面语。" +
  "如果检索不到回答内容，就根据问题本身用一句话介绍这件事的背景，" +
  "不要说『找不到』『建议去查看』之类的话。";

function cleanSummary(s) {
  const t = (s || "").replace(/\[图片\]|\s+/g, " ").trim();
  if (!t) return "这个问题正在知乎热议中，回答摘要暂缺，感兴趣可以看看原文。";
  return t.length > 150 ? t.slice(0, 150) + "…" : t;
}

function morningText(items, day) {
  const [, m, d] = day.split("-");
  const parts = [`早上好！今天是${Number(m)}月${Number(d)}日，来听今天的知乎早报。`];
  items.forEach((it, i) => parts.push(`第${i + 1}条，${it.title} ${it.summary}`));
  parts.push("以上就是今天的知乎早报，祝你今天顺利！");
  return parts.join("\n");
}

async function runMorning(env) {
  const day = bjDate();
  const hot = await zhGet(env, "/api/v1/content/hot_list?Limit=5");
  const items = [];
  for (const it of hot.Items || []) {
    const ck = `mc:${day}:${it.Title}`;
    let sum = await env.REPORTS.get(ck);
    if (!sum) {
      try {
        sum = await zhida(env, summaryPrompt(it.Title));
      } catch {
        sum = cleanSummary(it.Summary);
      }
      await env.REPORTS.put(ck, sum, { expirationTtl: 2 * DAY_MS / 1000 });
    }
    items.push({ title: it.Title, url: it.Url, summary: sum });
  }
  const text = morningText(items, day);
  const mp3 = await tts(text);
  await env.REPORTS.put("morning:data", JSON.stringify({
    date: day, generated: bjNow(), items, text,
  }));
  await env.REPORTS.put("morning:mp3", mp3);
  return { items: items.length, audioBytes: mp3.byteLength };
}

/* ---------- 创作周报流水线 ---------- */

async function fetchRecent(env, days, maxItems) {
  const cutoff = Date.now() / 1000 - days * 86400;
  const found = [];
  let offset = "0";
  for (let page = 0; page < 10; page++) {
    const data = await zhGet(
      env,
      `/api/v1/user/contents?ContentType=all&SortField=ts&SortOrder=desc&Offset=${offset}&Limit=20`
    );
    const items = data.Items || [];
    if (!items.length) break;
    for (const it of items) {
      if ((it.CreatedAt || 0) < cutoff) return found.slice(0, maxItems);
      if (TYPES[it.ContentType]) found.push(it);
    }
    const pg = data.Paging || {};
    if (pg.IsEnd || !pg.NextOffset) break;
    offset = String(pg.NextOffset);
  }
  return found.slice(0, maxItems);
}

const pct = (x) => (x * 100).toFixed(1) + "%";

function analyze(contents, statsMap) {
  const items = [];
  const totals = { view: 0, up: 0, collect: 0, share: 0, comment: 0, followers: 0 };
  const sources = {}, ages = {}, locs = {};
  for (const c of contents) {
    const s = statsMap[c.Url] || {};
    const m = s.Metrics || {};
    const view = m.ViewCount || 0;
    const row = {
      title: c.Title || "(无标题)",
      type: TYPES[c.ContentType] || c.ContentType,
      url: c.Url,
      created: new Date(c.CreatedAt * 1000 + 8 * 3600000).toISOString().slice(5, 10),
      view,
      up: m.UpvoteCount || 0,
      collect: m.CollectCount || 0,
      share: m.ShareCount || 0,
      comment: m.CommentCount || 0,
      followers: m.NewFollowerCount || 0,
      has_stats: !!s.Metrics,
    };
    row.rate = view ? (row.up + row.collect + row.share + row.comment) / view : 0;
    items.push(row);
    for (const k of Object.keys(totals)) totals[k] += row[k];
    const aud = s.Audience || {};
    for (const x of aud.Source || []) sources[x.Name] = (sources[x.Name] || 0) + (x.Count || 0);
    for (const x of aud.Age || []) ages[x.Name] = (ages[x.Name] || 0) + (x.Count || 0);
    for (const x of aud.Location || []) locs[x.Name] = (locs[x.Name] || 0) + (x.Count || 0);
  }
  const srcTotal = Object.values(sources).reduce((a, b) => a + b, 0) || 1;
  const top = (d, n) =>
    Object.entries(d).sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([name, count]) => ({ name, count }));
  return {
    items: items.sort((a, b) => b.view - a.view),
    totals,
    counts: {
      answer: contents.filter((c) => c.ContentType === "answer").length,
      pin: contents.filter((c) => c.ContentType === "pin").length,
    },
    sources: Object.entries(sources)
      .map(([name, count]) => ({ name, count, ratio: count / srcTotal }))
      .sort((a, b) => b.count - a.count),
    age: top(ages, 3),
    location: top(locs, 5),
  };
}

function suggest(agg, days) {
  const out = [];
  const items = agg.items.filter((r) => r.has_stats);
  const t = agg.totals;
  const n = agg.items.length;
  if (!n) return [`最近${days}天没有发布回答或想法。保持更新是获得推荐流量的前提，先从一条想法开始。`];
  const best = items[0];
  if (best)
    out.push(`浏览最高的是《${best.title.slice(0, 30)}》（${best.view}浏览、${best.up}赞同），这类选题和开头写法值得复用。`);
  const byType = {};
  for (const r of items) (byType[r.type] ||= []).push(r);
  if (Object.keys(byType).length === 2) {
    const avg = Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [k, v.reduce((a, r) => a + r.view, 0) / v.length])
    );
    const better = Object.keys(avg).sort((a, b) => avg[b] - avg[a])[0];
    out.push(`${better}的平均浏览（${avg[better].toFixed(0)}）明显高于另一类，精力有限时优先写${better}。`);
  }
  const rec = (agg.sources.find((s) => s.name === "App-推荐") || {}).ratio || 0;
  const search = (agg.sources.find((s) => s.name === "App-搜索") || {}).ratio || 0;
  if (rec && rec < 0.35)
    out.push(`推荐流量只占${pct(rec)}，系统分发偏少：标题可以更直接抛出冲突或结论，并尽量蹭热榜问题作答。`);
  if (search >= 0.15)
    out.push(`搜索流量占${pct(search)}，说明内容有长尾价值，适合持续写解读/方法类题材。`);
  if (t.view) {
    const upRate = t.up / t.view;
    if (upRate < 0.01)
      out.push(`整体赞同率${pct(upRate)}（低于1%），看的人多但认同少：开头三段内给出明确观点，别先铺背景。`);
    else if (upRate > 0.03)
      out.push(`赞同率${pct(upRate)}，高于常见水平，观点共鸣强，保持这个风格。`);
    if (t.collect / t.view > 0.01)
      out.push("收藏率不错，内容实用性强，可以多做清单式、可复用的干货。");
  }
  if (n < 3) out.push(`本周只发了${n}篇，更新频率偏低，稳定更新有利于推荐权重。`);
  if (t.followers) out.push(`本周涨粉${t.followers}个，内容开始带来关注，可在文末引导关注。`);
  return out.slice(0, 5);
}

/* ---------- AI 建议（Workers AI 免费额度；失败回退上面的规则建议） ---------- */

const AI_MODEL = "@cf/openai/gpt-oss-120b";

function aiPrompt(agg, days) {
  const data = {
    发布数量: agg.counts,
    总计: agg.totals,
    单篇: agg.items.filter((r) => r.has_stats).slice(0, 8).map((r) => ({
      标题: String(r.title).slice(0, 60), 类型: r.type, 浏览: r.view, 赞同: r.up,
      收藏: r.collect, 转发: r.share, 评论: r.comment,
      互动率: r.view ? (((r.up + r.collect + r.share + r.comment) / r.view) * 100).toFixed(2) + "%" : "0%",
    })),
    流量来源: agg.sources.slice(0, 5).map((s) => ({ 名称: s.name, 占比: (s.ratio * 100).toFixed(1) + "%" })),
    读者年龄: agg.age, 读者地域: agg.location,
  };
  return (
    "你是知乎创作顾问。下面是某创作者近" + days + "天的真实数据（JSON，账号级口径）。\n" +
    "先按这些基准分析，再给建议：\n" +
    "- 赞同率=赞同/浏览：低于1%偏低（看多认同少），高于3%很强；\n" +
    "- 收藏率=收藏/浏览：高于1%说明内容实用；\n" +
    "- 推荐流量占比偏低时，标题和选题要更抓人；搜索占比高说明有长尾价值，适合方法/解读类题材；\n" +
    "- 回答靠选题和开头观点，想法靠短平快和互动，两者玩法不同。\n" +
    "给出3~4条改进建议，要求：\n" +
    "1. 你只能看到标题和统计数据，看不到正文和图片：严禁对正文内容、配图、段落结构编造具体改法（如换图、改结构）；建议只能围绕数据反映的问题：赞同率/收藏率高低、更新频率、流量来源占比、选题方向；\n" +
    "2. 每条不超过60字，用\"建议……\"句式，给具体动作；\n" +
    "3. 只能使用数据中已有的指标，严禁编造点击率、完读率等数据里没有的指标；\n" +
    "4. 优先引用具体数字；可提及作品标题作为例子，但只能给选题或标题写法层面的改法；不要把已回答过的问题当新选题推荐；推荐新选题只给方向（如\"财报解读类\"），严禁编造具体事实或数字当选题前提；\n" +
    "5. 不要建议把想法改写成回答；不要重复\"浏览最高的是哪篇\"（播报已包含）；\n" +
    "6. 评论数可能未统计，不要仅凭评论为0下结论；\n" +
    "7. 更新频率建议必须对照数据中的实际发布数量，已达标就不要提；\n" +
    "8. 不要空泛套话，纯中文，只输出JSON数组，如 [\"建议1\",\"建议2\",\"建议3\"]。\n" +
    "数据：" + JSON.stringify(data)
  );
}

/* 取回复文本：新版模型返回 OpenAI 格式（choices），老版返回 response */
function aiText(res) {
  const c = res && res.choices && res.choices[0] && res.choices[0].message;
  return String((c && c.content) || (res && res.response) || "");
}

async function aiSuggest(env, agg, days) {
  if (!env.AI) throw new Error("AI binding missing");
  const res = await env.AI.run(AI_MODEL, {
    messages: [{ role: "user", content: aiPrompt(agg, days) }],
    max_completion_tokens: 4000, // 推理也占输出预算，留足余量；max_tokens 已被官方弃用
  });
  const text = aiText(res)
    .trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("AI response has no JSON array");
  const arr = JSON.parse(m[0]);
  if (!Array.isArray(arr)) throw new Error("AI response not array");
  const out = arr
    .filter((s) => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 120)
    .slice(0, 4);
  if (out.length < 2) throw new Error("AI suggestions too few");
  return out;
}

function creatorText(agg, suggestions, days) {
  const t = agg.totals, c = agg.counts;
  const parts = [
    `这是你的知乎创作周报。最近${days}天，你发布了${c.answer}篇回答、${c.pin}条想法。` +
      `总浏览${t.view}，赞同${t.up}，收藏${t.collect}，转发${t.share}，涨粉${t.followers}个。`,
  ];
  if (agg.items.length) {
    const b = agg.items[0];
    parts.push(`表现最好的是《${b.title.slice(0, 30)}》，${b.view}次浏览，${b.up}个赞同。`);
  }
  const tips = suggestions.filter((s) => !s.startsWith("浏览最高"));
  if (tips.length) parts.push("给你的建议：" + tips.join("；"));
  parts.push("周报完毕，继续加油！");
  return parts.join("\n");
}

/* 账号级近 N 天统计（与知乎客户端同口径）；失败返回 null 回退单篇加总 */
async function accountStats(env, days) {
  const end = bjDate();
  const start = new Date(Date.now() + 8 * 3600000 - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  try {
    const d = await zhGet(env, `/api/v1/user/creator_account_stats?StartDate=${start}&EndDate=${end}&ContentType=all`);
    const m = d.Metrics || {}, t = m.Today || {};
    const daily = (d.FollowerDetails && d.FollowerDetails.Daily) || [];
    const fans = daily.filter((x) => x.Date >= start && x.Date <= end).reduce((s, x) => s + (x.NetIncrease || 0), 0);
    const todayFans = (daily.find((x) => x.Date === end) || {}).NetIncrease || 0;
    const aud = d.Audience || {};
    const topN = (arr, n) => (arr || []).slice().sort((a, b) => (b.Count || 0) - (a.Count || 0)).slice(0, n).map((x) => ({ name: x.Name, count: x.Count || 0 }));
    return {
      totals: {
        view: (m.ViewCount || 0) + (m.PlayCount || 0),
        up: m.UpvoteCount || 0,
        collect: m.CollectCount || 0,
        share: m.ShareCount || 0,
        comment: m.CommentCount || 0,
        followers: fans,
      },
      today: {
        view: (t.ViewCount || 0) + (t.PlayCount || 0),
        up: t.UpvoteCount || 0,
        collect: t.CollectCount || 0,
        share: t.ShareCount || 0,
        comment: t.CommentCount || 0,
        followers: todayFans,
      },
      sources: (aud.Source || []).map((x) => ({ name: x.Name, count: x.Count || 0, ratio: x.Ratio || 0 })).sort((a, b) => b.count - a.count),
      age: topN(aud.Age, 3),
      location: topN(aud.Location, 5),
    };
  } catch {
    return null;
  }
}

async function runCreator(env, days = 7) {
  const contents = await fetchRecent(env, days, 30);
  const statsMap = {};
  for (const c of contents) {
    try {
      const data = await zhGet(
        env,
        `/api/v1/user/creator_content_stats?ContentUrl=${encodeURIComponent(c.Url)}`
      );
      statsMap[c.Url] = (data.Items || [])[0] || null;
    } catch {
      statsMap[c.Url] = null;
    }
  }
  const agg = analyze(contents, statsMap);
  const acc = await accountStats(env, days);
  if (acc) Object.assign(agg, acc);
  let suggestions, suggestBy = "ai", suggestError = null;
  try {
    suggestions = await aiSuggest(env, agg, days);
  } catch (e) {
    suggestError = String((e && e.message) || e).slice(0, 200);
    console.error("AI suggest failed, fallback to rules:", suggestError);
    suggestions = suggest(agg, days);
    suggestBy = "rules";
  }
  const text = creatorText(agg, suggestions, days);
  const mp3 = await tts(text);
  const data = { generated: bjNow(), days, ...agg, suggestions, suggest_by: suggestBy, suggest_error: suggestError, text };
  await env.REPORTS.put("creator:data", JSON.stringify(data));
  await env.REPORTS.put("creator:mp3", mp3);
  return { items: contents.length, audioBytes: mp3.byteLength };
}

/* ---------- HTTP 与定时入口 ---------- */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const html = (body) =>
  new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

async function kvJson(env, key) {
  const v = await env.REPORTS.get(key);
  return v ? json(JSON.parse(v)) : json({ empty: true }, 404);
}

async function kvAudio(env, key) {
  const v = await env.REPORTS.get(key, "arrayBuffer");
  if (!v) return new Response("audio not generated yet", { status: 404 });
  return new Response(v, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

async function handleFetch(req, env) {
  const u = new URL(req.url);
  const p = u.pathname;
  if (p === "/api/debug") {
    const step = u.searchParams.get("step") || "hot";
    try {
      if (step === "hot") {
        const d = await zhGet(env, "/api/v1/content/hot_list?Limit=2");
        return json({ ok: true, titles: (d.Items || []).map((i) => i.Title) });
      }
      if (step === "envinfo") {
        const s = env.ZHIHU_ACCESS_SECRET || "";
        return json({
          hasSecret: !!env.ZHIHU_ACCESS_SECRET,
          len: s.length,
          head: s.slice(0, 4),
          tail: s.slice(-4),
        });
      }
      if (step === "hotwith") {
        // 诊断用：用请求头现场传入的凭证调用，区分"存储凭证错"与"云端IP被拦"
        const secret = req.headers.get("X-Zhihu-Secret");
        if (!secret) return json({ error: "missing X-Zhihu-Secret header" }, 400);
        const r = await fetch(ZHIHU + "/api/v1/content/hot_list?Limit=1", {
          headers: {
            Authorization: `Bearer ${secret}`,
            "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
          },
        });
        const j = await r.json();
        return json({ ok: j.Code === 0, status: r.status, code: j.Code, message: j.Message });
      }
      if (step === "zhida") {
        const t = await zhida(env, "用一句话介绍知乎热榜是什么");
        return json({ ok: true, answer: t });
      }
      if (step === "ai") {
        if (!env.AI) return json({ ok: false, error: "AI binding missing" }, 500);
        const res = await env.AI.run(AI_MODEL, {
          messages: [{ role: "user", content: "用一句话介绍知乎热榜是什么" }],
          max_completion_tokens: 2000,
        });
        return json({ ok: true, model: AI_MODEL, keys: Object.keys(res || {}), answer: aiText(res) });
      }
      if (step === "tts") {
        const mp3 = await tts("你好，这是一条云端语音合成测试。");
        await env.REPORTS.put("debug:mp3", mp3);
        return json({ ok: true, bytes: mp3.byteLength });
      }
      if (step === "kv") {
        await env.REPORTS.put("debug:kv", "ok");
        const v = await env.REPORTS.get("debug:kv");
        return json({ ok: true, read: v });
      }
      return json({ error: "unknown step" }, 400);
    } catch (e) {
      return json({ ok: false, step, error: String((e && e.message) || e) }, 500);
    }
  }
  if (p === "/api/refresh" && req.method === "POST") {
    if (!env.REFRESH_KEY || req.headers.get("X-Refresh-Key") !== env.REFRESH_KEY)
      return json({ error: "forbidden" }, 403);
    const body = await req.json().catch(() => ({}));
    const which = body.which || "all";
    const out = {};
    try {
      if (which !== "creator") out.morning = await runMorning(env);
      if (which !== "morning") out.creator = await runCreator(env);
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e), stack: String((e && e.stack) || "").split("\n").slice(0, 4) }, 500);
    }
    return json({ ok: true, ...out });
  }
  if (p === "/api/morning") return kvJson(env, "morning:data");
  if (p === "/api/creator") return kvJson(env, "creator:data");
  if (p === "/audio/morning.mp3") return kvAudio(env, "morning:mp3");
  if (p === "/audio/weekly.mp3") return kvAudio(env, "creator:mp3");
  if (p === "/creator" || p === "/creator/") return html(creatorPage());
  if (p === "/" || p === "/index.html") return html(morningPage());
  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(req, env) {
    try {
      return await handleFetch(req, env);
    } catch (e) {
      return json({ ok: false, where: "outer", error: String((e && e.message) || e) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    const job =
      event.cron === "0 0 * * *"
        ? runCreator(env).then((r) => console.log("creator ok", r))
        : runMorning(env).then((r) => console.log("morning ok", r));
    ctx.waitUntil(job.catch((e) => console.error("scheduled failed", e)));
  },
};