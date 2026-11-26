const sizingForm = document.getElementById("sizing-sheet");
const sizingInputs = Array.from(sizingForm.querySelectorAll("input"));
const figures = document.getElementById("sizing-figures");
const sizingError = document.getElementById("sizing-error");
const runtime = document.getElementById("sizing-runtime");
const formatLoad = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 3 });

// Eaton 5PX1500IRT2UAUG2, internal batteries, VA = W. Keys are exact chart loads in watts.
const runMinutes = new Map([
  [75, 188],
  [150, 91],
  [300, 44],
  [450, 28],
  [600, 20],
  [750, 14],
  [900, 11],
  [1050, 8.5],
  [1200, 7],
  [1350, 6],
  [1500, 5],
]);

function describeRuntime(watts, va, factor) {
  if (watts > 1500 || va > 1500) {
    return "Outside the 1,500 W or 1,500 VA rating of this example UPS. No runtime is shown.";
  }
  if (watts === 0)
    return "No connected load. The chart does not specify a zero-load runtime.";
  if (factor !== 1)
    return "No runtime lookup: Eaton’s published row assumes VA = W (power factor 1).";
  if (!runMinutes.has(watts))
    return "No exact published load point for this design. Runtime is not interpolated.";
  return (
    "Manufacturer chart: " +
    runMinutes.get(watts) +
    " min typical at " +
    formatLoad.format(watts / 15) +
    "% load, internal batteries. Eaton notes actual runtime may vary by ±15%."
  );
}

function renderSizing() {
  const errors = [];
  for (const input of sizingInputs) {
    const value = input.valueAsNumber;
    const valid =
      Number.isFinite(value) &&
      value >= 0 &&
      (input.name !== "factor" || (value > 0 && value <= 1));
    input.setAttribute("aria-invalid", String(!valid));
    if (!valid) {
      const label = input.labels[0].textContent.trim();
      errors.push(
        label +
          (input.name === "factor"
            ? ": use a value greater than 0 and at most 1."
            : ": enter a number of zero or more."),
      );
    }
  }

  const [host, switchLoad, other, growth, factor] = sizingInputs.map(
    (input) => input.valueAsNumber,
  );
  const peak = host + switchLoad + other;
  const watts = peak * (1 + growth / 100);
  const va = watts / factor;
  const heat = watts * 3.412;
  if (!errors.length && ![peak, watts, va, heat].every(Number.isFinite)) {
    errors.push(
      "The calculation exceeds the numeric range. Reduce the values.",
    );
  }
  figures.hidden = errors.length > 0;
  sizingError.hidden = errors.length === 0;
  sizingError.textContent = errors.join(" ");
  runtime.textContent = "";
  if (errors.length) return;

  document.getElementById("sizing-peak").textContent =
    formatLoad.format(peak) + " W";
  document.getElementById("sizing-design").textContent =
    formatLoad.format(watts) + " W";
  document.getElementById("sizing-va").textContent =
    formatLoad.format(Math.ceil(va)) + " VA";
  document.getElementById("sizing-heat").textContent =
    formatLoad.format(Math.round(heat)) + " BTU/h";
  runtime.textContent = describeRuntime(watts, va, factor);
}

sizingForm.addEventListener("input", renderSizing);
sizingForm.addEventListener("submit", (event) => event.preventDefault());
sizingForm.addEventListener("reset", (event) => {
  event.preventDefault();
  for (const input of sizingInputs) input.value = input.defaultValue;
  renderSizing();
});
renderSizing();
