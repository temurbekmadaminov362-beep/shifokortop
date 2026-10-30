// Shifokor top — Telegram bot (Supabase Edge Function "telegram-bot").
// The bot answers in chat (search by specialty, symptom, name or clinic) and opens the site as a Telegram Mini App.
// Needs one secret in Supabase → Edge Functions → Secrets: TELEGRAM_BOT_TOKEN (from @BotFather).
// The function keeps Supabase's JWT check ON. It does not use a webhook: a database job (pg_cron) calls it every
// minute with the project's anon key, and each call asks Telegram for new messages for about 50 seconds (long polling).
// Setup (menu button, commands, descriptions) runs once with  GET ?setup=1  (also called with the anon key).

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const SITE = "https://temurbekmadaminov362-beep.github.io/shifokortop/";
const FN_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "") + "/functions/v1/telegram-bot";
const API = "https://api.telegram.org/bot" + TOKEN + "/";
const MAX_RESULTS = 8;

/* ---------- helpers ---------- */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
const webhookSecret = async () => (await sha256Hex("shifokortop:" + TOKEN)).slice(0, 48);
async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(API + method, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return await r.json().catch(() => ({ ok: false }));
}
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const CYR: Record<string, string> = { "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"j","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f","х":"x","ц":"ts","ч":"ch","ш":"sh","щ":"sh","ъ":"","ы":"i","ь":"","э":"e","ю":"yu","я":"ya","ў":"o","қ":"q","ғ":"g","ҳ":"h" };
function norm(s: unknown): string {   // same idea as the site: Cyrillic → Latin, no apostrophes, h/x and kh/x treated alike
  let t = String(s ?? "").toLowerCase();
  t = t.replace(/[а-яёўқғҳ]/g, (c) => (c in CYR ? CYR[c] : c));
  t = t.replace(/['ʻʼ‘’`´]/g, "");
  t = t.replace(/sh/g, "\u0001").replace(/ch/g, "\u0002").replace(/kh/g, "x").replace(/h/g, "x").replace(/\u0001/g, "sh").replace(/\u0002/g, "ch");
  t = t.replace(/\bye/g, "e").replace(/iye/g, "ie").replace(/aye/g, "ae");
  return t.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/* ---------- data from the site (cached for 10 minutes) ---------- */
type Doc = { id: string; name: string; nameRu?: string; specialties?: string[]; kids?: number | null; clinic?: string; address?: string; addressRu?: string;
  hours?: string; clinicHours?: string; phone?: string; experience?: number; price?: number | null; _hay?: string };
type Specs = { order: string[]; kidOnly: string[]; spec: Record<string, string[]> };
let cache: { at: number; docs: Doc[]; specs: Specs } | null = null;
async function data() {
  if (cache && Date.now() - cache.at < 10 * 60e3) return cache;
  const [docs, specs] = await Promise.all([
    fetch(SITE + "data/doctors.json").then((r) => r.json()),
    fetch(SITE + "data/specs.json").then((r) => r.json()),
  ]);
  cache = { at: Date.now(), docs: (docs as Doc[]).filter((d) => d && d.id && d.name), specs };
  return cache;
}

/* ---------- texts ---------- */
const ruDoctors = (n: number) => (n % 10 === 1 && n % 100 !== 11) ? "врач" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? "врача" : "врачей";
const TXT = {
  uz: {
    hello: (n: number) => `Assalomu alaykum! <b>Shifokor top</b> — Andijon viloyatidagi ${n} ta shifokor: telefon, manzil, qabul vaqti va bemorlar baholari.\n\n` +
      `Pastdagi ro'yxatdan yo'nalishni tanlang 👇 yoki yozing:\n• yo'nalish — <i>endokrinolog</i>, <i>bolalar LOR</i>\n• muammo — <i>diabet</i>, <i>ko'z</i>, <i>tish</i>\n• ism yoki klinika nomi`,
    help: `Yo'nalish, muammo, shifokor ismi yoki klinika nomini yozing, men mos shifokorlarni ko'rsataman.\n\nMasalan: <i>nevrolog</i>, <i>bolalar nevrologi</i>, <i>bosim</i>, <i>Zam-zam</i>.\n\nBarcha imkoniyatlar (xarita, filtrlar, baho qoldirish) — «Ilovani ochish» tugmasida.`,
    open: "🔎 Ilovani ochish", details: "Batafsil", found: (n: number, q: string) => `«${esc(q)}» bo'yicha ${n} ta shifokor topildi:`,
    more: (n: number) => `…va yana ${n} ta. Hammasini ilovada ko'ring.`, none: (q: string) => `«${esc(q)}» bo'yicha shifokor topilmadi. Boshqacha yozib ko'ring, masalan: <i>endokrinolog</i>, <i>bolalar LOR</i>, <i>diabet</i>.`,
    hours: "Qabul", clinicHours: "Klinika", noHours: "ish vaqti hozircha noma'lum", noPhone: "telefon tez orada qo'shiladi",
    years: (n: number) => `${n} yil tajriba`, som: "so'm", popular: "Ko'p qidiriladigan yo'nalishlar:", kidsTag: "👶 bolalar",
    menu: "Ochish", short: "Andijon shifokorlari: telefon, manzil, qabul vaqti va baholar. Yo'nalish yoki muammoni yozing.",
    desc: "Shifokor top — Andijon viloyati shifokorlari katalogi.\n\nYo'nalish (endokrinolog, bolalar LOR…), muammo (diabet, ko'z…), ism yoki klinika nomini yozing — telefon, manzil va qabul vaqtini yuboraman.\n\nTashxis qo'ymaydi. Shoshilinch holatda 103.",
    cmdStart: "Boshlash", cmdHelp: "Qanday qidirish", cmdKids: "Bolalar shifokorlari",
    kidsH: "Bolalar shifokorlari — yo'nalishni tanlang:",
    kidsBtn: "👶 Bolalar shifokorlari", placeholder: "Yo'nalish, muammo yoki ism…", doctors: "shifokorlar",
    next: (n: number) => `Keyingi ${n} ta ▶`, moreList: (n: number) => `…yana ${n} ta — «Keyingi» tugmasini bosing.`,
    otherSpecs: "Boshqa yo'nalishlar — pastdagi ro'yxatda 👇",
  },
  ru: {
    hello: (n: number) => `Здравствуйте! <b>Shifokor top</b> — ${n} ${ruDoctors(n)} Андижанской области: телефоны, адреса, часы приёма и отзывы пациентов.\n\n` +
      `Выберите специальность в списке внизу 👇 или напишите:\n• специальность — <i>эндокринолог</i>, <i>детский лор</i>\n• жалобу — <i>диабет</i>, <i>глаза</i>, <i>зуб</i>\n• имя врача или название клиники`,
    help: `Напишите специальность, жалобу, имя врача или клинику — я покажу подходящих врачей.\n\nНапример: <i>невролог</i>, <i>детский невролог</i>, <i>давление</i>, <i>Zam-zam</i>.\n\nВсе возможности (карта, фильтры, отзывы) — по кнопке «Открыть приложение».`,
    open: "🔎 Открыть приложение", details: "Подробнее", found: (n: number, q: string) => `По запросу «${esc(q)}» найдено врачей: ${n}`,
    more: (n: number) => `…и ещё ${n}. Все — в приложении.`, none: (q: string) => `По запросу «${esc(q)}» врачей не найдено. Попробуйте иначе, например: <i>эндокринолог</i>, <i>детский лор</i>, <i>диабет</i>.`,
    hours: "Приём", clinicHours: "Клиника", noHours: "часы приёма пока неизвестны", noPhone: "телефон скоро добавим",
    years: (n: number) => `стаж ${n} лет`, som: "сум", popular: "Часто ищут:", kidsTag: "👶 дети",
    menu: "Открыть", short: "Врачи Андижана: телефоны, адреса, часы приёма и отзывы. Напишите специальность или жалобу.",
    desc: "Shifokor top — каталог врачей Андижанской области.\n\nНапишите специальность (эндокринолог, детский лор…), жалобу (диабет, глаза…), имя врача или клинику — пришлю телефон, адрес и часы приёма.\n\nНе ставит диагнозы. В экстренной ситуации звоните 103.",
    cmdStart: "Начать", cmdHelp: "Как искать", cmdKids: "Детские врачи",
    kidsH: "Детские врачи — выберите специальность:",
    kidsBtn: "👶 Детские врачи", placeholder: "Специальность, жалоба или имя…", doctors: "врачей",
    next: (n: number) => `Следующие ${n} ▶`, moreList: (n: number) => `…ещё ${n} — нажмите «Следующие».`,
    otherSpecs: "Другие специальности — в списке внизу 👇",
  },
};
type Lang = "uz" | "ru";
const langOf = (u: { language_code?: string } | undefined): Lang => (/^ru/i.test(u?.language_code ?? "") ? "ru" : "uz");
const DAY_RU: Record<string, string> = { Du: "Пн", Se: "Вт", Ch: "Ср", Pa: "Чт", Ju: "Пт", Sh: "Сб", Ya: "Вс" };
const hoursText = (s: string | undefined, lang: Lang) => !s ? "" : s === "24/7" ? (lang === "ru" ? "круглосуточно" : "kun-u tun") :
  lang === "ru" ? s.replace(/\b(Du|Se|Ch|Pa|Ju|Sh|Ya)\b/g, (m) => DAY_RU[m]) : s;

/* ---------- search ---------- */
// drop common Uzbek and Russian endings so "nevrologlar", "nevrologga", "невролога" all find "nevrolog"
const ENDINGS = ["larining", "larning", "lardan", "larga", "larni", "lari", "lar", "dagi", "ning", "dan", "ga", "ni", "ogo", "ami", "ov", "ev", "om", "am", "a", "u", "y", "i", "e"];
function stem(t: string) {
  for (const e of ENDINGS) if (t.length - e.length >= 4 && t.endsWith(e)) return t.slice(0, -e.length);
  return t;
}
function specLabel(specs: Specs, code: string, lang: Lang, kids = false) {
  const s = specs.spec[code]; if (!s) return code;
  return kids ? (lang === "ru" ? s[3] : s[2]) : (lang === "ru" ? s[1] : s[0]);
}
const isKidOnly = (specs: Specs, d: Doc) => d.kids === 1 || ((d.specialties ?? []).length > 0 && (d.specialties ?? []).every((c) => specs.kidOnly.includes(c)));
const seesKids = (specs: Specs, d: Doc) => d.kids === 1 || d.kids === 2 || (d.specialties ?? []).some((c) => specs.kidOnly.includes(c));
const KID_WORDS = ["bola", "bolalar", "detskiy", "detskii", "detsk", "rebenok", "rebenka", "deti", "detey", "pediatr", "child"];
function search(all: { docs: Doc[]; specs: Specs }, query: string) {
  const { docs, specs } = all;
  let tokens = norm(query).split(" ").filter((t) => t.length > 1);
  const wantKids = tokens.some((t) => KID_WORDS.some((k) => t.startsWith(k)));
  if (wantKids) tokens = tokens.filter((t) => !KID_WORDS.some((k) => t.startsWith(k)) || t.startsWith("pediatr"));
  const hay = (d: Doc) => d._hay ??= norm([d.name, d.nameRu, (d.specialties ?? []).map((c) => (specs.spec[c] ?? [c]).join(" ")).join(" "), d.clinic, d.address, d.addressRu].join(" "));
  tokens = tokens.map(stem);
  let res = docs.filter((d) => tokens.every((t) => hay(d).includes(t)));
  if (wantKids) res = res.filter((d) => seesKids(specs, d));
  return res.sort((a, b) => (b.experience ?? 0) - (a.experience ?? 0));
}

/* ---------- messages ---------- */
function docText(specs: Specs, d: Doc, lang: Lang) {
  const t = TXT[lang];
  const name = lang === "ru" ? (d.nameRu || d.name) : d.name;
  const sp = (d.specialties ?? []).map((c) => specLabel(specs, c, lang, isKidOnly(specs, d))).join(", ");
  const addr = [d.clinic, lang === "ru" && d.addressRu ? d.addressRu : d.address].filter(Boolean).join(", ");
  const h = d.hours ? `${t.hours}: ${hoursText(d.hours, lang)}` : d.clinicHours ? `${t.clinicHours}: ${hoursText(d.clinicHours, lang)}` : t.noHours;
  const extra = [d.experience ? t.years(d.experience) : "", d.price ? `${Number(d.price).toLocaleString("ru-RU")} ${t.som}` : "", d.kids === 2 ? t.kidsTag : ""].filter(Boolean).join(" · ");
  return `<b>${esc(name)}</b> — ${esc(sp)}\n📍 ${esc(addr)}\n🕘 ${esc(h)}\n📞 ${d.phone ? esc(d.phone) : esc(t.noPhone)}${extra ? "\n" + esc(extra) : ""}`;
}
const appButton = (lang: Lang, hash = "") => ({ text: TXT[lang].open, web_app: { url: SITE + hash } });
const specCounts = (docs: Doc[], specs: Specs, kids = false) => {
  const n: Record<string, number> = {};
  for (const d of docs) if (!kids || seesKids(specs, d)) for (const c of d.specialties ?? []) n[c] = (n[c] ?? 0) + 1;
  return n;
};
// the list under the message box: every specialty that has doctors, two per row, with the number of doctors
function mainKeyboard(all: { docs: Doc[]; specs: Specs }, lang: Lang) {
  const t = TXT[lang]; const n = specCounts(all.docs, all.specs);
  const codes = all.specs.order.filter((c) => n[c]);
  const rows: unknown[][] = [[{ text: t.kidsBtn }, { text: t.open, web_app: { url: SITE } }]];
  for (let i = 0; i < codes.length; i += 2) rows.push(codes.slice(i, i + 2).map((c) => ({ text: `${specLabel(all.specs, c, lang)} · ${n[c]}` })));
  return { keyboard: rows, resize_keyboard: true, is_persistent: true, input_field_placeholder: t.placeholder };
}
// a tap on that list sends the button's text: find which specialty it names (either language, adult or kids name)
function specFromText(specs: Specs, text: string): { code: string; kids: boolean } | "kids" | null {
  const q = norm(text.replace(/\s*·\s*\d+\s*$/, ""));
  if (!q) return null;
  if (q === norm(TXT.uz.kidsBtn) || q === norm(TXT.ru.kidsBtn)) return "kids";
  for (const code of specs.order) {
    const s = specs.spec[code]; if (!s) continue;
    if (q === norm(s[0]) || q === norm(s[1])) return { code, kids: false };
    if (q === norm(s[2]) || q === norm(s[3])) return { code, kids: true };
  }
  return null;
}
// up to 8 doctors per message; "next" adds a button that shows the following 8
async function sendResults(chatId: number, lang: Lang, title: string, list: Doc[], specs: Specs, next?: (offset: number) => string | null, offset = 0) {
  const t = TXT[lang];
  const shown = list.slice(offset, offset + MAX_RESULTS);
  const rest = list.length - offset - shown.length;
  const nextData = rest > 0 && next ? next(offset + MAX_RESULTS) : null;
  const tail = rest > 0 ? (nextData ? t.moreList(rest) : t.more(rest)) : "";
  const text = [title, ...shown.map((d) => docText(specs, d, lang)), tail].filter(Boolean).join("\n\n");
  const buttons: unknown[][] = shown.map((d) => [{ text: `${t.details}: ${(lang === "ru" ? (d.nameRu || d.name) : d.name).split(" ").slice(0, 2).join(" ")}`, web_app: { url: SITE + "#d-" + d.id } }]);
  if (nextData) buttons.push([{ text: t.next(Math.min(MAX_RESULTS, rest)), callback_data: nextData }]);
  buttons.push([appButton(lang)]);
  await tg("sendMessage", { chat_id: chatId, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: buttons } });
}
async function sendSpec(chatId: number, lang: Lang, all: { docs: Doc[]; specs: Specs }, code: string, kids: boolean, offset = 0) {
  const list = all.docs.filter((d) => (d.specialties ?? []).includes(code) && (!kids || seesKids(all.specs, d))).sort((a, b) => (b.experience ?? 0) - (a.experience ?? 0));
  const label = specLabel(all.specs, code, lang, kids || all.specs.kidOnly.includes(code));
  const t = TXT[lang];
  const title = offset ? `<b>${esc(label)}</b> — ${offset + 1}–${Math.min(offset + MAX_RESULTS, list.length)} / ${list.length}`
    : `<b>${esc(label)}</b> — ${t.doctors}: ${list.length}`;
  await sendResults(chatId, lang, title, list, all.specs, (o) => `${kids ? "k" : "s"}:${code}:${o}`, offset);
}
const fitsCallback = (s: string) => new TextEncoder().encode(s).length <= 64;

/* ---------- updates ---------- */
async function onMessage(msg: any) {
  const chatId = msg.chat?.id; const lang = langOf(msg.from);
  const text = String(msg.text ?? "").trim();
  if (!chatId || !text) return;
  const all = await data();
  const t = TXT[lang];
  if (/^\/start\b/.test(text)) {
    const payload = text.split(/\s+/)[1] ?? "";
    const m = payload.match(/^d-([A-Za-z0-9-]+)$/);
    const d = m && all.docs.find((x) => x.id === m[1]);
    if (d) {
      await tg("sendMessage", { chat_id: chatId, text: docText(all.specs, d, lang), parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: t.details, web_app: { url: SITE + "#d-" + d.id } }], [appButton(lang)]] } });
      await tg("sendMessage", { chat_id: chatId, text: t.otherSpecs, reply_markup: mainKeyboard(all, lang) });
      return;
    }
    await tg("sendMessage", { chat_id: chatId, text: t.hello(all.docs.length), parse_mode: "HTML", reply_markup: mainKeyboard(all, lang) });
    return;
  }
  if (/^\/help\b/.test(text)) { await tg("sendMessage", { chat_id: chatId, text: t.help, parse_mode: "HTML", reply_markup: mainKeyboard(all, lang) }); return; }
  if (/^\/bolalar\b|^\/kids\b/.test(text)) { await sendKidsMenu(chatId, lang, all.specs, all.docs); return; }
  const sp = specFromText(all.specs, text);
  if (sp === "kids") { await sendKidsMenu(chatId, lang, all.specs, all.docs); return; }
  if (sp) { await sendSpec(chatId, lang, all, sp.code, sp.kids); return; }
  const q = text.slice(0, 100);
  const found = search(all, q);
  if (!found.length) { await tg("sendMessage", { chat_id: chatId, text: t.none(text.slice(0, 60)), parse_mode: "HTML", reply_markup: mainKeyboard(all, lang) }); return; }
  await sendResults(chatId, lang, t.found(found.length, text.slice(0, 60)), found, all.specs, (o) => { const d_ = `q:${o}:${q}`; return fitsCallback(d_) ? d_ : null; });
}
async function sendKidsMenu(chatId: number, lang: Lang, specs: Specs, docs: Doc[]) {
  const n = specCounts(docs, specs, true);
  const codes = specs.order.filter((c) => n[c]);
  const rows: unknown[][] = [];
  for (let i = 0; i < codes.length; i += 2) rows.push(codes.slice(i, i + 2).map((c) => ({ text: `${specLabel(specs, c, lang, true)} · ${n[c]}`, callback_data: "k:" + c })));
  rows.push([appButton(lang)]);
  await tg("sendMessage", { chat_id: chatId, text: TXT[lang].kidsH, reply_markup: { inline_keyboard: rows } });
}
async function onCallback(cb: any) {
  const lang = langOf(cb.from); const chatId = cb.message?.chat?.id; const data_ = String(cb.data ?? "");
  await tg("answerCallbackQuery", { callback_query_id: cb.id });
  if (!chatId) return;
  const all = await data();
  if (data_ === "kids") { await sendKidsMenu(chatId, lang, all.specs, all.docs); return; }
  const q = data_.match(/^q:(\d+):(.+)$/s);
  if (q) {
    const query = q[2], from = Number(q[1]);
    const found = search(all, query);
    await sendResults(chatId, lang, TXT[lang].found(found.length, query.slice(0, 60)), found, all.specs, (o) => { const d_ = `q:${o}:${query}`; return fitsCallback(d_) ? d_ : null; }, from);
    return;
  }
  const m = data_.match(/^([sk]):([a-z]+)(?::(\d+))?$/);
  if (!m || !all.specs.spec[m[2]]) return;
  await sendSpec(chatId, lang, all, m[2], m[1] === "k", Number(m[3] ?? 0));
}

