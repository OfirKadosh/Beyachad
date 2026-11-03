import { ComingSoon } from "../../components/ComingSoon";
export default function Guests() {
  return (
    <ComingSoon
      title="המוזמנים שלנו"
      description="כל האנשים שחשובים לכם, ברשימה משותפת אחת."
      details={[
        "משפחות והזמנות עם מספר אנשים לכל הזמנה",
        "אישורי הגעה ומספר המגיעים בפועל",
        "קבוצות, ילדים וצרכים תזונתיים",
      ]}
    />
  );
}
