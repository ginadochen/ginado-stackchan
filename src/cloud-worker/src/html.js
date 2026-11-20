/** 页面外壳：车机宽屏双栏（左 38% 控制面板 + 右 62% 类歌词新闻流），
 *  <900px 自动降级为原单列播客播放器布局。
 *  数据运行时从 /api/* 拉取（KV 中最新一期），音频从 /audio/* 拉取。
 *  支持 Media Session API（方向盘按键联动）。 */

const CSS = `
:root{--bg:#0b0d0c;--bg2:#1E1E22;--text:#f2f2f2;--cur:#ffffff;--past:#585c58;--fut:#8f948f;--accent:#245EF4;--dim:rgba(36,94,244,.32);--pill:rgba(255,255,255,.09);--good:#3fb97f}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{height:100%;width:100%;overflow:hidden;overscroll-behavior:none}
body{background:var(--bg);color:var(--text);font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif}
body::before{content:"";position:fixed;inset:0;background:radial-gradient(60% 45% at 50% 38%,rgba(70,80,60,.35),transparent 70%);pointer-events:none}
#app{position:relative;height:100vh;height:100dvh;width:100vw;max-width:640px;margin:0 auto;display:flex;flex-direction:column;padding:14px 22px calc(14px + env(safe-area-inset-bottom));overflow:hidden}
button{background:none;border:none;color:inherit;font:inherit;cursor:pointer;touch-action:manipulation}
svg{display:block}
.wo{display:none!important}
#left{display:contents}
/* 顶栏 */
#top{display:flex;align-items:center;gap:12px;padding:4px 0 10px;order:0}
#top .sp{flex:1}
.icobtn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#e8e8e8;opacity:.9}
.icobtn:active{background:var(--pill)}
.icobtn svg{width:24px;height:24px;fill:currentColor}
#pill{display:flex;align-items:center;gap:8px;background:var(--pill);border-radius:999px;padding:8px 16px;font-size:14px;color:#cfcfcf}
#pill .dot{width:7px;height:7px;border-radius:50%;background:var(--good);flex:0 0 7px}
/* 歌词稿 / 新闻流 */
#trwrap{position:relative;flex:1;min-height:0;order:1}
#tr{height:100%;overflow-y:auto;scrollbar-width:none;padding:26px 6px 20px;mask-image:linear-gradient(transparent,#000 8%,#000 88%,transparent);-webkit-mask-image:linear-gradient(transparent,#000 8%,#000 88%,transparent);overscroll-behavior:contain}
#tr::-webkit-scrollbar{display:none}
#tr .ln{font-size:21px;line-height:1.6;color:var(--fut);padding:12px 4px;transition:color .3s,font-size .3s,background .3s;cursor:pointer}
#tr .ln.past{color:var(--past)}
#tr .ln.cur{color:var(--cur);font-weight:700;font-size:23px}
#trFloat{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;pointer-events:none}
#trFloat button{pointer-events:auto;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;display:flex;align-items:center;justify-content:center}
#trFloat svg{width:20px;height:20px;fill:currentColor}
body.no-tr #trwrap{display:none}
body.big-tr #tr .ln{font-size:26px}
body.big-tr #tr .ln.cur{font-size:29px}
body.big-tr #meta{display:none}
/* 节目信息（窄屏） */
#meta{display:flex;align-items:center;gap:14px;padding:14px 2px 10px;order:2}
#cover{flex:0 0 56px;width:56px;height:56px;border-radius:8px;background:var(--accent);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;font-size:13px;line-height:1.25;text-align:center}
#meta .tt{min-width:0}
#epTitle{font-size:19px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#epShow{font-size:16px;color:var(--accent);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 播控区 */
#player{order:3}
#times{display:flex;justify-content:space-between;font-size:16px;color:#e6e6e6;font-variant-numeric:tabular-nums;padding:2px 2px 6px}
#wave{width:100%;height:64px;touch-action:none;cursor:pointer;display:block}
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
/* 底栏（窄屏） */
#bot{display:flex;align-items:center;justify-content:space-between;padding:6px 2px 0;order:4}
#listBtn{display:flex;align-items:center;gap:10px;white-space:nowrap;background:var(--pill);border-radius:12px;padding:12px 26px;font-size:16px;color:#e8e8e8}
#listBtn svg{width:20px;height:20px;fill:currentColor}
/* 弹层 */
#sheet{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;z-index:9}
#sheet.open{display:block}
#sheetBox{position:absolute;left:0;right:0;bottom:0;max-width:640px;margin:0 auto;max-height:76vh;max-height:76dvh;background:#161a17;border-radius:20px 20px 0 0;display:flex;flex-direction:column}
#sheetHead{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 10px;font-size:17px;font-weight:600}
#sheetClose{width:44px;height:44px;font-size:24px;color:#aaa}
#sheetBody{overflow-y:auto;padding:0 20px calc(20px + env(safe-area-inset-bottom));font-size:16px;line-height:1.6;overscroll-behavior:contain}
.row{padding:13px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.row:last-child{border-bottom:none}
.row .t{font-weight:600;color:var(--text)}
.row .s{color:#9aa09a;font-size:14px;margin-top:4px}
.row .acts{margin-top:8px;display:flex;gap:10px}
.mini{border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:8px 16px;font-size:14px;color:#ddd}
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

/* ================= 车机宽屏双栏（>=900px） ================= */
@media (min-width:900px){
  body{background:linear-gradient(135deg,#141416 0%,#1E1E22 100%)}
  body::before{background:radial-gradient(50% 60% at 24% 40%,rgba(36,94,244,.05),transparent 70%)}
  .wo{display:flex!important}
  .no{display:none!important}
  #app{flex-direction:row;max-width:none;margin:0;padding:50px 200px;gap:50px;align-items:stretch}
  #left{flex:0 0 38%;min-width:0;display:flex;flex-direction:column;justify-content:space-between}
  #trwrap{flex:1 1 62%;min-width:0;height:100%}
  /* 左栏顶部：日期胶囊 + 收藏 + 倍速 */
  #top{padding:0;gap:14px;transform:translateY(48px)}
  #pill{padding:14px 20px;font-size:16px;min-height:52px}
  #pill:active{background:rgba(255,255,255,.16)}
  .icobtn{width:52px;height:52px}
  .icobtn svg{width:27px;height:27px}
  #rateChip{min-width:76px;height:52px;align-items:center;justify-content:center;background:var(--pill);border-radius:999px;font-size:17px;font-weight:600;color:#e8e8e8;font-variant-numeric:tabular-nums}
  #rateChip:active{background:rgba(255,255,255,.16)}
  /* 左栏中部：封面大卡片 */
  #coverCard{position:relative;flex:0 0 auto;width:50%;min-width:220px;aspect-ratio:1/1;margin:auto;border-radius:22px;background:var(--accent);border:1px solid rgba(255,255,255,.14);padding:22px;flex-direction:column;justify-content:center;align-items:flex-start;overflow:hidden}
  #cardKicker{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:600;color:rgba(255,255,255,.92)}
  .klogo{width:20px;height:20px;flex:0 0 20px}
  #cardEn{font-size:clamp(34px,6vh,54px);font-weight:800;line-height:1.08;color:#fff;margin-top:8px;letter-spacing:.5px}
  #epSub{font-size:15px;color:rgba(255,255,255,.75);margin-top:8px}
  .eq{position:absolute;left:22px;bottom:16px;display:flex;gap:4px;align-items:flex-end;height:18px}
  #mascot{position:absolute;right:24px;bottom:0;width:38%;min-width:70px;max-width:120px;pointer-events:none;transform:scaleX(-1)}
  .eq i{width:5px;height:100%;background:rgba(255,255,255,.9);border-radius:2px;transform:scaleY(.25);transform-origin:bottom;opacity:.85}
  body.playing .eq i{animation:eqb 1.1s ease-in-out infinite}
  body.playing .eq i:nth-child(2){animation-delay:.18s}
  body.playing .eq i:nth-child(3){animation-delay:.36s}
  body.playing .eq i:nth-child(4){animation-delay:.54s}
  body.playing .eq i:nth-child(5){animation-delay:.72s}
  body.playing #coverCard{animation:breath 3.2s ease-in-out infinite}
  @keyframes eqb{0%,100%{transform:scaleY(.25)}50%{transform:scaleY(1)}}
  @keyframes breath{0%,100%{box-shadow:0 0 0 rgba(36,94,244,0)}50%{box-shadow:0 0 36px rgba(36,94,244,.14)}}
  /* 左栏底部：播控 */
  #player{flex:0 0 auto;transform:translateY(-48px)}
  #times{font-size:16px;padding:0 2px 4px;transform:translateY(-48px)}
  #wave{height:54px;transform:translateY(-48px)}
  #ctl{justify-content:center;gap:18px;padding:12px 0 6px;transform:translateY(-48px)}
  #ctl .skip{width:56px;height:56px}
  #ctl .skip svg{width:36px;height:36px}
  #ctl .nav{width:56px;height:56px;align-items:center;justify-content:center;color:#e8e8e8}
  #ctl .nav svg{width:32px;height:32px;fill:currentColor}
  #ctl .nav:active,#ctl .skip:active{background:var(--pill);border-radius:50%}
  #playBtn{width:68px;height:68px;border-radius:50%;background:#fff;color:#141416;flex:0 0 68px}
  #playBtn svg{width:36px;height:36px;fill:currentColor}
  #auxRow{display:flex;align-items:center;gap:14px;margin-top:12px}
  #listBtnW{display:flex;flex:1;min-width:0;height:56px;align-items:center;justify-content:center;gap:10px;line-height:1;background:var(--pill);border-radius:14px;font-size:17px;color:#e8e8e8}
  #listBtnW svg{width:26px;height:26px;flex:0 0 26px;transform:translateY(1px)}
  #listBtnW .txt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #listBtnW:active{background:rgba(255,255,255,.16)}
  .auxbtn{position:relative;display:flex;width:56px;height:56px;flex:0 0 56px;align-items:center;justify-content:center;line-height:1;background:var(--pill);border-radius:14px;color:#e8e8e8}
  .auxbtn svg{width:26px;height:26px;transform:translateY(1px)}
  .auxbtn:active{background:rgba(255,255,255,.16)}
  /* 右栏：类歌词新闻流 */
  #tr{padding:44px 12px}
  #tr .ln{font-size:26px;font-weight:400;line-height:1.55;color:rgba(255,255,255,.42);padding:14px 18px;margin:4px 0;border-radius:14px;border-left:4px solid transparent}
  #tr .ln.past{color:rgba(255,255,255,.42)}
  #tr .ln.cur{font-size:32px;font-weight:700;color:#FFFFFF;background:rgba(255,255,255,.06);border-left-color:var(--accent)}
  /* 弹层：宽屏居中靠下 */
  #sheetBox{left:50%;right:auto;transform:translateX(-50%);bottom:20px;width:min(760px,92vw);max-width:none;margin:0;border-radius:20px;max-height:82vh;max-height:82dvh}
  #sheetHead{font-size:19px;padding:18px 24px 10px}
  #sheetBody{padding:0 24px 24px;font-size:17px}
  #toast{bottom:8dvh;font-size:16px}
}
`;

