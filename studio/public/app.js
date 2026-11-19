// «ستوديو آية» dashboard — vanilla JS, talks only to the local server.
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const S = {slug: localStorage.getItem('ayah.slug') || '', tab: 'projects', cfg: null, recipes: {}};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2600); };

const api = async (path, opts = {}) => {
  const r = await fetch('/api' + path, opts);
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = txt; }
  if (!r.ok) throw new Error(j?.error || txt);
  return j;
};
const get = (f) => api(`/p/${encodeURIComponent(S.slug)}/file/${f}`).catch(() => null);
const put = (f, data) => api(`/p/${encodeURIComponent(S.slug)}/file/${f}`, {method: 'PUT', body: JSON.stringify(data, null, 2)});
const run = (cmd, body = {}) => api(`/p/${encodeURIComponent(S.slug)}/run/${cmd}`, {method: 'POST', body: JSON.stringify(body)});

const confirmBox = (html, okText = 'موافق') => new Promise((ok) => {
  const d = $('#dlg'); $('#dlgBody').innerHTML = html; $('#dlgOk').textContent = okText;
  const cp = $('#cp', d); if (cp) cp.onclick = () => { navigator.clipboard?.writeText($('#pp', d).value); toast('اتنسخ'); };
  d.returnValue = ''; d.showModal(); d.onclose = () => ok(d.returnValue === 'ok');
});

// wait for a background job, drawing a progress bar in `box`
const follow = async (job, box, label) => {
  box.innerHTML = `<div class="card"><div class="row"><b>${esc(label)}</b><span class="muted grow" id="jl">شغال…</span></div><div class="bar"><i id="jb" style="width:3%"></i></div></div>`;
  for (;;) {
    await new Promise((r) => setTimeout(r, 1200));
    const j = await api('/jobs/' + job.id);
    $('#jb', box).style.width = Math.max(3, j.progress || 0) + '%';
    $('#jl', box).textContent = (j.log || '').trim().split('\n').at(-1)?.slice(0, 120) || '…';
    if (j.status !== 'running') {
      box.innerHTML = j.status === 'done' ? '' : `<div class="card"><b>حصلت مشكلة</b><pre class="muted" style="white-space:pre-wrap">${esc(j.log.slice(-1500))}</pre></div>`;
      return j;
    }
  }
};

