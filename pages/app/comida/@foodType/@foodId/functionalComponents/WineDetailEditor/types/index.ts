import type { Vino } from "../../../../../../../../api/types";

export type WineFormData = {
  nombre: string;
  tipo: string;
  precio: string;
  bodega: string;
  denominacion_origen: string;
  graduacion: string;
  anyo: string;
  descripcion: string;
  active: boolean;
};

export type WineDetailEditorProps = {
  vino: Vino | null;
  isNew: boolean;
  onSave: (saved: Vino) => void;
};