const BODY = `
<div id="app">
  <div id="left">
    <div id="top">
      <button class="icobtn no" id="foldBtn" aria-label="收起文字稿"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6z"/></svg></button>
      <button id="pill" class="js-list" aria-label="历史期数与播放列表"><span class="dot"></span><span id="pillTxt">加载中…</span></button>
      <div class="sp"></div>
      <button id="rateChip" class="wo" aria-label="倍速切换">1.0x</button>
      <button class="icobtn no" id="shareBtn" aria-label="分享"><svg viewBox="0 0 24 24"><path d="M18 16c-.8 0-1.5.3-2 .8l-7-4.1c.1-.2.1-.5.1-.7s0-.5-.1-.7l7-4.1c.5.5 1.2.8 2 .8 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .2 0 .5.1.7l-7 4.1C7.5 9.3 6.8 9 6 9c-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2-.8l7 4.1c-.1.2-.1.4-.1.7 0 1.6 1.3 2.9 2.9 2.9s2.9-1.3 2.9-2.9-1.2-3-2.7-3z"/></svg></button>
    </div>
    <div id="coverCard" class="wo">
      <div id="cardKicker"><svg class="klogo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.721 0C2.251 0 0 2.25 0 5.719V18.28C0 21.751 2.252 24 5.721 24h12.56C21.751 24 24 21.75 24 18.281V5.72C24 2.249 21.75 0 18.281 0zm1.964 4.078c-.271.73-.5 1.434-.68 2.11h4.587c.545-.006.445 1.168.445 1.171H9.384a58.104 58.104 0 01-.112 3.797h2.712c.388.023.393 1.251.393 1.266H9.183a9.223 9.223 0 01-.408 2.102l.757-.604c.452.456 1.512 1.712 1.906 2.177.473.681.063 2.081.063 2.081l-2.794-3.382c-.653 2.518-1.845 3.607-1.845 3.607-.523.468-1.58.82-2.64.516 2.218-1.73 3.44-3.917 3.667-6.497H4.491c0-.015.197-1.243.806-1.266h2.71c.024-.32.086-3.254.086-3.797H6.598c-.136.406-.158.447-.268.753-.594 1.095-1.603 1.122-1.907 1.155.906-1.821 1.416-3.6 1.591-4.064.425-1.124 1.671-1.125 1.671-1.125zM13.078 6h6.377v11.33h-2.573l-2.184 1.373-.401-1.373h-1.219zm1.313 1.219v8.86h.623l.263.937 1.455-.938h1.456v-8.86z"/></svg><span id="cardKickerTxt">知乎早报</span></div>
      <div id="cardEn">Morning<br>Call</div>
      <div id="epSub">加载中…</div>
      <div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <img id="mascot" src="data:image/png;base64,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" alt="" aria-hidden="true">
    </div>
    <div id="player">
      <div id="times"><span id="tCur">0:00</span><span id="tLeft">-0:00</span></div>
      <canvas id="wave"></canvas>
      <div id="ctl">
        <button class="side no" id="rateBtn" aria-label="倍速"><svg viewBox="0 0 24 24"><path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="12" y="14.5" text-anchor="middle">1x</text></svg></button>
        <button class="skip" id="back15" aria-label="后退15秒"><svg viewBox="0 0 24 24"><path d="M12 4V1L7 5l5 4V6c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7H3c0 5 4 9 9 9s9-4 9-9-4-9-9-9z"/><text x="12" y="16.5" text-anchor="middle" font-size="7.5" font-weight="700">15</text></svg></button>
        <button class="nav wo" id="prevBtn" aria-label="上一条"><svg viewBox="0 0 24 24"><path d="M6 6h2.4v12H6zm3.6 6l8.4 6V6z"/></svg></button>
        <button id="playBtn" aria-label="播放"><svg id="iPlay" viewBox="0 0 24 24"><path d="M7 4l14 8-14 8z"/></svg><svg id="iPause" viewBox="0 0 24 24" style="display:none"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg></button>
        <button class="nav wo" id="nextBtn" aria-label="下一条"><svg viewBox="0 0 24 24"><path d="M15.6 6H18v12h-2.4zM6 6l8.4 6L6 18z"/></svg></button>
        <button class="skip" id="fwd30" aria-label="前进30秒"><svg viewBox="0 0 24 24"><path d="M12 4V1l5 4-5 4V6c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7h2c0 5-4 9-9 9s-9-4-9-9 4-9 9-9z"/><text x="12" y="16.5" text-anchor="middle" font-size="7.5" font-weight="700">30</text></svg></button>
      </div>
      <div id="auxRow" class="wo">
        <button id="listBtnW" class="js-list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path fill="none" d="M4 6h12M4 11h12M4 16h8"/><path fill="none" d="M18 13.5v5l4.5-2.5z"/></svg><span class="txt">播放列表 / 往期早报</span></button>
        <button class="auxbtn js-toc" id="tocBtnW" aria-label="本期目录"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path fill="none" d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg></button>
        <button class="auxbtn js-info" id="infoBtnW" aria-label="节目信息"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" fill="none"/><path fill="none" d="M12 11v5"/><path fill="none" d="M12 7.5h.01"/></svg></button>
      </div>
    </div>
  </div>
  <div id="trwrap">
    <div id="tr"></div>
    <div id="trFloat" class="no">
      <button id="trClose" aria-label="关闭文字稿"><svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/></svg></button>
      <button id="trBig" aria-label="放大文字稿"><svg viewBox="0 0 24 24"><path d="M5 5h5V3H3v7h2zm14 0h-5V3h7v7h-2zM5 19h5v2H3v-7h2zm14 0h-5v2h7v-7h-2z"/></svg></button>
    </div>
  </div>
  <div id="meta" class="no">
    <div id="cover">知乎<br>早报</div>
    <div class="tt"><div id="epTitle">加载中…</div><div id="epShow">知乎早报 | 语音版</div></div>
  </div>
  <div id="bot" class="no">
    <button class="icobtn js-info" id="infoBtn" aria-label="信息"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" fill="none"/><path fill="none" d="M12 11v5"/><path fill="none" d="M12 7.5h.01"/></svg></button>
    <button id="listBtn" class="js-list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path fill="none" d="M4 6h12M4 11h12M4 16h8"/><path fill="none" d="M18 13.5v5l4.5-2.5z"/></svg>播放列表</button>
    <button class="icobtn js-toc" id="tocBtn" aria-label="目录"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path fill="none" d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg></button>
  </div>
</div>
<div id="sheet"><div id="sheetBox">
  <div id="sheetHead"><span id="sheetTitle"></span><button id="sheetClose" aria-label="关闭">×</button></div>
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
var epTitleStr = '', showName = '';
var wideMQ = window.matchMedia('(min-width:900px)');
var $ = function(id){ return document.getElementById(id); };
var esc = function(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
function bindAll(sel, fn){ Array.prototype.forEach.call(document.querySelectorAll(sel), function(el){ el.addEventListener('click', fn); }); }
var toastT = 0;
function toast(msg){ var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove('show'); }, 1800); }
function fmt(s){ if(!isFinite(s) || s < 0) s = 0; s = Math.floor(s); var h = Math.floor(s/3600), m = Math.floor(s%3600/60), ss = s%60; var mm = (h && m < 10 ? '0' : '') + m; return (h ? h + ':' : '') + mm + ':' + (ss<10?'0':'') + ss; }

/* ---------- 歌词稿 / 新闻流 ---------- */
function buildLines(text){
  lines = text.split('\\n').filter(function(x){ return x.trim(); });
  weights = []; totalW = 0;
  lines.forEach(function(l){ totalW += l.length; weights.push(totalW); });
  $('tr').innerHTML = lines.map(function(l, i){ return '<div class="ln" data-i="' + i + '">' + esc(l) + '</div>'; }).join('');
  Array.prototype.forEach.call($('tr').children, function(el){
    el.addEventListener('click', function(){
      manualUntil = 0;
      seekFrac((weights[el.dataset.i-1] || 0) / totalW);
      audio.play().catch(function(){});
    });
  });
}
function lineAt(frac){
  var w = frac * totalW;
  for (var i = 0; i < weights.length; i++) if (w < weights[i]) return i;
  return weights.length - 1;
}
function lineStart(i){ return (weights[i-1] || 0) / totalW; }
function paintLines(){
  if (!audio.duration || !lines.length) return;
  var idx = lineAt(audio.currentTime / audio.duration);
  if (idx === curLine) return;
  curLine = idx;
  Array.prototype.forEach.call($('tr').children, function(el, i){
    el.className = 'ln' + (i < idx ? ' past' : i === idx ? ' cur' : '');
  });
  updateMediaMeta();
  if (Date.now() > manualUntil) {
    var el = $('tr').children[idx], box = $('tr');
    var top = wideMQ.matches
      ? el.offsetTop - (box.clientHeight - el.offsetHeight) / 2
      : el.offsetTop - box.clientHeight * 0.35;
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
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
    g.fillStyle = (i / n <= frac) ? '#245EF4' : 'rgba(36,94,244,.32)';
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
function onLayoutChange(){ drawWave(); curLine = -1; paintLines(); }
if (wideMQ.addEventListener) wideMQ.addEventListener('change', onLayoutChange);
else if (wideMQ.addListener) wideMQ.addListener(onLayoutChange);

/* ---------- 播放控制 ---------- */
function paintTimes(){
  $('tCur').textContent = fmt(audio.currentTime);
  $('tLeft').textContent = '-' + fmt(audio.duration - audio.currentTime);
}
function paintPlay(){
  $('iPlay').style.display = audio.paused ? 'block' : 'none';
  $('iPause').style.display = audio.paused ? 'none' : 'block';
  document.body.classList.toggle('playing', !audio.paused);
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
}
function jumpItem(delta){
  if (!lines.length || !audio.duration) return;
  var idx = Math.min(lines.length - 1, Math.max(0, (curLine < 0 ? 0 : curLine) + delta));
  manualUntil = 0;
  seekFrac(lineStart(idx));
  audio.play().catch(function(){});
}
audio.addEventListener('loadedmetadata', function(){ paintTimes(); drawWave(); paintLines(); });
audio.addEventListener('timeupdate', function(){ paintTimes(); drawWave(); paintLines(); updateMediaPosition(); });
audio.addEventListener('play', paintPlay);
audio.addEventListener('pause', paintPlay);
audio.addEventListener('ended', paintPlay);
audio.addEventListener('error', function(){ toast('音频还没生成或加载失败'); });
$('playBtn').addEventListener('click', function(){ audio.paused ? audio.play().catch(function(){ toast('播放被拦截，请再点一次'); }) : audio.pause(); });
$('back15').addEventListener('click', function(){ audio.currentTime = Math.max(0, audio.currentTime - 15); });
$('fwd30').addEventListener('click', function(){ audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30); });
$('prevBtn').addEventListener('click', function(){ jumpItem(-1); });
$('nextBtn').addEventListener('click', function(){ jumpItem(1); });
function paintRate(){
  var r = rates[rateIdx];
  $('rateBtn').querySelector('text').textContent = (r + 'x').replace('.0x', 'x');
  $('rateChip').textContent = r.toFixed(2).replace(/0$/, '') + 'x';
}
function cycleRate(){
  rateIdx = (rateIdx + 1) % rates.length;
  audio.playbackRate = rates[rateIdx];
  paintRate();
  toast('倍速 ' + rates[rateIdx] + 'x');
}
$('rateBtn').addEventListener('click', cycleRate);
$('rateChip').addEventListener('click', cycleRate);

/* ---------- Media Session（方向盘按键联动） ---------- */
function updateMediaMeta(){
  if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
  var artist = (curLine >= 0 && lines[curLine]) ? lines[curLine].slice(0, 80) : showName;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: epTitleStr || document.title,
    artist: artist,
    album: showName
  });
}
function updateMediaPosition(){
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(audio.currentTime, audio.duration)
    });
  } catch (e) {}
}
if ('mediaSession' in navigator) {
  var ms = navigator.mediaSession;
  var act = function(name, fn){ try { ms.setActionHandler(name, fn); } catch (e) {} };
  act('play', function(){ audio.play().catch(function(){}); });
  act('pause', function(){ audio.pause(); });
  act('previoustrack', function(){ jumpItem(-1); });
  act('nexttrack', function(){ jumpItem(1); });
  act('seekbackward', function(d){ audio.currentTime = Math.max(0, audio.currentTime - ((d && d.seekOffset) || 15)); });
  act('seekforward', function(d){ audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + ((d && d.seekOffset) || 30)); });
  act('seekto', function(d){ if (d && isFinite(d.seekTime) && audio.duration) { audio.currentTime = Math.min(Math.max(0, d.seekTime), audio.duration); paintTimes(); drawWave(); paintLines(); } });
}

/* ---------- 顶栏 / 稿区开关（窄屏） ---------- */
$('foldBtn').addEventListener('click', function(){ document.body.classList.toggle('no-tr'); });
$('trClose').addEventListener('click', function(){ document.body.classList.add('no-tr'); });
$('trBig').addEventListener('click', function(){ document.body.classList.toggle('big-tr'); setTimeout(drawWave, 50); });
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
bindAll('.js-list', function(){
  var rows = [
    { href: '/', cover: '知乎<br>早报', t: '知乎早报 · 每日热榜语音版', s: '每天 07:30 更新', cur: CONF.kind === 'morning' },
    { href: '/creator/', cover: '创作<br>周报', t: '创作周报 · 数据与建议语音版', s: '每周一 08:00 更新', cur: CONF.kind === 'creator' }
  ];
  openSheet('播放列表 / 往期早报', rows.map(function(r){
    return '<div class="row" style="display:flex;gap:12px;align-items:center;cursor:pointer" data-href="' + r.href + '"><div style="flex:0 0 44px;width:44px;height:44px;border-radius:6px;background:' + (r.cur ? '#245EF4' : 'rgba(255,255,255,.12)') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;text-align:center;line-height:1.2">' + r.cover + '</div><div style="min-width:0"><div class="t">' + r.t + (r.cur ? ' <span style="color:#245EF4;font-size:13px">· 正在播放</span>' : '') + '</div><div class="s">' + r.s + '</div></div></div>';
  }).join(''));
  Array.prototype.forEach.call($('sheetBody').querySelectorAll('[data-href]'), function(el){
    el.addEventListener('click', function(){ location.href = el.dataset.href; });
  });
});
bindAll('.js-info', function(){
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
bindAll('.js-toc', function(){
  if (!D) { toast('数据加载中'); return; }
  if (CONF.kind === 'morning') {
    openSheet('本期目录（点按跳转）', D.items.map(function(it, i){
      var f = lineStart(i + 1);
      return '<div class="row"><div class="t">' + (i+1) + '. ' + esc(it.title) + '</div><div class="s">' + esc(it.summary) + '</div><div class="acts"><button class="mini hot" data-f="' + f + '">从这里播放</button><a class="mini" href="' + esc(it.url) + '" target="_blank" rel="noopener">知乎原文 ↗</a></div></div>';
    }).join(''));
    Array.prototype.forEach.call($('sheetBody').querySelectorAll('[data-f]'), function(el){
      el.addEventListener('click', function(){ $('sheet').classList.remove('open'); manualUntil = 0; seekFrac(parseFloat(el.dataset.f)); audio.play().catch(function(){}); });
    });
  } else {
    openSheet('单篇表现（按浏览排序）', D.items.map(function(it){
      return '<div class="row"><div class="t"><span style="color:#245EF4;font-size:13px;margin-right:6px">' + esc(it.type) + '</span><a href="' + esc(it.url) + '" target="_blank" rel="noopener" style="color:inherit">' + esc(it.title) + '</a></div><div class="s">' + esc(it.created) + ' · 浏览 ' + it.view.toLocaleString() + ' · 赞同 ' + it.up + ' · 收藏 ' + it.collect + ' · 转发 ' + it.share + (it.has_stats ? '' : ' · 统计缺失') + '</div></div>';
    }).join(''));
  }
});

/* ---------- 启动 ---------- */
fetch(CONF.api).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
  if (!d) { $('pillTxt').textContent = '本期尚未生成'; $('epTitle').textContent = '本期尚未生成'; $('epSub').textContent = '本期尚未生成'; return; }
  D = d;
  if (CONF.kind === 'morning') {
    var p = d.date.split('-'), m = +p[1], dd = +p[2];
    var doy = Math.floor((Date.UTC(+p[0], m-1, dd) - Date.UTC(+p[0], 0, 0)) / 86400000);
    $('pillTxt').textContent = m + '月' + dd + '日 · 生成于 ' + d.generated.slice(11);
    epTitleStr = '#' + doy + ' 知乎早报 · ' + d.items.length + '条热榜';
    showName = '知乎早报 | 语音版';
    $('epTitle').textContent = epTitleStr;
    $('epShow').textContent = showName;
    $('cover').innerHTML = '知乎<br>早报';
    $('cardKickerTxt').textContent = '知乎早报';
    $('cardEn').innerHTML = 'Morning<br>Call';
    $('epSub').textContent = d.items.length + '条热榜';
    document.title = '知乎早报 · ' + m + '月' + dd + '日';
  } else {
    $('pillTxt').textContent = '近' + d.days + '天 · 生成于 ' + d.generated.slice(11);
    epTitleStr = '创作周报 · ' + d.counts.answer + '篇回答 / ' + d.counts.pin + '条想法';
    showName = '知乎创作 | 周报语音版';
    $('epTitle').textContent = epTitleStr;
    $('epShow').textContent = showName;
    $('cover').innerHTML = '创作<br>周报';
    $('cardKickerTxt').textContent = '创作周报';
    $('cardEn').innerHTML = 'Weekly<br>Report';
    $('epSub').textContent = d.counts.answer + '篇回答 / ' + d.counts.pin + '条想法';
    document.title = '创作周报 · 知乎看板';
  }
  buildLines(d.text);
  audio.src = CONF.audio;
  loadPeaks(CONF.audio);
  paintTimes();
  paintLines();
  updateMediaMeta();
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
<meta name="theme-color" content="#141416">
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