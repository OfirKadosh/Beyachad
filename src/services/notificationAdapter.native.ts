import { AndroidImportance, IosAuthorizationStatus } from "expo-notifications";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { notificationTitles, type ReminderAdapter } from "../core/reminders";
const marker = "beyachad-reminders-v1";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
export const notificationAdapter: ReminderAdapter = {
  supported: true,
  async permission(request = false) {
    if (request && Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("wedding-reminders", {
        name: "תזכורות חתונה",
        importance: AndroidImportance.DEFAULT,
      });
    const p = request
      ? await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        })
      : await Notifications.getPermissionsAsync();
    return (
      p.granted ||
      p.ios?.status === IosAuthorizationStatus.PROVISIONAL ||
      p.ios?.status === IosAuthorizationStatus.EPHEMERAL
    );
  },
  async list() {
    return (await Notifications.getAllScheduledNotificationsAsync())
      .filter((n) => n.content.data?.app === marker)
      .map((n) => ({
        id: n.identifier,
        owner: String(n.content.data?.owner),
        key: String(n.content.data?.key),
        at: Number(n.content.data?.at),
      }));
  },
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },
  async schedule(owner, item) {
    await Notifications.scheduleNotificationAsync({
      identifier: `beyachad:${owner}:${item.key}`,
      content: {
        title: notificationTitles[item.kind],
        body: "יש פריט מתוכנן במרחב החתונה. פתחו את האפליקציה לפרטים.",
        sound: "default",
        data: { app: marker, owner, key: item.key, at: item.notifyAt },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(item.notifyAt!),
        channelId: Platform.OS === "android" ? "wedding-reminders" : undefined,
      },
    });
  },
};
