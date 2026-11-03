import { View } from "react-native";
export function DocumentPreview({ url, name }: { url: string; name: string }) {
  return (
    <View style={{ height: 460, borderRadius: 16, overflow: "hidden" }}>
      <iframe
        title={`תצוגת מסמך: ${name}`}
        src={url}
        referrerPolicy="no-referrer"
        sandbox="allow-downloads"
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          background: "white",
        }}
      />
    </View>
  );
}
