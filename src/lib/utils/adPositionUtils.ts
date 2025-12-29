import { getPositionLabelFromWordPress, extractPositionMappings } from "./wordpressOptionsUtils";

// Ad Position Configuration mapping
// This fetches from WordPress adi-settings configuration

export interface AdPositionConfig {
  key: string;
  label: string;
  description?: string;
  category?: string;
  isFromWordPress?: boolean;
}

// Fallback position configurations (used when WordPress config is not available)
export const FALLBACK_POSITION_CONFIGS: Record<string, AdPositionConfig> = {
  'header': {
    key: 'header',
    label: 'Header Banner',
    description: 'Top of page header banner',
    category: 'Top'
  },
  'header-top': {
    key: 'header-top',
    label: 'Header Top',
    description: 'Very top of header',
    category: 'Top'
  },
  'header-bottom': {
    key: 'header-bottom',
    label: 'Header Bottom',
    description: 'Bottom of header area',
    category: 'Top'
  },
  'sidebar': {
    key: 'sidebar',
    label: 'Sidebar',
    description: 'Main sidebar area',
    category: 'Side'
  },
  'sidebar-top': {
    key: 'sidebar-top',
    label: 'Sidebar Top',
    description: 'Top of sidebar',
    category: 'Side'
  },
  'sidebar-middle': {
    key: 'sidebar-middle',
    label: 'Sidebar Middle',
    description: 'Middle of sidebar',
    category: 'Side'
  },
  'sidebar-bottom': {
    key: 'sidebar-bottom',
    label: 'Sidebar Bottom',
    description: 'Bottom of sidebar',
    category: 'Side'
  },
  'content-top': {
    key: 'content-top',
    label: 'Content Top',
    description: 'Above main content',
    category: 'Content'
  },
  'content-middle': {
    key: 'content-middle',
    label: 'Content Middle',
    description: 'Within main content',
    category: 'Content'
  },
  'content-bottom': {
    key: 'content-bottom',
    label: 'Content Bottom',
    description: 'Below main content',
    category: 'Content'
  },
  'footer': {
    key: 'footer',
    label: 'Footer Banner',
    description: 'Footer area banner',
    category: 'Bottom'
  },
  'footer-top': {
    key: 'footer-top',
    label: 'Footer Top',
    description: 'Top of footer',
    category: 'Bottom'
  },
  'footer-bottom': {
    key: 'footer-bottom',
    label: 'Footer Bottom',
    description: 'Bottom of footer',
    category: 'Bottom'
  },
  'popup': {
    key: 'popup',
    label: 'Popup Ad',
    description: 'Popup or overlay ad',
    category: 'Overlay'
  },
  'modal': {
    key: 'modal',
    label: 'Modal Ad',
    description: 'Modal overlay ad',
    category: 'Overlay'
  },
  'sticky': {
    key: 'sticky',
    label: 'Sticky Ad',
    description: 'Sticky/floating ad',
    category: 'Floating'
  },
  'banner-728x90': {
    key: 'banner-728x90',
    label: 'Leaderboard (728x90)',
    description: '728x90 banner ad',
    category: 'Standard'
  },
  'banner-300x250': {
    key: 'banner-300x250',
    label: 'Medium Rectangle (300x250)',
    description: '300x250 banner ad',
    category: 'Standard'
  },
  'banner-160x600': {
    key: 'banner-160x600',
    label: 'Wide Skyscraper (160x600)',
    description: '160x600 banner ad',
    category: 'Standard'
  },
  'banner-320x50': {
    key: 'banner-320x50',
    label: 'Mobile Banner (320x50)',
    description: '320x50 mobile banner',
    category: 'Mobile'
  },
  'in-article': {
    key: 'in-article',
    label: 'In-Article',
    description: 'Within article content',
    category: 'Content'
  },
  'before-article': {
    key: 'before-article',
    label: 'Before Article',
    description: 'Before article content',
    category: 'Content'
  },
  'after-article': {
    key: 'after-article',
    label: 'After Article',
    description: 'After article content',
    category: 'Content'
  }
};

/**
 * Get the display label for a position key (async - fetches from WordPress)
 */
export async function getPositionLabel(positionKey: string): Promise<string> {
  try {
    // First try to get from WordPress configuration
    const wpLabel = await getPositionLabelFromWordPress(positionKey);
    if (wpLabel && wpLabel !== positionKey) {
      return wpLabel;
    }
    
    // Fallback to static config
    const config = FALLBACK_POSITION_CONFIGS[positionKey];
    if (config) {
      return config.label;
    }
    
    // Final fallback: convert snake_case or kebab-case to Title Case
    return positionKey
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  } catch (error) {
    console.error('Error getting position label:', error);
    return positionKey;
  }
}

/**
 * Get position configuration (async - fetches from WordPress)
 */
export async function getPositionConfig(positionKey: string): Promise<AdPositionConfig | null> {
  try {
    const wpLabel = await getPositionLabelFromWordPress(positionKey);
    const fallbackConfig = FALLBACK_POSITION_CONFIGS[positionKey];
    
    if (wpLabel && wpLabel !== positionKey) {
      return {
        key: positionKey,
        label: wpLabel,
        description: fallbackConfig?.description || '',
        category: fallbackConfig?.category || 'Custom',
        isFromWordPress: true
      };
    }
    
    return fallbackConfig || null;
  } catch (error) {
    console.error('Error getting position config:', error);
    return FALLBACK_POSITION_CONFIGS[positionKey] || null;
  }
}

/**
 * Get all available positions grouped by category
 */
export async function getPositionsByCategory(): Promise<Record<string, AdPositionConfig[]>> {
  try {
    const wpMappings = await extractPositionMappings();
    const grouped: Record<string, AdPositionConfig[]> = {};
    
    // Add WordPress positions
    for (const [key, label] of Object.entries(wpMappings)) {
      const config: AdPositionConfig = {
        key,
        label,
        category: 'WordPress',
        isFromWordPress: true
      };
      
      if (!grouped['WordPress']) {
        grouped['WordPress'] = [];
      }
      grouped['WordPress'].push(config);
    }
    
    // Add fallback positions
    Object.values(FALLBACK_POSITION_CONFIGS).forEach(config => {
      const category = config.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(config);
    });
    
    return grouped;
  } catch (error) {
    console.error('Error getting positions by category:', error);
    const grouped: Record<string, AdPositionConfig[]> = {};
    Object.values(FALLBACK_POSITION_CONFIGS).forEach(config => {
      const category = config.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(config);
    });
    return grouped;
  }
}

/**
 * Validate if a position key exists in configuration
 */
export async function isValidPosition(positionKey: string): Promise<boolean> {
  try {
    const wpMappings = await extractPositionMappings();
    return positionKey in wpMappings || positionKey in FALLBACK_POSITION_CONFIGS;
  } catch (error) {
    console.error('Error validating position:', error);
    return positionKey in FALLBACK_POSITION_CONFIGS;
  }
}

/**
 * Get formatted position data for API responses (async - fetches from WordPress)
 */
export async function formatPositionForResponse(positionKey: string) {
  try {
    const config = await getPositionConfig(positionKey);
    const label = await getPositionLabel(positionKey);
    
    return {
      key: positionKey,
      label: label,
      description: config?.description || '',
      category: config?.category || 'Other',
      isFromWordPress: config?.isFromWordPress || false,
      isValid: await isValidPosition(positionKey)
    };
  } catch (error) {
    console.error('Error formatting position for response:', error);
    return {
      key: positionKey,
      label: positionKey,
      description: '',
      category: 'Other',
      isFromWordPress: false,
      isValid: false
    };
  }
}