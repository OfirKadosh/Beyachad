import { MotionProvider, useReducedMotion } from "../components/motion";
import { DocumentProvider } from "../providers/DocumentProvider";
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
  const reduced = useReducedMotion();
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
        animation: reduced ? "none" : "slide_from_right",
        animationDuration: 280,
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
        <Stack.Screen name="wedding-details" />
        <Stack.Screen name="documents" />
      </Stack.Protected>
      <Stack.Screen name="account" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="recovery" />
    </Stack>
  );
}
function Routes() {
  const auth = useAuth();
  if (!auth.ready) return <Loading />;
  if (!auth.userId || auth.locked || auth.recovering)
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="recovery" />
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
          <Stack.Screen name="wedding-details" />
          <Stack.Screen name="documents" />
          <Stack.Screen name="account" />
        </Stack.Protected>
      </Stack>
    );
  return (
    <WeddingProvider key={auth.userId}>
      <FinanceProvider>
        <GuestProvider>
          <MeetingProvider>
            <DocumentProvider>
              <ReminderProvider>
                <WeddingRoutes />
              </ReminderProvider>
            </DocumentProvider>
          </MeetingProvider>
        </GuestProvider>
      </FinanceProvider>
    </WeddingProvider>
  );
}
export default function Root() {
  return (
    <MotionProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <ReminderLifecycle />
          <Routes />
        </AuthProvider>
      </SafeAreaProvider>
    </MotionProvider>
  );
}
