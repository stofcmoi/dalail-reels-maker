// صانع ريلز دلائل الخيرات (Static + Vercel API + FFmpeg WASM)
import { FFmpeg } from "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js";

const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
const toast = (msg) => {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(()=>toastEl.classList.remove("show"), 2400);
};

const COLORS = ["#0B1220","#0E1A30","#121A2A","#0D2A2D","#1B1323","#24140F","#1B1F12","#161616","#0F2437","#12213C","#1A1A2E","#2A1A12"];
let bgColor = COLORS[1];
let bgImage = null; // Image object
let loadedPart = null; // { part, titleAr, items:[{idx, ar, tr:{en,fr}}] }

const readers = [
  { id:"r1", name:"قارئ 1", audioParts: { "1":"", "2":"", "3":"", "4":"", "5":"", "6":"", "7":"", "8":"" } }
];
// يمكن تعديل readers داخل data/readers.json لاحقاً. هنا default بسيط.

function fillParts(sel){
  sel.innerHTML="";
  for(let i=1;i<=8;i++){
    const o=document.createElement("option");
    o.value=String(i);
    o.textContent=`الحزب ${i}`;
    sel.appendChild(o);
  }
}
fillParts($("partSelect"));
fillParts($("admPart"));

function fillReaders(){
  const sel=$("readerSelect");
  sel.innerHTML="";
  for(const r of readers){
    const o=document.createElement("option");
    o.value=r.id;
    o.textContent=r.name;
    sel.appendChild(o);
  }
}
fillReaders();

function fillSwatches(){
  const wrap=$("swatches");
  wrap.innerHTML="";
  COLORS.forEach((c, i)=>{
    const d=document.createElement("div");
    d.className="sw"+(c===bgColor?" sel":"");
    d.style.background=c;
    d.title=c;
    d.onclick=()=>{ bgColor=c; bgImage=null; [...wrap.children].forEach(x=>x.classList.remove("sel")); d.classList.add("sel"); renderPreview(); };
    wrap.appendChild(d);
  });
}
fillSwatches();

$("bgUpload").addEventListener("change", async (e)=>{
  const f=e.target.files?.[0];
  if(!f) return;
  const url=URL.createObjectURL(f);
  const img=new Image();
  img.onload=()=>{ bgImage=img; renderPreview(); };
  img.src=url;
});

function getRange(){
  const from = parseInt($("fromIdx").value||"1",10);
  const to = parseInt($("toIdx").value||String(from),10);
  return {from, to};
}

function currentReader(){
  const id = $("readerSelect").value;
  return readers.find(r=>r.id===id) || readers[0];
}

function ensureRangeSelects(){
  const from=$("fromIdx");
  const to=$("toIdx");
  from.innerHTML=""; to.innerHTML="";
  if(!loadedPart){ return; }
  for(const it of loadedPart.items){
    const o1=document.createElement("option");
    o1.value=String(it.idx);
    o1.textContent=String(it.idx);
    from.appendChild(o1);

    const o2=document.createElement("option");
    o2.value=String(it.idx);
    o2.textContent=String(it.idx);
    to.appendChild(o2);
  }
  from.value="1";
  to.value="1";
}

$("fromIdx").addEventListener("change", ()=>{
  const {from}=getRange();
  if(parseInt($("toIdx").value,10) < from) $("toIdx").value=String(from);
  renderPreview();
});
$("toIdx").addEventListener("change", renderPreview);
$("trLang").addEventListener("change", renderPreview);
$("showMeta").addEventListener("change", renderPreview);
$("fontSize").addEventListener("input", renderPreview);
$("textColor").addEventListener("input", renderPreview);
$("shadow").addEventListener("input", renderPreview);
$("readerSelect").addEventListener("change", renderPreview);
$("partSelect").addEventListener("change", ()=>{ loadedPart=null; $("fromIdx").innerHTML=""; $("toIdx").innerHTML=""; renderPreview(); });

