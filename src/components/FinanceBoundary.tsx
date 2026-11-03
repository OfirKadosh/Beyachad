import type { PropsWithChildren } from "react";
import { useFinance } from "../providers/FinanceProvider";
import { Button, Loading, Notice, Screen, Title } from "./ui";
export function FinanceBoundary({ children }: PropsWithChildren) {
  const { loading, error, reload } = useFinance();
  if (loading) return <Loading />;
  if (error)
    return (
      <Screen>
        <Title>ננסה שוב?</Title>
        <Notice text={error} error />
        <Button
          title="רענון ספקים ותשלומים"
          onPress={() => {
            void reload();
          }}
        />
      </Screen>
    );
  return children;
}
