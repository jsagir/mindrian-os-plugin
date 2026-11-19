#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261118-x1g: the Part 8 typed proof for every profiled script.
 *
 * Owner rulings 2026-11-19: OWNER-REDUCE (less egress blocking; no rule is
 * stricter than the English rule in any script), OWNER-R35 (a body is 3 or
 * more sentences or more than 4,000 characters, in every script), OWNER-FP
 * (first person at English parity), OWNER-HE (exact English parity for
 * Hebrew), OWNER-H7A (the two H7a rows follow their English twins) and
 * OWNER-P (keep every recent leak fix: Holes A to E, the mixed-script token
 * rule, the confusable fold, a prefix glued to a Latin term).
 *
 * Groups (--group NAME, default all; --only ID,ID for the unit behaviours):
 *   unit         U1 to U8 and U10 on lib/core/part8-script-proof.cjs, the
 *                lexicon and the shape helper
 *   matrix       the generic control rows (allow) and the room-content rows
 *                (block) of en, es, he, ru, uk, ar, zh, ja, el, ko and hi
 *   shape        L3900 (2 sentences, edge, allow) and L4100 (body)
 *   contact      emails, phones and identifiers (block)
 *   body         3-sentence bodies (body_shape)
 *   firstperson  P1 sprouts, short-edge parity rows, P2 statements
 *   split        the shape split of the private markers (zh and he)
 *   fold         niqqud, harakat, tatweel; single-token caseless rooms
 *   mixed        Hole A rows, mixed and homoglyph rows, the W2 affix rows
 *   unprovable   unprofiled scripts block with NON_LATIN_REASON
 *   typed        the typed shape arm (Hole E)
 *   parity       H7a rows and their English twins
 *   hook         the PreToolUse hook on 3 spawns
 *   lazy         an ASCII question never loads part8-script-proof.cjs
 *   fuzz         seeded variants of every sensitive ingredient and of every
 *                generic control row
 *   noroom       a room-content row allows with no room bound and blocks in
 *                its own room; a single generic word allows; a test-395 paste
 *                row allows only with a cut (owner decision 2026-11-19,
 *                option A)
 *
 * Required (not run), the file exports FIXTURES and runs nothing.
 *
 * Part 8: every sentence is invented. No real room, name or identifier.
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CH = function (cp) { return String.fromCharCode(cp); };
const ZWSP = CH(0x200B);
const ZWNJ = CH(0x200C);
const ZWJ = CH(0x200D);
const WJ = CH(0x2060);
const SHY = CH(0x00AD);
const BOM = CH(0xFEFF);
const NBSP = CH(0x00A0);

// ---------------------------------------------------------------------------
// The matrix fixtures (the strings of the plan, used exactly)
// ---------------------------------------------------------------------------
const L = {
  en: {
    room: { venture_name: 'Brightmoor Kiln', title: 'Toka Maxe' }, comma: ', ', sep: ' ',
    short: 'How do I run a jobs-to-be-done interview?',
    long: 'What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, and which framework should come first?',
    two: 'What is the Minto pyramid? When should I use it instead of a lean canvas?',
    term: ['How do I run a jobs-to-be-done interview for Brightmoor Kiln?'],
    narrative: 'Yesterday I met Dana Levi and she said our pricing is too high, which framework should we use?',
    pw: 'Which framework fits our secret pricing plan?',
    pos: 'Which framework fits my startup?',
    body: ['The board plans to fire the founder after the audit. The lead investor wants out before the round. The pilot failed and nobody told the regulator.'],
    email: 'dana.levi@example.com', idn: 'dana at example dot com', phone: '+972 50 123 4567', native: '+٩٧٢ ٥٠ ١٢٣ ٤٥٦٧',
  },
  es: {
    room: { venture_name: 'Brasa Lunar' }, comma: ', ', sep: ' ',
    short: '¿Cómo hago una entrevista de jobs-to-be-done?',
    long: '¿Cuál es la diferencia entre un saliente inverso y un cuello de botella cuando mapeo un sistema técnico, y qué marco conviene aplicar primero?',
    two: '¿Qué es el lienzo lean? ¿Cuándo conviene usarlo en lugar de un análisis de cinco fuerzas?',
    term: ['¿Cómo hago una entrevista de jobs-to-be-done para Brasa Lunar?'],
    narrative: 'Ayer me reuní con Lucía Romero y dijo que nuestros precios son demasiado altos, ¿qué marco conviene?',
    pw: '¿Qué marco sirve para el plan secreto?',
    pos: '¿Qué marco uso para mi empresa?',
    body: ['La junta planea despedir al fundador después de la auditoría. El inversor principal quiere salir antes de la ronda. El piloto falló y nadie avisó al regulador.'],
    email: 'lucia.romero@ejemplo.com', idn: 'lucia arroba ejemplo punto com', phone: '+34 612 345 678', native: '＋３４ ６１２ ３４５ ６７８',
  },
  he: {
    room: { venture_name: 'מבצע חרצית' }, comma: ', ', sep: ' ',
    short: 'איך מריצים ראיון ג׳ובס טו בי דאן?',
    long: 'מה ההבדל בין ריברס סאליינט לבין צוואר בקבוק כשאני ממפה מערכת טכנולוגית, ואיזו מסגרת כדאי להפעיל קודם?',
    two: 'מה זה פירמידת מינטו? מתי להשתמש בה במקום לין קנבס?',
    term: ['איך מריצים ראיון ג׳ובס טו בי דאן במבצע חרצית?', 'איך מריצים ראיון עבור מבצע חרצית?'],
    narrative: 'אני פגשתי אתמול את דנה לוי והיא אמרה שהתמחור שלנו גבוה מדי, איזו מסגרת מתאימה?',
    pw: 'איזו מסגרת מתאימה לתוכנית הסודית?',
    pos: 'איזו מסגרת מתאימה לחברה שלי?',
    body: ['הדירקטוריון מתכנן לפטר את המייסד אחרי הביקורת. המשקיע הראשי רוצה לצאת לפני הסבב. הפיילוט במרפאה נכשל.'],
    email: 'dana@example.co.il', idn: 'דנה@דוגמה.ישראל', phone: '+972 50 123 4567', native: '+٩٧٢ ٥٠ ١٢٣ ٤٥٦٧',
  },
  ru: {
    room: { venture_name: 'Северный Янтарь' }, comma: ', ', sep: ' ',
    short: 'Как провести интервью по методу jobs-to-be-done?',
    long: 'В чём разница между обратным выступом и узким местом, когда я описываю техническую систему, и какую методику стоит применить первой?',
    two: 'Что такое пирамида Минто? Когда её лучше применять вместо лин-канваса?',
    term: ['Как провести интервью по методу jobs-to-be-done для Северного Янтаря?'],
    narrative: 'Я вчера встретил Ивана Петрова, и он сказал, что наши цены слишком высокие, какая методика подходит?',
    pw: 'Какая методика подходит для секретного плана?',
    pos: 'Какая методика подходит для нашей компании?',
    body: ['Совет директоров планирует уволить основателя после аудита. Ведущий инвестор хочет выйти до раунда. Пилот провалился, и никто не сообщил регулятору.'],
    email: 'ivan.petrov@example.com', idn: 'иван@пример.рф', phone: '+7 912 345 67 89', native: '＋７ ９１２ ３４５ ６７ ８９',
  },
  uk: {
    room: { venture_name: 'Північний Бурштин' }, comma: ', ', sep: ' ',
    short: 'Як провести інтервʼю за методом jobs-to-be-done?',
    long: 'Яка різниця між зворотним виступом і вузьким місцем, коли я описую технічну систему, і яку методику варто застосувати першою?',
    two: 'Що таке піраміда Мінто? Коли її краще застосовувати замість лін-канвасу?',
    term: ['Як провести інтервʼю для Північного Бурштину?'],
    narrative: 'Я вчора зустрів Івана Коваленка, і він сказав, що наші ціни занадто високі, яка методика підходить?',
    pw: 'Яка методика підходить для секретного плану?',
    pos: 'Яка методика підходить для нашої компанії?',
    body: ['Рада директорів планує звільнити засновника після аудиту. Провідний інвестор хоче вийти до раунду. Пілот провалився, і ніхто не повідомив регулятора.'],
    email: 'ivan.kovalenko@example.com', idn: 'іван@приклад.укр', phone: '+380 67 123 4567', native: '＋３８０ ６７ １２３ ４５６７',
  },
  ar: {
    room: { venture_name: 'نجمة الصحراء' }, comma: '، ', sep: ' ',
    short: 'كيف أجري مقابلة الوظائف المطلوب إنجازها؟',
    long: 'ما الفرق بين العنصر المتأخر وعنق الزجاجة عند رسم خريطة لنظام تقني، وأي إطار عمل يجب تطبيقه أولا؟',
    two: 'ما هو هرم مينتو؟ متى يجب استخدامه بدلا من نموذج العمل التجاري؟',
    term: ['كيف أجري مقابلة الوظائف المطلوب إنجازها لنجمة الصحراء؟'],
    narrative: 'أنا التقيت بالدكتور أحمد صالح أمس وقال إن تسعيرنا مرتفع جدا، أي إطار يناسب؟',
    pw: 'أي إطار يناسب الخطة السرية؟',
    pos: 'أي إطار يناسب شركتنا؟',
    body: ['يخطط مجلس الإدارة لفصل المؤسس بعد التدقيق. يريد المستثمر الرئيسي الخروج قبل الجولة. فشلت التجربة ولم يخبر أحد الجهة التنظيمية.'],
    email: 'ahmad.saleh@example.com', idn: 'أحمد@مثال.شبكة', phone: '+971 50 123 4567', native: '+٩٧٢ ٥٠ ١٢٣ ٤٥٦٧',
  },
  zh: {
    room: { venture_name: '星火计划' }, comma: '，', sep: '',
    short: '如何进行待办任务访谈？',
    long: '在绘制技术系统图时，反向突出点和瓶颈之间有什么区别，应该先使用哪个框架？',
    two: '什么是明托金字塔？什么时候应该用它代替精益画布？',
    term: ['如何为星火计划进行待办任务访谈？'],
    narrative: '我昨天见了王先生，他说我们的定价太高了，哪个框架合适？',
    pw: '哪个框架适合这个秘密计划？',
    pos: '哪个框架适合我的公司？',
    body: ['董事会：计划解雇创始人！投资者想退出！试点失败了！哪个框架？', '董事会计划在审计后解雇创始人。主要投资者想在下一轮之前退出。诊所试点失败了。'],
    email: 'wang.wei@example.cn', idn: '王伟@例子.中国', phone: '+86 138 1234 5678', native: '＋８１ ９０ １２３４ ５６７８',
  },
  ja: {
    room: { venture_name: '青嵐プロジェクト' }, comma: '、', sep: '',
    short: 'ジョブ理論のインタビューはどう進めますか？',
    long: '技術システムを図にするとき、リバースサリエントとボトルネックの違いは何で、どのフレームワークを先に使うべきですか？',
    two: 'ミントのピラミッドとは何ですか？リーンキャンバスの代わりにいつ使うべきですか？',
    term: ['ジョブ理論のインタビューは青嵐プロジェクトでどう進めますか？'],
    narrative: '私は昨日田中さんに会いました、彼は私たちの価格が高すぎると言いました、どのフレームワークが合いますか？',
    pw: '秘密の計画に合うフレームワークは？',
    pos: '私の会社に合うフレームワークは？',
    body: ['取締役会：創業者を解雇する予定です！主要投資家は撤退したい！試験は失敗した！どのフレームワーク？'],
    email: 'tanaka@example.jp', idn: '田中@例え.テスト', phone: '+81 90 1234 5678', native: '＋８１ ９０ １２３４ ５６７８',
  },
  el: {
    room: { venture_name: 'Βόρειο Κεχριμπάρι' }, comma: ', ', sep: ' ',
    short: 'Πώς κάνω μια συνέντευξη jobs-to-be-done;',
    long: 'Ποια είναι η διαφορά ανάμεσα σε ένα αντίστροφο σημείο και ένα σημείο συμφόρησης όταν χαρτογραφώ ένα τεχνικό σύστημα, και ποιο πλαίσιο πρέπει να εφαρμόσω πρώτα;',
    two: 'Τι είναι η πυραμίδα του Μίντο; Πότε να τη χρησιμοποιήσω αντί για ένα λιν καμβά;',
    term: ['Πώς κάνω μια συνέντευξη για την ομάδα του Βόρειου Κεχριμπαριού;'],
    narrative: 'Εγώ συνάντησα χθες τη Δανάη Λεβή και είπε ότι η τιμολόγησή μας είναι πολύ υψηλή, ποιο πλαίσιο ταιριάζει;',
    pw: 'Ποιο πλαίσιο ταιριάζει στο μυστικό σχέδιο;',
    pos: 'Ποιο πλαίσιο ταιριάζει στην εταιρεία μου;',
    body: ['Το διοικητικό συμβούλιο σχεδιάζει να απολύσει τον ιδρυτή μετά τον έλεγχο. Ο βασικός επενδυτής θέλει να αποχωρήσει πριν από τον γύρο. Το πιλοτικό απέτυχε και κανείς δεν ενημέρωσε τη ρυθμιστική αρχή.'],
    email: 'danai@example.gr', idn: 'δανάη@παράδειγμα.ελ', phone: '+30 69 1234 5678', native: '+30 69 1234 5678',
  },
  ko: {
    room: { venture_name: '북쪽 호박' }, comma: ', ', sep: ' ',
    short: '잡스 투 비 던 인터뷰는 어떻게 진행하나요?',
    long: '기술 시스템을 매핑할 때 역방향 돌출점과 병목 현상의 차이는 무엇이며, 어떤 프레임워크를 먼저 적용해야 하나요?',
    two: '민토 피라미드란 무엇인가요? 린 캔버스 대신 언제 사용해야 하나요?',
    term: ['잡스 투 비 던 인터뷰를 북쪽 호박에서 어떻게 진행하나요?'],
    narrative: '저는 어제 김민수 씨를 만났는데 우리 가격이 너무 높다고 했어요, 어떤 프레임워크가 맞나요?',
    pw: '비밀 계획에는 어떤 프레임워크가 맞나요?',
    pos: '우리 회사에는 어떤 프레임워크가 맞나요?',
    body: ['이사회는 감사 후에 창업자를 해고할 계획입니다. 주요 투자자는 라운드 전에 나가고 싶어 합니다. 파일럿은 실패했고 아무도 규제 기관에 알리지 않았습니다.'],
    email: 'minsu@example.kr', idn: '민수@예시.한국', phone: '+82 10 1234 5678', native: '+82 10 1234 5678',
  },
  hi: {
    room: { venture_name: 'उत्तरी अंबर' }, comma: ', ', sep: ' ',
    short: 'जॉब्स-टू-बी-डन इंटरव्यू कैसे करें?',
    long: 'तकनीकी प्रणाली का नक्शा बनाते समय रिवर्स सैलिएंट और बॉटलनेक में क्या अंतर है, और पहले कौन सा फ्रेमवर्क लागू करना चाहिए?',
    two: 'मिंटो पिरामिड क्या है? लीन कैनवास की जगह इसे कब इस्तेमाल करना चाहिए?',
    term: ['उत्तरी अंबर के लिए जॉब्स-टू-बी-डन इंटरव्यू कैसे करें?'],
    narrative: 'मैं कल श्री राहुल शर्मा से मिला और उन्होंने कहा कि हमारी कीमत बहुत ज\u093C्यादा है, कौन सा फ्रेमवर्क ठीक है?',
    pw: 'गुप्त योजना के लिए कौन सा फ्रेमवर्क ठीक है?',
    pos: 'मेरी कंपनी के लिए कौन सा फ्रेमवर्क ठीक है?',
    body: ['बोर्ड ऑडिट के बाद संस्थापक को निकालने की योजना बना रहा है। मुख्य निवेशक राउंड से पहले बाहर निकलना चाहता है। पायलट विफल रहा और किसी ने नियामक को नहीं बताया।'],
    email: 'rahul@example.in', idn: 'राहुल@उदाहरण.भारत', phone: '+91 98765 43210', native: '+९१ ९८७६५ ४३२१०',
  },
};
const LANGS = Object.keys(L);

