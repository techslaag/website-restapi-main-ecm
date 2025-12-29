/**
 * WordPress Export Fix
 * This script prevents export links from opening new pages and forces downloads instead
 */

(function() {
    'use strict';
    
    // Configuration
    const API_BASE = window.location.protocol + '//' + window.location.hostname + ':3500';
    
    /**
     * Force download file from URL
     */
    function forceDownload(url, filename) {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                // Get filename from headers if not provided
                if (!filename) {
                    const contentDisposition = response.headers.get('Content-Disposition');
                    if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                        if (filenameMatch && filenameMatch[1]) {
                            filename = filenameMatch[1].replace(/['"]/g, '');
                        }
                    }
                }
                
                return response.blob();
            })
            .then(blob => {
                // Create download link
                const url_obj = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url_obj;
                link.download = filename || 'export.csv';
                link.style.display = 'none';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up
                URL.revokeObjectURL(url_obj);
                
                console.log('File downloaded:', filename);
            })
            .catch(error => {
                console.error('Download failed:', error);
                alert('Download failed: ' + error.message);
            });
    }
    
    /**
     * Extract ad_id from current page URL
     */
    function getCurrentAdId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('ad_id');
    }
    
    /**
     * Initialize the export fix
     */
    function init() {
        console.log('WordPress Export Fix initialized');
        
        // Method 1: Intercept all clicks on the page
        document.addEventListener('click', function(event) {
            const target = event.target;
            const link = target.closest('a, button');
            
            if (!link) return;
            
            const href = link.getAttribute('href') || '';
            const onclick = link.getAttribute('onclick') || '';
            
            // Check if this looks like an export URL
            if (href.includes('/api/ads/export/excel') || 
                onclick.includes('/api/ads/export/excel') ||
                (href.includes('export') && (href.includes('ad_id=') || getCurrentAdId()))) {
                
                event.preventDefault();
                event.stopPropagation();
                
                let exportUrl = href;
                
                // Handle onclick attribute
                if (!exportUrl && onclick) {
                    const urlMatch = onclick.match(/['"]([^'"]*\/api\/ads\/export\/excel[^'"]*)['"]/);
                    if (urlMatch) {
                        exportUrl = urlMatch[1];
                    } else {
                        // Try to extract just the path
                        const pathMatch = onclick.match(/['"]([^'"]*export[^'"]*)['"]/);
                        if (pathMatch) {
                            exportUrl = API_BASE + pathMatch[1];
                        }
                    }
                }
                
                // Make sure URL is complete
                if (exportUrl && !exportUrl.startsWith('http')) {
                    if (exportUrl.startsWith('/')) {
                        exportUrl = API_BASE + exportUrl;
                    } else {
                        exportUrl = API_BASE + '/api/ads/export/excel?' + exportUrl;
                    }
                }
                
                // Add ad_id if missing but available from page
                if (exportUrl && !exportUrl.includes('ad_id=')) {
                    const currentAdId = getCurrentAdId();
                    if (currentAdId) {
                        const separator = exportUrl.includes('?') ? '&' : '?';
                        exportUrl += separator + 'ad_id=' + currentAdId;
                    }
                }
                
                if (exportUrl) {
                    console.log('Intercepted export URL:', exportUrl);
                    forceDownload(exportUrl);
                }
                
                return false;
            }
        }, true); // Use capture phase
        
        // Method 2: Override window.open for export URLs
        const originalWindowOpen = window.open;
        window.open = function(url, target, features) {
            if (url && url.includes('/api/ads/export/excel')) {
                console.log('Intercepted window.open for export:', url);
                forceDownload(url);
                return null;
            }
            return originalWindowOpen.call(this, url, target, features);
        };
        
        // Method 3: Look for common WordPress export button patterns
        function findAndFixExportButtons() {
            // Find buttons that might be export buttons
            const exportButtons = document.querySelectorAll(
                'a[href*="export"], button[onclick*="export"], ' +
                '.button[href*="excel"], [title*="Export"], [title*="export"]'
            );
            
            exportButtons.forEach(button => {
                const href = button.getAttribute('href') || '';
                const onclick = button.getAttribute('onclick') || '';
                
                if (href.includes('ad_id=') || onclick.includes('ad_id=') || getCurrentAdId()) {
                    // Add a data attribute to mark this as processed
                    if (!button.hasAttribute('data-export-fixed')) {
                        button.setAttribute('data-export-fixed', 'true');
                        
                        button.addEventListener('click', function(e) {
                            e.preventDefault();
                            
                            let exportUrl = href || API_BASE + '/api/ads/export/excel';
                            
                            if (!exportUrl.includes('ad_id=')) {
                                const currentAdId = getCurrentAdId();
                                if (currentAdId) {
                                    const separator = exportUrl.includes('?') ? '&' : '?';
                                    exportUrl += separator + 'ad_id=' + currentAdId;
                                }
                            }
                            
                            forceDownload(exportUrl);
                        });
                    }
                }
            });
        }
        
        // Run immediately and then periodically (in case buttons are added dynamically)
        findAndFixExportButtons();
        setInterval(findAndFixExportButtons, 2000);
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Also initialize on window load as backup
    window.addEventListener('load', init);
    
})();