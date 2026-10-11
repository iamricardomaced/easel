export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  category: string;
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: 'ig-post', label: 'Instagram Post', width: 1080, height: 1080, category: 'Social media' },
  { id: 'ig-portrait', label: 'Instagram Post (4:5)', width: 1080, height: 1350, category: 'Social media' },
  { id: 'ig-story', label: 'Instagram Story', width: 1080, height: 1920, category: 'Social media' },
  { id: 'fb-post', label: 'Facebook Post', width: 1200, height: 630, category: 'Social media' },
  { id: 'linkedin', label: 'LinkedIn Post', width: 1200, height: 1200, category: 'Social media' },
  { id: 'x-post', label: 'X Post', width: 1600, height: 900, category: 'Social media' },
  { id: 'yt-thumb', label: 'YouTube Thumbnail', width: 1280, height: 720, category: 'Video' },
  { id: 'presentation', label: 'Presentation (16:9)', width: 1920, height: 1080, category: 'Presentations' },
  { id: 'presentation-43', label: 'Presentation (4:3)', width: 1024, height: 768, category: 'Presentations' },
  { id: 'a4', label: 'A4 Document', width: 794, height: 1123, category: 'Print' },
  { id: 'letter', label: 'US Letter', width: 816, height: 1056, category: 'Print' },
  { id: 'poster', label: 'Poster (18×24 in)', width: 1296, height: 1728, category: 'Print' },
  { id: 'flyer', label: 'Flyer (A5)', width: 559, height: 794, category: 'Print' },
  { id: 'business-card', label: 'Business Card', width: 1050, height: 600, category: 'Print' },
  { id: 'logo', label: 'Logo', width: 500, height: 500, category: 'Branding' },
  { id: 'resume', label: 'Resume', width: 794, height: 1123, category: 'Documents' },
  { id: 'invitation', label: 'Invitation (5×7 in)', width: 480, height: 672, category: 'Print' },
  { id: 'desktop-wallpaper', label: 'Desktop Wallpaper', width: 1920, height: 1080, category: 'Other' },
];

export const DEFAULT_COLORS = [
  '#000000', '#545454', '#737373', '#a6a6a6', '#d9d9d9', '#ffffff',
  '#ff3131', '#ff5757', '#ff66c4', '#cb6ce6', '#8c52ff', '#5e17eb',
  '#03989e', '#00c2cb', '#5ce1e6', '#38b6ff', '#5271ff', '#004aad',
  '#00bf63', '#7ed957', '#c1ff72', '#ffde59', '#ffbd59', '#ff914d',
];
