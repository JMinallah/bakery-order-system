import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startDeadlineReminderJob } from "./jobs/deadline-reminders.js";
import { startOrderExpiryJob } from "./jobs/order-expiry.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  startDeadlineReminderJob();
  startOrderExpiryJob();
});