// First person (OWNER-FP).
const P1_SPROUTS = {
  en: ['I want to understand how JTBD works?'],
  es: ['¿Yo debería usar JTBD primero?'],
  ru: ['Я хочу понять, как работает JTBD?'],
  uk: ['Я хочу зрозуміти, як працює JTBD?'],
  ar: ['أنا أريد أن أفهم كيف يعمل JTBD؟'],
  he: ['אני רוצה להבין איך עובד JTBD?'],
  zh: ['我应该先用哪个框架？', '我们想收购一家公司，该用哪个框架？'],
  ja: ['私はどのフレームワークを使うべきですか？'],
  el: ['Εγώ θέλω να καταλάβω πώς λειτουργεί το JTBD;'],
  ko: ['저는 JTBD가 어떻게 작동하는지 알고 싶어요?'],
  hi: ['मैं समझना चाहता हूँ कि JTBD कैसे काम करता है?'],
};
const SHORT_EDGE_PARITY = [
  'I want to know which framework fits a wicked problem when the market is new and the stage is discovery?',
  'Я хочу понять, какая методика подходит для сложной задачи, когда рынок новый, а стадия поиска только началась?',
  '我想知道当市场是新的而且阶段是探索时哪个框架适合棘手的问题？',
];
const P2_ROWS = [
  'The price fell because we changed the plan after the audit and the team left the market',
  'המחיר ירד כי אנחנו שינינו את התוכנית אחרי הביקורת והצוות עזב את השוק',
  'Цены упали, потому что мы изменили план после аудита, и команда ушла с рынка',
  'Los precios bajaron porque nosotros cambiamos el plan después de la auditoría',
];

// The shape split (OWNER-REDUCE, OWNER-HE): each row is a short edge.
const SPLIT_ALLOW = [
  '在下一个发现阶段之前，分析这个秘密计划的最佳框架是什么？',
  'מה המסגרת הטובה ביותר לניתוח התוכנית הסודית לפני השלב הבא של הגילוי והבדיקה בשוק?',
  'איזו מסגרת מתאימה לעבודת התזה שלי על נקודות תורפה בשרשראות אספקה של סוללות בשוק החדש?',
  'אני רוצה לדעת איזו מסגרת מתאימה לבעיה מרושעת כשהשוק חדש והשלב הוא גילוי בתחילת הדרך?',
];
const SPLIT_BLOCK = [
  '在下一个发现阶段之前，分析这个机密计划的最佳框架是什么？',
  'מה המסגרת הטובה ביותר לניתוח מסמך חסוי לפני השלב הבא של הגילוי והבדיקה בשוק?',
  'איזו מסגרת מתאימה לבדוק את התמחור שלנו לפני השלב הבא של הגילוי והבדיקה בשוק?',
];
// The English twins of the split rows (Facts 3, PROVEN at planning time).
const SPLIT_TWINS = [
  ['What is the best framework to analyse the secret plan before the next stage of discovery?', 'allow'],
  ['Which framework fits my thesis work on weak points in battery supply chains in the new market?', 'allow'],
  ['What is the best framework to analyse the confidential plan before the next stage of discovery?', 'block'],
  ['Which framework fits for checking our pricing before the next stage of discovery and market testing?', 'block'],
];

