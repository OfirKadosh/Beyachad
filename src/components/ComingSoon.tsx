import { Text } from "react-native";
import { Card, Screen, styles, Title } from "./ui";
export function ComingSoon({
  title,
  description,
  details,
}: {
  title: string;
  description: string;
  details: string[];
}) {
  return (
    <Screen>
      <Title>{title}</Title>
      <Text style={styles.text}>{description}</Text>
      <Card hero>
        <Text style={styles.heading}>המסך הזה ייבנה בשלב הבא</Text>
        <Text style={styles.muted}>
          כאן יופיעו הנתונים שלכם לאחר שנוסיף את יכולות הניהול.
        </Text>
      </Card>
      {details.map((text) => (
        <Text key={text} style={styles.text}>
          • {text}
        </Text>
      ))}
    </Screen>
  );
}
