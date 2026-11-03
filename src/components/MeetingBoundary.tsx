import type { PropsWithChildren } from "react";
import { useMeetings } from "../providers/MeetingProvider";
import { Button, Loading, Notice, Screen, Title } from "./ui";
export function MeetingBoundary({ children }: PropsWithChildren) {
  const { loading, error, reload } = useMeetings();
  if (loading) return <Loading />;
  if (error)
    return (
      <Screen>
        <Title>ננסה שוב?</Title>
        <Notice text={error} error />
        <Button
          title="רענון הפגישות"
          onPress={() => {
            void reload();
          }}
        />
      </Screen>
    );
  return children;
}
