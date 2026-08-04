/* Find the Impostor - pass-and-play social deduction game.
   Pure vanilla JS, no dependencies. State lives in memory + localStorage for player names. */
(function () {
  "use strict";

  var AVATARS = ["🦊","🐼","🐸","🦉","🐙","🦁","🐨","🐵","🦄","🐯","🐮","🐷","🐰","🐲","🦖","🐧","🦝","🐹","🦔","🐢"];
  var TIMER_OPTIONS = [
    { label: "Off", secs: 0 },
    { label: "1 min", secs: 60 },
    { label: "2 min", secs: 120 },
    { label: "3 min", secs: 180 }
  ];

  var state = {
    players: [],        // [{name, avatar}]
    catIndex: 0,
    impostors: 1,
    timerSecs: 0,
    // per-round
    roles: [],          // parallel to players: true = impostor
    word: "",
    catName: "",
    revealIdx: 0,
    order: [],          // shuffled speaking order (names)
    vote: null,         // index of accused player
    timeLeft: 0,
    timerId: null,
    timerRunning: false
  };

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  }); }

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 1600);
  }

  function show(screenId) {
    var screens = document.querySelectorAll("#app .screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove("on");
    var el = $(screenId);
    el.classList.add("on");
    el.classList.remove("fade"); void el.offsetWidth; el.classList.add("fade");
    $("app").scrollTop = 0;
  }

  // ---------- persistence (names only) ----------
  function saveNames() {
    try { localStorage.setItem("fti_players", JSON.stringify(state.players)); } catch (e) {}
  }
  function loadNames() {
    try {
      var raw = localStorage.getItem("fti_players");
      if (raw) {
        var p = JSON.parse(raw);
        if (Array.isArray(p) && p.length) state.players = p;
      }
    } catch (e) {}
  }

  // ---------- SETUP ----------
  function renderPlayers() {
    var host = $("plist");
    host.innerHTML = "";
    state.players.forEach(function (p, i) {
      var row = document.createElement("div");
      row.className = "prow";
      row.innerHTML =
        '<div class="av">' + p.avatar + '</div>' +
        '<div class="nm">' + esc(p.name) + '</div>' +
        '<button class="rm" title="Remove" data-i="' + i + '">✕</button>';
      row.querySelector(".rm").onclick = function () { removePlayer(i); };
      host.appendChild(row);
    });
    refreshSetup();
  }

  function usedAvatars() { return state.players.map(function (p) { return p.avatar; }); }
  function freeAvatar() {
    var used = usedAvatars();
    var free = AVATARS.filter(function (a) { return used.indexOf(a) < 0; });
    return free.length ? pick(free) : pick(AVATARS);
  }

  function addPlayer() {
    var input = $("nameInput");
    var name = (input.value || "").trim();
    if (!name) { input.focus(); return; }
    if (state.players.length >= 12) { toast("Max 12 players"); return; }
    var exists = state.players.some(function (p) { return p.name.toLowerCase() === name.toLowerCase(); });
    if (exists) { toast("That name's taken"); return; }
    state.players.push({ name: name, avatar: freeAvatar() });
    input.value = "";
    input.focus();
    saveNames();
    renderPlayers();
  }

  function removePlayer(i) {
    state.players.splice(i, 1);
    saveNames();
    renderPlayers();
  }

  function renderCats() {
    var host = $("catChips");
    host.innerHTML = "";
    window.WORD_PACKS.forEach(function (c, i) {
      var b = document.createElement("button");
      b.className = "chip" + (i === state.catIndex ? " sel" : "");
      b.innerHTML = c.emoji + " " + esc(c.name);
      b.onclick = function () { state.catIndex = i; renderCats(); };
      host.appendChild(b);
    });
  }

  function renderTimers() {
    var host = $("timerChips");
    host.innerHTML = "";
    TIMER_OPTIONS.forEach(function (o) {
      var b = document.createElement("button");
      b.className = "chip" + (o.secs === state.timerSecs ? " sel" : "");
      b.textContent = o.label;
      b.onclick = function () { state.timerSecs = o.secs; renderTimers(); };
      host.appendChild(b);
    });
  }

  function maxImpostors() {
    // keep at least 2 crew members
    return Math.max(1, Math.min(3, state.players.length - 2));
  }

  function bumpImpostors(d) {
    var next = state.impostors + d;
    var max = maxImpostors();
    if (next < 1) next = 1;
    if (next > max) { next = max; toast("Need at least 2 crew"); }
    state.impostors = next;
    $("impVal").textContent = state.impostors;
  }

  function refreshSetup() {
    var n = state.players.length;
    var note = $("setupNote");
    var btn = $("startBtn");
    if (state.impostors > maxImpostors()) state.impostors = maxImpostors();
    $("impVal").textContent = state.impostors;
    if (n < 3) {
      note.textContent = "Add at least 3 players to start. (" + n + "/3)";
      btn.disabled = true;
    } else {
      note.innerHTML = "Ready! " + n + " players · " + state.impostors +
        " impostor" + (state.impostors > 1 ? "s" : "") + " · pack: " +
        window.WORD_PACKS[state.catIndex].emoji + " " + esc(window.WORD_PACKS[state.catIndex].name);
      btn.disabled = false;
    }
  }

  // ---------- START / ROLES ----------
  function start() {
    if (state.players.length < 3) return;
    assignRound();
    state.revealIdx = 0;
    show("s-pass");
    renderPass();
  }

  function assignRound() {
    var pack = window.WORD_PACKS[state.catIndex];
    state.word = pick(pack.words);
    state.catName = pack.name;
    state.vote = null;

    var n = state.players.length;
    var count = Math.min(state.impostors, maxImpostors());
    var idxs = shuffle(state.players.map(function (_, i) { return i; }));
    var impSet = {};
    for (var k = 0; k < count; k++) impSet[idxs[k]] = true;
    state.roles = state.players.map(function (_, i) { return !!impSet[i]; });

    state.order = shuffle(state.players.map(function (p) { return p.name; }));
  }

  // ---------- PASS ----------
  function renderPass() {
    var p = state.players[state.revealIdx];
    $("passName").textContent = p.avatar + " " + p.name;
    $("passName2").textContent = p.name;
    $("passWho").textContent = p.name;
  }

  function goReveal() {
    show("s-reveal");
    renderReveal();
  }

  // ---------- REVEAL ----------
  function renderReveal() {
    var i = state.revealIdx;
    var p = state.players[i];
    var isImp = state.roles[i];

    $("revealCount").textContent = "Player " + (i + 1) + " of " + state.players.length;
    $("revealBackName").textContent = p.name + ", tap to reveal";

    var card = $("revealCard");
    card.classList.remove("flipped");

    var front = $("revealFront");
    front.classList.remove("crew", "imp");
    if (isImp) {
      front.classList.add("imp");
      $("revealRole").textContent = "You're the Impostor";
      $("revealWord").textContent = "FAKE IT";
      $("revealCat").textContent = "Category · " + state.catName;
      var tip = document.getElementById("revealImpTip");
      if (!tip) {
        tip = document.createElement("div");
        tip.id = "revealImpTip";
        tip.className = "imp-tip";
        front.appendChild(tip);
      }
      tip.style.display = "block";
      tip.textContent = "You don't know the word. Listen closely, blend in, and don't get caught.";
    } else {
      front.classList.add("crew");
      $("revealRole").textContent = "Crew · Secret word";
      $("revealWord").textContent = state.word.toUpperCase();
      $("revealCat").textContent = "Category · " + state.catName;
      var t2 = document.getElementById("revealImpTip");
      if (t2) t2.style.display = "none";
    }

    $("revealHint").textContent = "Tap the card to see your secret.";
    $("revealNext").style.visibility = "hidden";
  }

  function flipCard() {
    var card = $("revealCard");
    if (card.classList.contains("flipped")) return;
    card.classList.add("flipped");
    var last = state.revealIdx === state.players.length - 1;
    $("revealHint").textContent = last
      ? "Memorize it, then start the round."
      : "Memorize it, hide the card, and pass on.";
    var btn = $("revealNext");
    btn.textContent = last ? "Everyone's seen it — Discuss →" : "Got it — pass on →";
    btn.style.visibility = "visible";
  }

  function nextReveal() {
    if (state.revealIdx < state.players.length - 1) {
      state.revealIdx++;
      show("s-pass");
      renderPass();
    } else {
      goDiscuss();
    }
  }

  // ---------- DISCUSS ----------
  function goDiscuss() {
    show("s-discuss");
    renderOrder();
    setupTimer();
  }

  function renderOrder() {
    var host = $("orderList");
    host.innerHTML = "";
    state.order.forEach(function (name, i) {
      var p = state.players.find(function (x) { return x.name === name; });
      var row = document.createElement("div");
      row.className = "order-row";
      row.innerHTML =
        '<div class="num">' + (i + 1) + '</div>' +
        '<div class="av" style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--brand));">' + (p ? p.avatar : "🎭") + '</div>' +
        '<div class="nm">' + esc(name) + '</div>';
      host.appendChild(row);
    });
  }

  function setupTimer() {
    var wrap = $("timerWrap");
    stopTimerTick();
    if (state.timerSecs > 0) {
      wrap.style.display = "block";
      state.timeLeft = state.timerSecs;
      state.timerRunning = true;
      $("timerToggle").textContent = "Pause";
      paintTimer();
      startTimerTick();
    } else {
      wrap.style.display = "none";
    }
  }

  function paintTimer() {
    var m = Math.floor(state.timeLeft / 60);
    var s = state.timeLeft % 60;
    var el = $("timerText");
    el.textContent = m + ":" + (s < 10 ? "0" : "") + s;
    el.classList.toggle("low", state.timeLeft <= 10);
  }

  function startTimerTick() {
    stopTimerTick();
    state.timerId = setInterval(function () {
      if (!state.timerRunning) return;
      state.timeLeft--;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        paintTimer();
        stopTimerTick();
        state.timerRunning = false;
        toast("⏰ Time's up — vote!");
        return;
      }
      paintTimer();
    }, 1000);
  }

  function stopTimerTick() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }

  function toggleTimer() {
    if (state.timeLeft <= 0) { resetTimer(); return; }
    state.timerRunning = !state.timerRunning;
    $("timerToggle").textContent = state.timerRunning ? "Pause" : "Resume";
  }

  function resetTimer() {
    state.timeLeft = state.timerSecs || 60;
    state.timerRunning = true;
    $("timerToggle").textContent = "Pause";
    paintTimer();
    startTimerTick();
  }

  // ---------- VOTE ----------
  function goVote() {
    stopTimerTick();
    state.vote = null;
    show("s-vote");
    renderVote();
  }

  function renderVote() {
    var host = $("voteGrid");
    host.innerHTML = "";
    state.players.forEach(function (p, i) {
      var b = document.createElement("button");
      b.className = "vote-btn" + (state.vote === i ? " sel" : "");
      b.innerHTML = '<div class="av">' + p.avatar + '</div><span>' + esc(p.name) + '</span>';
      b.onclick = function () {
        state.vote = i;
        renderVote();
        $("voteBtn").disabled = false;
      };
      host.appendChild(b);
    });
    $("voteBtn").disabled = state.vote === null;
  }

  // ---------- RESULT ----------
  function reveal() {
    if (state.vote === null) return;
    var accusedIsImp = state.roles[state.vote];
    var impNames = state.players.filter(function (_, i) { return state.roles[i]; });
    var single = impNames.length === 1;

    var crewWins = accusedIsImp; // caught an impostor
    $("resWord").textContent = state.word.toUpperCase();

    var tagHost = $("resImps");
    tagHost.innerHTML = "";
    impNames.forEach(function (p) {
      var t = document.createElement("span");
      t.className = "tag";
      t.textContent = p.avatar + " " + p.name + (single ? "" : "");
      tagHost.appendChild(t);
    });
    // label impostor tags
    var lbl = document.createElement("div");
    lbl.style.cssText = "width:100%;color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-top:6px;";
    lbl.textContent = single ? "The impostor was" : "The impostors were";
    tagHost.insertBefore(lbl, tagHost.firstChild);

    var accused = state.players[state.vote];
    if (crewWins) {
      $("resEmoji").textContent = "🕵️";
      $("resTitle").textContent = "Crew wins!";
      $("resSub").innerHTML = "You caught <b>" + esc(accused.name) + "</b> — a real impostor.";
    } else {
      $("resEmoji").textContent = "🎭";
      $("resTitle").textContent = "Impostor" + (single ? "" : "s") + " win!";
      $("resSub").innerHTML = "You voted <b>" + esc(accused.name) + "</b>, but they were innocent. The impostor faked it.";
    }
    show("s-result");
  }

  function playAgain() {
    assignRound();
    state.revealIdx = 0;
    show("s-pass");
    renderPass();
  }

  // ---------- NAV / LIFECYCLE ----------
  function launch() {
    document.body.classList.add("playing");
    $("app").classList.add("on");
    if (!state.players.length) loadNames();
    renderPlayers();
    renderCats();
    renderTimers();
    refreshSetup();
    show("s-setup");
    $("app").scrollTop = 0;
  }

  function exit() {
    stopTimerTick();
    document.body.classList.remove("playing");
    $("app").classList.remove("on");
    window.scrollTo(0, 0);
  }

  function exitToSetup() {
    stopTimerTick();
    show("s-setup");
    renderPlayers();
    renderCats();
    renderTimers();
    refreshSetup();
  }

  function confirmQuit() {
    if (confirm("Quit this round and return to setup?")) exitToSetup();
  }

  // expose
  window.Game = {
    launch: launch, exit: exit, exitToSetup: exitToSetup, confirmQuit: confirmQuit,
    addPlayer: addPlayer, bumpImpostors: bumpImpostors,
    start: start, goReveal: goReveal, flipCard: flipCard, nextReveal: nextReveal,
    goVote: goVote, reveal: reveal, playAgain: playAgain,
    toggleTimer: toggleTimer, resetTimer: resetTimer
  };
})();
