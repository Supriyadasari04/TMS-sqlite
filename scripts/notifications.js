// === Shared Notification Utilities ===

// Save a new notification (persists in localStorage)
function addNotification(notification) {
  const notifs = JSON.parse(localStorage.getItem("notifications")) || [];
  notifs.push({
    id: "notif-" + Date.now(),
    ...notification,
    read: false,
  });
  localStorage.setItem("notifications", JSON.stringify(notifs));
  window.dispatchEvent(new Event("storage")); // Trigger live update
}

// Get notifications relevant to a user
function getUserNotifications(user) {
  const notifs = JSON.parse(localStorage.getItem("notifications")) || [];
  if (!user) return [];

  if (user.role === "admin")
    return notifs.filter(n => n.role === "admin");
  if (user.role === "agent")
    return notifs.filter(n => n.role === "agent" && n.email === user.email);
  if (user.role === "customer")
    return notifs.filter(n => n.role === "customer" && n.email === user.email);

  return [];
}

// Clear all notifications for the current user
function clearNotificationsForUser(user) {
  const notifs = JSON.parse(localStorage.getItem("notifications")) || [];
  const remaining = notifs.filter(n => {
    if (user.role === "admin") return n.role !== "admin";
    if (user.role === "agent") return !(n.role === "agent" && n.email === user.email);
    if (user.role === "customer") return !(n.role === "customer" && n.email === user.email);
  });
  localStorage.setItem("notifications", JSON.stringify(remaining));
  window.dispatchEvent(new Event("storage"));
}

// === UI Renderer ===
function renderNotifications() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  const notifs = getUserNotifications(user);
  const countEl = document.getElementById("notif-count");
  const panelEl = document.getElementById("notif-panel");

  if (!countEl || !panelEl) return;

  countEl.innerText = notifs.length;
  panelEl.innerHTML = notifs.length
    ? notifs
        .map(
          n => `
        <div class="notif-item">
          <p>${n.message}</p>
          <small>${n.timestamp}</small>
        </div>`
        )
        .join("") +
      `<button onclick="clearNotificationsForUser(${JSON.stringify(user)})" class="btn-outline" style="margin-top:10px;">Clear All</button>`
    : `<p class="empty-text">No notifications</p>`;
}

// === Toggle Panel ===
function toggleNotifications() {
  const panel = document.getElementById("notif-panel");
  if (!panel) return;
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

// Live update notifications when localStorage changes
window.addEventListener("storage", e => {
  if (e.key === "notifications") renderNotifications();
});

// Render once on load
window.addEventListener("load", renderNotifications);
