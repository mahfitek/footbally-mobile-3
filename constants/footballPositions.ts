export interface PositionCategory {
  category: string;
  positions: string[];
}

export const FOOTBALL_POSITIONS: PositionCategory[] = [
  { category: 'Kaleci', positions: ['Kaleci (GK)'] },
  {
    category: 'Defans',
    positions: [
      'Sağ Bek (RB)',
      'Sağ Kanat Bek (RWB)',
      'Sağ Stoper (RCB)',
      'Stoper (CB)',
      'Sol Stoper (LCB)',
      'Sol Kanat Bek (LWB)',
      'Sol Bek (LB)',
    ],
  },
  {
    category: 'Orta Saha',
    positions: [
      'Sağ Orta Saha (RCM)',
      'Merkez Orta Saha (CM)',
      'Sol Orta Saha (LCM)',
      'Savunma Orta Saha (CDM)',
      'Sağ Savunma Orta Saha (RCDM)',
      'Sol Savunma Orta Saha (LCDM)',
      'Ofansif Orta Saha (CAM)',
      'Sağ Ofansif Orta Saha (RCAM)',
      'Sol Ofansif Orta Saha (LCAM)',
    ],
  },
  {
    category: 'Kanat',
    positions: ['Sağ Kanat (RW)', 'Sol Kanat (LW)', 'Sağ Açık (RM)', 'Sol Açık (LM)'],
  },
  {
    category: 'Forvet',
    positions: [
      'Sağ İç Forvet (RF)',
      'Sol İç Forvet (LF)',
      'Santrafor (ST)',
      'İkinci Forvet (SS)',
      'Sağ Forvet (RS)',
      'Sol Forvet (LS)',
    ],
  },
];
