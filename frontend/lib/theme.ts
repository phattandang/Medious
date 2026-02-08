/**
 * Medious App Theme
 * Modern, premium color scheme with violet/cyan accents
 */

export const colors = {
  // Base colors
  background: '#F8FAFC',      // Cool off-white
  backgroundAlt: '#F1F5F9',   // Slightly darker for contrast
  surface: '#FFFFFF',         // Cards, modals
  surfaceHover: '#F8FAFC',    // Hover state for surfaces

  // Text colors
  text: '#0F172A',            // Primary text (dark slate)
  textSecondary: '#475569',   // Secondary text
  textMuted: '#64748B',       // Muted/placeholder text
  textInverse: '#FFFFFF',     // Text on dark backgrounds

  // Brand colors
  primary: '#7C3AED',         // Violet - main brand color
  primaryLight: '#A78BFA',    // Light violet
  primaryDark: '#6D28D9',     // Dark violet (pressed state)

  // Accent colors
  accent: '#22D3EE',          // Cyan - spark/innovation
  accentLight: '#67E8F9',     // Light cyan
  accentDark: '#06B6D4',      // Dark cyan

  // Semantic colors
  success: '#10B981',         // Green
  successLight: '#D1FAE5',
  warning: '#F59E0B',         // Amber
  warningLight: '#FEF3C7',
  error: '#EF4444',           // Red
  errorLight: '#FEE2E2',
  info: '#3B82F6',            // Blue
  infoLight: '#DBEAFE',

  // UI elements
  border: '#E2E8F0',          // Light borders
  borderFocus: '#7C3AED',     // Focused input borders
  divider: '#E2E8F0',         // Divider lines

  // Interactive states
  like: '#EF4444',            // Heart/like color
  likeBackground: '#FEE2E2',

  // Gradients (for special elements)
  gradientStart: '#7C3AED',
  gradientEnd: '#22D3EE',

  // Story ring gradient
  storyGradient: ['#7C3AED', '#22D3EE', '#06B6D4'],

  // Tab bar
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabActive: '#7C3AED',
  tabInactive: '#64748B',

  // Status bar
  statusBar: '#F8FAFC',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
};

export default { colors, spacing, borderRadius, shadows };
