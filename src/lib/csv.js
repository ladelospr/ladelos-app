// Descarga un CSV que Excel abre bien.
//
// El BOM del principio es lo que hace que Excel detecte UTF-8; sin el,
// "Bayamón" sale como "BayamÃ³n". Se usa CSV y no .xlsx para no meter una
// dependencia nueva solo para exportar tablas.
export function descargarCSV(nombre, cabecera, filas) {
  const escapa = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lineas = [
    cabecera.map(escapa).join(","),
    ...filas.map((fila) => fila.map(escapa).join(",")),
  ];
  const csv = "﻿" + lineas.join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
