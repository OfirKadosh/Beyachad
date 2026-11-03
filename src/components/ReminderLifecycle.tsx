import { useEffect } from "react";
import { useAuth } from "../providers/AuthProvider";
import { cancelDeviceReminders } from "../services/deviceReminders";
// Biometric lock keeps a session; only actual sign-out cancels future reminders.
export function ReminderLifecycle() {
  const { userId, ready } = useAuth();
  useEffect(() => {
    if (ready && !userId) void cancelDeviceReminders().catch(() => {});
  }, [ready, userId]);
  return null;
}
