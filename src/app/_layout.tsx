import { MeetingProvider } from "../providers/MeetingProvider";
import { ReminderProvider } from "../providers/ReminderProvider";
import { ReminderLifecycle } from "../components/ReminderLifecycle";
import { GuestProvider } from "../providers/GuestProvider";
import { FinanceProvider } from "../providers/FinanceProvider";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../providers/AuthProvider";
import { WeddingProvider, useWedding } from "../providers/WeddingProvider";
import { Button, Loading, Notice, Screen, Title } from "../components/ui";
function WeddingRoutes() {
  const { wedding, loading, error, reload } = useWedding();
  if (loading) return <Loading />;
  if (error)
    return (
      <Screen>
        <Title>ננסה שוב?</Title>
        <Notice text={error} error />
        <Button
          title="טעינה מחדש"
          onPress={() => {
            void reload();
          }}
        />
      </Screen>
    );
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        animationDuration: 250,
      }}
    >
      <Stack.Protected guard={false}>
        <Stack.Screen name="auth" />
      </Stack.Protected>
      <Stack.Protected guard={!wedding}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={!!wedding}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="task-editor" />
        <Stack.Screen name="vendor-editor" />
        <Stack.Screen name="vendor-detail" />
        <Stack.Screen name="payment-editor" />
        <Stack.Screen name="guest-editor" />
        <Stack.Screen name="meetings" />
        <Stack.Screen name="meeting-editor" />
        <Stack.Screen name="reminders" />
      </Stack.Protected>
    </Stack>
  );
}
function Routes() {
  const auth = useAuth();
  if (!auth.ready) return <Loading />;
  if (!auth.userId || auth.locked)
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Protected guard={false}>
          <Stack.Screen name="setup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="task-editor" />
          <Stack.Screen name="vendor-editor" />
          <Stack.Screen name="vendor-detail" />
          <Stack.Screen name="payment-editor" />
          <Stack.Screen name="guest-editor" />
          <Stack.Screen name="meetings" />
          <Stack.Screen name="meeting-editor" />
          <Stack.Screen name="reminders" />
        </Stack.Protected>
      </Stack>
    );
  return (
    <WeddingProvider key={auth.userId}>
      <FinanceProvider>
        <GuestProvider>
          <MeetingProvider>
            <ReminderProvider>
              <WeddingRoutes />
            </ReminderProvider>
          </MeetingProvider>
        </GuestProvider>
      </FinanceProvider>
    </WeddingProvider>
  );
}
export default function Root() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <ReminderLifecycle />
        <Routes />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
