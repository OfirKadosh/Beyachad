import type { ReminderAdapter } from "../core/reminders";
// Browser preview intentionally uses the in-app agenda only.
export const notificationAdapter: ReminderAdapter = {
  supported: false,
  permission: async () => false,
  list: async () => [],
  cancel: async () => {},
  schedule: async () => {},
};
