// Application state management

// Initial state
const initialState = {
    currentPage: 'dashboard',
    products: [],
    sales: [],
    settings: {},
    // Add other initial state properties here
};

// State management
const state = {
    _state: { ...initialState },
    _listeners: new Set(),
    _history: {
        past: [],
        present: null,
        future: [],
        maxLength: 50
    },

    // Get current state
    get current() {
        return this._state;
    },

    // Get a specific value from state
    get(key) {
        return this._state[key];
    },

    // Set state
    set(key, value) {
        // Save current state to history before changing
        this._saveToHistory();
        
        // Update state
        this._state = {
            ...this._state,
            [key]: value
        };
        
        // Notify listeners
        this._notify(key, value);
    },

    // Update multiple state properties at once
    update(updates) {
        // Save current state to history before changing
        this._saveToHistory();
        
        // Update state
        this._state = {
            ...this._state,
            ...updates
        };
        
        // Notify listeners for each updated property
        Object.entries(updates).forEach(([key, value]) => {
            this._notify(key, value);
        });
    },

    // Reset to initial state
    reset() {
        this._state = { ...initialState };
        this._history = {
            past: [],
            present: null,
            future: [],
            maxLength: 50
        };
        this._notify('*', this._state);
    },

    // Subscribe to state changes
    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    },

    // Undo last state change
    undo() {
        if (this._history.past.length === 0) return false;
        
        const previous = this._history.past.pop();
        this._history.future.unshift(this._state);
        
        if (this._history.future.length > this._history.maxLength) {
            this._history.future.pop();
        }
        
        this._state = { ...previous };
        this._notify('*', this._state);
        return true;
    },

    // Redo last undone state change
    redo() {
        if (this._history.future.length === 0) return false;
        
        const next = this._history.future.shift();
        this._history.past.push(this._state);
        
        if (this._history.past.length > this._history.maxLength) {
            this._history.past.shift();
        }
        
        this._state = { ...next };
        this._notify('*', this._state);
        return true;
    },

    // Check if undo is available
    canUndo() {
        return this._history.past.length > 0;
    },

    // Check if redo is available
    canRedo() {
        return this._history.future.length > 0;
    },

    // Save current state to history
    _saveToHistory() {
        this._history.past.push(JSON.parse(JSON.stringify(this._state)));
        
        if (this._history.past.length > this._history.maxLength) {
            this._history.past.shift();
        }
        
        this._history.future = [];
    },

    // Notify listeners of state changes
    _notify(key, value) {
        this._listeners.forEach(listener => {
            try {
                listener(key, value, this._state);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }
};

// Initialize state
async function initState() {
    try {
        // Load any persisted state here (e.g., from localStorage or IndexedDB)
        // const savedState = await loadState();
        // if (savedState) {
        //     state._state = { ...initialState, ...savedState };
        // }
    } catch (error) {
        console.error('Error initializing state:', error);
    }
}

export { state, initState };