async function loadPart(part){
  toast("جاري جلب النص...");
  const res = await fetch(`/api/part?part=${encodeURIComponent(part)}`);
  if(!res.ok){
    throw new Error("فشل جلب النص. تحقق من الاتصال.");
  }
  const data = await res.json();
  loadedPart = data;
  ensureRangeSelects();
  toast("تم تحميل النص");
  renderPreview();
}

$("loadBtn").addEventListener("click", async ()=>{
  try{ await loadPart($("partSelect").value); }
  catch(e){ toast(e.message || String(e)); }
});

function wrapText(ctx, text, x, y, maxW, lineH){
  const words = text.split(/\s+/).filter(Boolean);
  let line="";
  const lines=[];
  for(const w of words){
    const test = line ? (line+" "+w) : w;
    if(ctx.measureText(test).width > maxW && line){
      lines.push(line);
      line = w;
    }else{
      line = test;
    }
  }
  if(line) lines.push(line);
  lines.forEach((ln,i)=>ctx.fillText(ln, x, y + i*lineH));
  return lines.length;
}

function renderPreview(){
  const c=$("preview");
  const ctx=c.getContext("2d");
  const W=c.width, H=c.height;

  // background
  ctx.clearRect(0,0,W,H);
  if(bgImage){
    // cover
    const iw=bgImage.width, ih=bgImage.height;
    const scale = Math.max(W/iw, H/ih);
    const dw=iw*scale, dh=ih*scale;
    const dx=(W-dw)/2, dy=(H-dh)/2;
    ctx.drawImage(bgImage, dx, dy, dw, dh);
    // dark overlay for readability
    ctx.fillStyle="rgba(0,0,0,.45)";
    ctx.fillRect(0,0,W,H);
  }else{
    ctx.fillStyle=bgColor;
    ctx.fillRect(0,0,W,H);
    // subtle pattern
    ctx.globalAlpha=0.10;
    ctx.strokeStyle="rgba(215,178,74,.45)";
    ctx.lineWidth=2;
    const step=120;
    for(let y=40;y<H;y+=step){
      for(let x=40;x<W;x+=step){
        ctx.beginPath();
        ctx.arc(x,y,22,0,Math.PI*2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
  }

  // vignette
  const g = ctx.createRadialGradient(W/2,H/2,200,W/2,H/2,1000);
  g.addColorStop(0,"rgba(0,0,0,0)");
  g.addColorStop(1,"rgba(0,0,0,0.55)");
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);

  // content box
  ctx.fillStyle="rgba(10,18,32,.55)";
  roundRect(ctx, 70, 210, W-140, H-420, 44);
  ctx.fill();
  ctx.strokeStyle="rgba(215,178,74,.25)";
  ctx.lineWidth=3;
  roundRect(ctx, 70, 210, W-140, H-420, 44);
  ctx.stroke();

  // meta
  const showMeta = $("showMeta").checked;
  const readerName = currentReader()?.name || "";
  const partNum = $("partSelect").value;
  if(showMeta){
    ctx.font = '700 42px "Cairo"';
    ctx.fillStyle="rgba(246,215,122,.95)";
    ctx.textAlign="center";
    ctx.fillText(`دلائل الخيرات • الحزب ${partNum}`, W/2, 150);
    ctx.font = '600 30px "Cairo"';
    ctx.fillStyle="rgba(233,238,248,.85)";
    ctx.fillText(readerName, W/2, 190);
  }

  // text
  const fs = parseInt($("fontSize").value,10);
  const shadow = parseInt($("shadow").value,10);
  const tc = $("textColor").value;

  const {from,to} = getRange();
  const items = loadedPart?.items || [];
  const selected = items.filter(it=>it.idx>=from && it.idx<=to);
  const arText = selected.map(it=>it.ar).join("\n\n");
  const lang = $("trLang").value;
  const trText = (lang==="none") ? "" : selected.map(it=>(it.tr?.[lang]||"")).filter(Boolean).join("\n\n");

  ctx.textAlign="center";
  ctx.fillStyle=tc;
  ctx.shadowColor="rgba(0,0,0,.75)";
  ctx.shadowBlur=shadow;
  ctx.font = `700 ${fs}px "Amiri"`;

  const maxW = W-220;
  const startY = 360;
  let y = startY;
  const lineH = Math.round(fs*1.25);

  if(!loadedPart){
    ctx.shadowBlur=0;
    ctx.font='700 54px "Cairo"';
    ctx.fillStyle="rgba(233,238,248,.9)";
    ctx.fillText("اضغط: جلب نص الحزب", W/2, H/2-10);
    ctx.font='400 30px "Cairo"';
    ctx.fillStyle="rgba(170,182,211,.9)";
    ctx.fillText("ثم اختر نطاق الجمل والخلفية والصوت", W/2, H/2+50);
    return;
  }

  if(!selected.length){
    ctx.shadowBlur=0;
    ctx.font='700 44px "Cairo"';
    ctx.fillStyle="rgba(233,238,248,.9)";
    ctx.fillText("اختر من/إلى", W/2, H/2);
    return;
  }

  // draw Arabic with manual wrapping per paragraph
  const paragraphs = arText.split("\n\n");
  for(const p of paragraphs){
    const lines = wrapLines(ctx, p, maxW);
    for(const ln of lines){
      ctx.fillText(ln, W/2, y);
      y += lineH;
    }
    y += Math.round(lineH*0.65);
  }

  // translation
  if(trText){
    ctx.shadowBlur=0;
    ctx.font = `600 ${Math.max(28, Math.round(fs*0.45))}px "Cairo"`;
    ctx.fillStyle="rgba(233,238,248,.88)";
    const tparas = trText.split("\n\n");
    y += 20;
    for(const p of tparas){
      const lines = wrapLines(ctx, p, maxW);
      for(const ln of lines){
        ctx.fillText(ln, W/2, y);
        y += Math.round(parseInt(ctx.font.match(/\d+/)[0],10)*1.35);
      }
      y += 18;
    }
  }

  // footer watermark
  ctx.shadowBlur=0;
  ctx.font='600 26px "Cairo"';
  ctx.fillStyle="rgba(246,215,122,.65)";
  ctx.fillText("صانع ريلز دلائل الخيرات", W/2, H-80);
}

function wrapLines(ctx, text, maxW){
  const words = text.split(/\s+/).filter(Boolean);
  const lines=[];
  let line="";
  for(const w of words){
    const test = line ? (line+" "+w) : w;
    if(ctx.measureText(test).width > maxW && line){
      lines.push(line);
      line = w;
    }else{
      line = test;
    }
  }
  if(line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

renderPreview();

/* -------------------- الصوت: معاينة مقطع -------------------- */

async function fetchTimings(part){
  // يبحث عن توقيتات في localStorage أو /timings/timings_partX.json
  const key = `timings_part_${part}`;
  const local = localStorage.getItem(key);
  if(local) return JSON.parse(local);

  try{
    const res = await fetch(`/timings/timings_part${part}.json`, {cache:"no-store"});
    if(res.ok) return res.json();
  }catch(_){}
  return null;
}

function getSegmentFromTimings(timings, from, to){
  if(!timings?.items?.length) return null;
  const a = timings.items.find(x=>x.idx===from);
  const b = timings.items.find(x=>x.idx===to);
  if(!a || !b) return null;
  const start = a.start;
  const end = b.end;
  if(!(start>=0) || !(end>start)) return null;
  return {start, end, duration: end-start};
}

$("playPreview").addEventListener("click", async ()=>{
  try{
    if(!loadedPart) return toast("حمّل النص أولًا");
    const part = $("partSelect").value;
    const {from,to}=getRange();
    const timings = await fetchTimings(part);
    if(!timings) return toast("لا توجد توقيتات لهذا الحزب بعد. أنشئها من صفحة Admin.");
    const seg = getSegmentFromTimings(timings, from, to);
    if(!seg) return toast("نطاق الجمل لا يطابق التوقيتات.");
    const r = currentReader();
    const url = r?.audioParts?.[part];
    if(!url) return toast("ضع رابط mp3 للحزب في readers.json لاحقًا.");
    const a = $("audioEl");
    a.src = url;
    await a.play().catch(()=>{});
    a.currentTime = seg.start + 0.01;
    await a.play().catch(()=>{});
    const stopAt = seg.end;
    clearInterval(a._i);
    a._i = setInterval(()=>{
      if(a.currentTime >= stopAt){
        a.pause();
        clearInterval(a._i);
      }
    }, 90);
    toast("تشغيل معاينة...");
  }catch(e){
    toast(e.message || String(e));
  }
});
$("stopPreview").addEventListener("click", ()=>{
  const a = $("audioEl");
  a.pause();
  clearInterval(a._i);
});

/* -------------------- Admin timings -------------------- */
let admPartData=null;
let currentIdx=1;
let markS=null, markE=null;

$("admLoad").addEventListener("click", async ()=>{
  try{
    await loadAdminPart($("admPart").value);
  }catch(e){ toast(e.message || String(e)); }
});

async function loadAdminPart(part){
  toast("جلب النص...");
  const res = await fetch(`/api/part?part=${encodeURIComponent(part)}`);
  if(!res.ok) throw new Error("فشل جلب النص");
  admPartData = await res.json();
  currentIdx = 1;
  renderSentenceList();
  toast("تم");
}

function renderSentenceList(){
  const list=$("sentenceList");
  list.innerHTML="";
  if(!admPartData){ list.innerHTML = `<div class="item"><div class="m">حمّل الحزب من زر "جلب"</div></div>`; return; }
  for(const it of admPartData.items){
    const div=document.createElement("div");
    div.className="item"+(it.idx===currentIdx?" sel":"");
    div.onclick=()=>{ currentIdx=it.idx; [...list.children].forEach(x=>x.classList.remove("sel")); div.classList.add("sel"); resetMarks(false); };
    div.innerHTML = `<div class="a">${escapeHtml(it.ar)}</div><div class="m">الجملة رقم: ${it.idx}</div>`;
    list.appendChild(div);
  }
}

function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function resetMarks(clearStored=true){
  markS=null; markE=null;
  $("startVal").textContent="—";
  $("endVal").textContent="—";
  if(clearStored){
    // no-op
  }
}

$("admPlay").addEventListener("click", async ()=>{
  const a=$("admAudio");
  const url=$("admMp3").value.trim();
  if(!url) return toast("ضع رابط mp3");
  a.src=url;
  await a.play().catch(()=>{});
});
$("admPause").addEventListener("click", ()=>$("admAudio").pause());
$("admStop").addEventListener("click", ()=>{
  const a=$("admAudio");
  a.pause(); a.currentTime=0;
});

$("markStart").addEventListener("click", ()=>{
  const t=$("admAudio").currentTime || 0;
  markS = t;
  $("startVal").textContent = fmt(t);
});
$("markEnd").addEventListener("click", ()=>{
  const t=$("admAudio").currentTime || 0;
  markE = t;
  $("endVal").textContent = fmt(t);
});

function fmt(t){
  const m=Math.floor(t/60);
  const s=(t%60).toFixed(2).padStart(5,"0");
  return `${m}:${s}`;
}

function timingsKey(part){ return `timings_part_${part}`; }

$("saveTiming").addEventListener("click", ()=>{
  const part=$("admPart").value;
  if(!(markS!=null && markE!=null && markE>markS)) return toast("حدد start ثم end بشكل صحيح");
  const key=timingsKey(part);
  const existing = localStorage.getItem(key);
  const obj = existing ? JSON.parse(existing) : { part: parseInt(part,10), items: [] };
  // upsert
  const rec = { idx: currentIdx, start: +markS.toFixed(3), end: +markE.toFixed(3) };
  const i = obj.items.findIndex(x=>x.idx===currentIdx);
  if(i>=0) obj.items[i]=rec; else obj.items.push(rec);
  obj.items.sort((a,b)=>a.idx-b.idx);
  localStorage.setItem(key, JSON.stringify(obj));
  toast(`حُفظت توقيتات الجملة ${currentIdx}`);
  // move next
  if(admPartData){
    const max = admPartData.items.length;
    if(currentIdx < max) currentIdx++;
    renderSentenceList();
    resetMarks(false);
  }
});

$("clearTiming").addEventListener("click", resetMarks);

$("downloadTimings").addEventListener("click", ()=>{
  const part=$("admPart").value;
  const key=timingsKey(part);
  const existing = localStorage.getItem(key);
  if(!existing) return toast("لا توجد توقيتات محفوظة بعد");
  const blob = new Blob([existing], {type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`timings_part${part}.json`;
  a.click();
  toast("تم تنزيل JSON");
});

/* -------------------- تصدير MP4 (FFmpeg WASM) -------------------- */
let ffmpeg = null;
let ffReady = false;

async function ensureFFmpeg(){
  if(ffReady) return;
  toast("تحميل FFmpeg...");
  ffmpeg = new FFmpeg({ log: false });
  // load core from CDN (single-thread) to avoid COOP/COEP requirements
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
  });
  ffReady = true;
  toast("FFmpeg جاهز");
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

$("exportBtn").addEventListener("click", async ()=>{
  const hint=$("exportHint");
  hint.textContent="";
  try{
    if(!loadedPart) return toast("حمّل النص أولاً");
    const part = $("partSelect").value;
    const {from,to}=getRange();
    const timings = await fetchTimings(part);
    if(!timings) return toast("لا توجد توقيتات لهذا الحزب بعد (Admin).");
    const seg = getSegmentFromTimings(timings, from, to);
    if(!seg) return toast("نطاق الجمل لا يطابق التوقيتات.");
    const r = currentReader();
    const mp3Url = r?.audioParts?.[part];
    if(!mp3Url) return toast("ضع رابط mp3 للحزب في readers.json لاحقاً.");

    await ensureFFmpeg();

    // Render one frame from canvas
    renderPreview();
    const canvas = $("preview");
    const pngBlob = await new Promise(res=>canvas.toBlob(res, "image/png"));
    if(!pngBlob) throw new Error("فشل إنشاء الصورة");

    hint.textContent = "جاري تنزيل الصوت...";
    const audioData = await fetchFile(mp3Url); // requires CORS
    await ffmpeg.writeFile("full.mp3", audioData);
    await ffmpeg.writeFile("frame.png", await fetchFile(pngBlob));

    // Trim audio (re-encode to AAC for mp4 container)
    hint.textContent = "قص الصوت...";
    const ss = seg.start.toFixed(3);
    const dur = seg.duration.toFixed(3);

    await ffmpeg.exec([
      "-ss", ss,
      "-t", dur,
      "-i", "full.mp3",
      "-c:a", "aac",
      "-b:a", "128k",
      "seg.m4a"
    ]);

    // Create video from single frame
    hint.textContent = "إنشاء الفيديو...";
    // 30fps, duration = dur
    await ffmpeg.exec([
      "-loop", "1",
      "-i", "frame.png",
      "-t", dur,
      "-r", "30",
      "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "vid.mp4"
    ]);

    // Mux audio + video
    hint.textContent = "دمج الصوت والنص...";
    await ffmpeg.exec([
      "-i", "vid.mp4",
      "-i", "seg.m4a",
      "-c:v", "copy",
      "-c:a", "aac",
      "-shortest",
      "out.mp4"
    ]);

    const out = await ffmpeg.readFile("out.mp4");
    const outBlob = new Blob([out.buffer], {type:"video/mp4"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(outBlob);
    a.download = `dalail_part${part}_${from}-${to}.mp4`;
    a.click();
    toast("تم تصدير MP4");

    hint.textContent = "تم. إذا واجهت مشكلة: غالبًا رابط mp3 لا يدعم CORS.";
  }catch(e){
    $("exportHint").textContent = "";
    toast(e.message || String(e));
  }
});
