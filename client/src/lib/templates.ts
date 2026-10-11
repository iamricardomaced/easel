import type { Fill, Page } from '../types';
import { makeIcon, makeImage, makeLine, makeShape, makeText, newPage, solid } from './factory';

export interface Template {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  pages: Page[];
}

const linear = (color: string, color2: string, angle = 135): Fill => ({ type: 'linear', color, color2, angle });
const photo = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${Math.round(w)}/${Math.round(h)}`;

function page(background: Fill, elements: Page['elements']): Page {
  return { ...newPage(background), elements };
}

const at = <T extends { x: number; y: number; w: number; h: number }>(el: T, x: number, y: number, w?: number, h?: number): T => {
  el.x = x;
  el.y = y;
  if (w !== undefined) el.w = w;
  if (h !== undefined) el.h = h;
  return el;
};

export function buildTemplates(): Template[] {
  return [
    {
      id: 'sale-post',
      name: 'Summer Sale',
      category: 'Instagram Post',
      width: 1080,
      height: 1080,
      pages: [
        page(linear('#ff9a8b', '#ff6a88'), [
          at(makeShape('ellipse', { fill: solid('#ffffff'), opacity: 0.15 }), 620, -120, 600, 600),
          at(makeShape('ellipse', { fill: solid('#ffffff'), opacity: 0.12 }), -180, 700, 520, 520),
          at(makeText({ text: 'SUMMER', fontFamily: 'Anton', fontSize: 190, color: '#ffffff', letterSpacing: 8 }), 80, 250, 920, 230),
          at(makeText({ text: 'SALE', fontFamily: 'Anton', fontSize: 260, color: '#fff3b0', letterSpacing: 20 }), 80, 450, 920, 320),
          at(makeShape('rect', { fill: solid('#1f1f1f'), radius: 60 }), 340, 820, 400, 110),
          at(makeText({ text: 'UP TO 50% OFF', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 40, color: '#ffffff' }), 340, 845, 400, 60),
        ]),
      ],
    },
    {
      id: 'quote-post',
      name: 'Minimal Quote',
      category: 'Instagram Post',
      width: 1080,
      height: 1080,
      pages: [
        page(solid('#f4efe6'), [
          at(makeText({ text: '“', fontFamily: 'Playfair Display', fontSize: 300, color: '#c08552' }), 90, 60, 300, 300),
          at(makeText({ text: 'Simplicity is the ultimate sophistication.', fontFamily: 'Playfair Display', fontSize: 84, italic: true, color: '#3a2e25', align: 'left', lineHeight: 1.2 }), 120, 330, 840, 320),
          at(makeLine({ color: '#c08552', strokeWidth: 4 }), 120, 720, 140, 10),
          at(makeText({ text: 'LEONARDO DA VINCI', fontFamily: 'Montserrat', fontSize: 30, letterSpacing: 6, color: '#3a2e25', align: 'left' }), 120, 760, 600, 50),
        ]),
      ],
    },
    {
      id: 'photo-post',
      name: 'Travel Photo',
      category: 'Instagram Post',
      width: 1080,
      height: 1080,
      pages: [
        page(solid('#0e1318'), [
          at(makeImage(photo('travel-coast', 1080, 1080), 1080, 1080), 0, 0),
          at(makeShape('rect', { fill: linear('#00000000', '#000000cc', 180) }), 0, 540, 1080, 540),
          at(makeText({ text: 'Explore the coast', fontFamily: 'DM Serif Display', fontSize: 110, color: '#ffffff', align: 'left' }), 80, 780, 920, 140),
          at(makeText({ text: 'Weekend guide · 12 hidden beaches', fontFamily: 'Inter', fontSize: 34, color: '#e6e6e6', align: 'left' }), 80, 930, 920, 60),
        ]),
      ],
    },
    {
      id: 'event-story',
      name: 'Night Event',
      category: 'Instagram Story',
      width: 1080,
      height: 1920,
      pages: [
        page(linear('#1a0b3d', '#5e17eb', 160), [
          at(makeShape('star', { fill: solid('#ffde59') }), 760, 160, 160, 160),
          at(makeShape('star', { fill: solid('#ffffff'), opacity: 0.6 }), 160, 420, 70, 70),
          at(makeText({ text: 'FRIDAY NIGHT', fontFamily: 'Bebas Neue', fontSize: 120, color: '#ffde59', letterSpacing: 10 }), 90, 620, 900, 140),
          at(makeText({ text: 'Live Jazz', fontFamily: 'Great Vibes', fontSize: 220, color: '#ffffff' }), 90, 760, 900, 280),
          at(makeText({ text: '21:00 · The Blue Room\nFree entry before 22:00', fontFamily: 'Montserrat', fontSize: 46, color: '#e3d9ff', lineHeight: 1.5 }), 90, 1150, 900, 150),
          at(makeShape('rect', { fill: solid('#ffde59'), radius: 80 }), 290, 1500, 500, 130),
          at(makeText({ text: 'RSVP NOW', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 48, color: '#1a0b3d' }), 290, 1534, 500, 70),
        ]),
      ],
    },
    {
      id: 'pitch-deck',
      name: 'Pitch Deck',
      category: 'Presentation',
      width: 1920,
      height: 1080,
      pages: [
        page(solid('#0e1318'), [
          at(makeShape('rect', { fill: linear('#ff5c39', '#ffb347') }), 0, 0, 24, 1080),
          at(makeText({ text: 'Acme Robotics', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 140, color: '#ffffff', align: 'left' }), 160, 360, 1400, 180),
          at(makeText({ text: 'Series A · 2026', fontFamily: 'Inter', fontSize: 48, color: '#9aa4b2', align: 'left' }), 160, 560, 1000, 70),
        ]),
        page(solid('#ffffff'), [
          at(makeText({ text: 'The problem', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 96, color: '#0e1318', align: 'left' }), 160, 140, 1200, 120),
          at(makeText({ text: '• Warehouses lose 18% of shifts to manual picking\n• Labour costs grew 9% a year since 2021\n• Existing robots need 6-month integrations', fontFamily: 'Inter', fontSize: 48, color: '#333', align: 'left', lineHeight: 1.7 }), 160, 320, 1100, 300),
          at(makeImage(photo('warehouse', 600, 700), 600, 700, { radius: 32 }), 1180, 220),
        ]),
        page(linear('#ff5c39', '#ffb347'), [
          at(makeText({ text: 'Thank you', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 180, color: '#ffffff' }), 160, 400, 1600, 220),
          at(makeText({ text: 'hello@acme.example', fontFamily: 'Inter', fontSize: 48, color: '#ffffff' }), 160, 640, 1600, 70),
        ]),
      ],
    },
    {
      id: 'yt-thumb',
      name: 'Bold Thumbnail',
      category: 'YouTube Thumbnail',
      width: 1280,
      height: 720,
      pages: [
        page(solid('#ffde59'), [
          at(makeImage(photo('creator', 560, 720), 560, 720), 720, 0),
          at(makeText({ text: 'I TRIED IT FOR 30 DAYS', fontFamily: 'Anton', fontSize: 120, color: '#0e1318', align: 'left', lineHeight: 1.05 }), 60, 120, 680, 420),
          at(makeShape('arrow', { fill: solid('#ff3131') }), 520, 520, 240, 140),
        ]),
      ],
    },
    {
      id: 'resume',
      name: 'Clean Resume',
      category: 'Resume',
      width: 794,
      height: 1123,
      pages: [
        page(solid('#ffffff'), [
          at(makeShape('rect', { fill: solid('#1f2a44') }), 0, 0, 260, 1123),
          at(makeImage(photo('portrait', 300, 300), 160, 160, { frame: 'circle' }), 50, 60),
          at(makeText({ text: 'CONTACT', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 16, color: '#ffffff', align: 'left', letterSpacing: 3 }), 30, 270, 200, 30),
          at(makeText({ text: 'jane@example.com\n+351 900 000 000\nLisbon, Portugal', fontFamily: 'Inter', fontSize: 14, color: '#d5dae6', align: 'left', lineHeight: 1.8 }), 30, 305, 210, 90),
          at(makeText({ text: 'SKILLS', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 16, color: '#ffffff', align: 'left', letterSpacing: 3 }), 30, 440, 200, 30),
          at(makeText({ text: 'Product design\nResearch\nPrototyping\nFigma, React', fontFamily: 'Inter', fontSize: 14, color: '#d5dae6', align: 'left', lineHeight: 1.8 }), 30, 475, 210, 120),
          at(makeText({ text: 'Jane Doe', fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 52, color: '#1f2a44', align: 'left' }), 300, 70, 460, 70),
          at(makeText({ text: 'Senior Product Designer', fontFamily: 'Montserrat', fontSize: 18, color: '#7a8399', align: 'left', letterSpacing: 2 }), 300, 145, 460, 30),
          at(makeLine({ color: '#1f2a44', strokeWidth: 2 }), 300, 200, 440, 6),
          at(makeText({ text: 'EXPERIENCE', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 16, color: '#1f2a44', align: 'left', letterSpacing: 3 }), 300, 230, 440, 30),
          at(makeText({ text: 'Lead Designer, Studio North (2021–now)\nRebuilt the booking flow; conversion rose from 3.1% to 4.4%.\n\nProduct Designer, Fintechly (2017–2021)\nDesigned the mobile onboarding used by 2M customers.', fontFamily: 'Inter', fontSize: 15, color: '#333', align: 'left', lineHeight: 1.7 }), 300, 270, 440, 220),
        ]),
      ],
    },
    {
      id: 'business-card',
      name: 'Business Card',
      category: 'Business Card',
      width: 1050,
      height: 600,
      pages: [
        page(solid('#0e1318'), [
          at(makeIcon('Hexagon', { color: '#00c2cb', strokeWidth: 1.5 }), 80, 80, 120, 120),
          at(makeText({ text: 'Northwind Studio', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 64, color: '#ffffff', align: 'left' }), 80, 330, 900, 80),
          at(makeText({ text: 'Branding · Web · Motion', fontFamily: 'Inter', fontSize: 30, color: '#00c2cb', align: 'left' }), 80, 420, 900, 50),
        ]),
        page(solid('#ffffff'), [
          at(makeText({ text: 'Alex Rivera', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 56, color: '#0e1318', align: 'left' }), 80, 120, 900, 70),
          at(makeText({ text: 'Creative Director', fontFamily: 'Inter', fontSize: 28, color: '#666', align: 'left' }), 80, 195, 900, 45),
          at(makeText({ text: 'alex@northwind.example\n+1 555 0100\nnorthwind.example', fontFamily: 'Inter', fontSize: 28, color: '#0e1318', align: 'left', lineHeight: 1.7 }), 80, 330, 900, 160),
        ]),
      ],
    },
    {
      id: 'poster',
      name: 'Concert Poster',
      category: 'Poster',
      width: 1296,
      height: 1728,
      pages: [
        page(solid('#ff3131'), [
          at(makeShape('ellipse', { fill: solid('#0e1318') }), 248, 200, 800, 800),
          at(makeText({ text: 'ECHO', fontFamily: 'Archivo Black', fontSize: 300, color: '#ff3131' }), 148, 440, 1000, 340),
          at(makeText({ text: 'WORLD TOUR 2026', fontFamily: 'Space Mono', fontSize: 64, color: '#0e1318', letterSpacing: 12 }), 148, 1100, 1000, 90),
          at(makeText({ text: 'LISBON · MADRID · PARIS · BERLIN', fontFamily: 'Space Mono', fontSize: 40, color: '#ffffff' }), 148, 1220, 1000, 60),
        ]),
      ],
    },
    {
      id: 'a4-report',
      name: 'Report Cover',
      category: 'A4 Document',
      width: 794,
      height: 1123,
      pages: [
        page(solid('#f7f7f2'), [
          at(makeImage(photo('architecture', 794, 620), 794, 620), 0, 0),
          at(makeText({ text: 'Annual Report 2026', fontFamily: 'DM Serif Display', fontSize: 68, color: '#1a1a1a', align: 'left', lineHeight: 1.1 }), 60, 680, 680, 170),
          at(makeText({ text: 'Prepared for the board of directors', fontFamily: 'Inter', fontSize: 20, color: '#666', align: 'left' }), 60, 860, 680, 40),
          at(makeShape('rect', { fill: solid('#00bf63') }), 60, 1040, 120, 10),
        ]),
      ],
    },
  ];
}

export const TEMPLATES = buildTemplates();