// Fold rows (block).
const FOLD_ROWS = {
  he: ['איך מנתחים מ\u05B4ב\u05B0צ\u05B8ע ח\u05B7ר\u05B0צ\u05B4ית?', 'מה התוכנית הס\u05BCוֹד\u05B4ית?'],
  ar: ['ما هي ن\u064Eج\u0652م\u064Eة الص\u064E\u0651ح\u0652ر\u064Eاء؟', 'ما هي نج\u0640مة الصح\u0640راء؟'],
};
const SINGLE_ROOMS = [
  { key: 'zh1', name: '星火计划', q: '星火计划适合哪个框架？' },
  { key: 'ja1', name: '青嵐', q: '青嵐のためのフレームワークは何ですか？' },
  { key: 'he1', name: 'חרצית', q: 'איך מנתחים את חרצית?' },
];

// Hole A completeness (en room; block).
const HOLE_A = ['איך מריצים ראיון בBrightmoor Kiln?', 'איך מריצים ראיון ב-Brightmoor Kiln?', 'كيف أجري مقابلة وBrightmoor Kiln؟', 'كيف أجري مقابلة لBrightmoor Kiln؟'];
// Mixed and homoglyph rows (en room).
const MIXED_BLOCK = [
  'How do I run a jobs-to-be-done interview for Тока Махе?',
  'How do I run a jobs-to-be-done interview for ΤΟΚΑ ΜΑΧΕ?',
  'How do I run a jobs-to-be-done interview for Brightмoor Kiln?',
  'What is SWOT for ACMEкод?',
];
const MIXED_ALLOW = ['מה זה בSWOT ואיך משתמשים בו?', '什么是SWOT分析？', 'JTBD가 무엇인가요?'];
const AFFIX_ALLOW = ['Какие этапы у SWOTа?', 'Какие этапы у JTBDа?', 'Как сделать SWOT-анализ для нового рынка?', 'איך משתמשים ב-SWOT בשלב הגילוי?',
  'איזו מסגרת קודמת ל-JTBD?', 'מה זה ה׳JTBD?', 'كيف أستخدم ال\u0640SWOT في مرحلة الاكتشاف؟'];
const AFFIX_BLOCK = ['איך מריצים ראיון בBrightmoor?', 'Как провести интервью для Brightmoorа?', 'كيف أجري مقابلة ل\u0640Brightmoor؟'];

// Unprovable scripts (block, NON_LATIN_REASON).
const UNPROVABLE = ['SWOT คืออะไร', 'چگونه یک مصاحبه انجام دهم؟', 'Шта је SWOT и како га применити?', 'Ինչ է SWOT-ը?', 'რა არის SWOT?', 'SWOT কী?'];

// Typed shape arm rows.
const TYPED_BLOCK = ['私たちの秘密の計画について教えてください', '我们的投资人在审计后离开了', 'Наш ведущий инвестор ушёл после аудита'];
const TYPED_BLOCK_EN_ROOM = ['How do I run a jobs-to-be-done interview for Тока Махе?'];
const TYPED_ALLOW = ['如何进行待办任务访谈？', 'Τι είναι το SWOT;', '스왓 분석이란 무엇입니까?'];

// The bare-name rows (OWNER-REDUCE: allow) and the bare-name edge (residual 1).
const BARE_NAME_ALLOW = ['דנה לוי עזבה אחרי הביקורת', '王小明在审计后离开了', 'Dana Levi left after the audit',
  'דנה לוי עזבה אחרי הביקורת והמייסד רוצה לפטר את הצוות כולו מחר בבוקר'];
const MORE_ALLOW = ['私立大学の評価方法は？'];

// The noroom rows (owner decision 2026-11-19, option A, for check 10 b1): a non-English room-content row allows when
// no room is bound and keeps its own-room block (the English term rows are not b1 rows: with no room the English
// name rule still blocks their edge form); a single generic word allows (English: "founder"); a paste row of
// tests/test-395-egress-leaks.cjs allows only with a cut, and the paste never stays in the sent text.
const NOROOM_WORDS = ['创始人', 'המייסד', 'הדירקטוריון', 'основателя', 'аудита', 'מבצע-חרצית', 'לבחור', 'מסגרת', 'עבור', 'הפרויקט', 'של', 'הצוות'];
const NOROOM_CUT = [
  ['הסבר את הטקסט "הדירקטוריון מתכנן לפטר את המייסד אחרי הביקורת והמשקיע רוצה לצאת" עם איזו מסגרת?', 'המייסד'],
  ['объясни текст "совет директоров уволит основателя после аудита" какой метод?', 'основателя'],
];
// [text, own room key or null]. The own room is the room whose lexicon names the term.
function noroomRows(fuzzBlock) {
  const out = [];
  Object.keys(L).filter(function (lang) { return lang !== 'en'; }).forEach(function (lang) { L[lang].term.forEach(function (t) { out.push([t, lang]); }); });
  fuzzBlock.filter(function (x) { return x.ing === 'term' && x.room !== 'en'; }).forEach(function (x) { out.push([x.text, x.room]); });
  out.push([FOLD_ROWS.he[0], 'he'], [FOLD_ROWS.ar[0], 'ar'], [FOLD_ROWS.ar[1], 'ar']);
  HOLE_A.slice(2).forEach(function (t) { out.push([t, 'en']); }); // the Arabic rows (START allowed the Hebrew rows with no room)
  out.push([MIXED_BLOCK[1], 'en']); // the Greek lookalike row (the Cyrillic one meets the name rule, the mixed one the mixed-script rule)
  AFFIX_BLOCK.slice(1).forEach(function (t) { out.push([t, 'enb']); }); // START allowed the Hebrew row with no room
  SINGLE_ROOMS.slice(0, 2).forEach(function (x) { out.push([x.q, x.key]); }); // START allowed the Hebrew row with no room
  NOROOM_WORDS.forEach(function (t) { out.push([t, t === 'מבצע-חרצית' ? 'heFolder' : null]); });
  return out;
}

// The H7a rows and their English twins (OWNER-H7A).
const H7A = [
  ['המשקיע הראשי עזב אחרי הביקורת והמייסד רוצה לפטר את הצוות', 'The lead investor left after the audit and the founder wants to fire the team'],
  ['המשקיע הראשי עזב אחרי הביקורת והמייסד רוצה לפטר את הצוות, איזו מסגרת מתאימה לנו עכשיו?',
    'The lead investor left after the audit and the founder wants to fire the team, which framework fits us now?'],
];

// A Hebrew narrative with a title cue (U6). The matrix Hebrew narrative holds
// no title cue (it blocks by its possessive), so U6 reads this twin.
const HE_CUE_NARRATIVE = 'פגשתי אתמול את ד"ר דנה לוי והיא אמרה שהמחיר גבוה מדי, איזו מסגרת מתאימה?';

