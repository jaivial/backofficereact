export const WINE_TIPO_OPTIONS = [
  { value: "TINTO", label: "Tinto" },
  { value: "BLANCO", label: "Blanco" },
  { value: "CAVA", label: "Cava" },
  { value: "ROSADO", label: "Rosado" },
] as const;

export const EMPTY_WINE_FORM = {
  nombre: "",
  tipo: "TINTO",
  precio: "0.00",
  bodega: "",
  denominacion_origen: "",
  graduacion: "",
  anyo: "",
  descripcion: "",
  active: true,
} as const;
