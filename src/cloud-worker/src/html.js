/** 页面外壳：播客播放器风格（滚动歌词稿 + 波形进度 + 大播放键）。
 *  数据运行时从 /api/* 拉取（KV 中最新一期），音频从 /audio/* 拉取。 */

const CSS = `
:root{--bg:#0b0d0c;--text:#f2f2f2;--cur:#ffffff;--past:#585c58;--fut:#8f948f;--accent:#ff5a36;--dim:rgba(255,90,54,.32);--pill:rgba(255,255,255,.09);--good:#3fb97f}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{height:100%}
body{background:var(--bg);color:var(--text);font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif;overflow:hidden}
body::before{content:"";position:fixed;inset:0;background:radial-gradient(60% 45% at 50% 38%,rgba(70,80,60,.35),transparent 70%);pointer-events:none}
#app{position:relative;height:100vh;height:100dvh;max-width:640px;margin:0 auto;display:flex;flex-direction:column;padding:14px 22px calc(14px + env(safe-area-inset-bottom))}
button{background:none;border:none;color:inherit;font:inherit;cursor:pointer}
svg{display:block}
/* 顶栏 */
#top{display:flex;align-items:center;gap:12px;padding:4px 0 10px}
#top .sp{flex:1}
.icobtn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#e8e8e8;opacity:.9}
.icobtn:active{background:var(--pill)}
.icobtn svg{width:24px;height:24px;fill:currentColor}
#pill{display:flex;align-items:center;gap:8px;background:var(--pill);border-radius:999px;padding:8px 16px;font-size:14px;color:#cfcfcf}
#pill .dot{width:7px;height:7px;border-radius:50%;background:var(--good)}
#favBtn.on svg{fill:var(--accent)}
/* 歌词稿 */
#trwrap{position:relative;flex:1;min-height:0}
#tr{height:100%;overflow-y:auto;scrollbar-width:none;padding:26px 6px 20px;mask-image:linear-gradient(transparent,#000 8%,#000 88%,transparent)}
#tr::-webkit-scrollbar{display:none}
#tr .ln{font-size:21px;line-height:1.6;color:var(--fut);padding:12px 4px;transition:color .3s;cursor:pointer}
#tr .ln.past{color:var(--past)}
#tr .ln.cur{color:var(--cur);font-weight:700;font-size:23px}
#trFloat{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;pointer-events:none}
#trFloat button{pointer-events:auto;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;display:flex;align-items:center;justify-content:center}
#trFloat svg{width:20px;height:20px;fill:currentColor}
body.no-tr #trwrap{display:none}
body.big-tr #tr .ln{font-size:26px}
body.big-tr #tr .ln.cur{font-size:29px}
body.big-tr #meta{display:none}
/* 节目信息 */
#meta{display:flex;align-items:center;gap:14px;padding:14px 2px 10px}
#cover{flex:0 0 56px;width:56px;height:56px;border-radius:8px;background:var(--accent);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;font-size:13px;line-height:1.25;text-align:center}
#meta .tt{min-width:0}
#epTitle{font-size:19px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#epShow{font-size:16px;color:var(--accent);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 时间 + 波形 */
#times{display:flex;justify-content:space-between;font-size:16px;color:#e6e6e6;font-variant-numeric:tabular-nums;padding:2px 2px 6px}
#wave{width:100%;height:64px;touch-action:none;cursor:pointer}
/* 控制区 */
#ctl{display:flex;align-items:center;justify-content:space-between;padding:16px 6px 10px}
#ctl .side{width:52px;height:52px;display:flex;align-items:center;justify-content:center;color:#c9c9c9}
#ctl .side svg{width:30px;height:30px;fill:currentColor}
#ctl .skip{width:60px;height:60px;display:flex;align-items:center;justify-content:center;color:#fff}
#ctl .skip svg{width:40px;height:40px;fill:currentColor}
#playBtn{width:88px;height:88px;display:flex;align-items:center;justify-content:center;color:#fff}
#playBtn svg{width:64px;height:64px;fill:currentColor}
#playBtn:active{transform:scale(.94)}
#rateBtn{position:relative}
#rateBtn text{fill:currentColor;font-size:7px;font-weight:700}
/* 底栏 */
#bot{display:flex;align-items:center;justify-content:space-between;padding:6px 2px 0}
#listBtn{display:flex;align-items:center;gap:10px;background:var(--pill);border-radius:12px;padding:12px 26px;font-size:16px;color:#e8e8e8}
#listBtn svg{width:20px;height:20px;fill:currentColor}
#tocBtn{position:relative}
#tocBtn .n{position:absolute;right:-2px;bottom:2px;font-size:12px;color:#cfcfcf}
/* 弹层 */
#sheet{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;z-index:9}
#sheet.open{display:block}
#sheetBox{position:absolute;left:0;right:0;bottom:0;max-width:640px;margin:0 auto;max-height:76vh;max-height:76dvh;background:#161a17;border-radius:20px 20px 0 0;display:flex;flex-direction:column}
#sheetHead{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 10px;font-size:17px;font-weight:600}
#sheetClose{width:36px;height:36px;font-size:22px;color:#aaa}
#sheetBody{overflow-y:auto;padding:0 20px calc(20px + env(safe-area-inset-bottom));font-size:16px;line-height:1.6}
.row{padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.row:last-child{border-bottom:none}
.row .t{font-weight:600;color:var(--text)}
.row .s{color:#9aa09a;font-size:14px;margin-top:4px}
.row .acts{margin-top:8px;display:flex;gap:10px}
.mini{border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:4px 14px;font-size:13px;color:#ddd}
.mini.hot{border-color:var(--accent);color:var(--accent)}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}
.card{background:rgba(255,255,255,.06);border-radius:12px;padding:10px 12px}
.card .v{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}
.card .k{color:#9aa09a;font-size:13px}
.tip{padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07);color:#d6d6d6}
.src{display:flex;align-items:center;gap:10px;padding:5px 0;font-size:14px}
.src .n{flex:0 0 84px;color:#9aa09a}
.src .track{flex:1;height:8px;background:rgba(255,255,255,.1);border-radius:4px}
.src .fill{height:8px;border-radius:4px;background:var(--accent)}
.src .p{flex:0 0 52px;text-align:right;color:#9aa09a}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.chip2{border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:4px 12px;font-size:13px;color:#bbb}
h3.sec{font-size:15px;color:#9aa09a;margin:14px 0 6px;font-weight:600}
#toast{position:fixed;left:50%;bottom:16vh;bottom:16dvh;transform:translateX(-50%);background:rgba(30,34,30,.95);border:1px solid rgba(255,255,255,.15);color:#eee;border-radius:999px;padding:10px 22px;font-size:15px;opacity:0;transition:opacity .25s;pointer-events:none;z-index:10;white-space:nowrap}
#toast.show{opacity:1}
`;

