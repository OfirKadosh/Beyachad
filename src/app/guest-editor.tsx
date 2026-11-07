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
import { GuestBoundary } from "../components/GuestBoundary";
import {
  duplicatePhone,
  emptyGuest,
  guestSideLabel,
  parseCount,
  rsvpLabels,
  type GuestDraft,
} from "../core/guests";
import { useGuests } from "../providers/GuestProvider";
import { useWedding } from "../providers/WeddingProvider";
export default function GuestEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <GuestBoundary>
      <Form key={id ?? "new"} id={id} />
    </GuestBoundary>
  );
}
function Form({ id }: { id?: string }) {
  const store = useGuests();
  const { wedding, viewerSlot } = useWedding();
  const action = useAction();
  const [original] = useState(
    () => store.guests.find((g) => g.id === id) ?? null,
  );
  const [writeId] = useState(() => id ?? Crypto.randomUUID());
  const [draft, setDraft] = useState<GuestDraft>(
    () => original ?? emptyGuest(),
  );
  const [adults, setAdults] = useState(String(original?.invited_adults ?? 1)),
    [children, setChildren] = useState(String(original?.invited_children ?? 0));
  const [confirmedAdults, setConfirmedAdults] = useState(
      String(original?.confirmed_adults ?? 0),
    ),
    [confirmedChildren, setConfirmedChildren] = useState(
      String(original?.confirmed_children ?? 0),
    );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const groups = [
    ...new Set(
      [
        "משפחה",
        "חברים",
        "עבודה",
        ...store.guests.map((guest) => guest.group_name),
        original?.group_name ?? "",
      ].filter(Boolean),
    ),
  ];
  const changed =
    !!original &&
    store.guests.find((g) => g.id === id)?.version !== original.version;
  function update<K extends keyof GuestDraft>(key: K, value: GuestDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setRsvp(value: GuestDraft["rsvp"]) {
    if (value === "confirmed" && draft.rsvp !== "confirmed") {
      setConfirmedAdults(adults);
      setConfirmedChildren(children);
    } else if (value !== "confirmed") {
      setConfirmedAdults("0");
      setConfirmedChildren("0");
    }
    update("rsvp", value);
  }
  function exit() {
    router.dismissTo("/guests");
  }
  function saved() {
    router.dismissTo({
      pathname: "/guests",
      params: { saved: String(Date.now()) },
    });
  }
  if (id && !original)
    return (
      <Screen>
        <Title>ההזמנה אינה ברשימה</Title>
        <Button title="חזרה למוזמנים" onPress={exit} />
      </Screen>
    );
  return (
    <Screen>
      <Button
        title="חזרה למוזמנים ללא שמירה"
        secondary
        disabled={action.busy}
        onPress={exit}
      />
      <Title>{original ? "עריכת הזמנה" : "הזמנה חדשה"}</Title>
      <Text style={styles.muted}>
        משפחה, זוג או אדם יחיד — הזמנה אחת, עם ספירת אנשים נפרדת.
      </Text>
      {changed && (
        <Notice
          text="ההזמנה עודכנה או נמחקה. הטיוטה נשארת פתוחה; חזרו לרשימה ופתחו אותה מחדש לפני שמירה."
          error
        />
      )}
      <Card>
        <Field
          label="שם ההזמנה או המשפחה"
          value={draft.name}
          onChangeText={(v) => update("name", v)}
          maxLength={100}
          editable={!action.busy}
          placeholder="למשל, שם המשפחה"
        />
        <Field
          label="איש קשר להזמנה — רשות"
          value={draft.contact}
          onChangeText={(v) => update("contact", v)}
          maxLength={100}
          editable={!action.busy}
        />
        <Field
          label="טלפון להזמנה — רשות"
          value={draft.phone}
          onChangeText={(v) => update("phone", v)}
          keyboardType="phone-pad"
          maxLength={40}
          editable={!action.busy}
        />
        {duplicatePhone(store.guests, draft.phone, original?.id) && (
          <Notice text="קיימת הזמנה נוספת עם אותו מספר טלפון. בדקו שאין כפילות; אפשר לשמור אם מדובר בהזמנות שונות." />
        )}
        <Choice
          label="הצד של ההזמנה"
          value={draft.side}
          options={(["one", "two", "shared"] as const).map((value) => ({
            value,
            label: guestSideLabel(value, wedding, viewerSlot),
          }))}
          onChange={(v) => update("side", v)}
          disabled={action.busy}
        />
        <Choice
          label="קבוצה — רשות"
          value={newGroup ? "new" : `group:${draft.group_name}`}
          options={[
            { value: "group:", label: "ללא קבוצה" },
            ...groups.map((group) => ({
              value: `group:${group}`,
              label: group,
            })),
            { value: "new", label: "קבוצה חדשה" },
          ]}
          onChange={(value) => {
            setNewGroup(value === "new");
            update("group_name", value === "new" ? "" : value.slice(6));
          }}
          disabled={action.busy}
        />
        {newGroup && (
          <Field
            label="שם הקבוצה החדשה"
            value={draft.group_name}
            onChangeText={(value) => update("group_name", value)}
            maxLength={50}
            editable={!action.busy}
          />
        )}
        <Field
          label="מבוגרים מוזמנים"
          value={adults}
          onChangeText={setAdults}
          keyboardType="number-pad"
          maxLength={3}
          editable={!action.busy}
        />
        <Field
          label="ילדים מוזמנים"
          value={children}
          onChangeText={setChildren}
          keyboardType="number-pad"
          maxLength={3}
          editable={!action.busy}
        />
        <Choice
          label="מצב ההגעה להזמנה"
          value={draft.rsvp}
          options={Object.entries(rsvpLabels).map(([value, label]) => ({
            value: value as GuestDraft["rsvp"],
            label,
          }))}
          onChange={setRsvp}
          disabled={action.busy}
        />
        {draft.rsvp === "confirmed" && (
          <>
            <Text style={styles.muted}>
              אפשר לאשר חלק מהמוזמנים. מי שלא נכללים במספר המאשרים ייספרו כלא
              מגיעים.
            </Text>
            <Field
              label="מבוגרים שאישרו"
              value={confirmedAdults}
              onChangeText={setConfirmedAdults}
              keyboardType="number-pad"
              maxLength={3}
              editable={!action.busy}
            />
            <Field
              label="ילדים שאישרו"
              value={confirmedChildren}
              onChangeText={setConfirmedChildren}
              keyboardType="number-pad"
              maxLength={3}
              editable={!action.busy}
            />
          </>
        )}
        <Field
          label="צרכים תזונתיים — פירוט וכמויות"
          value={draft.dietary}
          onChangeText={(v) => update("dietary", v)}
          multiline
          numberOfLines={3}
          maxLength={1000}
          editable={!action.busy}
          placeholder="למשל, מנה טבעונית אחת או צורך ללא גלוטן"
        />
        <Text style={styles.muted}>
          הפירוט מתייחס להזמנה כולה; ציינו למי וכמה מנות נדרשות.
        </Text>
        <Field
          label="הערות להזמנה — רשות"
          value={draft.notes}
          onChangeText={(v) => update("notes", v)}
          multiline
          numberOfLines={3}
          maxLength={2000}
          editable={!action.busy}
        />
        <Button
          title="שמירת הזמנה"
          disabled={changed}
          busy={action.busy}
          onPress={() => {
            void action.run(async () => {
              if (newGroup && !draft.group_name.trim())
                throw Error("יש להזין שם לקבוצה החדשה או לבחור קבוצה קיימת.");
              await store.saveGuest(writeId, original, {
                ...draft,
                invited_adults: parseCount(adults),
                invited_children: parseCount(children),
                confirmed_adults:
                  draft.rsvp === "confirmed" ? parseCount(confirmedAdults) : 0,
                confirmed_children:
                  draft.rsvp === "confirmed"
                    ? parseCount(confirmedChildren)
                    : 0,
              });
              saved();
            });
          }}
        />
        <Notice text={action.message} error />
      </Card>
      {original && (
        <Card>
          <Text style={styles.heading}>מחיקת ההזמנה</Text>
          {confirmDelete ? (
            <>
              <Text style={styles.text}>
                למחוק את ״{original.name}״ ואת{" "}
                {original.invited_adults + original.invited_children} המוזמנים
                שבה מהרשימה?
              </Text>
              <Button
                title="אישור מחיקת ההזמנה"
                disabled={changed}
                busy={action.busy}
                onPress={() => {
                  void action.run(async () => {
                    await store.deleteGuest(original);
                    saved();
                  });
                }}
              />
              <Button
                title="ביטול מחיקת ההזמנה"
                secondary
                disabled={action.busy}
                onPress={() => setConfirmDelete(false)}
              />
            </>
          ) : (
            <Button
              title="מחיקת הזמנה"
              secondary
              disabled={changed || action.busy}
              onPress={() => setConfirmDelete(true)}
            />
          )}
        </Card>
      )}
    </Screen>
  );
}
