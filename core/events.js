// Event management system

const events = new Map();

// Initialize event system
function initEvents() {
    // Set up global event listeners with sound effects
    document.addEventListener('click', (e) => {
        handleGlobalClick(e);
        // Play click sound for buttons
        if (e.target.closest('button, .btn, [role="button"]') && window.soundManager) {
            try {
                window.soundManager.playClick();
            } catch (error) {
                // Ignore sound errors
            }
        }
    });
    
    // Debounced search sound to avoid playing on every keystroke
    let searchSoundTimeout = null;
    document.addEventListener('keydown', (e) => {
        handleGlobalKeyDown(e);
        // Play search sound when typing in search inputs (debounced)
        if (e.target.matches('input[type="search"], #searchInput') && window.soundManager) {
            clearTimeout(searchSoundTimeout);
            searchSoundTimeout = setTimeout(() => {
                try {
                    window.soundManager.playSearch();
                } catch (error) {
                    // Ignore sound errors
                }
            }, 500); // Only play after 500ms of no typing
        }
    });
    
    // Listen for IPC messages
    if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.on('app-event', (event, data) => {
            emit('ipc-message', { event, data });
        });
    }
}

// Subscribe to an event
function on(eventName, callback) {
    if (!events.has(eventName)) {
        events.set(eventName, new Set());
    }
    events.get(eventName).add(callback);
    
    // Return unsubscribe function
    return () => {
        if (events.has(eventName)) {
            events.get(eventName).delete(callback);
        }
    };
}

// Emit an event
function emit(eventName, data) {
    if (events.has(eventName)) {
        events.get(eventName).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for ${eventName}:`, error);
            }
        });
    }
}

// Remove all event listeners
function off(eventName) {
    if (eventName) {
        events.delete(eventName);
    } else {
        events.clear();
    }
}

// Global click handler
function handleGlobalClick(event) {
    // Handle clicks on elements with data-action attribute
    const actionElement = event.target.closest('[data-action]');
    if (actionElement) {
        const action = actionElement.getAttribute('data-action');
        const data = actionElement.dataset;
        emit(`action:${action}`, { event, element: actionElement, data });
    }
}

// Global keydown handler
function handleGlobalKeyDown(event) {
    // Handle global keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
            case 's':
                event.preventDefault();
                emit('shortcut:save');
                break;
            case 'n':
                event.preventDefault();
                emit('shortcut:new');
                break;
            case 'f':
                if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                    event.preventDefault();
                    const searchInput = document.querySelector('[data-action="search"]');
                    if (searchInput) {
                        searchInput.focus();
                    }
                }
                break;
            case 'z':
                if (event.shiftKey) {
                    event.preventDefault();
                    emit('shortcut:redo');
                } else {
                    event.preventDefault();
                    emit('shortcut:undo');
                }
                break;
        }
    }
}

// Common events
const EVENTS = {
    NAVIGATE: 'navigate',
    SHOW_TOAST: 'show-toast',
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',
    FORM_SUBMIT: 'form:submit',
    FORM_RESET: 'form:reset',
    DATA_LOADED: 'data:loaded',
    DATA_SAVED: 'data:saved',
    DATA_DELETED: 'data:deleted',
    ERROR: 'error'
};

export {
    initEvents,
    on,
    off,
    emit,
    EVENTS
};