const BODY = `
<div id="app">
  <div id="top">
    <button class="icobtn" id="foldBtn" aria-label="收起文字稿"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6z"/></svg></button>
    <div id="pill"><span class="dot"></span><span id="pillTxt">加载中…</span></div>
    <div class="sp"></div>
    <button class="icobtn" id="favBtn" aria-label="收藏"><svg viewBox="0 0 24 24"><path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.4 4.8 1.6 7z"/></svg></button>
    <button class="icobtn" id="shareBtn" aria-label="分享"><svg viewBox="0 0 24 24"><path d="M18 16c-.8 0-1.5.3-2 .8l-7-4.1c.1-.2.1-.5.1-.7s0-.5-.1-.7l7-4.1c.5.5 1.2.8 2 .8 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .2 0 .5.1.7l-7 4.1C7.5 9.3 6.8 9 6 9c-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2-.8l7 4.1c-.1.2-.1.4-.1.7 0 1.6 1.3 2.9 2.9 2.9s2.9-1.3 2.9-2.9-1.2-3-2.7-3z"/></svg></button>
  </div>
  <div id="trwrap">
    <div id="tr"></div>
    <div id="trFloat">
      <button id="trClose" aria-label="关闭文字稿"><svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/></svg></button>
      <button id="trBig" aria-label="放大文字稿"><svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2zm14 0h-5V3h7v7h-2zM5 19h5v2H3v-7h2zm14 0h-5v2h7v-7h-2z"/></svg></button>
    </div>
  </div>
  <div id="meta">
    <div id="cover">知乎<br>早报</div>
    <div class="tt"><div id="epTitle">加载中…</div><div id="epShow">知乎早报 | 语音版</div></div>
  </div>
  <div id="times"><span id="tCur">0:00</span><span id="tLeft">-0:00</span></div>
  <canvas id="wave"></canvas>
  <div id="ctl">
    <button class="side" id="rateBtn" aria-label="倍速"><svg viewBox="0 0 24 24"><path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="12" y="14.5" text-anchor="middle">1x</text></svg></button>
    <button class="skip" id="back15" aria-label="后退15秒"><svg viewBox="0 0 24 24"><path d="M12 4V1L7 5l5 4V6c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7H3c0 5 4 9 9 9s9-4 9-9-4-9-9-9z"/><text x="12" y="16.5" text-anchor="middle" font-size="7.5" font-weight="700">15</text></svg></button>
    <button id="playBtn" aria-label="播放"><svg id="iPlay" viewBox="0 0 24 24"><path d="M7 4l14 8-14 8z"/></svg><svg id="iPause" viewBox="0 0 24 24" style="display:none"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg></button>
    <button class="skip" id="fwd30" aria-label="前进30秒"><svg viewBox="0 0 24 24"><path d="M12 4V1l5 4-5 4V6c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7h2c0 5-4 9-9 9s-9-4-9-9 4-9 9-9z"/><text x="12" y="16.5" text-anchor="middle" font-size="7.5" font-weight="700">30</text></svg></button>
    <button class="side" id="likeBtn" aria-label="赞"><svg viewBox="0 0 24 24"><path d="M2 21h4V9H2v12zM22 10c0-1.1-.9-2-2-2h-6.3l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 1 7.59 6.59C7.22 6.95 7 7.45 7 8v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1z"/></svg></button>
  </div>
  <div id="bot">
    <button class="icobtn" id="infoBtn" aria-label="信息"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2zm0-8h-2V7h2z"/></svg></button>
    <button id="listBtn"><svg viewBox="0 0 24 24"><path d="M4 6h12v2H4zm0 5h12v2H4zm0 5h8v2H4zm14-5v6l5-3z"/></svg>播放列表</button>
    <button class="icobtn" id="tocBtn" aria-label="目录"><svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 9h8v1.6H8zm0 3.4h6V14H8z"/></svg><span class="n" id="tocN"></span></button>
  </div>
</div>
<div id="sheet"><div id="sheetBox">
  <div id="sheetHead"><span id="sheetTitle"></span><button id="sheetClose">×</button></div>
  <div id="sheetBody"></div>
</div></div>
<div id="toast"></div>
<audio id="audio" preload="auto"></audio>
`;

