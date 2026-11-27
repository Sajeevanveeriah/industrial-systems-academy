/* Fictional finite-capacity scheduling exercise. */
(function () {
  "use strict";
  const orders = {
    straight: {
      id: "FP-101",
      product: "Straight-cut fries",
      family: "Straight",
      eligible: ["A", "B"],
      duration: 70,
      due: 160,
    },
    crinkle: {
      id: "FP-102",
      product: "Crinkle-cut fries",
      family: "Crinkle",
      eligible: ["A"],
      duration: 50,
      due: 80,
    },
    coated: {
      id: "FP-103",
      product: "Coated fries",
      family: "Coated",
      eligible: ["B"],
      duration: 65,
      due: 70,
    },
  };
  const shiftDate = "11 May 2027";
  function clock(elapsed) {
    const t = 360 + elapsed;
    return (
      String(Math.floor(t / 60)).padStart(2, "0") +
      ":" +
      String(t % 60).padStart(2, "0")
    );
  }
  function initial() {
    return [
      { job: "straight", line: "A" },
      { job: "crinkle", line: "A" },
      { job: "coated", line: "B" },
    ];
  }
  function solve(queue) {
    const lines = {
      A: { free: 0, family: "Straight" },
      B: { free: 0, family: "Coated" },
    };
    return queue.map(({ job, line }) => {
      const order = orders[job],
        resource = lines[line];
      if (!order.eligible.includes(line))
        return {
          job,
          line,
          issue:
            order.id +
            " is eligible on line " +
            order.eligible.join(" or ") +
            " only.",
        };
      const setup = resource.family === order.family ? 0 : 20;
      const setupStart = resource.free,
        start = setupStart + setup,
        end = start + order.duration;
      resource.free = end;
      resource.family = order.family;
      return {
        job,
        line,
        setupStart,
        setup,
        start,
        end,
        late: Math.max(0, end - order.due),
      };
    });
  }
  function styles() {
    if (document.getElementById("aps-lesson-style")) return;
    const s = document.createElement("style");
    s.id = "aps-lesson-style";
    s.textContent =
      ".aps-lesson{color:#183c32;display:grid;gap:14px;min-width:0}.aps-lesson p,.aps-lesson h3,.aps-lesson h4{margin:0}.aps-lesson button,.aps-lesson select{font:inherit;border:1px solid #748b7c;border-radius:5px;background:#f9fcf8;color:#173f32;padding:6px 10px;max-width:100%}.aps-lesson button{cursor:pointer}.aps-lesson button:disabled{opacity:.5;cursor:default}.aps-lesson button:focus-visible,.aps-lesson select:focus-visible{outline:3px solid #966200;outline-offset:2px}.aps-brief,.aps-card,.aps-result{padding:12px 15px;border:1px solid #b9cbbf;background:#fff;border-radius:8px;min-width:0}.aps-orders,.aps-results{display:grid;gap:8px}.aps-card{display:grid;gap:6px}.aps-card p,.aps-result p,.aps-source{font-size:.9rem;line-height:1.5}.aps-actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px}.aps-actions label{display:inline-flex;align-items:center;gap:5px}.aps-status{font-weight:700}.aps-issue{border-left:4px solid #ac720a;background:#fff6d9}.aps-pass{border-left:4px solid #378466;background:#edf7ef}.aps-result strong{display:block}.aps-timeline{display:grid;gap:8px}.aps-track{height:22px;position:relative;background:#f4f6f0;border:1px solid #aabcaf}.aps-track span{position:absolute;top:0;bottom:0}.aps-track .setup{background:repeating-linear-gradient(135deg,#d8a23c 0 4px,#f7dfa5 4px 8px)}.aps-track .run{background:#3a866a;border-right:1px solid white}.aps-axis{display:flex;justify-content:space-between;font-size:.8rem}.aps-source a{color:#005a47;text-decoration:underline}";
    document.head.append(s);
  }
  function mount(root) {
    styles();
    let queue = initial();
    root.innerHTML =
      '<section class="aps-lesson" aria-label="APS production scheduling exercise"><h3>Schedule a fry-packing shift</h3><p>DSR reports that Farm Frites Poland uses APS 4FACTORY to sequence operations across production lines in Lębork. DSR combines its planning services with Siemens Opcenter APS. The two lines, orders and times below are fictional training data.</p><div class="aps-brief"><strong>Shift brief · ' +
      shiftDate +
      '</strong><p>Both lines open at 06:00 local time. Line A starts on Straight and line B on Coated. Every change of product family occupies that line for 20 minutes. Each line handles one order at a time. Different lines can run in parallel. For this shift, all material and staff are available at 06:00.</p></div><p>Assign each order to an eligible line and reorder its priority until all three finish by their due times. The queue sets the order of work within each line. An ineligible assignment stays unscheduled.</p><div data-aps-queue class="aps-orders"></div><div class="aps-actions"><button type="button" data-aps="calculate">Calculate schedule</button><button type="button" data-aps="reset">Reset exercise</button></div><div data-aps-output></div><div data-aps-status class="aps-status" role="status" aria-live="polite"></div><details><summary>Worked feasible schedule</summary><p>Start FP-102 on A. Change from Straight to Crinkle between 06:00 and 06:20, then pack until 07:10. On B, pack FP-103 from 06:00 to 07:05. After FP-102, change A back to Straight and run FP-101 from 07:30 to 08:40. All three meet their deadlines.</p><button type="button" data-aps="worked">Apply worked schedule</button></details><p class="aps-source">Sources checked 27 November 2026. <a href="https://www.dsr.com.pl/zastosowanie-rozwiazan-informatycznych-dsr-4factory-w-fabryce-farm-frites-poland/">Farm Frites Poland case study, 10 March 2026</a> · <a href="https://www.dsr.com.pl/planowanie-produkcji-aps/">DSR APS 4FACTORY product overview</a>.</p></section>';
    const section = root.firstElementChild;
    const q = (selector) => section.querySelector(selector);
    function renderQueue() {
      q("[data-aps-queue]").innerHTML = queue
        .map(({ job, line }, i) => {
          const o = orders[job];
          return (
            '<div class="aps-card"><strong>Priority ' +
            (i + 1) +
            " · " +
            o.id +
            " · " +
            o.product +
            "</strong><p>Eligible on " +
            o.eligible.join(" or ") +
            " · " +
            o.duration +
            " min run · Due " +
            shiftDate +
            ", " +
            clock(o.due) +
            '</p><div class="aps-actions"><label>Assigned line<select data-aps-line="' +
            job +
            '" aria-label="Assigned line for ' +
            o.id +
            '">' +
            ["A", "B"]
              .map(
                (l) =>
                  '<option value="' +
                  l +
                  '"' +
                  (l === line ? " selected" : "") +
                  ">" +
                  l +
                  "</option>",
              )
              .join("") +
            "</select></label>" +
            ["up", "down"]
              .map(
                (dir) =>
                  '<button type="button" data-aps-move="' +
                  dir +
                  '" data-job="' +
                  job +
                  '" aria-label="Move ' +
                  o.id +
                  " " +
                  dir +
                  '"' +
                  ((dir === "up" && i === 0) ||
                  (dir === "down" && i === queue.length - 1)
                    ? " disabled"
                    : "") +
                  ">Move " +
                  dir +
                  "</button>",
              )
              .join("") +
            "</div></div>"
          );
        })
        .join("");
    }
    function calculate() {
      const rows = solve(queue),
        finish = Math.max(
          60,
          ...rows.filter((r) => !r.issue).map((r) => r.end),
        );
      const pct = (n) => ((n / finish) * 100).toFixed(2) + "%";
      const bars = ["A", "B"]
        .map(
          (l) =>
            "<div><small>Line " +
            l +
            '</small><div class="aps-track" aria-hidden="true">' +
            rows
              .filter((r) => r.line === l && !r.issue)
              .map(
                (r) =>
                  (r.setup
                    ? '<span class="setup" style="left:' +
                      pct(r.setupStart) +
                      ";width:" +
                      pct(r.setup) +
                      '"></span>'
                    : "") +
                  '<span class="run" style="left:' +
                  pct(r.start) +
                  ";width:" +
                  pct(r.end - r.start) +
                  '"></span>',
              )
              .join("") +
            "</div></div>",
        )
        .join("");
      q("[data-aps-output]").innerHTML =
        '<div class="aps-timeline"><h4>Line timeline</h4><small>Striped amber indicates changeover. Green indicates production.</small>' +
        bars +
        '<div class="aps-axis"><span>06:00</span><span>' +
        clock(finish) +
        '</span></div></div><div class="aps-results">' +
        rows
          .map((r) => {
            const o = orders[r.job],
              out = r.issue
                ? "Unscheduled"
                : r.late
                  ? r.late + " min late"
                  : "On time";
            const detail = r.issue
              ? r.issue
              : (r.setup
                  ? "Changeover " +
                    clock(r.setupStart) +
                    " to " +
                    clock(r.start) +
                    ". "
                  : "No changeover. ") +
                "Run " +
                clock(r.start) +
                " to " +
                clock(r.end) +
                ". Due " +
                clock(o.due) +
                ".";
            return (
              '<div class="aps-result ' +
              (r.issue || r.late ? "aps-issue" : "aps-pass") +
              '" data-aps-row="' +
              r.job +
              '"><strong>' +
              o.id +
              " · Line " +
              r.line +
              " · " +
              out +
              "</strong><p>" +
              detail +
              "</p></div>"
            );
          })
          .join("") +
        "</div>";
      const misses = rows.filter((r) => r.late).length,
        blocked = rows.filter((r) => r.issue).length,
        totalLate = rows.reduce((sum, r) => sum + (r.late || 0), 0),
        totalSetup = rows.reduce((sum, r) => sum + (r.setup || 0), 0);
      q("[data-aps-status]").textContent =
        (misses || blocked
          ? "Revise the schedule."
          : "Feasible schedule. All three orders finish on time.") +
        " Unscheduled " +
        blocked +
        ". Late orders " +
        misses +
        ". Total tardiness " +
        totalLate +
        " min. Line changeovers " +
        totalSetup +
        " min.";
    }
    function invalidate() {
      q("[data-aps-output]").replaceChildren();
      q("[data-aps-status]").textContent =
        "Plan changed. Calculate the schedule to check this revision.";
    }
    section.addEventListener("change", (e) => {
      const sel = e.target.closest("[data-aps-line]");
      if (!sel) return;
      const row = queue.find((r) => r.job === sel.dataset.apsLine);
      row.line = sel.value;
      invalidate();
    });
    section.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.apsMove) {
        const i = queue.findIndex((row) => row.job === b.dataset.job),
          next = i + (b.dataset.apsMove === "up" ? -1 : 1);
        if (next < 0 || next >= queue.length) return;
        [queue[i], queue[next]] = [queue[next], queue[i]];
        renderQueue();
        invalidate();
        const focus = q(
          '[data-job="' +
            b.dataset.job +
            '"][data-aps-move="' +
            b.dataset.apsMove +
            '"]',
        );
        (focus && !focus.disabled
          ? focus
          : q('[data-aps-line="' + b.dataset.job + '"]')
        ).focus();
        return;
      }
      if (b.dataset.aps === "reset") {
        queue = initial();
        renderQueue();
        calculate();
        return;
      }
      if (b.dataset.aps === "worked") {
        queue = [
          { job: "crinkle", line: "A" },
          { job: "coated", line: "B" },
          { job: "straight", line: "A" },
        ];
        renderQueue();
        calculate();
        return;
      }
      if (b.dataset.aps === "calculate") calculate();
    });
    renderQueue();
    calculate();
  }
  window.ApsLesson = { mount };
})();
