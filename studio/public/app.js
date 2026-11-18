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
  review: ['مراجعة الصور بالـ AI', 'بيبعت صور المشاهد مصغّرة، وموديل بيشوف الصور يدوّر على أي حاجة ممكن تتفهم غلط أو تخالف القواعد. الفاحص بيعمل ده ببلاش للحاجات اللي تتحسب، والـ AI بيكمّل اللي محتاج عين.'],
};
const aiBox = async (task, onDone) => {
  const el = document.createElement('div');
  el.className = 'card ai';
  const est = await api(`/p/${encodeURIComponent(S.slug)}/estimate?task=${task}`).catch(() => null);
  const [title, desc] = AI_INFO[task];
  el.innerHTML = `<div class="row"><h3 class="grow">✨ ${title} (اختياري)</h3><span class="pill warn">بيستخدم AI</span></div>
    <p class="muted">${desc} ${est ? `التقدير: حوالي <b>${est.total.toLocaleString('ar-EG')}</b> توكن.` : ''}</p>
    <div class="row"><button class="gold" data-m="claude" ${S.cfg.hasClaudeKey ? '' : 'disabled'}>بـ Claude (أونلاين)</button>
    ${task === 'review' ? '' : '<button data-m="local">بموديل على جهازك (Ollama)</button>'}
    ${S.cfg.hasClaudeKey ? '' : '<span class="muted">Claude محتاج ANTHROPIC_API_KEY.</span>'}</div><div class="j"></div>`;
  el.querySelectorAll('[data-m]').forEach((b) => (b.onclick = async () => {
    const mode = b.dataset.m;
    const ok = await confirmBox(`<h3>${title}</h3><p>الخطوة دي بتستخدم AI ${mode === 'claude' ? '(Claude، أونلاين)' : '(Ollama على جهازك)'}.<br>التقدير: حوالي <b>${est?.total ?? '؟'}</b> توكن.</p>`, 'أيوه كمّل');
    if (!ok) return;
    const j = await run('ai', {task, mode}).catch((e) => toast(e.message));
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
      <div class="card ai"><div class="row"><h3 class="grow">✨ حسّن بالـ AI (اختياري)</h3><span class="pill warn">بيستخدم AI</span></div>
        <p class="muted">بيبعت <b>نص التفريغ بس</b> في طلب واحد، والموديل بيختار وصفة لكل مشهد ويقترح الهوك والعنوان والوصف والتعليق المثبّت. الرسم والقواعد الشرعية بيفضلوا في الأداة والفاحص.
        ${est ? `التقدير: حوالي <b>${est.total.toLocaleString('ar-EG')}</b> توكن (${est.input.toLocaleString('ar-EG')} إدخال + ${est.output.toLocaleString('ar-EG')} إخراج).` : ''}</p>
        <div class="row"><button class="gold" id="planClaude" ${hasKey ? '' : 'disabled'}>حسّن بـ Claude (أونلاين)</button>
          <button id="planLocal">حسّن بموديل على جهازك (Ollama، ببلاش وأبطأ)</button>
          ${hasKey ? '' : '<span class="muted">علشان تستخدم Claude: شغّل الأداة ومعاها ANTHROPIC_API_KEY.</span>'}</div></div>
      <div id="bjob"></div><div id="metaBox"></div>
      ${lint ? `<div class="card"><h3>الفاحص: <span class="pill ${lint.errors.length ? 'err' : 'ok'}">${lint.errors.length} خطأ</span> <span class="pill warn">${lint.warnings.length} تنبيه</span></h3>
        <ul class="lint">${[...lint.errors, ...lint.warnings].slice(0, 30).map((i) => `<li>${i.severity === 'error' ? '✗' : '!'} <b>${esc(i.where)}</b>: ${esc(i.msg)} ${i.fix ? `<span class="muted">← ${esc(i.fix)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
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
    $('#planClaude').onclick = () => plan('claude');
    $('#planLocal').onclick = () => plan('local');
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

  async render() {
    if (!needProject()) return;
    const j = await run('lint', {stage: 'render'});
    await follow(j, view, 'الفاحص قبل الرندر');
    const lint = await get('lint.json');
    view.innerHTML = `<div class="card"><h2>الرندر والإخراج</h2>
      <p>الفاحص قبل الرندر: <span class="pill ${lint.errors.length ? 'err' : 'ok'}">${lint.errors.length} خطأ</span></p>
      <ul class="lint">${lint.errors.map((i) => `<li>✗ <b>${esc(i.where)}</b>: ${esc(i.msg)}</li>`).join('')}</ul>
      <button class="primary" id="rnd" ${lint.errors.length ? 'disabled' : ''}>رندر الفيديو</button>
      <p class="muted">الرندر بيتعمل على أجزاء (حوالي ${S.cfg.render.chunkFrames} فريم للجزء) وبعدين بيتجمع، ومعاه المكساج والصورة المصغّرة والعنوان والوصف والتعليق المثبّت في فولدر واحد.</p></div><div id="rjob"></div>`;
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
