(() => {
  "use strict";

  const scenarios = {
    healthy: {
      answer: "all",
      explanation: "The sample crosses the fibre and the application stores its sequence and source timestamp. All three counters advance together."
    },
    fibre: {
      answer: "source",
      explanation: "Local power keeps the endpoint sampling. The broken fibre stops new samples at the endpoint. The receiver and application retain the last sequence they received."
    },
    stale: {
      answer: "receiver",
      explanation: "The optical link carries the new sample to the receiver. The stalled application keeps its previous sequence and source timestamp, so its displayed value grows older."
    }
  };

  function time(seconds) {
    return new Date(Date.UTC(2000, 0, 1, 8, 0, seconds)).toISOString().slice(11, 19);
  }

  function addStyles() {
    if (document.getElementById("study-link-styles")) return;
    const style = document.createElement("style");
    style.id = "study-link-styles";
    style.textContent = `
      [data-study-link] .sl-figure {margin:1rem 0;padding:clamp(13px,2vw,20px);border:1px solid #9fb8ab;border-radius:9px;background:#f5f9f2;color:#19382d;display:grid;gap:10px;min-width:0}
      [data-study-link] .sl-figure * {box-sizing:border-box}
      [data-study-link] .sl-figure figcaption {font-weight:750;font-size:1.1rem;color:#19382d}
      [data-study-link] .sl-figure p {margin:0;line-height:1.45}
      [data-study-link] .sl-controls {display:flex;flex-wrap:wrap;align-items:end;gap:8px}
      [data-study-link] label {display:grid;gap:3px;color:#254a39;min-width:0;font-size:.9rem}
      [data-study-link] button,[data-study-link] select {padding:7px 10px;min-height:38px;max-width:100%;border-radius:5px;border:1px solid #779182;background:#fff;color:#17372a;font:inherit}
      [data-study-link] button {cursor:pointer;font-weight:650}
      [data-study-link] .sl-paths {display:grid;gap:5px;background:#fff;border:1px solid #c9d8ca;padding:9px;border-radius:5px}
      [data-study-link] .sl-data {overflow-x:auto;min-width:0}
      [data-study-link] table {width:100%;border-collapse:collapse;margin:0;background:#fff;font-size:.86rem}
      [data-study-link] th,[data-study-link] td {padding:6px;text-align:left;border-bottom:1px solid #cad7ca;color:#19382d}
      [data-study-link] th {background:#e5eee0}
      [data-study-link] .sl-response:not(:empty) {padding:8px 10px;background:#e4efdd;border-left:3px solid #56805c}
      [data-study-link] :focus-visible {outline:3px solid #a75027;outline-offset:2px}
      @media(max-width:480px){[data-study-link] .sl-controls>label{width:100%}[data-study-link] th,[data-study-link] td{padding:5px 4px}}
    `;
    document.head.append(style);
  }

  function mount(host) {
    if (host.querySelector(".sl-figure")) return;
    addStyles();
    const figure = document.createElement("figure");
    figure.className = "sl-figure";
    figure.innerHTML = `
      <figcaption>Follow one sample from sensor to screen</figcaption>
      <p>The sensor endpoint has its own local power supply. Choose a condition, predict where the next sample will appear, then advance the clock by one second.</p>
      <div class="sl-controls">
        <label>Test condition<select data-sl-field="condition">
          <option value="healthy">Healthy link and application</option>
          <option value="fibre">Broken fibre link</option>
          <option value="stale">Application stops reading samples</option>
        </select></label>
        <label>Which counters will advance?<select data-sl-field="prediction">
          <option value="">Choose a prediction</option>
          <option value="all">Endpoint, receiver and application</option>
          <option value="source">Endpoint only</option>
          <option value="receiver">Endpoint and receiver only</option>
        </select></label>
      </div>
      <div class="sl-paths">
        <p><strong>Physical path</strong> &nbsp; Local supply → endpoint → optical fibre → receiver</p>
        <p><strong>Data path</strong> &nbsp; Endpoint sample → receiver buffer → application display</p>
        <p data-sl-out="link"></p>
      </div>
      <div class="sl-controls"><button type="button" data-sl-action="sample">Advance one sample</button>
        <button type="button" data-sl-action="check">Check prediction</button></div>
      <p data-sl-out="clock"></p>
      <div class="sl-data"><table aria-label="Latest sample at each point"><thead><tr><th scope="col">Observed at</th>
        <th scope="col">Sequence</th><th scope="col">Source time (UTC)</th></tr></thead><tbody></tbody></table></div>
      <p class="sl-response" role="status" data-sl-out="feedback"></p>`;
    host.append(figure);
    const select = name => figure.querySelector('[data-sl-field="'+name+'"]');
    const output = name => figure.querySelector('[data-sl-out="'+name+'"]');
    const rows = [];
    for (const name of ["Endpoint", "Receiver buffer", "Application display"]) {
      const tr = document.createElement("tr");
      const title = document.createElement("th");
      title.scope = "row";
      title.textContent = name;
      const sequence = document.createElement("td");
      const recorded = document.createElement("td");
      tr.append(title, sequence, recorded);
      figure.querySelector("tbody").append(tr);
      rows.push({ sequence, recorded });
    }
    let seconds = 0;
    let latest = [0, 0, 0];
    function render() {
      const condition = select("condition").value;
      output("link").textContent = "Endpoint power on · Optical link " + (condition === "fibre" ? "down" : "up");
      output("clock").textContent = "Test clock " + time(seconds) + " UTC · Displayed sample age " + (seconds - latest[2]) + " s";
      rows.forEach((row, index) => {
        row.sequence.textContent = String(100 + latest[index]);
        row.recorded.textContent = time(latest[index]);
      });
    }
    select("condition").addEventListener("change", () => {
      seconds = 0;
      latest = [0, 0, 0];
      select("prediction").value = "";
      output("feedback").textContent = "A new trial starts with sample 100 already present at all three points.";
      render();
    });
    select("prediction").addEventListener("change", () => { output("feedback").textContent = ""; });
    figure.querySelector('[data-sl-action="sample"]').addEventListener("click", () => {
      const condition = select("condition").value;
      seconds++;
      latest[0] = seconds;
      if (condition !== "fibre") latest[1] = seconds;
      if (condition === "healthy") latest[2] = seconds;
      render();
      output("feedback").textContent = "Sample "+seconds+". "+output("link").textContent+". Compare the counters and source timestamps.";
    });
    figure.querySelector('[data-sl-action="check"]').addEventListener("click", () => {
      const answer = select("prediction").value;
      const scenario = scenarios[select("condition").value];
      if (!answer) output("feedback").textContent = "Choose the counters you expect to advance.";
      else if (!seconds) output("feedback").textContent = "Advance one sample to collect evidence for the prediction.";
      else output("feedback").textContent = (answer === scenario.answer ? "Correct. " : "Compare your prediction with the readings. ") + scenario.explanation;
    });
    render();
  }
  function start() { document.querySelectorAll("[data-study-link]").forEach(mount); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