// ---------------- optional AI helper box (off unless the user presses it; always shows the cost first) ----------------
const AI_INFO = {
  hadith: ['تحقق من الأحاديث بالـ AI', 'بيبعت الكلام اللي اتسمع والنص المقترح بس، ويرجّع: هل ده حديث، والنص المعروف، والمصدر، والدرجة. <b>الـ AI ممكن يغلط في الأحاديث</b>، فالنتيجة بتظهر جنب الكارت كاقتراح، والتأكيد بيفضل بإيدك. الأضمن إنك تراجع بنفسك من زرار «ابحث في الدرر السنية».'],
  words: ['اقتراحات للكلمات الصفرا', 'بيبعت نص التفريغ بس، ويقترح تصحيح للكلمات اللي التفريغ مش متأكد منها، بنفس لهجة الشيخ. الاقتراح بيظهر وانت تقبله أو ترفضه.'],
  meta: ['العنوان والوصف والتعليق المثبّت', 'بيبعت نص التفريغ بس، ويقترح عنوان ووصف وسؤال للتعليق المثبّت وهاشتاجات. من غير اسم الشيخ.'],
  plan: ['حسّن الستوري بورد بالـ AI', 'بيبعت نص التفريغ بس، والموديل بيختار وصفة لكل مشهد ويقترح الهوك والعنوان والوصف والتعليق المثبّت. التقسيم وكروت الآيات والقواعد الشرعية والرسم بيفضلوا في الأداة والفاحص. الستوري بورد الحالي هيتبدل.'],
  review: ['مراجعة الصور بالـ AI', 'بيبعت صور المشاهد مصغّرة، وموديل بيشوف الصور يدوّر على أي حاجة ممكن تتفهم غلط أو تخالف القواعد. الفاحص بيعمل ده ببلاش للحاجات اللي تتحسب، والـ AI بيكمّل اللي محتاج عين.'],
};
const aiBox = async (task, onDone) => {
  const el = document.createElement('div');
  el.className = 'card ai';
  const est = await api(`/p/${encodeURIComponent(S.slug)}/estimate?task=${task}`).catch(() => null);
  const [title, desc] = AI_INFO[task];
  el.innerHTML = `<div class="row"><h3 class="grow">✨ ${title} (اختياري)</h3><span class="pill warn">بيستخدم AI</span></div>
    <p class="muted">${desc} ${est ? `التقدير: حوالي <b>${est.total.toLocaleString('ar-EG')}</b> توكن.` : ''}</p>
    <div class="row">
      <button class="gold" data-m="claude-code" ${S.cfg.hasClaudeCode ? '' : 'disabled'} title="بيستخدم اشتراكك في Claude عن طريق Claude Code على جهازك، من غير مفتاح">بـ Claude Code (اشتراكك)</button>
      <button data-m="manual" title="تنسخ الطلب وتلصقه في أي شات AI (Claude أو ChatGPT أو Gemini)، وترجع تلصق الرد">انسخ والصق في أي AI</button>
      <button data-m="claude" ${S.cfg.hasClaudeKey ? '' : 'disabled'}>بمفتاح Claude API</button>
      ${task === 'review' ? '' : '<button data-m="local">Ollama على جهازك</button>'}</div>
    ${S.cfg.hasClaudeCode ? '' : '<p class="muted">علشان زرار Claude Code: سطّب Claude Code وسجّل دخول باشتراكك مرة واحدة.</p>'}<div class="j"></div>`;
  el.querySelectorAll('[data-m]').forEach((b) => (b.onclick = async () => {
    const mode = b.dataset.m;
    let answer;
    if (mode === 'manual') {
      const prompt = await fetch(`/api/p/${encodeURIComponent(S.slug)}/prompt?task=${task}`).then((r) => r.text());
      const ok = await confirmBox(`<h3>${title}: انسخ والصق</h3>
        <p class="muted">1) انسخ الطلب ده والصقه في أي شات AI (claude.ai أو غيره) ${task === 'review' ? 'ومعاه صور المشاهد من فولدر المشروع ' : ''}2) انسخ رده كله والصقه تحت.</p>
        <textarea id="pp" readonly style="height:140px;font-size:12px">${esc(prompt)}</textarea>
        <button type="button" id="cp">انسخ الطلب</button>
        <textarea id="pa" placeholder="الصق رد الـ AI هنا" style="height:140px;margin-top:10px"></textarea>`, 'استخدم الرد');
      if (!ok) return;
      answer = $('#pa').value;
      if (!answer.trim()) return toast('ماتلصقش رد');
    } else {
      const where = {claude: 'Claude API بمفتاحك (أونلاين، بيتحسب من رصيد الـ API)', 'claude-code': 'Claude Code باشتراكك (أونلاين، من حدود استخدام اشتراكك)', local: 'Ollama على جهازك (أوفلاين)'}[mode];
      const ok = await confirmBox(`<h3>${title}</h3><p>الخطوة دي بتستخدم AI: ${where}.<br>التقدير: حوالي <b>${est?.total ?? '؟'}</b> توكن.</p>`, 'أيوه كمّل');
      if (!ok) return;
    }
    const j = await run('ai', {task, mode, answer}).catch((e) => toast(e.message));
    if (!j) return;
    const r = await follow(j, $('.j', el), title);
    if (r.status === 'done') { toast('خلص ✨'); onDone?.(); }
  }));
  return el;
};

