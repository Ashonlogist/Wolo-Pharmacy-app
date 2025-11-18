// Sound management system for Wolo Pharmacy
// Provides audio feedback for user interactions

class SoundManager {
    constructor() {
        this.enabled = true;
        this.volume = 0.7;
        this.sounds = {};
        this.audioContext = null;
        
        // Initialize audio context
        this.initAudioContext();
        
        // Load sound settings from storage
        this.loadSettings();
    }
    
    // Initialize Web Audio API context
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume audio context on first user interaction (required by browser autoplay policies)
            const resumeAudio = () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        console.log('Audio context resumed');
                    }).catch(err => {
                        console.warn('Could not resume audio context:', err);
                    });
                }
            };
            
            // Try to resume on any user interaction
            document.addEventListener('click', resumeAudio, { once: true });
            document.addEventListener('keydown', resumeAudio, { once: true });
            document.addEventListener('touchstart', resumeAudio, { once: true });
        } catch (error) {
            console.warn('Web Audio API not supported, using fallback:', error);
            this.audioContext = null;
        }
    }
    
    // Load sound settings
    async loadSettings() {
        try {
            if (typeof window.electron !== 'undefined' && window.electron.ipcRenderer) {
                const { settings } = await import('./api.js');
                const soundEnabled = await settings.get('sound_enabled');
                const soundVolume = await settings.get('sound_volume');
                
                this.enabled = soundEnabled?.value !== 'false';
                this.volume = parseFloat(soundVolume?.value || 0.7);
            }
        } catch (error) {
            console.warn('Could not load sound settings:', error);
        }
    }
    
    // Save sound settings
    async saveSettings() {
        try {
            if (typeof window.electron !== 'undefined' && window.electron.ipcRenderer) {
                const { settings } = await import('./api.js');
                await settings.save('sound_enabled', this.enabled.toString());
                await settings.save('sound_volume', this.volume.toString());
            }
        } catch (error) {
            console.warn('Could not save sound settings:', error);
        }
    }
    
    // Generate a beep sound using Web Audio API
    async playBeep(frequency = 800, duration = 200, type = 'sine') {
        if (!this.enabled) return;
        
        try {
            // Ensure audio context exists
            if (!this.audioContext) {
                this.initAudioContext();
            }
            
            // Resume audio context if suspended (required by browser autoplay policies)
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            if (!this.audioContext) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            
            // Convert volume from 0-1 to actual gain (0-0.3 for beeps)
            const actualVolume = this.volume * 0.3;
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(actualVolume, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
        } catch (error) {
            console.warn('Error playing beep:', error);
        }
    }
    
    // Play success sound
    playSuccess() {
        if (!this.enabled) return;
        this.playBeep(800, 150, 'sine').catch(() => {});
        setTimeout(() => this.playBeep(1000, 150, 'sine').catch(() => {}), 100);
    }
    
    // Play error sound
    playError() {
        if (!this.enabled) return;
        this.playBeep(400, 300, 'sawtooth').catch(() => {});
    }
    
    // Play warning sound
    playWarning() {
        if (!this.enabled) return;
        this.playBeep(600, 200, 'square').catch(() => {});
        setTimeout(() => this.playBeep(500, 200, 'square').catch(() => {}), 150);
    }
    
    // Play info sound
    playInfo() {
        if (!this.enabled) return;
        this.playBeep(700, 100, 'sine').catch(() => {});
    }
    
    // Play click sound
    playClick() {
        if (!this.enabled) return;
        this.playBeep(1000, 50, 'sine').catch(() => {});
    }
    
    // Play notification sound
    playNotification() {
        if (!this.enabled) return;
        // Pleasant notification melody
        this.playBeep(800, 100, 'sine').catch(() => {});
        setTimeout(() => this.playBeep(1000, 100, 'sine').catch(() => {}), 120);
        setTimeout(() => this.playBeep(1200, 150, 'sine').catch(() => {}), 240);
    }
    
    // Play delete sound
    playDelete() {
        if (!this.enabled) return;
        this.playBeep(300, 200, 'sawtooth').catch(() => {});
    }
    
    // Play save sound
    playSave() {
        if (!this.enabled) return;
        this.playBeep(600, 100, 'sine').catch(() => {});
        setTimeout(() => this.playBeep(800, 100, 'sine').catch(() => {}), 100);
        setTimeout(() => this.playBeep(1000, 150, 'sine').catch(() => {}), 200);
    }
    
    // Play page transition sound
    playPageTransition() {
        if (!this.enabled) return;
        this.playBeep(500, 80, 'sine').catch(() => {});
    }
    
    // Play search sound
    playSearch() {
        if (!this.enabled) return;
        this.playBeep(900, 60, 'sine').catch(() => {});
    }
    
    // Play export sound
    playExport() {
        if (!this.enabled) return;
        // Success-like sound for export
        this.playBeep(700, 100, 'sine').catch(() => {});
        setTimeout(() => this.playBeep(900, 100, 'sine').catch(() => {}), 100);
    }
    
    // Play import sound
    playImport() {
        if (!this.enabled) return;
        // Different melody for import
        this.playBeep(600, 100, 'sine').catch(() => {});
        setTimeout(() => this.playBeep(800, 100, 'sine').catch(() => {}), 100);
    }
    
    // Toggle sound on/off
    toggle() {
        this.enabled = !this.enabled;
        this.saveSettings();
        if (this.enabled) {
            this.playSuccess();
        }
        return this.enabled;
    }
    
    // Set volume (0.0 to 1.0)
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.saveSettings();
    }
    
    // Get current volume
    getVolume() {
        return this.volume;
    }
    
    // Check if sound is enabled
    isEnabled() {
        return this.enabled;
    }
}

// Create global sound manager instance
const soundManager = new SoundManager();

// Export for use in other modules
export default soundManager;

// Also expose globally for easy access
window.soundManager = soundManager;

