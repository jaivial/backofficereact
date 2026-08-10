import { useCallback } from "react";
import type {
  ConfigDailyLimit,
  ConfigDayStatus,
  ConfigFloor,
  ConfigMesasDeDos,
  ConfigMesasDeTres,
  ConfigOpeningHours,
  HourSplitConfig,
  MandatoryMenuConfig,
  MenuSelectorItem,
  OpeningMode,
} from "../../../../../api/types";
import { clampDailyLimit, mergeHoursByOpeningMode, sortServiceHours, toggleHour } from "../helpers/configHelpers";
import type { useToasts } from "../../../../../ui/feedback/useToasts";

interface UseConfigDayOptions {
  api: any;
  date: string;
  day: ConfigDayStatus | null;
  dailyLimit: ConfigDailyLimit | null;
  openingHours: ConfigOpeningHours | null;
  mesasDeDos: ConfigMesasDeDos | null;
  mesasDeTres: ConfigMesasDeTres | null;
  floors: ConfigFloor[];
  hourSplit: HourSplitConfig | null;
  mandatoryMenuStatus: boolean;
  mandatoryBooking: boolean;
  selectedMenuIds: number[];
  menuChooseMain: number[];
  availableMenus: MenuSelectorItem[];
  draftLimit: string;
  pushToast: ReturnType<typeof useToasts>["pushToast"];
  setDay: (day: ConfigDayStatus | null) => void;
  setDailyLimit: (limit: ConfigDailyLimit | null) => void;
  setOpeningHours: (hours: ConfigOpeningHours | null) => void;
  setMesasDeDos: (mesas: ConfigMesasDeDos | null) => void;
  setMesasDeTres: (mesas: ConfigMesasDeTres | null) => void;
  setFloors: (floors: ConfigFloor[]) => void;
  setHourSplit: (config: HourSplitConfig | null) => void;
  setMandatoryMenuStatus: (status: boolean) => void;
  setMandatoryMenuConfig: (config: MandatoryMenuConfig | null) => void;
  setSelectedMenuIds: (ids: number[]) => void;
  setMenuChooseMain: (ids: number[]) => void;
  setMandatoryBooking: (mandatory: boolean) => void;
  setDraftLimit: (limit: string) => void;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
}