// ---------------- tabs ----------------
const TABS = {
  async projects() {
    const list = await api('/projects');
    view.innerHTML = `
      <div class="card"><h2>مقطع جديد</h2>
        <div class="drop-zone"><div class="row" style="justify-content:center">
          <input id="nslug" placeholder="اسم المشروع (مثلًا nafs-tatma3)" />
          <input id="nfile" type="file" accept="audio/*,video/*" />
          <button class="primary" id="ngo">استيراد وتفريغ</button></div>
          <p class="muted">mp3 أو mp4 أو wav. التفريغ بيشتغل على جهازك من غير إنترنت، وبياخد دقايق حسب طول المقطع.</p></div>
        <div id="njob"></div></div>
      <div class="card"><h2>المشاريع</h2><table><tr><th>المشروع</th><th>المرحلة</th><th>المدة</th><th></th></tr>
        ${list.map((p) => `<tr><td><b>${esc(p.slug)}</b></td><td><span class="pill">${esc(p.stage)}</span></td><td>${p.duration ? fmt(p.duration) : ''}</td>
          <td><button data-open="${esc(p.slug)}">افتح</button></td></tr>`).join('') || '<tr><td colspan=4 class="muted">مفيش مشاريع لسه</td></tr>'}</table></div>`;
    view.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openProject(b.dataset.open)));
    $('#ngo').onclick = async () => {
      const slug = $('#nslug').value.trim(), f = $('#nfile').files[0];
      if (!slug || !f) return toast('اكتب اسم واختار ملف');
      const r = await api(`/projects?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(f.name)}`, {method: 'POST', body: f}).catch((e) => toast(e.message));
      if (!r) return;
      S.slug = slug; localStorage.setItem('ayah.slug', slug); setCurrent();
      const j = await follow({id: r.job}, $('#njob'), 'استيراد ← تفريغ ← كشف الخلفية ← كشف الآيات');
      if (j.status === 'done') go('transcript');
    };
  },

  async transcript() {
    if (!needProject()) return;
    const [tr, an] = await Promise.all([get('transcript.json'), get('audio_analysis.json')]);
    if (!tr) return (view.innerHTML = '<div class="card">لسه مفيش تفريغ.</div>');
    const low = tr.words.filter((w) => w.flags?.includes('low')).length;
    view.innerHTML = `
      <div class="card"><div class="row"><h2 class="grow">التفريغ</h2>
        <span class="pill warn">${low} كلمة محتاجة مراجعة (أصفر)</span>
        <button id="save" class="primary">حفظ</button><button id="resac">حفظ وإعادة كشف الآيات</button></div>
        <p class="muted">اضغط على كلمة تسمعها وتعدّلها. الكلمات المشطوبة (تأتأة أو تكرار أو حشو) مش هتظهر في الكابشن. الكابشن لازم يطابق الكلمة المنطوقة بالظبط.</p>
        <audio id="aud" controls src="/api/p/${encodeURIComponent(S.slug)}/media" style="width:100%"></audio></div>
      <div class="card"><b>الصوت:</b> ${an ? (an.hasBed ? `فيه خلفية صوتية (السكتات على ${an.gapMedianRelDb} dB)، فـ<b>مفيش أي قص</b> والسكتات هتتملي بحركة.` :
        `صوت نضيف، فالسكتات الأطول من ${S.cfg.audio.silenceMax} ث اتقصت (${tr.cuts?.length || 0} قصة).`) : '—'}</div>
      <div id="aiw"></div><div class="card words" id="words"></div>`;
    $('#aiw').append(await aiBox('words', () => TABS.transcript()));
    const box = $('#words'), aud = $('#aud');
    const draw = () => (box.innerHTML = tr.words.map((w, i) => `<span class="w ${w.flags?.includes('low') ? 'low' : ''} ${w.drop ? 'drop' : ''} ${w.sacred ? 'sacred' : ''}" data-i="${i}" title="${w.start.toFixed(2)}s · ثقة ${Math.round(w.p * 100)}%${w.drop ? ' · ' + w.drop : ''}${w.ai_suggest ? ' · اقتراح AI: ' + w.ai_suggest.w : ''}">${esc(w.w)}${w.ai_suggest ? `<sup style="color:var(--goldD)">✨${esc(w.ai_suggest.w)}</sup>` : ''}</span>`).join(' '));
    draw();
    box.onclick = async (e) => {
      const el = e.target.closest('.w'); if (!el) return;
      const w = tr.words[+el.dataset.i];
      aud.currentTime = Math.max(0, w.start - 0.4); aud.play(); setTimeout(() => aud.pause(), (w.end - w.start + 0.9) * 1000);
      const ok = await confirmBox(`<h3>تعديل الكلمة</h3><p class="muted">بتتقال عند ${w.start.toFixed(2)} ث</p>
        ${w.ai_suggest ? `<p>✨ اقتراح AI: <b>${esc(w.ai_suggest.w)}</b> <span class="muted">${esc(w.ai_suggest.why)}</span></p>` : ''}
        <input id="ew" value="${esc(w.ai_suggest?.w ?? w.w)}" style="width:100%;font-size:22px" />
        <label class="row" style="margin-top:10px"><input type="checkbox" id="ed" ${w.drop ? 'checked' : ''} /> مشيلها من الكابشن (تأتأة/تكرار/حشو)</label>`, 'حفظ الكلمة');
      if (!ok) return;
      w.w = $('#ew').value.trim() || w.w; delete w.ai_suggest; w.flags = (w.flags || []).filter((f) => f !== 'low');
      if ($('#ed').checked) w.drop = w.drop || 'manual'; else delete w.drop;
      draw();
    };
    $('#save').onclick = async () => { await put('transcript.json', tr); toast('اتحفظ'); };
    $('#resac').onclick = async () => { await put('transcript.json', tr); const j = await run('resacred'); await follow(j, view.appendChild(document.createElement('div')), 'كشف الآيات والأحاديث'); go('sacred'); };
  },

  async sacred() {
    if (!needProject()) return;
    const sc = await get('sacred.json');
    if (!sc) return (view.innerHTML = '<div class="card">لسه مفيش كشف.</div>');
    const label = {quran: 'آية', hadith: 'حديث', dhikr: 'ذكر'};
    view.innerHTML = `<div class="card"><div class="row"><h2 class="grow">الآيات والأحاديث والذكر</h2><button id="save" class="primary">حفظ</button></div>
      <p class="muted">دي مناطق <b>ممنوع فيها مؤثرات صوت</b>. لازم تأكد كل نص قبل الرندر. نصوص الأحاديث المقترحة من مكتبة الأداة <b>محتاجة مراجعة على مصدر موثوق</b>، ولو الحديث مش صحيح أو مش متأكد، علّمه «كلام الشيخ»: هيظهر بين «» من غير مصدر.</p></div>
      ${sc.spans.map((s, i) => `<div class="card" data-i="${i}">
        <div class="row"><span class="pill ${s.confirmed ? 'ok' : 'warn'}">${label[s.type]} ${s.confirmed ? '✓ متأكد' : 'محتاج تأكيد'}</span>
          <span class="muted">${fmt(s.start)}–${fmt(s.end)}</span>${s.status === 'suggested' ? '<span class="pill warn">مقترح من المكتبة، راجعه</span>' : ''}${s.status === 'speaker' ? '<span class="pill">كلام الشيخ</span>' : ''}<span class="grow"></span>
          <button data-a="play">اسمع</button>${s.type === 'hadith' ? '<button data-a="speaker">كلام الشيخ</button>' : ''}<button data-a="remove" class="danger">مش ${label[s.type]}</button><button data-a="ok" class="primary">${s.confirmed ? 'إلغاء التأكيد' : 'تأكيد ✓'}</button></div>
        <p class="muted">اتسمع: ${esc(s.heard)}</p>
        ${s.type === 'hadith' ? `<div class="row"><a href="https://dorar.net/hadith/search?q=${encodeURIComponent(s.text ? s.text.replace(/[«»]/g, '') : s.heard)}" target="_blank" rel="noopener">🔎 ابحث بنفسك في الدرر السنية (أونلاين)</a></div>` : ''}
        ${s.ai_check ? `<div class="card ai" style="margin-top:8px"><b>✨ رأي الـ AI (اقتراح، مش تأكيد):</b> ${{hadith: 'حديث', not_hadith: 'مش حديث', unsure: 'مش متأكد'}[s.ai_check.verdict] ?? esc(s.ai_check.verdict)}
          ${s.ai_check.text ? `<div class="hadith">${esc(s.ai_check.text)}</div>` : ''}<div class="muted">${esc([s.ai_check.source, s.ai_check.grade, s.ai_check.number].filter(Boolean).join(' · '))}</div>
          <div class="muted">${esc(s.ai_check.notes || '')}</div>${s.ai_check.text ? '<button data-a="useai">استخدم النص ده (هتأكد بنفسك بعدها)</button>' : ''}</div>` : ''}
        ${s.type === 'dhikr' ? '' : `<textarea data-f="text" class="${s.type === 'quran' ? 'quran' : 'hadith'}">${esc(s.text || '')}</textarea>
        <div class="row"><input data-f="${s.type === 'quran' ? 'ref' : 'source'}" value="${esc(s.type === 'quran' ? s.ref : s.source)}" placeholder="${s.type === 'quran' ? 'السورة والآية' : 'المصدر (مثلًا رواه البخاري)'}" class="grow" /></div>`}
      </div>`).join('')}<audio id="aud" src="/api/p/${encodeURIComponent(S.slug)}/media"></audio>`;
    if (sc.spans.some((s) => s.type === 'hadith')) view.insertBefore(await aiBox('hadith', () => TABS.sacred()), view.children[1]);
    view.querySelectorAll('[data-i]').forEach((card) => {
      const s = sc.spans[+card.dataset.i];
      card.querySelectorAll('[data-f]').forEach((inp) => (inp.oninput = () => { s[inp.dataset.f] = inp.value; s.confirmed = false; }));
      card.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'play') { const au = $('#aud'); au.currentTime = s.start - 0.3; au.play(); setTimeout(() => au.pause(), (s.end - s.start + 0.8) * 1000); return; }
        if (a === 'ok') { if (s.type === 'hadith' && s.status !== 'speaker' && (!s.text || !s.source)) return toast('اكتب نص الحديث ومصدره الأول'); s.confirmed = !s.confirmed; }
        if (a === 'speaker') { s.status = 'speaker'; s.text = ''; s.source = ''; s.confirmed = true; }
        if (a === 'remove') sc.spans.splice(sc.spans.indexOf(s), 1);
        if (a === 'useai') { s.text = s.ai_check.text.startsWith('«') ? s.ai_check.text : `«${s.ai_check.text}»`; s.source = [s.ai_check.source, s.ai_check.grade].filter(Boolean).join(' — '); s.status = 'suggested'; s.confirmed = false; }
        TABS.sacredRedraw(sc);
      }));
    });
  },
  async sacredRedraw(sc) { await put('sacred.json', sc); TABS.sacred(); },

  async board() {
    if (!needProject()) return;
    const [sb, lint, est] = await Promise.all([get('storyboard.json'), get('lint.json'), api(`/p/${encodeURIComponent(S.slug)}/estimate`).catch(() => null)]);
    const hasKey = S.cfg.hasClaudeKey;
    view.innerHTML = `
      <div class="card"><h2>الستوري بورد</h2>
        <div class="row"><label>الهوك (هدف الفيديو في جملة قصيرة):</label><input id="hook" class="grow" value="${esc(sb?.template.hook.text || '')}" placeholder="مثلًا: نفسك عمرها ما هتقولك كفاية" />
          <button id="saveHook">حفظ الهوك</button></div>
        <div class="row" style="margin-top:12px"><button class="primary" id="planRules">اعمل الستوري بورد (من غير AI، ببلاش)</button>
          <span class="muted">بيختار وصفة لكل مشهد بقواعد ثابتة، وانت تغيّر اللي عايزه.</span></div></div>
      <div id="planBox"></div>
      <div id="bjob"></div><div id="metaBox"></div>
      ${lint ? `<div class="card"><h3>الفاحص: <span class="pill ${lint.errors.length ? 'err' : 'ok'}">${lint.errors.length} خطأ</span> <span class="pill warn">${lint.warnings.length} تنبيه</span></h3>
        <ul class="lint">${[...lint.errors, ...lint.warnings].slice(0, 30).map((i) => `<li>${i.severity === 'error' ? '✗' : '!'} <b>${esc(i.where)}</b>: ${esc(i.msg)} ${i.fix ? `<span class="muted">← ${esc(i.fix)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
      <div class="card ai" id="chat"><div class="row"><h3 class="grow">💬 كلّم الستوري بورد (اختياري)</h3><span class="pill warn">بيستخدم AI</span></div>
        <p class="muted">اكتب بالعامية اللي عايزه، زي «خلي مشهد s5 سلّم وزوّد طيارة» أو «الفقاعة في s2 تقول كفاية؟» أو «غيّر الهوك». الـ AI بيحوّل كلامك لتعديل، والأداة بتعيد صور المشاهد اللي اتغيّرت بس. الكابشن وكروت الآيات والقواعد الشرعية مابيتغيّروش. <b>حوالي 2 ألف توكن للرسالة.</b></p>
        <div id="chatLog" style="max-height:260px;overflow:auto"></div>
        <div class="row"><textarea id="chatIn" placeholder="اكتب طلبك…" style="min-height:48px" class="grow"></textarea></div>
        <div class="row"><select id="chatMode"><option value="claude-code" ${S.cfg.hasClaudeCode ? '' : 'disabled'}>Claude Code (اشتراكك)</option><option value="manual">انسخ والصق في أي AI</option>
          <option value="claude" ${S.cfg.hasClaudeKey ? '' : 'disabled'}>مفتاح Claude API</option><option value="local">Ollama على جهازك</option></select>
          <button class="gold" id="chatGo">ابعت</button></div><div id="chatJob"></div></div>
      <div id="scenes"></div>`;
    const plan = async (mode) => {
      if (mode !== 'rules') {
        const ok = await confirmBox(`<h3>الخطوة دي بتستخدم AI</h3><p>${mode === 'claude' ? 'هيتبعت نص التفريغ لـ Claude API (أونلاين).' : 'هيشتغل موديل Ollama على جهازك (أوفلاين).'}<br>التقدير: حوالي <b>${est?.total ?? '؟'}</b> توكن.</p><p class="muted">الستوري بورد الحالي هيتبدل.</p>`, 'أيوه كمّل');
        if (!ok) return;
      }
      const j = await run('plan', {mode});
      const r = await follow(j, $('#bjob'), mode === 'rules' ? 'بيعمل الستوري بورد' : 'الـ AI بيخطط');
      if (r.status === 'done') { if (/fallback/.test(r.log)) toast('الـ AI ماشتغلش، فالأداة استخدمت القواعد الثابتة'); TABS.board(); }
    };
    $('#metaBox').append(await aiBox('meta', () => TABS.board()));
    const pub = await get('publish.json');
    if (pub) $('#metaBox').insertAdjacentHTML('beforeend', `<div class="card"><h3>للنشر</h3><p><b>العنوان:</b> ${esc(pub.title)}</p><p><b>الوصف:</b> ${esc(pub.description)}</p><p><b>التعليق المثبّت:</b> ${esc(pub.pinned)}</p><p class="muted">${esc((pub.hashtags || []).join(' '))}</p></div>`);
    $('#planRules').onclick = () => plan('rules');
    $('#planBox').append(await aiBox('plan', () => TABS.board()));
    const drawChat = async () => {
      const h = (await get('chat.json')) || [];
      $('#chatLog').innerHTML = h.map((m) => `<div style="margin:6px 0;padding:8px 12px;border-radius:12px;background:${m.role === 'user' ? '#fff' : 'var(--paper2)'}"><b>${m.role === 'user' ? 'انت' : 'الأداة'}:</b> ${esc(m.text)}${m.changed?.length ? ` <span class="muted">(${m.changed.join('، ')})</span>` : ''}</div>`).join('');
      $('#chatLog').scrollTop = 1e6;
    };
    drawChat();
    if (!S.cfg.hasClaudeCode) $('#chatMode').value = 'manual';
    $('#chatGo').onclick = async () => {
      const message = $('#chatIn').value.trim(); if (!message) return;
      const mode = $('#chatMode').value; let answer;
      if (mode === 'manual') {
        const prompt = await fetch(`/api/p/${encodeURIComponent(S.slug)}/prompt?task=chat&message=${encodeURIComponent(message)}`).then((r) => r.text());
        const ok = await confirmBox(`<h3>انسخ والصق</h3><p class="muted">انسخ الطلب ده والصقه في أي شات AI، وبعدين الصق رده كله تحت.</p>
          <textarea id="pp" readonly style="height:140px;font-size:12px">${esc(prompt)}</textarea><button type="button" id="cp">انسخ الطلب</button>
          <textarea id="pa" placeholder="الصق الرد هنا" style="height:120px;margin-top:10px"></textarea>`, 'طبّق');
        if (!ok) return; answer = $('#pa').value; if (!answer.trim()) return toast('ماتلصقش رد');
      }
      const j = await run('ai', {task: 'chat', mode, message, answer}).catch((e) => toast(e.message)); if (!j) return;
      const r = await follow(j, $('#chatJob'), 'بيطبّق طلبك ويعيد صور المشاهد');
      if (r.status === 'done') { $('#chatIn').value = ''; TABS.board(); }
    };
    $('#saveHook').onclick = async () => { if (!sb) return; sb.template.hook.text = $('#hook').value.trim(); sb.meta.title = sb.template.hook.text; await put('storyboard.json', sb); toast('الهوك اتحفظ. أعد صورة أول فريم من «الصور»'); };
    if (!sb) return;
    $('#scenes').innerHTML = sb.scenes.filter((s) => s.id !== 'outro').map((s) => {
      const card = s.role === 'sacred';
      const sugg = (s.suggest || []).slice(0, 3).map((x) => x[0]);
      const needsText = ['thought', 'sign'].includes(s.recipe);
      return `<div class="card scene" data-id="${s.id}">
        <div class="t"><b>${s.id}</b><br>${fmt(s.start)}<br>${fmt(s.end)}</div>
        <div><div>${esc(s.meaning)}</div>
          ${card ? '<p class="muted">مشهد كارت آية/حديث (ثابت).</p>' : `<div class="chips" style="margin-top:8px">${sugg.map((r) => `<span class="chip ${r === s.recipe ? 'on' : ''}" data-r="${r}">${esc(S.recipes[r] || r)}</span>`).join('')}
            <select data-all><option value="">وصفات تانية…</option>${Object.entries(S.recipes).filter(([k]) => k !== 'card').map(([k, v]) => `<option value="${k}" ${k === s.recipe ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
          ${needsText ? `<div class="row" style="margin-top:8px"><input data-text class="grow" value="${esc(s.params?.text || '')}" placeholder="الكلام اللي جوه (بلهجة الشيخ)" /><button data-apply>طبّق</button></div>` : ''}`}
        </div>
        <div><img src="/api/p/${encodeURIComponent(S.slug)}/stills/${s.id}.png?${Date.now()}" onerror="this.style.display='none'" style="width:100%;border-radius:10px" /></div></div>`;
    }).join('');
    $('#scenes').querySelectorAll('.scene').forEach((el) => {
      const s = sb.scenes.find((x) => x.id === el.dataset.id);
      const apply = async (recipe, params) => {
        const j = await run('rescene', {scene: s.id, recipe, params});
        const r = await follow(j, $('#bjob'), `بيغيّر المشهد ${s.id} ويعيد صورته`);
        if (r.status === 'done') TABS.board();
      };
      el.querySelectorAll('[data-r]').forEach((c) => (c.onclick = () => apply(c.dataset.r, {...(s.params || {})})));
      const sel = $('[data-all]', el); if (sel) sel.onchange = () => sel.value && apply(sel.value, {...(s.params || {})});
      const ap = $('[data-apply]', el); if (ap) ap.onclick = () => apply(s.recipe, {...(s.params || {}), text: $('[data-text]', el).value.trim()});
    });
  },

  async stills() {
    if (!needProject()) return;
    const [idx, ap, sb] = await Promise.all([get('stills/index.json'), get('approvals.json'), get('storyboard.json')]);
    const appr = ap || {scenes: {}};
    view.innerHTML = `<div class="card"><div class="row"><h2 class="grow">صور الستوري بورد</h2>
        <button class="primary" id="mk">${idx ? 'أعد كل الصور' : 'اعمل الصور'}</button><button id="all">وافق على الكل</button></div>
        <p class="muted">مفيش رندر فيديو من غير موافقتك على كل مشهد. لو عايز تغيّر مشهد، روح «الستوري بورد» واختار وصفة تانية، أو علّمه «محتاج تعديل».</p></div>
      <div id="sjob"></div><div id="rev"></div><div class="grid" id="grid"></div>`;
    if (idx) $('#rev').append(await aiBox('review', () => TABS.stills()));
    const rv = await get('ai_review.json');
    const issues = Object.fromEntries((rv?.items || []).map((x) => [x.id, x]));
    $('#mk').onclick = async () => { const r = await follow(await run('stills'), $('#sjob'), 'بيرندر الصور'); if (r.status === 'done') TABS.stills(); };
    $('#all').onclick = async () => { (idx || []).forEach((s) => (appr.scenes[s.id] = 'approved')); await put('approvals.json', appr); TABS.stills(); };
    if (!idx) return;
    const ids = new Set((sb?.scenes || []).map((s) => s.id));
    $('#grid').innerHTML = idx.map((s, n) => `<div class="still ${appr.scenes[s.id] || ''}" data-id="${s.id}">
      <img src="/api/p/${encodeURIComponent(S.slug)}/stills/${s.id}.png?${Date.now()}" />
      <div class="meta"><b>${n + 1}. ${s.id}</b> · ${fmt(s.t)}<div class="muted">${esc(s.label)}</div>
      ${issues[s.id] && !issues[s.id].ok ? `<div style="color:var(--coral)">✨ ${esc((issues[s.id].issues || []).join('، '))}${issues[s.id].suggest ? ' ← ' + esc(issues[s.id].suggest) : ''}</div>` : ''}
      <div class="row" style="margin-top:6px"><button data-v="approved" class="primary">موافق</button><button data-v="changes">محتاج تعديل</button>${ids.has(s.id) ? '<button data-v="redo" class="ghost">↻</button>' : ''}</div></div></div>`).join('');
    $('#grid').querySelectorAll('.still').forEach((el) => el.querySelectorAll('[data-v]').forEach((b) => (b.onclick = async () => {
      if (b.dataset.v === 'redo') { const r = await follow(await run('stills', {scenes: [el.dataset.id]}), $('#sjob'), 'بيعيد الصورة'); if (r.status === 'done') TABS.stills(); return; }
      appr.scenes[el.dataset.id] = b.dataset.v; await put('approvals.json', appr); el.className = 'still ' + b.dataset.v;
    })));
  },

  async settings() {
    S.cfg = await api('/config');
    const u = S.cfg.user || {};
    const v = (path, d) => path.split('.').reduce((o, k) => (o ?? {})[k], u) ?? d;
    view.innerHTML = `<div class="card"><h2>الإعدادات</h2>
      <table>
        <tr><td>رسم الستات</td><td><label><input type="checkbox" id="women" ${v('shariah.womenAllowed', S.cfg.shariah.womenAllowed) ? 'checked' : ''}/> مسموح (الافتراضي: مقفول زي PLAYBOOK النشر؛ تقدر تفتحه لفيديو معيّن بس)</label></td></tr>
        <tr><td>أقصى سكتة قبل القص</td><td><input id="sil" type="number" step="0.1" min="0.3" max="3" value="${v('audio.silenceMax', S.cfg.audio.silenceMax)}"/> ثانية <span class="muted">(بيتطبق بس لو مفيش خلفية صوتية)</span></td></tr>
        <tr><td>مدة المشهد التقريبية</td><td><input id="beat" type="number" step="0.2" min="2.5" max="7" value="${v('planner.beatSeconds', S.cfg.planner.beatSeconds)}"/> ثانية</td></tr>
        <tr><td>جملة المشاركة</td><td><input id="share" class="grow" style="width:100%" value="${esc(v('channel.shareLine', S.cfg.channel.shareLine))}"/></td></tr>
        <tr><td>موديل Ollama</td><td><input id="oll" value="${esc(v('planner.ollamaModel', S.cfg.planner.ollamaModel))}"/></td></tr>
        <tr><td>مفتاح Claude API (اختياري)</td><td><input id="key" type="password" style="width:100%" placeholder="sk-ant-..." value="${esc(v('ai.claudeKey', ''))}"/>
          <div class="muted">بيتحفظ في config/user.json على جهازك بس (مش متغير عام في النظام، علشان مايأثرش على اشتراكك في Claude Code). مش محتاجه لو هتستخدم «Claude Code باشتراكك» أو «انسخ والصق».</div></td></tr>
        <tr><td>Claude Code</td><td>${S.cfg.hasClaudeCode ? '✓ متسطّب، وزرار «اشتراكك» شغال' : '✗ مش متسطّب. سطّبه من claude.com/code وسجّل دخول باشتراكك مرة واحدة'}</td></tr>
      </table><div class="row" style="margin-top:12px"><button class="primary" id="saveS">حفظ</button></div></div>`;
    $('#saveS').onclick = async () => {
      await api('/settings', {method: 'PUT', body: JSON.stringify({
        shariah: {womenAllowed: $('#women').checked}, audio: {silenceMax: +$('#sil').value}, planner: {beatSeconds: +$('#beat').value, ollamaModel: $('#oll').value.trim()},
        channel: {...S.cfg.channel, shareLine: $('#share').value.trim()}, ai: {claudeKey: $('#key').value.trim()}})});
      S.cfg = await api('/config'); toast('اتحفظ');
    };
  },

  async render() {
    if (!needProject()) return;
    const j = await run('lint', {stage: 'render'});
    await follow(j, view, 'الفاحص قبل الرندر');
    const lint = await get('lint.json');
    view.innerHTML = `<div class="card"><h2>الرندر والإخراج</h2>
      <p>الفاحص قبل الرندر: <span class="pill ${lint.errors.length ? 'err' : 'ok'}">${lint.errors.length} خطأ</span></p>
      <ul class="lint">${lint.errors.map((i) => `<li>✗ <b>${esc(i.where)}</b>: ${esc(i.msg)}</li>`).join('')}</ul>
      <div class="row"><button class="primary" id="rnd" ${lint.errors.length ? 'disabled' : ''}>رندر الفيديو كامل</button>
        <button id="prev">معاينة أول <input id="pv" type="number" value="20" min="5" max="120" style="width:64px" /> ثانية</button></div>
      <p class="muted">المعاينة بتترندر من غير ما تستنى الموافقة على كل المشاهد، علشان تشوف الحركة والصوت بسرعة، والأجزاء اللي اترندرت بيتعاد استخدامها في الرندر الكامل.</p>
      <p class="muted">الرندر بيتعمل على أجزاء (حوالي ${S.cfg.render.chunkFrames} فريم للجزء) وبعدين بيتجمع، ومعاه المكساج والصورة المصغّرة والعنوان والوصف والتعليق المثبّت في فولدر واحد.</p></div><div id="rjob"></div>`;
    $('#prev').onclick = async (e) => { if (e.target.id === 'pv') return; const n = +$('#pv').value || 20;
      const r = await follow(await run('render', {to: n}), $('#rjob'), `بيرندر أول ${n} ثانية`);
      if (r.status === 'done') $('#rjob').innerHTML = `<div class="card"><video controls style="max-height:70vh" src="/api/p/${encodeURIComponent(S.slug)}/out/${encodeURIComponent(S.slug)}_first${n}s.mp4?${Date.now()}"></video></div>`; };
    $('#rnd').onclick = async () => { const r = await follow(await run('render'), $('#rjob'), 'بيرندر الفيديو'); if (r.status === 'done') toast('الفيديو جاهز ✅'); };
  },
};

const needProject = () => { if (S.slug) return true; view.innerHTML = '<div class="card">اختار مشروع الأول من «المشاريع».</div>'; return false; };
const setCurrent = () => ($('#current').textContent = S.slug ? `المشروع: ${S.slug}` : '');
const openProject = (slug) => { S.slug = slug; localStorage.setItem('ayah.slug', slug); setCurrent(); go('board'); };
const go = (tab) => {
  S.tab = tab;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  view.innerHTML = '<div class="card muted">بيحمّل…</div>';
  TABS[tab]().catch((e) => (view.innerHTML = `<div class="card">حصلت مشكلة: ${esc(e.message)}</div>`));
};
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
(async () => {
  [S.cfg, S.recipes] = await Promise.all([api('/config'), api('/recipes')]);
  const q = new URLSearchParams(location.search);
  if (q.get('p')) { S.slug = q.get('p'); localStorage.setItem('ayah.slug', S.slug); }
  setCurrent(); go(q.get('tab') || (S.slug ? 'board' : 'projects'));
})();
