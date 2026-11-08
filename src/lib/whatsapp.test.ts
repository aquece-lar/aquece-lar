import { describe, expect, it } from 'vitest';
import { DEFAULT_WHATSAPP_MESSAGE } from '@/config/quotes';
import { fillWhatsappMessage, whatsappLink } from './whatsapp';

const DATA = {
  quote: { number: '#1181', amount: 18940, validUntil: '2026-11-30' },
  customer: { name: 'Ana Souza' },
  seller: { name: 'Carlos Menezes' },
  company: 'Aquece Lar',
};

describe('fillWhatsappMessage', () => {
  it('troca cada campo pelo dado do orçamento', () => {
    expect(fillWhatsappMessage(DEFAULT_WHATSAPP_MESSAGE, DATA)).toBe(
      'Olá, Ana Souza! Segue o orçamento #1181 da Aquece Lar, no valor de R$ 18.940,00, válido até 30/11/2026. ' +
        'Qualquer dúvida, estou à disposição. Carlos Menezes',
    );
  });

  it('campo desconhecido fica como está', () => {
    expect(fillWhatsappMessage('{cliente} {nome}', DATA)).toBe('Ana Souza {nome}');
  });
});

describe('whatsappLink', () => {
  it('telefone brasileiro ganha o 55 e a mensagem vai codificada', () => {
    expect(whatsappLink('(54) 99812-4410', 'Olá & até')).toBe('https://wa.me/5554998124410?text=Ol%C3%A1%20%26%20at%C3%A9');
  });

  it('com DDI, mantém; sem telefone, abre para escolher o contato', () => {
    expect(whatsappLink('+55 54 99812-4410', 'oi')).toBe('https://wa.me/5554998124410?text=oi');
    expect(whatsappLink('', 'oi')).toBe('https://wa.me/?text=oi');
  });
});