// The START expectations (computed on the clean START tree, quick 261118-x1g Task 1):
// the en room lexicon entries (the room_name entry masked) and the shape of every ASCII fixture.
const START_EN_ENTRIES = [{"kind":"venture_name","text":"Brightmoor Kiln","tokens":["brightmoor","kiln"],"needle":" brightmoor kiln "},{"kind":"venture_name","text":"Toka Maxe","tokens":["toka","maxe"],"needle":" toka maxe "},{"kind":"room_name","text":"<room>","tokens":["<room>"],"needle":"<room>"}];
const START_ASCII_SHAPES = { "How do I run a jobs-to-be-done interview?": "{\"kind\":\"sprout\",\"words\":10,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, and which framework should come first?": "{\"kind\":\"edge\",\"words\":24,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "What is the Minto pyramid? When should I use it instead of a lean canvas?": "{\"kind\":\"edge\",\"words\":15,\"sentences\":2,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and? What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and?": "{\"kind\":\"edge\",\"words\":666,\"sentences\":2,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":true,\"reason\":\"string_too_long\"}", "How do I run a jobs-to-be-done interview for Brightmoor Kiln?": "{\"kind\":\"edge\",\"words\":13,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "Yesterday I met Dana Levi and she said our pricing is too high, which framework should we use?": "{\"kind\":\"edge\",\"words\":18,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "Which framework fits our secret pricing plan?": "{\"kind\":\"sprout\",\"words\":7,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "Which framework fits my startup?": "{\"kind\":\"sprout\",\"words\":5,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "The board plans to fire the founder after the audit. The lead investor wants out before the round. The pilot failed and nobody told the regulator.": "{\"kind\":\"body\",\"words\":26,\"sentences\":3,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system? What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system, What is the difference between a reverse salient and a bottleneck when I am mapping a technical system?": "{\"kind\":\"body\",\"words\":720,\"sentences\":3,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":\"string_too_long\"}", "How do I run a jobs-to-be-done interview? dana.levi@example.com": "{\"kind\":\"edge\",\"words\":11,\"sentences\":2,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "How do I run a jobs-to-be-done interview? dana at example dot com": "{\"kind\":\"edge\",\"words\":15,\"sentences\":2,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "How do I run a jobs-to-be-done interview? +972 50 123 4567": "{\"kind\":\"edge\",\"words\":14,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "How do I run a jobs-to-be-done interview? ACME2026X": "{\"kind\":\"edge\",\"words\":11,\"sentences\":2,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "I want to understand how JTBD works?": "{\"kind\":\"sprout\",\"words\":7,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "I want to know which framework fits a wicked problem when the market is new and the stage is discovery?": "{\"kind\":\"edge\",\"words\":20,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "Dana Levi left after the audit": "{\"kind\":\"sprout\",\"words\":6,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "The lead investor left after the audit and the founder wants to fire the team": "{\"kind\":\"edge\",\"words\":15,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "The lead investor left after the audit and the founder wants to fire the team, which framework fits us now?": "{\"kind\":\"edge\",\"words\":20,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":false,\"longEdge\":false,\"reason\":null}", "The price fell because we changed the plan after the audit and the team left the market": "{\"kind\":\"edge\",\"words\":17,\"sentences\":1,\"lines\":0,\"quoted\":false,\"firstPersonStatement\":true,\"longEdge\":false,\"reason\":null}" };

// ---------------------------------------------------------------------------
// Builders (pure)
// ---------------------------------------------------------------------------
function nfkc(s) { return s.normalize('NFKC').replace(/\p{Cf}/gu, ''); }
function firstClause(lang) {
  const d = L[lang];
  if (lang === 'zh' || lang === 'ja') return d.long.replace(/[？?]$/u, '');
  return d.long.split(d.comma.trim())[0].trim();
}
// One sentence of copies of the first clause, joined with the language comma,
// with a final question mark; its normalised length is within [lo, hi].
function buildSentence(lang, lo, hi) {
  const d = L[lang];
  const clause = firstClause(lang);
  const q = (lang === 'zh' || lang === 'ja') ? '？' : (lang === 'ar' ? '؟' : (lang === 'el' ? ';' : '?'));
  let s = clause;
  while (nfkc(s + d.comma + clause + q).length <= hi) s += d.comma + clause;
  if (nfkc(s + q).length < lo) {
    const units = (lang === 'zh' || lang === 'ja') ? Array.from(clause) : clause.split(' ');
    const joiner = (lang === 'zh' || lang === 'ja') ? '' : ' ';
    let tail = '';
    for (let i = 0; i < units.length; i += 1) {
      const next = tail + (tail && joiner) + units[i];
      if (nfkc(s + d.comma + next + q).length > hi) break;
      tail = next;
      if (nfkc(s + d.comma + tail + q).length >= lo) break;
    }
    if (tail) s += d.comma + tail;
  }
  return s + q;
}
function buildLong(lang, lo, hi) {
  const d = L[lang];
  return buildSentence(lang, lo, hi) + d.sep + buildSentence(lang, lo, hi);
}

// mulberry32, seed 261118.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The 20 punctuation variants of a control row (each must allow).
function punctVariants(s, lang) {
  const sp = s.indexOf(' ');
  const end = s.slice(-1);
  const body = s.slice(0, -1);
  const fw = { '?': '？', ';': CH(0x037E), '؟': '؟' }[end] || end;
  const mid = Math.floor(s.length / 2);
  const out = [
    s,
    s + ' ',
    ' ' + s,
    sp > 0 ? s.slice(0, sp) + '  ' + s.slice(sp + 1) : s + '  ',
    sp > 0 ? s.slice(0, sp) + NBSP + s.slice(sp + 1) : NBSP + s,
    s.slice(0, 1) + ZWSP + s.slice(1),
    s.slice(0, 2) + ZWJ + s.slice(2),
    body + WJ + end,
    s.slice(0, mid) + SHY + s.slice(mid),
    BOM + s,
    body + end + end,
    body + fw,
    body + ' ' + end,
    s + '\t',
    s.lastIndexOf(' ') > 0 ? s.slice(0, s.lastIndexOf(' ')) + '  ' + s.slice(s.lastIndexOf(' ') + 1) : s + ' ',
    s.replace(', ', '，'),
    s.slice(0, mid) + ZWNJ + s.slice(mid),
    insertMark(s, lang),
    s.normalize('NFD'),
    s + '  ',
  ];
  return out;
}
// One mark (Hebrew point, Arabic tatweel) inside a word, or a ZWSP.
function insertMark(s, lang) {
  if (lang === 'he') {
    const i = s.search(/\p{Script=Hebrew}/u);
    return i >= 0 ? s.slice(0, i + 1) + CH(0x05B0) + s.slice(i + 1) : s;
  }
  if (lang === 'ar') {
    const m = /\p{Script=Arabic}{3,}/u.exec(s.slice(4));
    if (m) { const i = 4 + m.index + 1; return s.slice(0, i) + CH(0x0640) + s.slice(i); }
    return s;
  }
  return s.slice(0, 3) + ZWSP + s.slice(3);
}
// A sensitive variant: whitespace, format characters, fullwidth end marks,
// and (Hebrew, Arabic) marks inside words.
function sensitiveVariant(s, lang, r) {
  let t = s;
  const pick = Math.floor(r() * 8);
  if (pick === 0) t = t + ' ';
  if (pick === 1) t = t.replace(/\?$/u, '？');
  if (pick === 2) { const i = 1 + Math.floor(r() * (t.length - 1)); t = t.slice(0, i) + [ZWSP, ZWJ, WJ, SHY][Math.floor(r() * 4)] + t.slice(i); }
  if (pick === 3) t = t.replace(' ', NBSP);
  if (pick === 4) t = t.replace(' ', '  ');
  if (pick === 5 && lang === 'he') {
    const idx = []; for (let i = 0; i < t.length; i += 1) if (/\p{Script=Hebrew}/u.test(t[i])) idx.push(i);
    if (idx.length) { const i = idx[Math.floor(r() * idx.length)]; t = t.slice(0, i + 1) + [CH(0x05B0), CH(0x05B4), CH(0x05B8), CH(0x05BC)][Math.floor(r() * 4)] + t.slice(i + 1); }
  }
  if (pick === 6 && lang === 'ar') {
    const idx = []; for (let i = 1; i < t.length; i += 1) if (/\p{Script=Arabic}/u.test(t[i - 1]) && /\p{Script=Arabic}/u.test(t[i])) idx.push(i);
    if (idx.length) { const i = idx[Math.floor(r() * idx.length)]; t = t.slice(0, i) + [CH(0x0640), CH(0x064E), CH(0x0650)][Math.floor(r() * 3)] + t.slice(i); }
  }
  if (pick === 7) t = BOM + t;
  return t;
}

// The sensitive ingredients of the fuzz (each string must block).
const ING = {
  pc: {
    en: 'Which framework fits the confidential plan?', es: '¿Qué marco sirve para el documento confidencial?', he: 'איזו מסגרת מתאימה למסמך חסוי?',
    ru: 'Какая методика подходит для конфиденциального плана?', uk: 'Яка методика підходить для конфіденційного плану?',
    ar: 'أي إطار يناسب الوثيقة للاستخدام الداخلي؟', zh: '哪个框架适合这个机密计划？', ja: '機密の計画に合うフレームワークは？',
    el: 'Ποιο πλαίσιο ταιριάζει στο εμπιστευτικό σχέδιο;', ko: '기밀 계획에는 어떤 프레임워크가 맞나요?', hi: 'गोपनीय योजना के लिए कौन सा फ्रेमवर्क ठीक है?',
  },
  posSprout: {
    en: 'Which framework fits my thesis?', es: '¿Qué marco sirve para mi tesis?', he: 'איזו מסגרת מתאימה לתזה שלי?',
    ru: 'Какая методика подходит для моей диссертации?', uk: 'Яка методика підходить для моєї дисертації?', ar: 'أي إطار يناسب خطتي؟',
    zh: '哪个框架适合我的论文？', ja: '私の論文に合うフレームワークは？', el: 'Ποιο πλαίσιο ταιριάζει στη διατριβή μου;',
    ko: '내 논문에는 어떤 프레임워크가 맞나요?', hi: 'मेरी थीसिस के लिए कौन सा फ्रेमवर्क ठीक है?',
  },
  p2: {
    en: P2_ROWS[0], he: P2_ROWS[1], ru: P2_ROWS[2], es: P2_ROWS[3], uk: 'Ціни впали, тому що ми змінили план після аудиту',
    ar: 'نحن غيرنا الخطة بعد التدقيق والفريق ترك السوق', zh: '我们在审计后改变了计划，团队离开了市场', ja: '私たちは監査の後で計画を変えました',
    el: 'Η τιμή έπεσε επειδή εμείς αλλάξαμε το σχέδιο μετά τον έλεγχο', ko: '우리는 감사 후에 계획을 바꿨고 팀은 시장을 떠났습니다',
    hi: 'कीमत गिर गई क्योंकि हम योजना बदल चुके थे',
  },
  mixed: { all: 'Brightмoor' },
};

function buildFuzz() {
  const r = rng(261118);
  const block = [];
  const allow = [];
  LANGS.forEach(function (lang) {
    const d = L[lang];
    const bases = {
      pc: [ING.pc[lang], d.long + d.sep + ING.pc[lang]],
      pw: [d.pw],
      pp: [d.pos, d.long + d.sep + d.pos],
      pos: [ING.posSprout[lang]],
      p2: [ING.p2[lang]],
      p1: P1_SPROUTS[lang],
      email: [d.short + ' ' + d.email],
      idn: [d.short + ' ' + d.idn],
      phone: lang === 'en' ? [d.short + ' ' + d.phone, d.short + ' ' + d.native] : [d.short + ' ' + d.native],
      ident: [d.short + ' ACME2026X'].concat(lang === 'ru' ? [d.short + ' АКМЕ2026Х'] : []),
      mixed: [d.short + ' ' + ING.mixed.all],
      body: d.body,
      term: d.term.map(function (t) { return { room: lang, text: t }; }),
    };
    Object.keys(bases).forEach(function (ing) {
      const list = bases[ing];
      for (let k = 0; k < 60; k += 1) {
        const b = list[k % list.length];
        const isRoom = typeof b === 'object';
        const text = sensitiveVariant(isRoom ? b.text : b, lang, r);
        block.push({ lang: lang, ing: ing, text: text, room: isRoom ? b.room : null,
          sproutOnly: ing === 'pw' || ing === 'pos' || ing === 'p1' });
      }
    });
    ['short', 'long', 'two'].forEach(function (row) {
      punctVariants(d[row], lang).forEach(function (v) { allow.push({ lang: lang, row: row, text: v }); });
    });
  });
  return { block: block, allow: allow };
}

function buildFixtures() {
  const byLang = {};
  LANGS.forEach(function (lang) {
    const d = L[lang];
    byLang[lang] = {
      allow: [d.short, d.long, d.two, buildLong(lang, 1925, 1950)].concat(lang === 'zh' ? ['王小明在审计后离开了'] : []),
      block: [].concat(d.term, [d.narrative, d.pw, d.pos], d.body, [buildLong(lang, 2050, 2095)],
        [d.short + ' ' + d.email, d.short + ' ' + d.idn, d.short + ' ' + d.phone, d.short + ' ' + d.native, d.short + ' ACME2026X'],
        P1_SPROUTS[lang]),
    };
  });
  byLang.ru.block.push(L.ru.short + ' АКМЕ2026Х');
  const fuzz = buildFuzz();
  const noroom = noroomRows(fuzz.block).map(function (r) { return r[0]; }).concat(NOROOM_CUT.map(function (r) { return r[0]; }));
  return {
    byLang: byLang,
    allow: [].concat(SHORT_EDGE_PARITY, SPLIT_ALLOW, MIXED_ALLOW, AFFIX_ALLOW, TYPED_ALLOW, BARE_NAME_ALLOW, MORE_ALLOW,
      H7A.map(function (p) { return p[0]; }), H7A.map(function (p) { return p[1]; }), noroom),
    block: [].concat(P2_ROWS, SPLIT_BLOCK, FOLD_ROWS.he, FOLD_ROWS.ar, HOLE_A, MIXED_BLOCK, AFFIX_BLOCK, UNPROVABLE, TYPED_BLOCK,
      SINGLE_ROOMS.map(function (x) { return x.q; })),
    fuzz: { allow: fuzz.allow.map(function (x) { return x.text; }), block: fuzz.block.map(function (x) { return x.text; }) },
    _fuzzRows: fuzz,
  };
}

const FIXTURES = buildFixtures();

if (require.main !== module) {
  module.exports = { FIXTURES: FIXTURES, L: L };
  return;
}

// ---------------------------------------------------------------------------
// Run: isolate HOME and the room registry before any plugin module loads
// ---------------------------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-x1g-'));
fs.mkdirSync(path.join(TMP, 'home'));
fs.mkdirSync(path.join(TMP, 'rooms'));
process.env.HOME = path.join(TMP, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;

const args = process.argv.slice(2);
function argOf(flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; }
const GROUP = argOf('--group');
const ONLY = (argOf('--only') || '').split(',').filter(Boolean);
function want(group) { return !GROUP || GROUP === group; }
function wantUnit(id) { return ONLY.length === 0 || ONLY.indexOf(id) !== -1; }

const GUARD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const PROOF_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-script-proof.cjs');
const guard = require(GUARD_PATH);
const lexMod = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-room-lexicon.cjs'));
const shapeMod = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-sprout-shape.cjs'));
const egress = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));

let proof = null;
function getProof() {
  if (proof) return proof;
  proof = require(PROOF_PATH);
  return proof;
}

const NON_LATIN_REASON = 'the string carries a token outside the Latin methodology vocabulary; no methodology handle matches it';

// One room per language, the 3 single-token caseless rooms and the en-b room.
function makeRoom(dir, fm) {
  fs.mkdirSync(dir, { recursive: true });
  const lines = ['---'];
  Object.keys(fm).forEach(function (k) { lines.push(k + ': ' + fm[k]); });
  lines.push('---', '', '# Invented room for test-261118-x1g. Not a real room.', '');
  fs.writeFileSync(path.join(dir, 'ROOM.md'), lines.join('\n'));
  return dir;
}
const ROOMS = {};
LANGS.forEach(function (lang) { ROOMS[lang] = makeRoom(path.join(TMP, 'x1g-' + lang), L[lang].room); });
SINGLE_ROOMS.forEach(function (x) { ROOMS[x.key] = makeRoom(path.join(TMP, 'x1g-' + x.key), { venture_name: x.name }); });
ROOMS.enb = makeRoom(path.join(TMP, 'x1g-enb'), { venture_name: 'Brightmoor' });
ROOMS.heFolder = makeRoom(path.join(TMP, 'מבצע-חרצית'), {});

let passed = 0;
let failed = 0;
const failKeys = [];
function check(id, name, fn) {
  const probs = [];
  try {
    fn(probs);
  } catch (err) {
    probs.push('threw: ' + (err && err.message ? err.message : String(err)));
  }
  if (probs.length === 0) {
    passed += 1;
    console.log('  ok - ' + id + ' ' + name);
  } else {
    failed += 1;
    failKeys.push(id);
    console.log('  FAIL - ' + id + ' ' + name);
    probs.slice(0, 12).forEach(function (p) { console.log('    ' + p); });
    if (probs.length > 12) console.log('    (' + (probs.length - 12) + ' more)');
  }
}
function tag(v) { return v.verdict + ' ' + v.class + '/' + v.token_class; }
function cut(q, roomDir) { return guard.classifyAndCut({ question: q }, { toolName: 'brain_ask', roomDir: roomDir === undefined ? null : roomDir }).verdict; }
function cls(q, roomDir) { return guard.classify({ question: q }, { toolName: 'brain_ask', roomDir: roomDir === undefined ? null : roomDir }); }
function shapeOf(q) { return shapeMod.classifyShape(nfkc(q)); }
function short(s) { return JSON.stringify(s.length > 70 ? s.slice(0, 70) + '...' : s); }
function expectAllow(p, q, roomDir, label) {
  const a = cls(q, roomDir);
  const b = cut(q, roomDir);
  if (a.verdict !== 'allow' || b.verdict !== 'allow') p.push((label || '') + short(q) + ' classify ' + tag(a) + ' cut ' + tag(b));
}
function expectBlock(p, q, roomDir, label) {
  const a = cls(q, roomDir);
  const b = cut(q, roomDir);
  if (a.verdict !== 'block' || b.verdict !== 'block') p.push((label || '') + short(q) + ' classify ' + tag(a) + ' cut ' + tag(b));
  return b;
}

console.log('Quick 261118-x1g: the Part 8 typed proof for every script\n');

// ---------------------------------------------------------------------------
// unit
// ---------------------------------------------------------------------------
const ASCII_ID_RULE = function (s) {
  const re = /(?<![A-Za-z0-9])[A-Z0-9]{5,}(?![A-Za-z0-9])/g;
  let m;
  while ((m = re.exec(s)) !== null) if (/[0-9]/.test(m[0]) && /[A-Z]/.test(m[0])) return true;
  return false;
};
function allProfiledStrings() {
  const out = [];
  LANGS.forEach(function (lang) { out.push.apply(out, FIXTURES.byLang[lang].allow); out.push.apply(out, FIXTURES.byLang[lang].block); });
  return out.concat(FOLD_ROWS.he, FOLD_ROWS.ar);
}
function genericRows() {
  const out = [];
  LANGS.forEach(function (lang) { out.push(L[lang].short, L[lang].long, L[lang].two, buildLong(lang, 1925, 1950)); });
  return out;
}
const SPROUT = { kind: 'sprout', longEdge: false };
const SHORT_EDGE = { kind: 'edge', longEdge: false };

if (want('unit')) {
  if (wantUnit('U1')) check('U1', 'hasUnprovableScript: false for the profiled fixtures, true for the 6 unprovable rows', function (p) {
    const m = getProof();
    allProfiledStrings().forEach(function (s) { if (m.hasUnprovableScript(nfkc(s))) p.push('true for ' + short(s)); });
    UNPROVABLE.forEach(function (s) { if (!m.hasUnprovableScript(nfkc(s))) p.push('false for ' + short(s)); });
  });
  if (wantUnit('U2')) check('U2', 'checkView folds marks, tatweel and digits; confusableFold folds lookalikes', function (p) {
    const m = getProof();
    const rows = [
      ['ש\u05B8\u05C1לוֹם', 'שלום'], ['ن\u064Eج\u0652م\u064Eة', 'نجمة'], ['نج\u0640مة', 'نجمة'], ['πώς', 'πως'], ['मैं', 'म'], ['٤٥٦', '456'], ['९८७', '987'],
      ['How do I run a jobs-to-be-done interview?', 'How do I run a jobs-to-be-done interview?'],
    ];
    rows.forEach(function (r) { if (m.checkView(r[0]) !== r[1]) p.push(JSON.stringify(r[0]) + ' -> ' + JSON.stringify(m.checkView(r[0]))); });
    if (m.foldDigits('+٩٧٢') !== '+972') p.push('foldDigits');
    if (m.confusableFold('Тока Махе') !== 'Toka Maxe') p.push('confusableFold Cyrillic: ' + m.confusableFold('Тока Махе'));
    if (m.confusableFold('ΤΟΚΑ ΜΑΧΕ') !== 'TOKA MAXE') p.push('confusableFold Greek: ' + m.confusableFold('ΤΟΚΑ ΜΑΧΕ'));
  });
  if (wantUnit('U3')) check('U3', 'isQuestionText: T3 words, final marks, particles; false for P2 rows', function (p) {
    const m = getProof();
    ['qué es SWOT', 'как работает SWOT', 'як працює SWOT', 'איך עובד SWOT', 'כיצד בוחרים מסגרת', 'كيف يعمل SWOT', '如何使用这个框架', 'どう使うのが良い',
      'τι είναι το SWOT', '무엇이 SWOT 인가', 'क्या है SWOT', 'what about SWOT?', 'ما هو SWOT؟', 'Τι είναι το SWOT;',
      '这是一个框架吗', 'これはフレームワークですか', 'SWOT은 좋은가요'].forEach(function (s) {
      if (!m.isQuestionText(nfkc(s))) p.push('false for ' + short(s));
    });
    P2_ROWS.concat([ING.p2.uk, ING.p2.ar, ING.p2.zh, ING.p2.ja, ING.p2.el, ING.p2.ko, ING.p2.hi]).forEach(function (s) {
      if (m.isQuestionText(nfkc(s))) p.push('true for ' + short(s));
    });
  });
  if (wantUnit('U4')) check('U4', 'hasPrivateMarker: the shape split', function (p) {
    const m = getProof();
    const t = function (s, sh) { if (!m.hasPrivateMarker(nfkc(s), sh)) p.push('false: ' + short(s) + ' ' + sh.kind); };
    const f = function (s, sh) { if (m.hasPrivateMarker(nfkc(s), sh)) p.push('true: ' + short(s) + ' ' + sh.kind); };
    LANGS.filter(function (x) { return x !== 'en' && x !== 'he'; }).forEach(function (lang) { t(L[lang].pw, SPROUT); t(L[lang].pos, SPROUT); });
    t(L.he.pos, SPROUT);
    LANGS.filter(function (x) { return x !== 'en' && x !== 'he'; }).forEach(function (lang) { P1_SPROUTS[lang].forEach(function (s) { t(s, SPROUT); }); });
    P2_ROWS.slice(1).forEach(function (s) { t(s, SPROUT); t(s, SHORT_EDGE); t(s, { kind: 'edge', longEdge: true }); });
    LANGS.filter(function (x) { return x !== 'en'; }).forEach(function (lang) { t(ING.pc[lang], SHORT_EDGE); t(L[lang].pos, SHORT_EDGE); });
    t('私たちの秘密の計画', SPROUT);
    genericRows().forEach(function (s) { f(s, shapeOf(s)); });
    SHORT_EDGE_PARITY.slice(1).forEach(function (s) { f(s, SHORT_EDGE); });
    f(SPLIT_ALLOW[0], SHORT_EDGE);
    f('私立大学の評価方法は？', SPROUT);
    f('Πες μου πώς λειτουργεί το JTBD;', SPROUT);
    f('Que mi plan fits?', SPROUT);
  });
  if (wantUnit('U4h')) check('U4h', 'OWNER-HE: Hebrew PC and PP block a short edge; PW, POS and P1 do not', function (p) {
    const m = getProof();
    SPLIT_BLOCK.slice(1).forEach(function (s) { if (!m.hasPrivateMarker(nfkc(s), SHORT_EDGE)) p.push('false: ' + short(s)); });
    SPLIT_ALLOW.slice(1).forEach(function (s) { if (m.hasPrivateMarker(nfkc(s), SHORT_EDGE)) p.push('true: ' + short(s)); });
    [
      'איך לבחור מסגרת עבור הפרויקט של הצוות הסודי שלנו', 'מה התוכנית הסודית?', 'החברה שלנו מפסידה כסף, איזו מסגרת?', 'הרעיון שלי טוב, איזו מסגרת?',
      'אני רוצה לפטר את המייסד אחרי הביקורת', 'המסמך הזה לשימוש פנימי בלבד, איך מנתחים אותו?',
    ].forEach(function (q) { const v = cls(q, null); if (v.verdict !== 'block') p.push('q35 H3 row ' + short(q) + ' ' + tag(v)); });
  });
  if (wantUnit('U5')) check('U5', 'hasAlwaysShape and hasIdentifier: Unicode email, at-words, native phones, Unicode capitals', function (p) {
    const m = getProof();
    const pats = egress.ALWAYS_PATTERNS;
    LANGS.filter(function (x) { return x !== 'en' && x !== 'es'; }).forEach(function (lang) {
      if (!m.hasAlwaysShape(nfkc(L[lang].idn), pats)) p.push('IDN ' + lang);
    });
    ['lucia arroba ejemplo punto com', 'иван собака пример точка рф', 'דנה שטרודל דוגמה נקודה ישראל', '王伟艾特例子点中国', '田中アットマーク例えドットテスト',
      'δανάη παπάκι παράδειγμα τελεία ελ', '민수 골뱅이 예시 점 한국', 'राहुल एट उदाहरण डॉट भारत', 'ivan [собака] primer [точка] rf'].forEach(function (s) {
      if (!m.hasAlwaysShape(nfkc(s), pats)) p.push('at-word ' + short(s));
    });
    ['+٩٧٢ ٥٠ ١٢٣ ٤٥٦٧', '+९१ ९८७६५ ४३२१०', nfkc('＋８１ ９０ １２３４ ５６７８')].forEach(function (s) {
      if (!m.hasAlwaysShape(s, pats) && !pats.some(function (r) { return r.test(s); })) p.push('phone ' + s);
    });
    ['АКМЕ2026Х', 'АCME2026X', 'ACME٢٠٢٦X'].forEach(function (s) { if (!m.hasIdentifier(s, ASCII_ID_RULE)) p.push('identifier ' + s); });
    genericRows().forEach(function (s) {
      if (m.hasAlwaysShape(nfkc(s), pats)) p.push('always on generic ' + short(s));
      if (m.hasIdentifier(nfkc(s), ASCII_ID_RULE)) p.push('identifier on generic ' + short(s));
    });
    let big = '';
    while (big.length < 40000) big += '@aб';
    const t0 = Date.now();
    m.hasAlwaysShape(big, pats);
    m.hasIdentifier(big, ASCII_ID_RULE);
    const ms = Date.now() - t0;
    if (ms > 200) p.push('40,000-character run took ' + ms + ' ms');
  });
  if (wantUnit('U6')) check('U6', 'hasEdgeNameRule: TitleCase and title cues; false for generic and bare-name rows', function (p) {
    const m = getProof();
    const sets = { functionWords: guard.QUESTION_FUNCTION_WORDS, methodologyTokens: guard.METHODOLOGY_TOKEN_SET };
    ['es', 'ru', 'uk', 'el', 'ar', 'zh', 'ja', 'ko', 'hi'].forEach(function (lang) {
      if (!m.hasEdgeNameRule(nfkc(L[lang].narrative), sets)) p.push('false: ' + lang + ' narrative');
    });
    if (!m.hasEdgeNameRule(nfkc(HE_CUE_NARRATIVE), sets)) p.push('false: he cue narrative');
    genericRows().forEach(function (s) { if (m.hasEdgeNameRule(nfkc(s), sets)) p.push('true: ' + short(s)); });
    BARE_NAME_ALLOW.forEach(function (s) { if (m.hasEdgeNameRule(nfkc(s), sets)) p.push('true: ' + short(s)); });
  });
  if (wantUnit('U10')) check('U10', 'hasMixedScriptToken: mixed tokens, the W2 affix exemption', function (p) {
    const m = getProof();
    ['Brightмoor', 'Вrightmoorа', 'ACMEкод', 'Dаna'].forEach(function (s) { if (!m.hasMixedScriptToken(s)) p.push('false: ' + s); });
    ['SWOTа', 'JTBDа', 'בSWOT', 'ال\u0640SWOT', 'وBrightmoor', '什么是SWOT分析', 'JTBD가'].concat(AFFIX_ALLOW, genericRows()).forEach(function (s) {
      if (m.hasMixedScriptToken(nfkc(s))) p.push('true: ' + short(s));
    });
  });
  if (wantUnit('U7')) check('U7', 'the room lexicon: caseless, prefix, particle, stem, fold and CJK matches', function (p) {
    lexMod._resetLexiconCache();
    [['zh1', '星火计划'], ['ja1', '青嵐'], ['he1', 'חרצית']].forEach(function (r) {
      const lex = lexMod.loadRoomLexicon(ROOMS[r[0]]);
      const vn = (lex.entries || []).filter(function (e) { return e.kind === 'venture_name'; });
      if (!lex.ok || vn.length !== 1) p.push(r[1] + ': ' + JSON.stringify(vn.map(function (e) { return e.text; })));
    });
    const hit = function (room, q, label) {
      const lex = lexMod.loadRoomLexicon(ROOMS[room]);
      if (!lexMod.matchLexicon(nfkc(q), lex)) p.push('no match ' + (label || room) + ': ' + short(q));
    };
    hit('zh', L.zh.term[0]); hit('ja', L.ja.term[0]); hit('ru', L.ru.term[0]); hit('uk', L.uk.term[0]); hit('el', L.el.term[0]);
    hit('ko', '북쪽 호박에서 어떤 프레임워크를 쓰나요?'); hit('enb', 'brightmoor에서 어떤 프레임워크를 쓰나요?', 'enb ko');
    hit('he', L.he.term[0]); hit('he', 'המבצע חרצית?'); hit('ar', L.ar.term[0]);
    hit('en', 'איך מריצים ראיון בBrightmoor Kiln?', 'en he-glued'); hit('en', 'كيف أجري مقابلة لBrightmoor Kiln؟', 'en ar-glued');
    hit('enb', 'בbrightmoor', 'enb W2 he'); hit('enb', 'brightmoorа', 'enb W2 ru');
    hit('he', FOLD_ROWS.he[0]); hit('ar', FOLD_ROWS.ar[0]); hit('ar', FOLD_ROWS.ar[1]);
    hit('en', 'Тока Махе', 'en Cyrillic lookalike'); hit('en', 'ΤΟΚΑ ΜΑΧΕ', 'en Greek lookalike');
    // A CJK claim of 3 or more content words matches by majority (a room.db with one claim node).
    const claimRoom = makeRoom(path.join(TMP, 'x1g-claim'), { venture_name: 'Claim Fixture' });
    fs.mkdirSync(path.join(claimRoom, '.mindrian'), { recursive: true });
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(claimRoom, '.mindrian', 'room.db'));
    db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
    db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run('c1', 'claim', JSON.stringify({ text: '董事会计划在审计后解雇创始人' }));
    db.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run('o1', 'company', JSON.stringify({ name: '星海' }));
    db.close();
    lexMod._resetLexiconCache();
    const clex = lexMod.loadRoomLexicon(claimRoom);
    if (!clex.ok) p.push('claim room not ok');
    if (!lexMod.matchLexicon('哪个框架适合董事会在审计后解雇创始人这个问题？', clex)) p.push('no CJK claim majority match');
    if (lexMod.matchLexicon('哪个框架适合董事会的问题？', clex)) p.push('CJK claim matched with 1 content word');
    if (!lexMod.matchLexicon('星海公司适合哪个框架？', clex)) p.push('no match for the 2-character company node');
    // The en room: entries equal to START, and no load of part8-script-proof.cjs (child process).
    const child = spawnSync(process.execPath, ['-e', [
      'process.env.HOME=' + JSON.stringify(process.env.HOME) + ';process.env.MINDRIAN_ROOMS_HOME=' + JSON.stringify(process.env.MINDRIAN_ROOMS_HOME) + ';',
      'const lex=require(' + JSON.stringify(path.join(REPO_ROOT, 'lib', 'core', 'part8-room-lexicon.cjs')) + ');',
      'const r=lex.loadRoomLexicon(' + JSON.stringify(ROOMS.en) + ');',
      'const loaded=Object.keys(require.cache).some(function(k){return /part8-script-proof\\.cjs$/.test(k);});',
      'process.stdout.write(JSON.stringify({entries:r.entries,loaded:loaded}));',
    ].join('')], { encoding: 'utf8' });
    let out = null;
    try { out = JSON.parse(child.stdout); } catch (_e) { p.push('child: ' + child.stderr.slice(0, 200)); }
    if (out) {
      const want = JSON.stringify(START_EN_ENTRIES);
      const got = JSON.stringify(out.entries.map(function (e) { return e.kind === 'room_name' ? Object.assign({}, e, { text: '<room>', tokens: ['<room>'], needle: '<room>' }) : e; }));
      if (got !== want) p.push('en entries differ from START: ' + got.slice(0, 200));
      if (out.loaded) p.push('the en lexicon loaded part8-script-proof.cjs');
    }
  });
  if (wantUnit('U8')) check('U8', 'the shape helper: CJK sentence breaks, Segmenter words, quotes; ASCII shapes as START', function (p) {
    const a = shapeOf('董事会:计划解雇创始人!投资者想退出!试点失败了!哪个框架?');
    if (a.kind !== 'body' || a.sentences !== 4) p.push('Hole D row: ' + a.kind + ' ' + a.sentences);
    const b = shapeOf('这是什么？那是什么？为什么？');
    if (b.sentences !== 3) p.push('3 questions count ' + b.sentences);
    const c = shapeOf('在下一个发现阶段之前，分析这个秘密计划的最佳框架是什么？');
    if (c.kind !== 'edge') p.push('a 15-segment Chinese question is ' + c.kind);
    const d = shapeOf('他说「董事会计划在审计后解雇创始人」，哪个框架合适？');
    if (d.quoted !== true) p.push('the corner-bracket quote is not quoted');
    Object.keys(START_ASCII_SHAPES).forEach(function (s) {
      const got = JSON.stringify(shapeMod.classifyShape(s));
      if (got !== START_ASCII_SHAPES[s]) p.push('ASCII shape differs: ' + short(s) + ' ' + got);
    });
  });
}

// ---------------------------------------------------------------------------
// matrix
// ---------------------------------------------------------------------------
if (want('matrix')) {
  check('M1', 'generic control rows allow (roomDir null and the own room), every language', function (p) {
    LANGS.forEach(function (lang) {
      const d = L[lang];
      [d.short, d.long, d.two].forEach(function (q) { expectAllow(p, q, null, lang + ' '); });
      expectAllow(p, d.short, ROOMS[lang], lang + ' own room ');
    });
    BARE_NAME_ALLOW.concat(MORE_ALLOW).forEach(function (q) { expectAllow(p, q, null, 'bare '); });
  });
  check('M2', 'room-content rows block, every language', function (p) {
    LANGS.forEach(function (lang) {
      const d = L[lang];
      d.term.forEach(function (q) { expectBlock(p, q, ROOMS[lang], lang + ' term '); });
      [d.narrative, d.pw, d.pos].forEach(function (q) { expectBlock(p, q, null, lang + ' '); expectBlock(p, q, ROOMS[lang], lang + ' room '); });
      d.body.forEach(function (q) { expectBlock(p, q, null, lang + ' body '); });
    });
  });
}

// ---------------------------------------------------------------------------
// shape (OWNER-R35)
// ---------------------------------------------------------------------------
if (want('shape')) {
  check('S1', 'L3900: 2 sentences, kind edge, allow, every language', function (p) {
    LANGS.forEach(function (lang) {
      const q = buildLong(lang, 1925, 1950);
      const n = nfkc(q).length;
      const sh = shapeOf(q);
      if (n < 3850 || n > 3950) p.push(lang + ' length ' + n);
      if (sh.kind !== 'edge' || sh.sentences !== 2) p.push(lang + ' shape ' + sh.kind + ' ' + sh.sentences);
      expectAllow(p, q, null, lang + ' L3900 ');
    });
  });
  check('S2', 'L4100: kind body, body_shape, every language', function (p) {
    LANGS.forEach(function (lang) {
      const q = buildLong(lang, 2050, 2095);
      const n = nfkc(q).length;
      if (n < 4050 || n > 4200) p.push(lang + ' length ' + n);
      if (shapeOf(q).kind !== 'body') p.push(lang + ' kind ' + shapeOf(q).kind);
      const v = cut(q, null);
      if (v.verdict !== 'block' || v.token_class !== 'body_shape') p.push(lang + ' L4100 ' + tag(v));
    });
  });
}

// ---------------------------------------------------------------------------
// contact
// ---------------------------------------------------------------------------
if (want('contact')) {
  check('C1', 'emails, phones and identifiers block, every language', function (p) {
    LANGS.forEach(function (lang) {
      const d = L[lang];
      [d.email, d.idn, d.phone, d.native, 'ACME2026X'].forEach(function (c) { expectBlock(p, d.short + ' ' + c, null, lang + ' '); });
    });
    expectBlock(p, L.ru.short + ' АКМЕ2026Х', null, 'ru ');
  });
}

// ---------------------------------------------------------------------------
// body (OWNER-R35)
// ---------------------------------------------------------------------------
if (want('body')) {
  check('B1', '3-sentence bodies are sprouts_required/body_shape, every language', function (p) {
    LANGS.forEach(function (lang) {
      L[lang].body.forEach(function (q) {
        const v = cut(q, null);
        if (v.verdict !== 'block' || v.token_class !== 'body_shape') p.push(lang + ' ' + short(q) + ' ' + tag(v));
      });
    });
  });
}

// ---------------------------------------------------------------------------
// firstperson (OWNER-FP)
// ---------------------------------------------------------------------------
if (want('firstperson')) {
  check('F1', 'a P1 opener blocks a sprout, every language', function (p) {
    LANGS.forEach(function (lang) {
      P1_SPROUTS[lang].forEach(function (q) {
        if (shapeOf(q).kind !== 'sprout') p.push(lang + ' not a sprout: ' + short(q) + ' ' + JSON.stringify(shapeOf(q)));
        expectBlock(p, q, null, lang + ' ');
      });
    });
  });
  check('F2', 'a short-edge question with an opener at the start allows (English parity)', function (p) {
    SHORT_EDGE_PARITY.forEach(function (q) {
      const sh = shapeOf(q);
      if (sh.kind !== 'edge' || sh.longEdge !== false) p.push('shape ' + short(q) + ' ' + sh.kind + ' ' + sh.longEdge);
      expectAllow(p, q, null);
    });
  });
  check('F3', 'a P2 statement blocks in every shape', function (p) {
    P2_ROWS.forEach(function (q) { expectBlock(p, q, null); });
  });
}

// ---------------------------------------------------------------------------
// split (OWNER-REDUCE, OWNER-HE)
// ---------------------------------------------------------------------------
if (want('split')) {
  check('X1', 'the shape split: PW, POS and P1 allow a short edge; PC and PP block it', function (p) {
    SPLIT_ALLOW.concat(SPLIT_BLOCK).forEach(function (q) {
      const sh = shapeOf(q);
      if (sh.kind !== 'edge' || sh.longEdge !== false) p.push('not a short edge: ' + short(q) + ' ' + sh.kind + ' w' + sh.words);
    });
    SPLIT_ALLOW.forEach(function (q) { expectAllow(p, q, null); });
    SPLIT_BLOCK.forEach(function (q) {
      const v = expectBlock(p, q, null);
      if (v.token_class !== 'edge_rule') p.push('class ' + short(q) + ' ' + tag(v));
    });
    SPLIT_TWINS.forEach(function (r) { const v = cut(r[0], null); if (v.verdict !== r[1]) p.push('English twin ' + short(r[0]) + ' ' + tag(v)); });
  });
}

// ---------------------------------------------------------------------------
// fold
// ---------------------------------------------------------------------------
if (want('fold')) {
  check('D1', 'niqqud, harakat and tatweel do not hide a room term or a marker', function (p) {
    expectBlock(p, FOLD_ROWS.he[0], ROOMS.he);
    expectBlock(p, FOLD_ROWS.he[1], null);
    FOLD_ROWS.ar.forEach(function (q) { expectBlock(p, q, ROOMS.ar); });
  });
  check('D2', 'single-token caseless rooms protect their name', function (p) {
    SINGLE_ROOMS.forEach(function (x) { expectBlock(p, x.q, ROOMS[x.key], x.key + ' '); });
  });
}

// ---------------------------------------------------------------------------
// mixed (Hole A, the mixed-script rule, the confusable fold, W2)
// ---------------------------------------------------------------------------
if (want('mixed')) {
  check('X2', 'Hole A: a prefix on a room term blocks, also glued to a Latin term', function (p) {
    HOLE_A.forEach(function (q) { expectBlock(p, q, ROOMS.en); });
  });
  check('X3', 'mixed and homoglyph rows', function (p) {
    MIXED_BLOCK.forEach(function (q) { expectBlock(p, q, ROOMS.en); });
    MIXED_ALLOW.forEach(function (q) { expectAllow(p, q, null); expectAllow(p, q, ROOMS.en, 'en room '); });
  });
  check('X4', 'W2: affix forms of a handle allow; affix forms of a room term block', function (p) {
    AFFIX_ALLOW.forEach(function (q) { expectAllow(p, q, null); expectAllow(p, q, ROOMS.enb, 'en-b room '); });
    AFFIX_BLOCK.forEach(function (q) { expectBlock(p, q, ROOMS.enb, 'en-b room '); });
  });
}

// ---------------------------------------------------------------------------
// unprovable
// ---------------------------------------------------------------------------
if (want('unprovable')) {
  check('N1', 'an unprofiled script blocks with NON_LATIN_REASON', function (p) {
    UNPROVABLE.forEach(function (q) {
      const v = cut(q, null);
      if (v.verdict !== 'block' || v.reason !== NON_LATIN_REASON) p.push(short(q) + ' ' + tag(v) + ' ' + v.reason);
    });
  });
}

// ---------------------------------------------------------------------------
// typed (Hole E)
// ---------------------------------------------------------------------------
if (want('typed')) {
  const shapePacket = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-shape-packet.cjs'));
  const built = shapePacket.buildShapePacket({ roomDir: path.join(REPO_ROOT, 'tests', 'fixtures', '392-shape-rooms', 'room-a') });
  const SHAPE = built.shape;
  const typed = function (q, roomDir) { return guard.classify({ question: q, shape: SHAPE }, { toolName: 'brain_ask', roomDir: roomDir || null }); };
  check('T1', 'the typed arm blocks markers and a lookalike room term', function (p) {
    TYPED_BLOCK.forEach(function (q) { const v = typed(q); if (v.verdict !== 'block') p.push(short(q) + ' ' + tag(v)); });
    TYPED_BLOCK_EN_ROOM.forEach(function (q) { const v = typed(q, ROOMS.en); if (v.verdict !== 'block') p.push('en room ' + short(q) + ' ' + tag(v)); });
  });
  check('T2', 'the typed arm allows generic CJK, Greek and Hangul questions', function (p) {
    TYPED_ALLOW.forEach(function (q) {
      const v = typed(q);
      if (v.verdict !== 'allow' || v.shape_validated !== true) p.push(short(q) + ' ' + tag(v) + ' shape_validated ' + v.shape_validated);
    });
  });
  check('T3', 'W1: the typed arm keeps the START skip of the script rule', function (p) {
    const v = typed('SWOT คืออะไร');
    if (v.verdict === 'block' && v.reason === NON_LATIN_REASON) p.push('Thai typed question blocks with NON_LATIN_REASON');
  });
}

// ---------------------------------------------------------------------------
// parity (OWNER-H7A)
// ---------------------------------------------------------------------------
if (want('parity')) {
  check('P1', 'each H7a row equals its English twin (verdict and class)', function (p) {
    H7A.forEach(function (pair) {
      const a = cut(pair[0], null);
      const b = cut(pair[1], null);
      if (a.verdict !== 'allow' || a.verdict !== b.verdict || a.class !== b.class) p.push(short(pair[0]) + ' ' + tag(a) + ' twin ' + tag(b));
    });
  });
}

// ---------------------------------------------------------------------------
// noroom (owner decision 2026-11-19, option A)
// ---------------------------------------------------------------------------
if (want('noroom')) {
  const rows = noroomRows(FIXTURES._fuzzRows.block);
  check('R1', 'a room-content row allows with no room bound and blocks in its own room (' + rows.length + ' rows)', function (p) {
    rows.forEach(function (r) {
      expectAllow(p, r[0], null, 'no room ');
      if (r[1]) expectBlock(p, r[0], ROOMS[r[1]], 'own room ' + r[1] + ' ');
    });
  });
  check('R2', 'a test-395 paste row allows only with a cut; the paste stays local', function (p) {
    NOROOM_CUT.forEach(function (r) {
      const c = guard.classifyAndCut({ question: r[0] }, { toolName: 'brain_ask', roomDir: null });
      if (c.verdict.verdict !== 'allow' || !(c.cut > 0)) p.push(short(r[0]) + ' ' + tag(c.verdict) + ' cut ' + c.cut);
      if (String(c.payload && c.payload.question).indexOf(r[1]) !== -1) p.push('the paste is in the sent text: ' + short(r[0]));
      const v = guard.classify({ question: r[0] }, { toolName: 'brain_ask', roomDir: null });
      if (v.verdict !== 'block' || v.token_class !== 'pasted_text') p.push('uncut ' + short(r[0]) + ' ' + tag(v));
    });
  });
}

// ---------------------------------------------------------------------------
// hook
// ---------------------------------------------------------------------------
if (want('hook')) {
  const HOOK = path.join(REPO_ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
  const runHook = function (toolName, input) {
    const env = {
      PATH: process.env.PATH,
      HOME: TMP,
      MINDRIAN_ROOMS_HOME: path.join(TMP, 'rooms-hook'),
      MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
      PART8_FORCE_BRAIN_AVAILABLE: '1',
    };
    const res = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ tool_name: toolName, tool_input: input, session_id: 's261118-x1g' }),
      env: env, encoding: 'utf8', timeout: 30000,
    });
    return { status: res.status, stderr: res.stderr || '' };
  };
  check('H1', 'the hook allows ru and ko generic questions and blocks ru with an email', function (p) {
    const a = runHook('mcp__theo__brain_ask', { question: L.ru.short });
    if (a.status !== 0) p.push('ru short exit ' + a.status + ' ' + a.stderr.slice(0, 160));
    const b = runHook('mcp__theo__brain_ask', { question: L.ko.short });
    if (b.status !== 0) p.push('ko short exit ' + b.status + ' ' + b.stderr.slice(0, 160));
    const c = runHook('mcp__theo__brain_ask', { question: L.ru.short + ' ' + L.ru.email });
    if (c.status !== 2) p.push('ru short with an email exit ' + c.status);
    if (c.stderr.indexOf(L.ru.email) !== -1) p.push('the hook echoes the email');
  });
}

// ---------------------------------------------------------------------------
// lazy
// ---------------------------------------------------------------------------
if (want('lazy')) {
  check('Z1', 'an ASCII question never loads part8-script-proof.cjs; a Hebrew question does', function (p) {
    if (!fs.existsSync(PROOF_PATH)) p.push('lib/core/part8-script-proof.cjs is missing');
    const code = [
      'process.env.HOME=' + JSON.stringify(process.env.HOME) + ';process.env.MINDRIAN_ROOMS_HOME=' + JSON.stringify(process.env.MINDRIAN_ROOMS_HOME) + ';',
      'delete process.env.CLAUDE_ACTIVE_ROOM;',
      'const g=require(' + JSON.stringify(GUARD_PATH) + ');',
      'const loaded=function(){return Object.keys(require.cache).some(function(k){return /part8-script-proof\\.cjs$/.test(k);});};',
      'const qs=' + JSON.stringify([L.en.short, L.en.long, L.en.two]) + ';',
      'const out=[];',
      'qs.forEach(function(q){g.classifyAndCut({question:q},{toolName:"brain_ask",roomDir:null});g.classifyAndCut({question:q},{toolName:"brain_ask",roomDir:' + JSON.stringify(ROOMS.en) + '});});',
      'out.push(loaded());',
      'g.classifyAndCut({question:' + JSON.stringify(L.he.short) + '},{toolName:"brain_ask",roomDir:null});',
      'out.push(loaded());',
      'process.stdout.write(JSON.stringify(out));',
    ].join('');
    const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
    let out = null;
    try { out = JSON.parse(r.stdout); } catch (_e) { p.push('child: ' + (r.stderr || '').slice(0, 200)); }
    if (out) {
      if (out[0] !== false) p.push('an ASCII question loaded the module');
      if (out[1] !== true) p.push('the Hebrew question did not load the module');
    }
  });
}

// ---------------------------------------------------------------------------
// fuzz
// ---------------------------------------------------------------------------
if (want('fuzz')) {
  const rows = FIXTURES._fuzzRows;
  check('Z2', 'every seeded sensitive variant blocks (' + rows.block.length + ' strings)', function (p) {
    rows.block.forEach(function (row) {
      if (row.sproutOnly && shapeOf(row.text).kind !== 'sprout') { p.push('not a sprout ' + row.lang + ' ' + row.ing + ' ' + short(row.text)); return; }
      const v = cut(row.text, row.room ? ROOMS[row.room] : null);
      if (v.verdict !== 'block') p.push(row.lang + ' ' + row.ing + ' ' + short(row.text) + ' ' + tag(v));
    });
  });
  check('Z3', 'every punctuation variant of a generic control row allows (' + rows.allow.length + ' strings)', function (p) {
    rows.allow.forEach(function (row) {
      const v = cut(row.text, null);
      if (v.verdict !== 'allow') p.push(row.lang + ' ' + row.row + ' ' + short(row.text) + ' ' + tag(v));
    });
  });
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\n' + passed + ' passed, ' + failed + ' failed' + (failKeys.length ? ' (' + failKeys.join(' ') + ')' : ''));
process.exit(failed > 0 ? 1 : 0);