const JS = `
var CONF = window.PAGE_CONF;
var audio = document.getElementById('audio');
var D = null, lines = [], weights = [], totalW = 0, curLine = -1;
var peaks = null, dragging = false, manualUntil = 0;
var rates = [1, 1.25, 1.5], rateIdx = 0;
var $ = function(id){ return document.getElementById(id); };
var esc = function(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
var toastT = 0;
function toast(msg){ var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove('show'); }, 1800); }
function fmt(s){ if(!isFinite(s) || s < 0) s = 0; s = Math.floor(s); var h = Math.floor(s/3600), m = Math.floor(s%3600/60), ss = s%60; var mm = (h && m < 10 ? '0' : '') + m; return (h ? h + ':' : '') + mm + ':' + (ss<10?'0':'') + ss; }

/* ---------- 歌词稿 ---------- */
function buildLines(text){
  lines = text.split('\\n').filter(function(x){ return x.trim(); });
  weights = []; totalW = 0;
  lines.forEach(function(l){ totalW += l.length; weights.push(totalW); });
  $('tr').innerHTML = lines.map(function(l, i){ return '<div class="ln" data-i="' + i + '">' + esc(l) + '</div>'; }).join('');
  Array.prototype.forEach.call($('tr').children, function(el){
    el.addEventListener('click', function(){ seekFrac((weights[el.dataset.i-1] || 0) / totalW); });
  });
}
function lineAt(frac){
  var w = frac * totalW;
  for (var i = 0; i < weights.length; i++) if (w < weights[i]) return i;
  return weights.length - 1;
}
function paintLines(){
  if (!audio.duration || !lines.length) return;
  var idx = lineAt(audio.currentTime / audio.duration);
  if (idx === curLine) return;
  curLine = idx;
  Array.prototype.forEach.call($('tr').children, function(el, i){
    el.className = 'ln' + (i < idx ? ' past' : i === idx ? ' cur' : '');
  });
  if (Date.now() > manualUntil) {
    var el = $('tr').children[idx], box = $('tr');
    box.scrollTo({ top: el.offsetTop - box.clientHeight * 0.35, behavior: 'smooth' });
  }
}
$('tr').addEventListener('wheel', function(){ manualUntil = Date.now() + 4000; }, { passive: true });
$('tr').addEventListener('touchstart', function(){ manualUntil = Date.now() + 4000; }, { passive: true });

/* ---------- 波形 ---------- */
function pseudoPeaks(n){
  var a = [];
  for (var i = 0; i < n; i++) a.push(0.22 + 0.78 * Math.abs(Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.53) * 0.4));
  return a;
}
function loadPeaks(src){
  var n = 72;
  peaks = pseudoPeaks(n); drawWave();
  if (!window.AudioContext && !window.webkitAudioContext) return;
  fetch(src).then(function(r){ return r.arrayBuffer(); }).then(function(buf){
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = new AC();
    return ctx.decodeAudioData(buf).then(function(ab){
      var ch = ab.getChannelData(0), per = Math.floor(ch.length / n), out = [], mx = 0;
      for (var i = 0; i < n; i++) {
        var p = 0, start = i * per, step = Math.max(1, Math.floor(per / 200));
        for (var j = start; j < start + per; j += step) { var v = Math.abs(ch[j]); if (v > p) p = v; }
        out.push(p); if (p > mx) mx = p;
      }
      peaks = out.map(function(p){ return 0.12 + 0.88 * (p / (mx || 1)); });
      drawWave(); ctx.close();
    });
  }).catch(function(){});
}
function drawWave(){
  var cv = $('wave'), dpr = window.devicePixelRatio || 1;
  var W = cv.clientWidth, H = cv.clientHeight;
  if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr;
  var g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  var n = peaks.length, bw = W / n, frac = audio.duration ? audio.currentTime / audio.duration : 0;
  for (var i = 0; i < n; i++) {
    var h = Math.max(3, peaks[i] * (H - 8)), x = i * bw + bw * 0.22, y = (H - h) / 2;
    g.fillStyle = (i / n <= frac) ? '#ff5a36' : 'rgba(255,90,54,.32)';
    if (g.roundRect) { g.beginPath(); g.roundRect(x, y, bw * 0.56, h, bw * 0.28); g.fill(); }
    else g.fillRect(x, y, bw * 0.56, h);
  }
  g.fillStyle = '#fff'; g.fillRect(frac * W - 1, 0, 2, H);
}
function waveFrac(ev){
  var r = $('wave').getBoundingClientRect();
  return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
}
function seekFrac(f){ if (audio.duration) { audio.currentTime = f * audio.duration; paintTimes(); drawWave(); paintLines(); } }
$('wave').addEventListener('pointerdown', function(ev){ dragging = true; $('wave').setPointerCapture(ev.pointerId); seekFrac(waveFrac(ev)); });
$('wave').addEventListener('pointermove', function(ev){ if (dragging) seekFrac(waveFrac(ev)); });
$('wave').addEventListener('pointerup', function(){ dragging = false; });
window.addEventListener('resize', drawWave);

/* ---------- 播放控制 ---------- */
function paintTimes(){
  $('tCur').textContent = fmt(audio.currentTime);
  $('tLeft').textContent = '-' + fmt(audio.duration - audio.currentTime);
}
function paintPlay(){
  $('iPlay').style.display = audio.paused ? 'block' : 'none';
  $('iPause').style.display = audio.paused ? 'none' : 'block';
}
audio.addEventListener('loadedmetadata', function(){ paintTimes(); drawWave(); paintLines(); });
audio.addEventListener('timeupdate', function(){ paintTimes(); drawWave(); paintLines(); });
audio.addEventListener('play', paintPlay);
audio.addEventListener('pause', paintPlay);
audio.addEventListener('ended', paintPlay);
audio.addEventListener('error', function(){ toast('音频还没生成或加载失败'); });
$('playBtn').addEventListener('click', function(){ audio.paused ? audio.play().catch(function(){ toast('播放被拦截，请再点一次'); }) : audio.pause(); });
$('back15').addEventListener('click', function(){ audio.currentTime = Math.max(0, audio.currentTime - 15); });
$('fwd30').addEventListener('click', function(){ audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30); });
$('rateBtn').addEventListener('click', function(){
  rateIdx = (rateIdx + 1) % rates.length;
  audio.playbackRate = rates[rateIdx];
  $('rateBtn').querySelector('text').textContent = (rates[rateIdx] + 'x').replace('.0x', 'x').replace('.25x', '.25x');
  toast('倍速 ' + rates[rateIdx] + 'x');
});
$('likeBtn').addEventListener('click', function(){
  var on = $('likeBtn').classList.toggle('on');
  $('likeBtn').style.color = on ? '#ff5a36' : '';
  toast(on ? '已赞本期节目' : '取消赞');
});

/* ---------- 顶栏 / 稿区开关 ---------- */
$('foldBtn').addEventListener('click', function(){ document.body.classList.toggle('no-tr'); });
$('trClose').addEventListener('click', function(){ document.body.classList.add('no-tr'); });
$('trBig').addEventListener('click', function(){ document.body.classList.toggle('big-tr'); setTimeout(drawWave, 50); });
var favKey = 'fav-' + CONF.kind;
if (localStorage.getItem(favKey)) $('favBtn').classList.add('on');
$('favBtn').addEventListener('click', function(){
  var on = $('favBtn').classList.toggle('on');
  on ? localStorage.setItem(favKey, '1') : localStorage.removeItem(favKey);
  toast(on ? '已收藏' : '取消收藏');
});
$('shareBtn').addEventListener('click', function(){
  var url = location.origin + (CONF.kind === 'morning' ? '/' : '/creator/');
  if (navigator.share) navigator.share({ title: document.title, url: url }).catch(function(){});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function(){ toast('链接已复制'); });
  else toast(url);
});

/* ---------- 弹层 ---------- */
function openSheet(title, html){ $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheet').classList.add('open'); }
$('sheetClose').addEventListener('click', function(){ $('sheet').classList.remove('open'); });
$('sheet').addEventListener('click', function(ev){ if (ev.target === $('sheet')) $('sheet').classList.remove('open'); });
$('listBtn').addEventListener('click', function(){
  var rows = [
    { href: '/', cover: '知乎<br>早报', t: '知乎早报 · 每日热榜语音版', s: '每天 07:30 更新', cur: CONF.kind === 'morning' },
    { href: '/creator/', cover: '创作<br>周报', t: '创作周报 · 数据与建议语音版', s: '每周一 08:00 更新', cur: CONF.kind === 'creator' }
  ];
  openSheet('播放列表', rows.map(function(r){
    return '<div class="row" style="display:flex;gap:12px;align-items:center;cursor:pointer" data-href="' + r.href + '"><div style="flex:0 0 44px;width:44px;height:44px;border-radius:6px;background:' + (r.cur ? '#ff5a36' : 'rgba(255,255,255,.12)') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;text-align:center;line-height:1.2">' + r.cover + '</div><div style="min-width:0"><div class="t">' + r.t + (r.cur ? ' <span style="color:#ff5a36;font-size:13px">· 正在播放</span>' : '') + '</div><div class="s">' + r.s + '</div></div></div>';
  }).join(''));
  Array.prototype.forEach.call($('sheetBody').querySelectorAll('[data-href]'), function(el){
    el.addEventListener('click', function(){ location.href = el.dataset.href; });
  });
});
$('infoBtn').addEventListener('click', function(){
  if (!D) { toast('数据加载中'); return; }
  var h = '';
  if (CONF.kind === 'creator') {
    var T = D.totals;
    h += '<div class="cards">' + [['总浏览',T.view],['赞同',T.up],['收藏',T.collect],['转发',T.share],['评论',T.comment],['涨粉',T.followers]].map(function(c){ return '<div class="card"><div class="v">' + c[1].toLocaleString() + '</div><div class="k">' + c[0] + '</div></div>'; }).join('') + '</div>';
    h += '<h3 class="sec">建议</h3>' + (D.suggestions.map(function(s){ return '<div class="tip">' + esc(s) + '</div>'; }).join('') || '<div class="tip">暂无建议</div>');
    h += '<h3 class="sec">流量来源</h3>' + D.sources.map(function(s){ return '<div class="src"><span class="n">' + esc(s.name) + '</span><div class="track"><div class="fill" style="width:' + Math.round(s.ratio*100) + '%"></div></div><span class="p">' + (s.ratio*100).toFixed(1) + '%</span></div>'; }).join('');
    h += '<h3 class="sec">读者画像</h3><div class="chips">' + D.age.map(function(a){ return '<span class="chip2">' + esc(a.name) + ' ' + a.count + '人</span>'; }).join('') + D.location.map(function(l){ return '<span class="chip2">' + esc(l.name) + ' ' + l.count + '人</span>'; }).join('') + '</div>';
  }
  h += '<h3 class="sec">关于本期</h3><div class="tip">生成时间：' + esc(D.generated) + '</div>' +
       '<div class="tip">' + (CONF.kind === 'morning' ? '内容来自知乎热榜高赞回答的 AI 总结，仅供快速了解，详情以知乎原文为准。每天北京时间 07:30 自动更新。' : '数据来自知乎开放平台本人创作统计，规则建议仅供参考。每周一北京时间 08:00 自动更新。') + '</div>' +
       '<div class="tip">行车中请勿操作屏幕；建议驻车时播放，音频通过车机媒体通道输出。歌词高亮按字数估算，仅供参考。</div>';
  openSheet('节目信息', h);
});
$('tocBtn').addEventListener('click', function(){
  if (!D) { toast('数据加载中'); return; }
  if (CONF.kind === 'morning') {
    openSheet('本期目录（点按跳转）', D.items.map(function(it, i){
      var f = (weights[i] || 0) / totalW;
      return '<div class="row"><div class="t">' + (i+1) + '. ' + esc(it.title) + '</div><div class="s">' + esc(it.summary) + '</div><div class="acts"><button class="mini hot" data-f="' + f + '">从这里播放</button><a class="mini" href="' + esc(it.url) + '" target="_blank" rel="noopener">知乎原文 ↗</a></div></div>';
    }).join(''));
    Array.prototype.forEach.call($('sheetBody').querySelectorAll('[data-f]'), function(el){
      el.addEventListener('click', function(){ $('sheet').classList.remove('open'); seekFrac(parseFloat(el.dataset.f)); audio.play().catch(function(){}); });
    });
  } else {
    openSheet('单篇表现（按浏览排序）', D.items.map(function(it){
      return '<div class="row"><div class="t"><span style="color:#ff5a36;font-size:13px;margin-right:6px">' + esc(it.type) + '</span><a href="' + esc(it.url) + '" target="_blank" rel="noopener" style="color:inherit">' + esc(it.title) + '</a></div><div class="s">' + esc(it.created) + ' · 浏览 ' + it.view.toLocaleString() + ' · 赞同 ' + it.up + ' · 收藏 ' + it.collect + ' · 转发 ' + it.share + (it.has_stats ? '' : ' · 统计缺失') + '</div></div>';
    }).join(''));
  }
});

/* ---------- 启动 ---------- */
fetch(CONF.api).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
  if (!d) { $('pillTxt').textContent = '本期尚未生成'; $('epTitle').textContent = '本期尚未生成'; return; }
  D = d;
  if (CONF.kind === 'morning') {
    var p = d.date.split('-'), m = +p[1], dd = +p[2];
    var doy = Math.floor((Date.UTC(+p[0], m-1, dd) - Date.UTC(+p[0], 0, 0)) / 86400000);
    $('pillTxt').textContent = m + '月' + dd + '日 · 生成于 ' + d.generated.slice(11);
    $('epTitle').textContent = '#' + doy + ' 知乎早报 · ' + d.items.length + '条热榜';
    $('epShow').textContent = '知乎早报 | 语音版';
    $('cover').innerHTML = '知乎<br>早报';
    $('tocN').textContent = d.items.length;
    document.title = '知乎早报 · ' + m + '月' + dd + '日';
  } else {
    $('pillTxt').textContent = '近' + d.days + '天 · 生成于 ' + d.generated.slice(11);
    $('epTitle').textContent = '创作周报 · ' + d.counts.answer + '篇回答 / ' + d.counts.pin + '条想法';
    $('epShow').textContent = '知乎创作 | 周报语音版';
    $('cover').innerHTML = '创作<br>周报';
    $('tocN').textContent = d.items.length;
    document.title = '创作周报 · 知乎看板';
  }
  buildLines(d.text);
  audio.src = CONF.audio;
  loadPeaks(CONF.audio);
  paintTimes();
  paintLines();
}).catch(function(){ $('pillTxt').textContent = '加载失败，请刷新'; });
`;

function page(kind) {
  const conf =
    kind === "morning"
      ? { kind: "morning", api: "/api/morning", audio: "/audio/morning.mp3" }
      : { kind: "creator", api: "/api/creator", audio: "/audio/weekly.mp3" };
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0d0c">
<title>${kind === "morning" ? "知乎早报 · 语音版" : "创作周报 · 知乎看板"}</title>
<style>${CSS}</style></head><body class="${kind}">
${BODY}
<script>
window.PAGE_CONF = ${JSON.stringify(conf)};
${JS}
</script></body></html>`;
}

export function morningPage() {
  return page("morning");
}

export function creatorPage() {
  return page("creator");
}