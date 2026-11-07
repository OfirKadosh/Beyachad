import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { localDateKey } from "../core/tasks";
import { Button, colors, styles } from "./ui";

const months = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];
const weekdays = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function displayDate(key: string) {
  return key.split("-").reverse().join(".");
}

export function DateField({
  label,
  value,
  onChange,
  optional = false,
  disabled = false,
  minYear = 1,
  maxYear = 9999,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  optional?: boolean;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
}) {
  const [cursor, setCursor] = useState<number | null>(null);
  const today = localDateKey();
  const min = minYear * 12;
  const max = maxYear * 12 + 11;

  function open() {
    const [year, month] = (value || today).split("-").map(Number);
    setCursor(Math.min(max, Math.max(min, year * 12 + month - 1)));
  }

  function choose(date: string) {
    onChange(date);
    setCursor(null);
  }

  const year = cursor === null ? 0 : Math.floor(cursor / 12);
  const month = cursor === null ? 0 : cursor % 12;
  // Work in UTC so calendar cells never shift with the device time zone.
  const first = new Date(0);
  first.setUTCFullYear(year, month, 1);
  const offset = first.getUTCDay();
  const last = new Date(first);
  last.setUTCMonth(month + 1, 0);
  const length = last.getUTCDate();

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.text}>{label}</Text>
      <Button
        accessibilityLabel={value ? `${label}, ${displayDate(value)}` : label}
        title={
          cursor !== null
            ? "סגירת לוח השנה"
            : value
              ? displayDate(value)
              : "בחירת תאריך"
        }
        secondary
        disabled={disabled}
        onPress={() => (cursor === null ? open() : setCursor(null))}
      />
      {cursor !== null && (
        <View accessibilityLabel={label} style={{ gap: 8 }}>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.heading, { textAlign: "center" }]}
          >
            {months[month]} {year}
          </Text>
          <View style={[styles.row, { justifyContent: "center" }]}>
            <Button
              title="חודש קודם"
              secondary
              disabled={disabled || cursor === min}
              onPress={() => setCursor(cursor - 1)}
            />
            <Button
              title="חודש הבא"
              secondary
              disabled={disabled || cursor === max}
              onPress={() => setCursor(cursor + 1)}
            />
          </View>
          <View style={[styles.row, { justifyContent: "center" }]}>
            <Button
              title="שנה קודמת"
              secondary
              disabled={disabled || year === minYear}
              onPress={() => setCursor(cursor - 12)}
            />
            <Button
              title="שנה הבאה"
              secondary
              disabled={disabled || year === maxYear}
              onPress={() => setCursor(cursor + 12)}
            />
          </View>
          <View style={{ direction: "rtl", flexDirection: "row" }}>
            {weekdays.map((day) => (
              <Text
                key={day}
                style={[styles.muted, { flex: 1, textAlign: "center" }]}
              >
                {day}
              </Text>
            ))}
          </View>
          {Array.from(
            { length: Math.ceil((offset + length) / 7) },
            (_, week) => (
              <View
                key={week}
                style={{ direction: "rtl", flexDirection: "row" }}
              >
                {weekdays.map((_, column) => {
                  const day = week * 7 + column - offset + 1;
                  if (day < 1 || day > length)
                    return <View key={column} style={{ flex: 1 }} />;
                  const date = [
                    String(year).padStart(4, "0"),
                    String(month + 1).padStart(2, "0"),
                    String(day).padStart(2, "0"),
                  ].join("-");
                  const selected = date === value;
                  return (
                    <Pressable
                      key={column}
                      accessibilityRole="button"
                      accessibilityLabel={`בחירת ${displayDate(date)}`}
                      accessibilityState={{ selected, disabled }}
                      disabled={disabled}
                      onPress={() => choose(date)}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: 12,
                        backgroundColor: selected
                          ? colors.green
                          : date === today
                            ? colors.sage
                            : "transparent",
                      }}
                    >
                      <Text
                        style={{ color: selected ? colors.paper : colors.ink }}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ),
          )}
          <Button
            title="בחירת היום"
            secondary
            disabled={disabled}
            onPress={() => choose(today)}
          />
          {optional && value !== "" && (
            <Button
              title="ניקוי תאריך"
              secondary
              disabled={disabled}
              onPress={() => choose("")}
            />
          )}
        </View>
      )}
    </View>
  );
}