/* ---------- one-time setup: no webhook (we poll), menu button, commands, descriptions ---------- */
async function setup() {
  const out: Record<string, unknown> = {};
  out.webhook = await tg("deleteWebhook", { drop_pending_updates: false });
  out.menu = await tg("setChatMenuButton", { menu_button: { type: "web_app", text: TXT.uz.menu, web_app: { url: SITE } } });
  for (const lang of ["uz", "ru"] as Lang[]) {
    const t = TXT[lang]; const lc = lang === "ru" ? "ru" : undefined;
    const cmds = [{ command: "start", description: t.cmdStart }, { command: "bolalar", description: t.cmdKids }, { command: "help", description: t.cmdHelp }];
    out["commands_" + lang] = await tg("setMyCommands", lc ? { commands: cmds, language_code: lc } : { commands: cmds });
    out["desc_" + lang] = await tg("setMyDescription", lc ? { description: t.desc, language_code: lc } : { description: t.desc });
    out["short_" + lang] = await tg("setMyShortDescription", lc ? { short_description: t.short, language_code: lc } : { short_description: t.short });
  }
  out.me = await tg("getMe", {});
  return out;
}

/* ---------- long polling: one call works for ~50 s, the next call comes from pg_cron a minute later ---------- */
async function poll(seconds = 50) {
  const until = Date.now() + seconds * 1000;
  let offset = 0, handled = 0;
  while (Date.now() < until - 2000) {
    const wait = Math.max(1, Math.min(20, Math.floor((until - Date.now()) / 1000) - 2));
    const r = await tg("getUpdates", offset ? { offset, timeout: wait, allowed_updates: ["message", "callback_query"] } : { timeout: wait, allowed_updates: ["message", "callback_query"] });
    if (!r.ok) break;                                   // e.g. 409: another call is already polling
    for (const upd of r.result ?? []) {
      offset = upd.update_id + 1;
      try {
        if (upd.message) await onMessage(upd.message);
        else if (upd.callback_query) await onCallback(upd.callback_query);
        handled++;
      } catch (e) { console.error("update failed", e); }
    }
  }
  if (offset) await tg("getUpdates", { offset, timeout: 0, limit: 1 });   // confirm what was handled
  return handled;
}

