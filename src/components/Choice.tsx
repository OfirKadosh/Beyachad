import { Pressable, Text, View } from "react-native";
import { colors, styles } from "./ui";
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange(value: T): void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.text}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ selected: value === option.value, disabled }}
            aria-checked={value === option.value}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 10,
              minHeight: 44,
              borderRadius: 20,
              backgroundColor:
                value === option.value ? colors.green : colors.sage,
              opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                fontSize: 14,
                color: value === option.value ? colors.paper : colors.ink,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
