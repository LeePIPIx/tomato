const miniLabel = document.querySelector("#miniLabel");
const miniTime = document.querySelector("#miniTime");

window.tomatoDesktop?.onTimerSnapshot((snapshot) => {
  miniTime.textContent = snapshot?.time || "25:00";
  miniLabel.textContent = snapshot?.label || "专注时间";
});

document.addEventListener("dblclick", () => {
  window.tomatoDesktop?.minimizeToTop();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.tomatoDesktop?.minimizeToTop();
});
