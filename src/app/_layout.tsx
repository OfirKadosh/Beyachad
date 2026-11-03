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
        </Stack.Protected>
      </Stack>
    );
  return (
    <WeddingProvider key={auth.userId}>
      <WeddingRoutes />
    </WeddingProvider>
  );
}
export default function Root() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
