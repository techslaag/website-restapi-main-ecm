/**
 * Utility functions for handling file exports
 * To be included in WordPress admin pages
 */

/**
 * Download file from URL without opening new page
 * @param {string} url - The export URL
 * @param {string} filename - Optional filename
 */
function downloadFileFromUrl(url, filename = null) {
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    
    // If filename provided, set it
    if (filename) {
        link.download = filename;
    }
    
    // Hide the link
    link.style.display = 'none';
    
    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Download file using fetch with proper error handling
 * @param {string} url - The export URL  
 * @param {string} defaultFilename - Default filename if not provided by server
 */
async function downloadFileWithFetch(url, defaultFilename = 'export.csv') {
    try {
        // Show loading indicator if available
        const loadingIndicator = document.querySelector('.adi-loading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'inline-block';
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Get filename from Content-Disposition header if available
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = defaultFilename;
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        // Get the file blob
        const blob = await response.blob();
        
        // Create object URL and download
        const objectUrl = URL.createObjectURL(blob);
        downloadFileFromUrl(objectUrl, filename);
        
        // Clean up object URL
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        
        // Hide loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Show success message if available
        const successMessage = document.querySelector('.adi-export-success');
        if (successMessage) {
            successMessage.textContent = `File "${filename}" downloaded successfully!`;
            successMessage.style.display = 'block';
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 3000);
        }
        
    } catch (error) {
        console.error('Download failed:', error);
        
        // Hide loading indicator
        const loadingIndicator = document.querySelector('.adi-loading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Show error message
        const errorMessage = document.querySelector('.adi-export-error');
        if (errorMessage) {
            errorMessage.textContent = `Download failed: ${error.message}`;
            errorMessage.style.display = 'block';
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 5000);
        } else {
            alert(`Download failed: ${error.message}`);
        }
    }
}

/**
 * Handle export button click for single ad
 * @param {number} adId - The ad ID
 * @param {string} adName - The ad name (for filename)
 */
function exportSingleAd(adId, adName = '') {
    const baseUrl = window.location.protocol + '//' + window.location.hostname + ':3500';
    const exportUrl = `${baseUrl}/api/ads/export/excel?ad_id=${adId}`;
    
    const sanitizedName = adName.replace(/[^a-zA-Z0-9-_]/g, '-');
    const filename = `ad-${adId}-${sanitizedName}-analytics.csv`;
    
    downloadFileWithFetch(exportUrl, filename);
}

/**
 * Handle export button click for all ads
 * @param {Object} filters - Optional filters (start_date, end_date, etc.)
 */
function exportAllAds(filters = {}) {
    const baseUrl = window.location.protocol + '//' + window.location.hostname + ':3500';
    
    // Build query string
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value) {
            params.append(key, value);
        }
    });
    
    const exportUrl = `${baseUrl}/api/ads/export/excel?${params.toString()}`;
    const filename = 'all-ads-analytics.csv';
    
    downloadFileWithFetch(exportUrl, filename);
}

/**
 * Initialize export button handlers
 * Call this when the page loads
 */
function initializeExportHandlers() {
    // Handle ALL links/buttons that go to export URLs
    document.addEventListener('click', function(event) {
        const target = event.target;
        const button = target.closest('a, button, .button');
        
        if (!button) return;
        
        // Check if this is an export URL
        const href = button.getAttribute('href') || '';
        const onclick = button.getAttribute('onclick') || '';
        
        // Detect export URLs
        if (href.includes('/api/ads/export/excel') || 
            onclick.includes('/api/ads/export/excel') ||
            href.includes('export') && href.includes('ad_id=')) {
            
            event.preventDefault();
            event.stopPropagation();
            
            let exportUrl = href;
            
            // Extract URL from onclick if needed
            if (!exportUrl && onclick) {
                const urlMatch = onclick.match(/['"]([^'"]*api\/ads\/export\/excel[^'"]*)['"]/);
                if (urlMatch) {
                    exportUrl = urlMatch[1];
                }
            }
            
            // Extract ad_id from URL
            const urlParams = new URLSearchParams(exportUrl.split('?')[1] || '');
            const adId = urlParams.get('ad_id');
            
            if (adId) {
                // Single ad export
                const adName = button.getAttribute('data-ad-name') || 
                             button.getAttribute('title') || 
                             button.textContent.trim() || '';
                exportSingleAd(adId, adName);
            } else {
                // All ads export
                const filters = {};
                urlParams.forEach((value, key) => {
                    if (key !== 'ad_id') {
                        filters[key] = value;
                    }
                });
                exportAllAds(filters);
            }
            
            return false;
        }
        
        // Handle buttons with specific classes
        if (button.matches('.adi-export-single') || button.closest('.adi-export-single')) {
            event.preventDefault();
            
            const exportButton = button.matches('.adi-export-single') 
                ? button 
                : button.closest('.adi-export-single');
                
            const adId = exportButton.getAttribute('data-ad-id');
            const adName = exportButton.getAttribute('data-ad-name') || '';
            
            if (adId) {
                exportSingleAd(adId, adName);
            }
        }
        
        if (button.matches('.adi-export-all') || button.closest('.adi-export-all')) {
            event.preventDefault();
            
            // Get filters from form or URL parameters
            const filters = {};
            
            // Try to get filters from form elements
            const startDateInput = document.querySelector('input[name="start_date"]');
            const endDateInput = document.querySelector('input[name="end_date"]');
            const deviceTypeSelect = document.querySelector('select[name="device_type"]');
            const positionSelect = document.querySelector('select[name="position"]');
            
            if (startDateInput && startDateInput.value) {
                filters.start_date = startDateInput.value;
            }
            if (endDateInput && endDateInput.value) {
                filters.end_date = endDateInput.value;
            }
            if (deviceTypeSelect && deviceTypeSelect.value) {
                filters.device_type = deviceTypeSelect.value;
            }
            if (positionSelect && positionSelect.value) {
                filters.position = positionSelect.value;
            }
            
            exportAllAds(filters);
        }
    });
    
    // Also intercept any window.open calls to export URLs
    const originalWindowOpen = window.open;
    window.open = function(url, target, features) {
        if (url && url.includes('/api/ads/export/excel')) {
            // Redirect to download instead of opening new window
            downloadFileWithFetch(url);
            return null;
        }
        return originalWindowOpen.call(this, url, target, features);
    };
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExportHandlers);
} else {
    initializeExportHandlers();
}