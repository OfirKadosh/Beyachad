import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AccessibilityInfo, Platform } from "react-native";
const MotionContext = createContext(true);
export function MotionProvider({ children }: PropsWithChildren) {
  // Start still, until the device/browser preference has been read.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setReduced(query.matches);
      update();
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);
  return (
    <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>
  );
}
export const useReducedMotion = () => useContext(MotionContext);
