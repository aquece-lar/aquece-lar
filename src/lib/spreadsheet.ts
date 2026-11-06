/**
 * Planilha em CSV no formato que o Excel em português abre direto com dois cliques:
 * ponto e vírgula entre colunas, vírgula decimal e BOM para manter os acentos.
 */

type Cell = string | number;

/** Número com vírgula decimal e sem separador de milhar (o Excel entende como número). */
function cell(value: Cell): string {
  const text = typeof value === 'number' ? value.toFixed(2).replace('.', ',') : value;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toSpreadsheet(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return '﻿' + [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Baixa o texto como arquivo no navegador. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
