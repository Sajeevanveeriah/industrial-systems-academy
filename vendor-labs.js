(() => {
  const lessons = {
    momentum: window.MomentumLessons,
    aveva: window.AvevaLessons,
    aps: window.ApsLesson,
  };
  const opened = new Set();
  function selectLesson() {
    const hash = location.hash.slice(1);
    const active = Object.hasOwn(lessons, hash) ? hash : "momentum";
    for (const link of document.querySelectorAll(".products a")) {
      if (link.hash === "#" + active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    for (const id of Object.keys(lessons))
      document.getElementById("lesson-" + id).hidden = id !== active;
    if (!opened.has(active)) {
      lessons[active].mount(document.getElementById("lesson-" + active));
      opened.add(active);
    }
  }
  document.querySelector(".skip").onclick = (event) => {
    event.preventDefault();
    document.getElementById("vwork").focus();
  };
  window.addEventListener("hashchange", selectLesson);
  selectLesson();
})();
