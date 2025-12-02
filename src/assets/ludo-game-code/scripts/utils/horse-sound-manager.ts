/**
 * Horse Sound Manager
 *
 * Utility class for managing sound effects for horse components
 */

import { AudioClip, AudioSource, Node } from "cc";
import { Logger } from "./logger";

export class HorseSoundManager {
    private audioSource: AudioSource = null;
    private sfxEnabled = true;
    private readonly node: Node;
    private readonly horseID: string;

    constructor(node: Node, horseID: string) {
        this.node = node;
        this.horseID = horseID;
        this.initializeAudioSource();
    }

    /**
     * Initialize AudioSource component for playing sound effects
     * Always uses main node (this.node) to avoid issues when nodeHorseIcon is reparented
     */
    private initializeAudioSource() {
        // Always use main node for AudioSource to avoid issues when nodeHorseIcon is reparented
        if (!this.node?.isValid) {
            Logger.warn("HorseSoundManager", `Main node is invalid for AudioSource initialization for horse ${this.horseID}`);
            return;
        }

        // Try to get existing AudioSource component from main node
        this.audioSource = this.node.getComponent(AudioSource);

        // If not found, add one
        if (!this.audioSource) {
            this.audioSource = this.node.addComponent(AudioSource);
        }

        // Ensure AudioSource is properly configured
        if (this.audioSource) {
            this.audioSource.volume = 1.0;
            this.audioSource.playOnAwake = false;
            this.audioSource.enabled = true;
            Logger.debug("HorseSoundManager", `AudioSource initialized on main node for horse ${this.horseID}`);
        } else {
            Logger.warn("HorseSoundManager", `Failed to initialize AudioSource for horse ${this.horseID}`);
        }
    }

    /**
     * Ensure AudioSource is available and ready to play
     */
    private ensureAudioSourceReady(): boolean {
        // Re-initialize if not available or invalid
        if (!this.audioSource || !this.audioSource.isValid || !this.audioSource.node?.isValid) {
            this.initializeAudioSource();
        }

        if (!this.audioSource || !this.audioSource.isValid) {
            return false;
        }

        // Ensure the AudioSource node is active (main node should stay active)
        if (!this.audioSource.node.active) {
            // Try to activate the node
            this.audioSource.node.active = true;
        }

        // Ensure AudioSource is enabled
        if (!this.audioSource.enabled) {
            this.audioSource.enabled = true;
        }

        // Ensure volume is set
        if (this.audioSource.volume === 0) {
            this.audioSource.volume = 1.0;
        }

        return true;
    }

    /**
     * Set SFX enabled state
     * @param enabled Whether SFX is enabled
     */
    public setSfxEnabled(enabled: boolean): void {
        this.sfxEnabled = enabled;
        Logger.debug("HorseSoundManager", `SFX enabled set to ${enabled} for horse ${this.horseID}`);
    }

    /**
     * Helper method to safely play a sound effect
     */
    public playSoundEffect(soundClip: AudioClip | null, soundName: string): void {
        // Check if SFX is enabled first
        if (!this.sfxEnabled) {
            Logger.debug("HorseSoundManager", `SFX disabled, skipping ${soundName} sound for horse ${this.horseID}`);
            return;
        }

        if (!soundClip) {
            Logger.debug("HorseSoundManager", `${soundName} sound not assigned for horse ${this.horseID}`);
            return;
        }

        // Ensure AudioSource is ready (this also ensures main node is active)
        if (!this.ensureAudioSourceReady()) {
            Logger.warn("HorseSoundManager", `AudioSource not ready, cannot play ${soundName} sound for horse ${this.horseID}`);
            return;
        }

        // Ensure main node is active (AudioSource is on main node)
        if (!this.node?.isValid) {
            Logger.warn("HorseSoundManager", `Main node is invalid, cannot play ${soundName} sound for horse ${this.horseID}`);
            return;
        }

        if (!this.node.active) {
            // Try to activate the main node
            this.node.active = true;
            Logger.debug("HorseSoundManager", `Activated main node to play ${soundName} sound for horse ${this.horseID}`);
        }

        try {
            // Double-check AudioSource is still valid
            if (!this.audioSource || !this.audioSource.isValid) {
                this.initializeAudioSource();
                if (!this.audioSource || !this.audioSource.isValid) {
                    Logger.error("HorseSoundManager", `Failed to initialize AudioSource for ${soundName} sound`);
                    return;
                }
            }

            // Ensure AudioSource volume is set
            if (this.audioSource.volume === 0) {
                this.audioSource.volume = 1.0;
            }

            // Ensure AudioSource is enabled
            if (!this.audioSource.enabled) {
                this.audioSource.enabled = true;
            }

            this.audioSource.playOneShot(soundClip, 1.0);
            Logger.debug("HorseSoundManager", `Playing ${soundName} sound for horse ${this.horseID}`);
        } catch (error) {
            Logger.error("HorseSoundManager", `Error playing ${soundName} sound for horse ${this.horseID}: ${error}`);
            // Try to re-initialize AudioSource on error
            this.initializeAudioSource();
        }
    }
}
