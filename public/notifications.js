// Display notifications on browsers that only support them through a service worker.
// The open app schedules notifications; this worker does not run background timers.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const app = windows.find(
        (client) => new URL(client.url).pathname === "/",
      );
      if (app) await app.focus();
      else await self.clients.openWindow("/");
    })(),
  );
});
