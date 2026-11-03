import { Text } from "react-native";
import { Card, Screen, styles, Title } from "../../components/ui";
import { useWedding } from "../../providers/WeddingProvider";
export default function Budget() {
  const { wedding } = useWedding();
  return (
    <Screen>
      <Title>התקציב שלנו</Title>
      <Card hero>
        <Text style={styles.muted}>יעד התקציב שהגדרתם</Text>
        <Text style={styles.title}>
          {wedding?.budget == null
            ? "טרם הוגדר"
            : `₪${wedding.budget.toLocaleString("he-IL")}`}
        </Text>
      </Card>
      <Text style={styles.text}>
        מעקב התחייבויות, מקדמות ותשלומים יתווסף בשלב התקציב והספקים.
      </Text>
      <Text style={styles.muted}>עד שנוסיף הוצאות, לא מוצגת יתרה מחושבת.</Text>
    </Screen>
  );
}
