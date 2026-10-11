export const FONTS = [
  'Inter',
  'Montserrat',
  'Open Sans',
  'Poppins',
  'Roboto',
  'Lato',
  'Playfair Display',
  'Merriweather',
  'Lora',
  'Oswald',
  'Raleway',
  'Bebas Neue',
  'Anton',
  'Archivo Black',
  'DM Serif Display',
  'Abril Fatface',
  'Pacifico',
  'Dancing Script',
  'Great Vibes',
  'Caveat',
  'Permanent Marker',
  'Space Grotesk',
  'Space Mono',
  'Josefin Sans',
  'Nunito',
  'Quicksand',
  'Rubik',
  'Work Sans',
  'Cormorant Garamond',
  'Libre Baskerville',
];

export function loadFonts() {
  const families = FONTS.map((f) => `family=${f.replace(/ /g, '+')}:ital,wght@0,400;0,700;1,400;1,700`).join('&');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}
