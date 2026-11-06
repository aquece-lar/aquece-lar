import { describe, expect, it } from 'vitest';
import { toSpreadsheet } from './spreadsheet';

describe('toSpreadsheet', () => {
  it('usa ponto e vírgula, vírgula decimal e BOM, com aspas só quando precisa', () => {
    const csv = toSpreadsheet(['Nº', 'Cliente', 'Valor'], [
      ['#1', 'Padaria "Pão Bom"; Centro', 1234.5],
      ['#2', 'Hotel', 30000],
    ]);
    expect(csv).toBe('﻿Nº;Cliente;Valor\r\n#1;"Padaria ""Pão Bom""; Centro";1234,50\r\n#2;Hotel;30000,00\r\n');
  });
});
