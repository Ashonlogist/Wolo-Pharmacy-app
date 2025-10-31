// drag-drop.js
function initializeDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (!dropZone || !fileInput) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Handle click to select files
    dropZone.addEventListener('click', () => fileInput.click());

    // Handle file selection
    fileInput.addEventListener('change', handleFileSelect, false);

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropZone.classList.add('highlight');
    }

    function unhighlight() {
        dropZone.classList.remove('highlight');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    async function handleFiles(files) {
        if (!files || files.length === 0) return;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log('Processing file:', file.name);
            
            try {
                // Example: Handle different file types
                if (file.type.startsWith('image/')) {
                    console.log('Processing image:', file.name);
                } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                    console.log('Processing CSV file:', file.name);
                }
                
                if (window.showToast) {
                    showToast(`Processed: ${file.name}`, 'success');
                }
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                if (window.showToast) {
                    showToast(`Error processing ${file.name}`, 'danger');
                }
            }
        }
        
        // Reset the file input
        fileInput.value = '';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDragAndDrop);
} else {
    initializeDragAndDrop();
}

// Add global error handlers
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error || event.message);
    if (window.showToast) {
        window.showToast('An unexpected error occurred. Please try again.', 'danger');
    }
    return false;
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.showToast) {
        window.showToast('An error occurred. Please try again.', 'danger');
    }
});
