const miniLabel = document.querySelector("#miniLabel");
const miniTime = document.querySelector("#miniTime");
const miniShell = document.querySelector(".mini-shell");

let dragState = null;

window.tomatoDesktop?.onTimerSnapshot((snapshot) => {
  miniTime.textContent = snapshot?.time || "25:00";
  miniLabel.textContent = snapshot?.label || "专注时间";
});

document.addEventListener("dblclick", () => {
  window.tomatoDesktop?.restoreFromMini();
});

miniShell.addEventListener("pointerdown", async (event) => {
  if (event.button !== 0) return;

  const position = await window.tomatoDesktop?.miniDragStart();
  if (!position) return;

  miniShell.setPointerCapture(event.pointerId);
  dragState = {
    pointerId: event.pointerId,
    originX: event.screenX,
    originY: event.screenY,
    windowX: position[0],
    windowY: position[1]
  };
});

miniShell.addEventListener("pointermove", (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;

  const nextX = dragState.windowX + event.screenX - dragState.originX;
  const nextY = dragState.windowY + event.screenY - dragState.originY;
  window.tomatoDesktop?.miniDragMove([nextX, nextY]);
});

miniShell.addEventListener("pointerup", (event) => {
  if (dragState?.pointerId === event.pointerId) dragState = null;
});

miniShell.addEventListener("pointercancel", () => {
  dragState = null;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.tomatoDesktop?.restoreFromMini();
});
