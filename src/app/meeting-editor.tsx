import { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Button,
  Card,
  Field,
  Notice,
  Screen,
  styles,
  Title,
  useAction,
} from "../components/ui";
import { Choice } from "../components/Choice";
import { MeetingBoundary } from "../components/MeetingBoundary";
import {
  meetingStatuses,
  overlappingMeetings,
  type MeetingDraft,
} from "../core/meetings";
import {
  deviceTimeZone,
  meetingWallTime,
  wallTimeToInstant,
} from "../core/meetingTime";
import { assigneeLabel } from "../core/tasks";
import { useMeetings } from "../providers/MeetingProvider";
import { useWedding } from "../providers/WeddingProvider";
import { useFinance } from "../providers/FinanceProvider";
export default function Editor() {
  const { id, fromList } = useLocalSearchParams<{
    id?: string;
    fromList?: string;
  }>();
  return (
    <MeetingBoundary>
      <Form key={id ?? "new"} id={id} fromList={fromList} />
    </MeetingBoundary>
  );
}
function Form({ id, fromList }: { id?: string; fromList?: string }) {
  const store = useMeetings(),
    { wedding, viewerSlot } = useWedding(),
    { vendors } = useFinance(),
    action = useAction();
  const [original] = useState(
      () => store.meetings.find((m) => m.id === id) ?? null,
    ),
    [writeId] = useState(() => id ?? Crypto.randomUUID());
  const [draft, setDraft] = useState<MeetingDraft>(
    () =>
      original ?? {
        title: "",
        starts_at: "",
        time_zone: deviceTimeZone(),
        duration_minutes: 60,
        location: "",
        vendor_id: null,
        owner: "both",
        status: "scheduled",
        reminder_minutes: 60,
        notes: "",
      },
  );
  const wall = original
    ? meetingWallTime(original.starts_at, original.time_zone)
    : { date: "", time: "" };
  const [date, setDate] = useState(wall.date),
    [time, setTime] = useState(wall.time),
    [duration, setDuration] = useState(
      String(original?.duration_minutes ?? 60),
    ),
    [confirm, setConfirm] = useState(false);
  const changed =
    !!original &&
    store.meetings.find((m) => m.id === id)?.version !== original.version;
  function update<K extends keyof MeetingDraft>(
    key: K,
    value: MeetingDraft[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function exit() {
    if (fromList === "true" && router.canGoBack()) router.back();
    else router.dismissTo("/meetings");
  }
  function saved() {
    router.dismissTo({
      pathname: "/meetings",
      params: { saved: String(Date.now()) },
    });
  }
  let overlaps = 0;
  try {
    overlaps = overlappingMeetings(
      store.meetings,
      {
        ...draft,
        starts_at: wallTimeToInstant(date, time, draft.time_zone),
        duration_minutes: Number(duration),
      },
      id,
    ).length;
  } catch {}
  if (id && !original)
    return (
      <Screen>
        <Title>הפגישה אינה ברשימה</Title>
        <Button title="חזרה לפגישות" onPress={exit} />
      </Screen>
    );
  return (
    <Screen>
      <Button
        title="חזרה לפגישות ללא שמירה"
        secondary
        disabled={action.busy}
        onPress={exit}
      />
      <Title>{original ? "עריכת פגישה" : "פגישה חדשה"}</Title>
      {changed && (
        <Notice
          text="הפגישה עודכנה או נמחקה. הטיוטה נשמרת כאן; פתחו אותה מחדש לפני שמירה."
          error
        />
      )}
      <Card>
        <Field
          label="כותרת הפגישה"
          value={draft.title}
          onChangeText={(v) => update("title", v)}
          maxLength={100}
          editable={!action.busy}
        />
        <Field
          label="תאריך הפגישה"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          maxLength={10}
          editable={!action.busy}
        />
        <Field
          label="שעת הפגישה"
          value={time}
          onChangeText={setTime}
          placeholder="HH:MM"
          maxLength={5}
          editable={!action.busy}
        />
        <Field
          label="אזור זמן לפגישה"
          value={draft.time_zone}
          onChangeText={(v) => update("time_zone", v)}
          autoCapitalize="none"
          placeholder="Asia/Jerusalem"
          editable={!action.busy}
        />
        <Text style={styles.muted}>
          השעה מוצגת לפי אזור הזמן של הפגישה גם כשנמצאים במדינה אחרת.
        </Text>
        <Field
          label="משך הפגישה בדקות"
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          maxLength={4}
          editable={!action.busy}
        />
        <Field
          label="מקום או קישור לפגישה — רשות"
          value={draft.location}
          onChangeText={(v) => update("location", v)}
          maxLength={300}
          editable={!action.busy}
        />
        <Choice
          label="אחריות לפגישה"
          value={draft.owner}
          options={(
            ["both", viewerSlot, viewerSlot === "one" ? "two" : "one"] as const
          ).map((value) => ({
            value,
            label: assigneeLabel(value, wedding, viewerSlot),
          }))}
          onChange={(v) => update("owner", v)}
          disabled={action.busy}
        />
        <Choice
          label="מצב הפגישה"
          value={draft.status}
          options={Object.entries(meetingStatuses).map(([value, label]) => ({
            value: value as MeetingDraft["status"],
            label,
          }))}
          onChange={(v) => update("status", v)}
          disabled={action.busy}
        />
        <Choice<string>
          label="ספק מקושר"
          value={draft.vendor_id ?? ""}
          options={[
            { value: "", label: "ללא ספק" },
            ...vendors.map((v) => ({ value: v.id, label: v.name })),
          ]}
          onChange={(v) => update("vendor_id", v || null)}
          disabled={action.busy}
        />
        <Choice<string>
          label="תזכורת לפגישה"
          value={
            draft.reminder_minutes === null
              ? "none"
              : String(draft.reminder_minutes)
          }
          options={[
            { value: "none", label: "ללא" },
            { value: "0", label: "בזמן הפגישה" },
            { value: "15", label: "רבע שעה לפני" },
            { value: "60", label: "שעה לפני" },
            { value: "1440", label: "24 שעות לפני" },
          ]}
          onChange={(v) =>
            update("reminder_minutes", v === "none" ? null : Number(v))
          }
          disabled={action.busy}
        />
        <Text style={styles.muted}>
          התראת מכשיר דורשת הפעלה והרשאה במסך התזכורות.
        </Text>
        <Field
          label="הערות לפגישה — רשות"
          value={draft.notes}
          onChangeText={(v) => update("notes", v)}
          multiline
          maxLength={2000}
          editable={!action.busy}
        />
        {overlaps > 0 && (
          <Notice
            text={`יש ${overlaps} פגישות חופפות עם אותו אחראי. בדקו את השעות לפני שמירה.`}
          />
        )}
        <Button
          title="שמירת פגישה"
          disabled={changed}
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              if (!/^\d+$/.test(duration))
                throw Error("יש להזין משך שלם בדקות.");
              await store.saveMeeting(writeId, original, {
                ...draft,
                starts_at: wallTimeToInstant(date, time, draft.time_zone),
                duration_minutes: Number(duration),
              });
              saved();
            });
          }}
        />
        <Notice text={action.message} error />
      </Card>
      {original && (
        <Card>
          <Text style={styles.heading}>מחיקת פגישה</Text>
          {confirm ? (
            <>
              <Text style={styles.text}>
                למחוק את ״{original.title}״ ואת התזכורת המקושרת?
              </Text>
              <Button
                title="אישור מחיקת הפגישה"
                disabled={changed}
                busy={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    await store.deleteMeeting(original);
                    saved();
                  });
                }}
              />
              <Button
                title="ביטול מחיקת הפגישה"
                secondary
                disabled={action.busy}
                onPress={() => setConfirm(false)}
              />
            </>
          ) : (
            <Button
              title="מחיקת פגישה"
              secondary
              disabled={action.busy || changed}
              onPress={() => setConfirm(true)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