Deno.serve(async (req: Request) => {
  if (!TOKEN) return new Response("TELEGRAM_BOT_TOKEN secret is not set", { status: 500 });
  if (req.method === "POST" && new URL(req.url).searchParams.get("poll") === "1") {
    const job = poll(50);
    // keep working after answering pg_cron right away
    const rt = (globalThis as any).EdgeRuntime;
    if (rt && typeof rt.waitUntil === "function") { rt.waitUntil(job); return new Response("polling", { status: 202 }); }
    return new Response("handled " + await job);
  }
  const url = new URL(req.url);
  if (req.method === "GET") {
    if (url.searchParams.get("setup") === "1") {
      const r = await setup();
      const me = (r.me as any)?.result;
      const ok = (r.webhook as any)?.ok;
      return new Response(JSON.stringify({ ok, bot: me ? "@" + me.username : null, steps: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v as any)?.ok])) }, null, 2),
        { headers: { "Content-Type": "application/json; charset=utf-8" } });
    }
    return new Response("Shifokor top bot", { status: 200 });
  }
  if (req.method !== "POST") return new Response("", { status: 405 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== await webhookSecret()) return new Response("", { status: 401 });
  try {
    const upd = await req.json();
    if (upd.message) await onMessage(upd.message);
    else if (upd.callback_query) await onCallback(upd.callback_query);
  } catch (e) {
    console.error("update failed", e);
  }
  return new Response("ok");
});
