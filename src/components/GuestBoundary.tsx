import type { PropsWithChildren } from "react";
import { useGuests } from "../providers/GuestProvider";
import { Button, Loading, Notice, Screen, Title } from "./ui";
export function GuestBoundary({ children }: PropsWithChildren) {
  const { loading, error, reload } = useGuests();
  if (loading) return <Loading />;
  if (error)
    return (
      <Screen>
        <Title>ננסה שוב?</Title>
        <Notice text={error} error />
        <Button
          title="רענון רשימת המוזמנים"
          onPress={() => {
            void reload();
          }}
        />
      </Screen>
    );
  return children;
}
