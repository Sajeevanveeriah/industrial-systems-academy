(() => {
  "use strict";

  const lessons = [
    [
      "Receive the right lot at a measured rate",
      "A hopper buffers a delivery. The feeder and weigh belt move a controlled stream to washing. The incoming weigh ticket and lot identifier tie this stream to the supplier.",
      "A 1,000 kg lot at 100 kg/min takes 10 model minutes to feed. The batch still weighs 1,000 kg on transfer. Reducing the feed rate changes the predicted time.",
      "The feeder is commanded to run but the belt-scale reading loses quality. Can the current feed rate still be proved?",
      "Check the load-cell signal, its zero and the speed measurement. A running command alone supplies no belt-load evidence. Keep the batch held until valid measurement returns.",
    ],
    [
      "Separate potatoes from soil and stones",
      "The washer moves potatoes through circulating water. The separator collects loose soil and stones in a different stream. The process controller monitors water flow and changes pump demand.",
      "The model sends 1,000 kg into the washer and records 20 kg in the debris stream, leaving 980 kg. Circulating wash water stays inside its own loop. This training model uses a fixed debris fraction.",
      "Pump demand is present, but the flow transmitter has stopped reporting. What should you check before passing product?",
      "Confirm a current flow signal and circulating water. Pump demand records the request; measured flow supplies the evidence for transfer.",
    ],
    [
      "Prove that the peeling cycle finished",
      "The peeler treats one charge at a time. A separate skin remover collects loosened peel. The line controller requests a batch and waits for a completion signal from the equipment controller.",
      "With 980 kg entering and the exposure timer at 16 s, the model removes 58.8 kg. Setting 18 s increases the modelled peel removal to 62.72 kg, leaving 917.28 kg.",
      "The sequence request is on but completion is absent. Should the batch appear at cutting?",
      "Keep it at peeling. Reconcile the outstanding request with the equipment completion signal and its batch identity before allowing discharge.",
    ],
    [
      "Match the cutter grid to the order",
      "A stream of water carries potatoes through a cutter grid. The grid determines strip size. The sorter diverts slivers from accepted strips.",
      "The order requires a 10 mm grid. With 921.2 kg of peeled potatoes, the model removes 32.242 kg as slivers. Recording another grid size prevents this order from passing configuration.",
      "The recipe says 10 mm, but the wrong grid was fitted. Does changing a screen value correct the cut?",
      "Check the installed grid against the specified pitch. The recipe records the mechanical setup. The feed also needs valid water-flow proof.",
    ],
    [
      "Control time in the blancher",
      "The belt carries strips through the blancher. Its travel speed determines residence time for a fixed path length. The classroom exercise holds the bath conditions fixed.",
      "At 90 s residence, 888.958 kg of strips gains 13.334 kg of water and loses 7.112 kg of soluble solids. The increase in the outgoing mass is consistent with those two streams.",
      "The belt has a speed demand but the encoder sample is stale. Can you establish residence time?",
      "Use current encoder feedback and verify a marker’s travel time through the model. A previous speed reading cannot establish the present belt speed.",
    ],
    [
      "Measure water leaving the strips",
      "Air passes through the product bed to remove surface water. The fan demand influences drying. Comparing matched inlet and outlet weights checks the reduction for a given batch.",
      "A 6% reduction applied to 895.18 kg removes 53.711 kg after rounding to the gram. The next machine receives 841.469 kg. This mass change alone does not measure the strips’ absolute moisture content.",
      "The inlet total covers the whole batch, but the outlet total covers only half the run. Is the difference a drying result?",
      "Match both intervals to the same lot and confirm valid scales. Otherwise a timing mismatch looks like additional water removal.",
    ],
    [
      "Separate oil uptake from evaporation",
      "A belt carries strips through the fryer while a separate system circulates and filters oil. The model uses belt residence to predict water loss and oil absorption.",
      "For 841.469 kg entering at 45 s residence, 37.866 kg of oil enters the product and 134.635 kg of water leaves. Counting only the net mass change would hide both contributions.",
      "The belt encoder is healthy but the oil circulation permissive is lost. Is the belt signal enough to continue?",
      "Hold feed and restore circulation proof. The encoder confirms belt travel; it cannot establish the state of the oil circuit.",
    ],
    [
      "Verify the cold zone before transfer",
      "Air passes through a bed of fries while the belt carries them across the freezing zone. A return-air sensor reports conditions at its own location.",
      "At the 12-minute training residence, the freezer receives and hands on 744.7 kg. The model changes the product condition and assumes no freezer mass loss. Product-temperature verification at a physical freezer requires separate measurements.",
      "The screen still shows yesterday’s plausible air temperature. Which evidence is missing?",
      "Check the source timestamp and quality, then confirm fresh feedback and zone readiness before transfer. A plausible number can be stale.",
    ],
    [
      "Count full bags and loose carryover",
      "A multihead weigher selects portions. The bagger seals each pack, and a checkweigher verifies its net product weight. Packaging film is outside the worked food-mass balance.",
      "At 1,000 g per bag, 744.7 kg produces 744 full bags. The remaining 0.7 kg returns to loose carryover. Rounding the input to 745 bags would create product that was never packed.",
      "The checkweigher is invalid, but the bag counter increases. Can the counter establish the packed net mass?",
      "Hold release and check a reference pack against the net-weight signal. A count establishes the number of recorded cycles, while the weight verifies the quantity in each pack.",
    ],
    [
      "Dispatch the matching pallet once",
      "The dock scanner identifies the logistics unit. Matching the pallet to its order and destination allows the transfer output to release it from staging.",
      "The worked order assigns dock lane 2. Moving 744 kg to dispatch preserves the net food mass. The simulated shipment changes inventory status and location.",
      "A pallet arrives at the dock, but its identifier cannot be read. What prevents the wrong stock movement?",
      "Keep it in staging, rescan the matching pallet and check its assigned lane. If a dispatch acknowledgement is lost, verify the original movement ID before replay.",
    ],
  ];
  const sketches = [
    "M37 31h84l-19 35H56z M57 70h46 M30 85h106 M40 85v10m85-10v10 M51 27q-6-12 7-14t7 14 M78 23q-5-10 6-11t7 11",
    "M26 47q0-9 9-9h90q10 0 10 9v20q0 9-10 9H35q-9 0-9-9z M42 41l13 29m5-29 13 29m5-29 13 29m5-29 13 29 M24 83q8-8 16 0t16 0 16 0 16 0 16 0 16 0 16 0",
    "M49 36q25-23 53 0v33q-26 23-53 0z M44 38h63 M49 48h53 M76 20v-7m-13 10q-7-7 0-14m27 14q-7-7 0-14 M61 77v13m29-13v13 M102 52h15l12 11",
    "M19 53h41l18-15h48v31H78L60 56H19 M85 40v26m9-26v26m9-26v26m9-26v26 M77 47h48M77 57h48 M130 44l12-4m-13 13h14m-14 7 13 4",
    "M21 52h118l-12 29H35z M26 58q7-5 14 0t14 0 14 0 14 0 14 0 14 0 14 0 M16 47l26 21h69l31-22 M50 41q-6-8 0-16m22 16q-6-8 0-16m21 16q-6-8 0-16",
    "M20 36h121v43H20z M23 69h112 M52 53q12-19 16-10t-9 11q14 8 7 14t-11-11q-12 6-14-2t11-2 M83 48h37m-37 7h30m-30 7h34",
    "M21 50h119l-11 29H33z M16 38l26 28h67l34-29 M33 57q7-5 14 0t14 0 14 0 14 0 14 0 14 0 M58 40q-7-8 0-15m21 15q-7-8 0-15m20 15q-7-8 0-15",
    "M22 32h116v47H22z M18 82h125 M80 39v32m-15-24 29 16m0-16-29 16 M49 44v19m-8-14 16 9m0-9-16 9 M111 46v19m-8-14 16 9m0-9-16 9",
    "M43 24h71l-14 20H57z M62 28l6 13m8-13v13m10-13-6 13 M68 46h22v9H68z M65 57h28l-2 6 5 21-4 4H66l-4-4 5-21z M68 67h21m-20 5h16 M60 93h38",
    "M22 83h116 M29 88h103 M35 81V59h29v22m5 0V59h29v22M53 57V36h28v21 M108 32h24v13h-24z M111 36h2m3 0h2m4 0h2m3 0h2 M113 47l-9 9m15-9-10 12",
  ];
  const numberFormat = new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: 3,
  });
  const kg = (n) => numberFormat.format(n) + " kg";
  const el = (tag, text, cls) => {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (cls) item.className = cls;
    return item;
  };

  function modelExample(index) {
    const model = window.FryProcess;
    let input = 1000,
      result;
    for (let i = 0; i <= index; i++) {
      const config = model.solvedStage(i);
      const status = model.check(i, config);
      if (!status.ok) throw new Error(status.why);
      result = model.operate(i, config, input);
      if (i < index) input = result.outputKg;
    }
    return { input, ...result };
  }

  function poster(index, stage) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270"><rect width="480" height="270" fill="#deefd8"/><path d="M0 185h480" stroke="#a3c8ad" stroke-width="2"/><g transform="translate(80 27) scale(1.95)" stroke="#285e47" fill="none" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"><path d="' +
      sketches[index] +
      '"/></g><text x="24" y="39" fill="#143b2b" font-size="25" font-family="Segoe UI,Arial,sans-serif">' +
      stage.name +
      "</text></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function makeFilm(root, stage, index, opts) {
    const base = String(
      opts.mediaBase ??
        root.closest("[data-stage-base]")?.dataset.stageBase ??
        document.querySelector("[data-stage-base]")?.dataset.stageBase ??
        "stage-media/",
    ).replace(/\/?$/, "/");
    const film = el("figure", undefined, "stc-film");
    const video = el("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", stage.name + " narrated lesson");
    video.poster = poster(index, stage);
    const paths =
      opts.mediaUrls?.[stage.id] || window.StageMediaPaths?.[stage.id] || {};
    const url = new URL(paths.video || base + stage.id + ".mp4", location.href);
    video.dataset.sourceUrl = url.href;
    if (url.protocol === "file:") {
      video.src = url.href;
    } else {
      video.controls = false;
      video.setAttribute("aria-busy", "true");
      const abort = new AbortController();
      let blobUrl;
      opts.disposeMedia = () => {
        abort.abort();
        video.pause();
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      };
      (async () => {
        try {
          const response = await fetch(url, { signal: abort.signal });
          if (!response.ok) throw Error("Film unavailable");
          const bytes = await response.blob();
          if (abort.signal.aborted) return;
          blobUrl = URL.createObjectURL(bytes);
          video.src = blobUrl;
        } catch {
          if (abort.signal.aborted) return;
          video.src = url.href;
        } finally {
          video.removeAttribute("aria-busy");
          video.controls = true;
        }
      })();
    }
    const media = window.StageMediaText?.[stage.id];
    const track = el("track");
    track.kind = "captions";
    track.srclang = "en";
    track.label = "English";
    track.default = true;
    const localText = media?.captions || media?.vtt;
    track.src =
      location.protocol === "file:" && localText
        ? "data:text/vtt;charset=utf-8," + encodeURIComponent(localText)
        : paths.track || paths.captions || base + stage.id + ".vtt";
    video.append(track);
    film.append(video);
    const caption = el(
      "figcaption",
      "Watch the " + stage.name.toLowerCase() + " walkthrough.",
    );
    film.append(caption);
    if (media?.transcript) {
      const transcript = el("details", undefined, "stc-transcript");
      transcript.append(el("summary", "Read the film transcript"));
      const paras = Array.isArray(media.transcript)
        ? media.transcript
        : String(media.transcript).split(/\n+/);
      for (const p of paras) if (p.trim()) transcript.append(el("p", p));
      film.append(transcript);
    }
    return film;
  }

  function route(stage, index, kind) {
    const [plc, device] = stage[kind].split(" · ");
    const base = "JB" + String(index + 1).padStart(2, "0");
    const sensor = kind === "sensor";
    const socket = base + (sensor ? ":S1" : ":A1");
    const panel = "PLC-01:" + plc;
    return sensor
      ? socket + " · " + device + " → " + panel
      : panel + " → " + socket + " · " + device;
  }

  function actions(index, opts) {
    const group = el("div", undefined, "stc-actions");
    function add(id, title, callback) {
      const b = el("button", title);
      b.type = "button";
      b.dataset.stageAction = id;
      b.disabled = typeof callback !== "function";
      if (!b.disabled) b.addEventListener("click", () => callback(index));
      group.append(b);
    }
    add(
      "practice",
      opts.practiceLabel || "Practise this station",
      opts.openPractice,
    );
    add("worked", "Inspect worked station", opts.openWorked);
    if (typeof opts.openGuide === "function")
      add("guide", "Open plant guide", opts.openGuide);
    if (opts.mode === "practice" && typeof opts.resetPractice === "function")
      add("reset", "Reset station practice", opts.resetPractice);
    return group;
  }

  function mount(root, index, opts = {}) {
    if (!root) return;
    const model = window.FryProcess;
    const stage = model?.stages?.[index],
      lesson = lessons[index];
    if (!stage || !lesson) {
      root.replaceChildren(
        el("p", "Select a process station to open its lesson."),
      );
      return;
    }
    const [title, hardware, example, question, answer] = lesson;
    const shell = el("section", undefined, "stc");
    shell.dataset.stageCourse = stage.id;
    const top = el("div", undefined, "stc-top");
    const intro = el("div");
    intro.append(
      el("p", stage.name + " / Station lesson", "stc-kicker"),
      el("h3", title),
      el("p", hardware, "stc-lead"),
    );
    intro.append(actions(index, opts));
    top.append(intro, makeFilm(root, stage, index, opts));
    shell.append(top);
    const body = el("div", undefined, "stc-body");
    const architecture = el("section", undefined, "stc-card");
    architecture.append(
      el("h4", "Trace the two signals"),
      el("p", stage.setup),
    );
    const routes = el("dl", undefined, "stc-routes");
    for (const [kind, label] of [
      ["sensor", "Field input to PLC"],
      ["actuator", "PLC output to field"],
    ]) {
      const pair = el("div");
      pair.append(el("dt", label), el("dd", route(stage, index, kind)));
      routes.append(pair);
    }
    architecture.append(routes);
    const worked = el("section", undefined, "stc-card");
    worked.append(el("h4", "Follow the worked batch"), el("p", example));
    const balance = modelExample(index);
    const values = el("dl", undefined, "stc-values");
    for (const [label, value] of [
      ["Recipe", stage.target + " " + stage.unit],
      ["Input", kg(balance.input)],
      ["Added", kg(balance.addedKg)],
      ["Removed", kg(balance.removedKg)],
      ["Output", kg(balance.outputKg)],
    ]) {
      const v = el("div");
      v.append(el("dt", label), el("dd", value));
      values.append(v);
    }
    worked.append(values);
    body.append(architecture, worked);
    const diag = el("details", undefined, "stc-diagnosis");
    diag.append(el("summary", question), el("p", answer));
    const steps = el("section", undefined, "stc-steps");
    steps.append(el("h4", "Try it on the plant floor"));
    const guide = el("ol");
    [
      "Select " +
        stage.machine +
        " in the equipment inventory. Mount it in the bay.",
      "Connect the sensor and actuator using the two signal paths above. Match both ends of each cable.",
      "Set " +
        stage.parameter.toLowerCase() +
        " to " +
        stage.target +
        " " +
        stage.unit +
        ". " +
        stage.reason,
      "Inject “" +
        stage.fault +
        "”. Confirm that the station holds. Select “" +
        stage.recovery +
        "” and verify recovery.",
    ].forEach((step) => guide.append(el("li", step)));
    steps.append(guide);
    const outcome = el("p", undefined, "stc-proof");
    outcome.append(
      el("b", "Acceptance evidence. "),
      document.createTextNode(stage.outcome),
    );
    steps.append(outcome);
    shell.append(body, diag, steps);
    const status =
      typeof opts.practiceStatus === "string"
        ? opts.practiceStatus
        : opts.practiceStatus?.why;
    if (status) shell.append(el("p", status, "stc-status"));
    shell.append(
      el(
        "small",
        "Worked quantities and recipe settings come from the fictional 1,000 kg training batch. Physical equipment requires its approved operating and food-safety specifications.",
        "stc-foot",
      ),
    );
    root.replaceChildren(shell);
    return {
      destroy() {
        opts.disposeMedia?.();
      },
    };
  }

  window.StageCourse = { mount };
})();
