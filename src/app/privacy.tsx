import { Text } from "react-native";
import { router } from "expo-router";
import { Button, Card, Screen, styles, Title } from "../components/ui";
export default function Privacy() {
  return (
    <Screen>
      <Button
        title="חזרה"
        secondary
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/");
        }}
      />
      <Title>המידע שלכם, בשליטה שלכם</Title>
      <Card>
        <Text style={styles.heading}>מה נשמר ולמי יש גישה</Text>
        <Text style={styles.text}>
          בחשבון אמיתי נשמרים כתובת האימייל, פרטי החתונה, משימות, ספקים
          ותשלומים, פגישות, מסמכים ופרטי מוזמנים שהזנתם. שני חברי המרחב יכולים
          לצפות ולעדכן את המידע המשותף. המסמכים נמצאים באחסון פרטי וקישורי
          הפתיחה שלהם זמניים.
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>במכשיר ובהתראות</Text>
        <Text style={styles.text}>
          באייפון ההתחברות נשמרת באחסון מאובטח. אפשר להוסיף נעילה ביומטרית
          בהגדרות. ההתראות מקומיות ואופציונליות; הן מציגות תיאור כללי ללא שמות,
          סכומים ופרטי מוזמנים. לאחר שינוי מרחוק, פתחו את האפליקציה לעדכון
          ההתראות.
        </Text>
        <Text style={styles.muted}>
          מצב הפיתוח שומר נתונים במכשיר בלבד. בדפדפן ההתחברות נשמרת באחסון
          המקומי עד ליציאה מהחשבון או לניקוי נתוני האתר. במכשיר משותף יש לצאת
          מהחשבון בסיום השימוש. חסימת אחסון בדפדפן עשויה למנוע שמירת התחברות.
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>עזיבה ומחיקה</Text>
        <Text style={styles.text}>
          אפשר לעזוב מרחב או למחוק חשבון דרך ההגדרות. מידע משותף נשאר אצל שותף
          שנותר במרחב. אם אתם האחרונים, הנתונים נמחקים לאחר הסרת המסמכים. מחיקה
          מהשירות הפעיל אינה מבטיחה הסרה מיידית מגיבויי ספק האחסון.
        </Text>
      </Card>
      <Card>
        <Text style={styles.heading}>זקוקים לעזרה?</Text>
        <Text style={styles.text}>
          אם שמירה נכשלה, בדקו חיבור ונסו לרענן. שינויים מתנגשים דורשים פתיחה
          מחדש של הפריט; הטיוטה נשארת במסך. אין להזין סיסמה או מפתחות שירות
          בהודעת תמיכה.
        </Text>
        <Text style={styles.muted}>
          הגרסה עדיין בבדיקות לפני הפצה לציבור. פרטי המפעיל וערוץ התמיכה יוגדרו
          לפני פרסום בחנות.
        </Text>
      </Card>
    </Screen>
  );
}
