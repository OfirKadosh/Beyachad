import { createReminderSync } from "../core/reminders";
import { notificationAdapter } from "./notificationAdapter";
export const deviceReminders = createReminderSync(notificationAdapter);
export const cancelDeviceReminders = () => deviceReminders.clear();
