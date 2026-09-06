import { useCallback, useMemo, useState } from "react";

import { createClient } from "../../../../../../api/client";
import type { BookingNotificationSettings } from "../../../../../../api/types";

/** Coordination id shared with the backend logs/routes. */
export const BOOKING_NOTIF_COORDINATION_ID = "bkg-wa-notif";

export function defaultBookingNotifications(): BookingNotificationSettings {
  return { sendConfirmation: true, sendReconfirmation: false, reconfirmationDaysBefore: 2 };
}

type UseBookingNotificationsReturn = {
  settings: BookingNotificationSettings;
  saved: BookingNotificationSettings;
  dirty: boolean;
  loaded: boolean;
  saving: boolean;
  setField: <K extends keyof BookingNotificationSettings>(key: K, value: BookingNotificationSettings[K]) => void;
  load: () => Promise<void>;
  save: () => Promise<boolean>;
};

export function useBookingNotifications(): UseBookingNotificationsReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [settings, setSettings] = useState<BookingNotificationSettings>(defaultBookingNotifications);
  const [saved, setSaved] = useState<BookingNotificationSettings>(defaultBookingNotifications);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const setField = useCallback(
    <K extends keyof BookingNotificationSettings>(key: K, value: BookingNotificationSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const res = await api.settings.getBookingNotifications();
      if (res.success) {
        setSettings(res.settings);
        setSaved(res.settings);
      }
    } catch {
      // keep defaults on error
    }
    setLoaded(true);
  }, [api.settings]);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await api.settings.setBookingNotifications(settings);
      if (!res.success) return false;
      setSettings(res.settings);
      setSaved(res.settings);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [api.settings, settings]);

  const dirty =
    settings.sendConfirmation !== saved.sendConfirmation ||
    settings.sendReconfirmation !== saved.sendReconfirmation ||
    settings.reconfirmationDaysBefore !== saved.reconfirmationDaysBefore;

  return { settings, saved, dirty, loaded, saving, setField, load, save };
}
