import prisma from "@/lib/prisma";

/**
 * Fetch WordPress option by name
 */
export async function getWordPressOption(optionName: string): Promise<string | null> {
  try {
    const option = await prisma.mod180_options.findUnique({
      where: {
        option_name: optionName
      },
      select: {
        option_value: true
      }
    });
    
    return option?.option_value || null;
  } catch (error) {
    console.error(`Error fetching WordPress option ${optionName}:`, error);
    return null;
  }
}

/**
 * Search for WordPress options by pattern
 */
export async function searchWordPressOptions(pattern: string): Promise<Array<{name: string, value: string}>> {
  try {
    const options = await prisma.mod180_options.findMany({
      where: {
        option_name: {
          contains: pattern
        }
      },
      select: {
        option_name: true,
        option_value: true
      }
    });
    
    return options.map(opt => ({
      name: opt.option_name,
      value: opt.option_value
    }));
  } catch (error) {
    console.error(`Error searching WordPress options with pattern ${pattern}:`, error);
    return [];
  }
}

/**
 * Get Ad Position configurations from WordPress settings
 */
export async function getAdPositionConfigurations(): Promise<Record<string, any>> {
  try {
    // Common WordPress plugin option name patterns for ad positions
    const possibleOptionNames = [
      'adi_settings',
      'adi_positions', 
      'adi_options',
      'advertising_insights_settings',
      'advertising_insights_positions',
      'ad_positions',
      'ad_settings',
      'adi-settings',
      'adi-positions'
    ];
    
    // Search for exact matches
    for (const optionName of possibleOptionNames) {
      const optionValue = await getWordPressOption(optionName);
      if (optionValue) {
        try {
          const parsed = JSON.parse(optionValue);
          if (parsed && typeof parsed === 'object') {
            return { [optionName]: parsed };
          }
        } catch (e) {
          // Not JSON, return as string
          return { [optionName]: optionValue };
        }
      }
    }
    
    // Search for options containing 'adi' or 'position'
    const adiOptions = await searchWordPressOptions('adi');
    const positionOptions = await searchWordPressOptions('position');
    const adOptions = await searchWordPressOptions('_ad_');
    
    const allOptions: Record<string, any> = {};
    
    // Process found options
    [...adiOptions, ...positionOptions, ...adOptions].forEach(option => {
      try {
        const parsed = JSON.parse(option.value);
        allOptions[option.name] = parsed;
      } catch (e) {
        allOptions[option.name] = option.value;
      }
    });
    
    return allOptions;
    
  } catch (error) {
    console.error('Error getting ad position configurations:', error);
    return {};
  }
}

/**
 * Extract position mappings from WordPress configuration
 */
export async function extractPositionMappings(): Promise<Record<string, string>> {
  try {
    const configs = await getAdPositionConfigurations();
    const positionMappings: Record<string, string> = {};
    
    // Look for position configurations in the settings
    Object.entries(configs).forEach(([optionName, optionValue]) => {
      if (typeof optionValue === 'object' && optionValue !== null) {
        // Look for position-related keys
        const checkForPositions = (obj: any, prefix = '') => {
          Object.entries(obj).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              checkForPositions(value, prefix ? `${prefix}_${key}` : key);
            } else if (typeof value === 'string') {
              // Check if this looks like a position configuration
              if (key.toLowerCase().includes('position') || 
                  key.toLowerCase().includes('location') ||
                  key.toLowerCase().includes('placement')) {
                const positionKey = prefix ? `${prefix}_${key}` : key;
                positionMappings[positionKey] = value;
              }
              
              // Check if key looks like a position key and value is the label
              if (['header', 'footer', 'sidebar', 'content', 'banner', 'popup'].some(pos => 
                key.toLowerCase().includes(pos))) {
                positionMappings[key] = value;
              }
            }
          });
        };
        
        checkForPositions(optionValue);
      }
    });
    
    return positionMappings;
    
  } catch (error) {
    console.error('Error extracting position mappings:', error);
    return {};
  }
}

/**
 * Get position label from WordPress configuration
 */
export async function getPositionLabelFromWordPress(positionKey: string): Promise<string> {
  try {
    const mappings = await extractPositionMappings();
    
    // Direct key match
    if (mappings[positionKey]) {
      return mappings[positionKey];
    }
    
    // Try case-insensitive match
    const lowerKey = positionKey.toLowerCase();
    const matchingKey = Object.keys(mappings).find(key => 
      key.toLowerCase() === lowerKey
    );
    
    if (matchingKey) {
      return mappings[matchingKey];
    }
    
    // Try partial match
    const partialMatch = Object.keys(mappings).find(key => 
      key.toLowerCase().includes(lowerKey) || lowerKey.includes(key.toLowerCase())
    );
    
    if (partialMatch) {
      return mappings[partialMatch];
    }
    
    // Fallback to formatted key
    return positionKey
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
      
  } catch (error) {
    console.error('Error getting position label from WordPress:', error);
    return positionKey;
  }
}