export function useConfigDay({
  api,
  date,
  day,
  dailyLimit,
  openingHours,
  mesasDeDos,
  mesasDeTres,
  floors,
  hourSplit,
  mandatoryMenuStatus,
  mandatoryBooking,
  selectedMenuIds,
  menuChooseMain,
  availableMenus,
  draftLimit,
  pushToast,
  setDay,
  setDailyLimit,
  setOpeningHours,
  setMesasDeDos,
  setMesasDeTres,
  setFloors,
  setHourSplit,
  setMandatoryMenuStatus,
  setMandatoryMenuConfig,
  setSelectedMenuIds,
  setMenuChooseMain,
  setMandatoryBooking,
  setDraftLimit,
  setBusy,
  setError,
}: UseConfigDayOptions) {
  const pushSuccess = useCallback(
    (message: string) => {
      pushToast({ kind: "success", title: "Guardado", message });
    },
    [pushToast],
  );

  const loadAll = useCallback(
    async (d: string) => {
      setBusy(true);
      setError(null);
      try {
        const [d0, d1, d2, d3, d4, d5, d6] = await Promise.all([
          api.config.getDay(d),
          api.config.getDailyLimit(d),
          api.config.getOpeningHours(d),
          api.config.getMesasDeDos(d),
          api.config.getMesasDeTres(d),
          api.config.getFloors(d),
          api.config.getHourSplit(d),
        ]);

        let nextError: string | null = null;

        if (d0.success) setDay(d0);
        else nextError = nextError || d0.message || "Error cargando estado del día";

        if (d1.success) setDailyLimit(d1);
        else nextError = nextError || d1.message || "Error cargando límite diario";

        if (d2.success) setOpeningHours(d2);
        else nextError = nextError || d2.message || "Error cargando horarios";

        if (d3.success) setMesasDeDos(d3);
        else nextError = nextError || d3.message || "Error cargando mesas de 2";

        if (d4.success) setMesasDeTres(d4);
        else nextError = nextError || d4.message || "Error cargando mesas de 3";

        if (d5.success) setFloors(d5.floors || []);
        else nextError = nextError || d5.message || "Error cargando plantas";

        if (d6.success) setHourSplit(d6);
        else nextError = nextError || d6.message || "Error cargando reparto por hora";

        if (nextError) setError(nextError);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cargando configuración");
      } finally {
        setBusy(false);
      }
    },
    [api, setBusy, setError, setDay, setDailyLimit, setOpeningHours, setMesasDeDos, setMesasDeTres, setFloors, setHourSplit],
  );

  const loadMandatoryMenuConfig = useCallback(
    async (d: string) => {
      setBusy(true);
      try {
        const menusRes = await api.menus.getSelector();
        if (menusRes.success) {
          // Note: availableMenus is set via parent component state
        }

        const configRes = await api.config.getMandatoryMenus(d);
        if (configRes.success) {
          setMandatoryMenuConfig(configRes);
          setMandatoryMenuStatus(configRes.status);
          setSelectedMenuIds(configRes.menuIds || []);
          setMenuChooseMain(configRes.menuChooseMain || []);
          setMandatoryBooking(configRes.mandatory);
        } else {
          setMandatoryMenuConfig(null);
          setMandatoryMenuStatus(false);
          setSelectedMenuIds([]);
          setMenuChooseMain([]);
          setMandatoryBooking(false);
        }
      } catch {
        setMandatoryMenuConfig(null);
        setMandatoryMenuStatus(false);
        setSelectedMenuIds([]);
        setMenuChooseMain([]);
        setMandatoryBooking(false);
      } finally {
        setBusy(false);
      }
    },
    [api, setBusy, setMandatoryMenuConfig, setMandatoryMenuStatus, setSelectedMenuIds, setMenuChooseMain, setMandatoryBooking],
  );

  const saveMandatoryMenus = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.config.saveMandatoryMenus({
        date,
        status: true,
        mandatory: mandatoryBooking,
        menuIds: selectedMenuIds,
        menuChooseMain: menuChooseMain,
      });
      if (res.success) {
        setMandatoryMenuConfig(res);
        pushToast({ kind: "success", title: "Guardado", message: "Configuración de menus guardada" });
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar la configuración" });
      }
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar la configuración" });
    } finally {
      setBusy(false);
    }
  }, [api, date, mandatoryBooking, selectedMenuIds, menuChooseMain, pushToast, setBusy, setMandatoryMenuConfig]);

  const handleMandatoryMenuToggle = useCallback(
    async (checked: boolean) => {
      if (!checked) {
        setBusy(true);
        try {
          const res = await api.config.saveMandatoryMenus({
            date,
            status: false,
            mandatory: false,
            menuIds: [],
            menuChooseMain: [],
          });
          if (res.success) {
            setMandatoryMenuStatus(false);
            setMandatoryMenuConfig(res);
            setSelectedMenuIds([]);
            setMenuChooseMain([]);
            setMandatoryBooking(false);
            pushToast({ kind: "success", title: "Desactivado", message: "Menús obligatorios desactivados para este día" });
          }
        } catch (e) {
          pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo actualizar" });
        } finally {
          setBusy(false);
        }
      } else {
        setMandatoryMenuStatus(true);
        if (selectedMenuIds.length === 0 && availableMenus.length > 0) {
          setSelectedMenuIds([availableMenus[0].id]);
        }
      }
    },
    [api, date, pushToast, selectedMenuIds, availableMenus, setBusy, setMandatoryMenuStatus, setMandatoryMenuConfig, setSelectedMenuIds, setMenuChooseMain, setMandatoryBooking],
  );

  const onDateChange = useCallback(
    (d: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set("date", d);
      window.history.replaceState(null, "", url.toString());
      void loadAll(d);
      void loadMandatoryMenuConfig(d);
    },
    [loadAll, loadMandatoryMenuConfig],
  );

  const toggleDay = useCallback(async () => {
    if (!day) return;
    setBusy(true);
    setError(null);
    try {
      const next = !day.isOpen;
      const res = await api.config.setDay(date, next);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar el día" });
        return;
      }
      setDay(res);
      pushSuccess(next ? "Día abierto" : "Día cerrado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el día");
    } finally {
      setBusy(false);
    }
  }, [api.config, date, day, pushSuccess, pushToast, setBusy, setError, setDay]);

  const setDayRange = useCallback(async (dates: string[], isOpen: boolean) => {
    if (!dates.length) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await api.config.setDayRange(dates, isOpen);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudieron actualizar los días" });
        return false;
      }
      // Refresh the currently selected day if it falls within the applied range.
      if (dates.includes(date)) {
        setDay(day ? { ...day, isOpen } : day);
      }
      pushSuccess(isOpen ? "Días abiertos" : "Días cerrados");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron actualizar los días");
      return false;
    } finally {
      setBusy(false);
    }
  }, [api.config, date, pushSuccess, pushToast, setBusy, setError, setDay]);

  const saveDailyLimit = useCallback(
    async (nextLimit: number) => {
      const normalized = clampDailyLimit(nextLimit);
      if (dailyLimit && normalized === dailyLimit.limit) {
        setDraftLimit(String(normalized));
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setDailyLimit(date, normalized);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar el límite" });
          if (dailyLimit) setDraftLimit(String(dailyLimit.limit));
          return;
        }
        setDailyLimit({
          date: res.date,
          limit: res.limit,
          totalPeople: dailyLimit?.totalPeople ?? 0,
          freeBookingSeats: Math.max(0, res.limit - (dailyLimit?.totalPeople ?? 0)),
          source: "override",
        });
        setDraftLimit(String(res.limit));
        pushSuccess("Límite diario actualizado");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el límite");
      } finally {
        setBusy(false);
      }
    },
    [api.config, dailyLimit, date, pushSuccess, pushToast, setBusy, setError, setDailyLimit, setDraftLimit],
  );

  const saveDailyLimitFromDraft = useCallback(() => {
    const n = Number(draftLimit);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      if (dailyLimit) setDraftLimit(String(dailyLimit.limit));
      pushToast({ kind: "error", title: "Error", message: "Límite diario inválido" });
      return;
    }
    void saveDailyLimit(Math.trunc(n));
  }, [dailyLimit, draftLimit, pushToast, saveDailyLimit]);

  const stepDailyLimit = useCallback(
    (step: number) => {
      const fromDraft = Number(draftLimit);
      const base = Number.isFinite(fromDraft) ? Math.trunc(fromDraft) : dailyLimit?.limit ?? 45;
      const next = clampDailyLimit(base + step);
      setDraftLimit(String(next));
      void saveDailyLimit(next);
    },
    [dailyLimit?.limit, draftLimit, saveDailyLimit, setDraftLimit],
  );

  const saveOpeningHours = useCallback(
    async (
      patch: Partial<{ openingMode: OpeningMode; morningHours: string[]; nightHours: string[] }>,
      successMessage: string,
    ) => {
      if (!openingHours) return;
      const previous = openingHours;
      const nextOpeningMode = patch.openingMode ?? openingHours.openingMode;
      const nextMorningHours = patch.morningHours ?? openingHours.morningHours;
      const nextNightHours = patch.nightHours ?? openingHours.nightHours;

      setOpeningHours({
        ...openingHours,
        openingMode: nextOpeningMode,
        morningHours: nextMorningHours,
        nightHours: nextNightHours,
        hours: mergeHoursByOpeningMode(nextOpeningMode, nextMorningHours, nextNightHours),
        source: "override",
      });
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setOpeningHours(date, {
          openingMode: nextOpeningMode,
          morningHours: nextMorningHours,
          nightHours: nextNightHours,
        });
        if (!res.success) {
          setOpeningHours(previous);
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar horarios" });
          return;
        }
        setOpeningHours(res);
        pushSuccess(successMessage);
      } catch (e) {
        setOpeningHours(previous);
        setError(e instanceof Error ? e.message : "No se pudo guardar horarios");
      } finally {
        setBusy(false);
      }
    },
    [api.config, date, openingHours, pushSuccess, pushToast, setBusy, setError, setOpeningHours],
  );

  const setMesasDos = useCallback(
    async (limit: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setMesasDeDos(date, limit);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar mesas de 2" });
          return;
        }
        setMesasDeDos(res);
        pushSuccess("Mesas de 2 actualizadas");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar mesas de 2");
      } finally {
        setBusy(false);
      }
    },
    [api.config, date, pushSuccess, pushToast, setBusy, setError, setMesasDeDos],
  );

  const setMesasTres = useCallback(
    async (limit: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setMesasDeTres(date, limit);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar mesas de 3" });
          return;
        }
        setMesasDeTres(res);
        pushSuccess("Mesas de 3 actualizadas");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar mesas de 3");
      } finally {
        setBusy(false);
      }
    },
    [api.config, date, pushSuccess, pushToast, setBusy, setError, setMesasDeTres],
  );

  const setFloorActive = useCallback(
    async (floor: ConfigFloor, active: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setFloor(date, floor.floorNumber, active);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar la planta" });
          return;
        }
        setFloors(res.floors || []);
        pushSuccess(`${floor.name} ${active ? "activada" : "desactivada"}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar la planta");
      } finally {
        setBusy(false);
      }
    },
    [api.config, date, pushSuccess, pushToast, setBusy, setError, setFloors],
  );

  const handleOpeningModeChange = useCallback(
    (value: string) => {
      const nextMode = value === "morning" || value === "night" ? value : "both";
      void saveOpeningHours({ openingMode: nextMode }, "Modo de apertura actualizado");
    },
    [saveOpeningHours],
  );

  const handleMorningHour = useCallback(
    (hour: string) => {
      void saveOpeningHours(
        { morningHours: toggleHour(openingHours?.morningHours || [], hour) },
        "Horario de mañana actualizado",
      );
    },
    [openingHours?.morningHours, saveOpeningHours],
  );

  const handleNightHour = useCallback(
    (hour: string) => {
      void saveOpeningHours(
        { nightHours: toggleHour(openingHours?.nightHours || [], hour) },
        "Horario de noche actualizado",
      );
    },
    [openingHours?.nightHours, saveOpeningHours],
  );

  const toggleHourSplit = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setHourSplit(date, enabled);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar el reparto por hora" });
          return;
        }
        setHourSplit(hourSplit ? { ...hourSplit, enabled: res.enabled, source: res.source } : hourSplit);
        pushToast({
          kind: "success",
          title: enabled ? "Reparto activado" : "Reparto desactivado",
          message: enabled ? "Aforo repartido por hora" : "Aforo diario sin límite por hora",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar el reparto por hora");
      } finally {
        setBusy(false);
      }
    },
    [api.config, date, hourSplit, pushToast, setBusy, setError, setHourSplit],
  );

  const commitHourSplitPercentages = useCallback(
    async (percentages: Record<string, number>): Promise<boolean> => {
      try {
        const res = await api.config.setHourSplitPercentages({ date, percentages });
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar el reparto" });
          return false;
        }
        setHourSplit(
          hourSplit
            ? {
                ...hourSplit,
                percentages: res.percentages,
                hourlyCapacities: res.hourlyCapacities ?? hourSplit.hourlyCapacities,
              }
            : hourSplit,
        );
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el reparto");
        return false;
      }
    },
    [api.config, date, hourSplit, pushToast, setBusy, setError, setHourSplit],
  );

  return {
    loadAll,
    loadMandatoryMenuConfig,
    saveMandatoryMenus,
    handleMandatoryMenuToggle,
    onDateChange,
    toggleDay,
    setDayRange,
    saveDailyLimit,
    saveDailyLimitFromDraft,
    stepDailyLimit,
    saveOpeningHours,
    setMesasDos,
    setMesasTres,
    setFloorActive,
    handleOpeningModeChange,
    handleMorningHour,
    handleNightHour,
    toggleHourSplit,
    commitHourSplitPercentages,
  };
}
