/**
 * Base Component
 *
 * Represents a player's starting base where horses begin the game.
 * Shows 4 horse placeholders that can spawn horses when the player rolls a 6.
 * The base becomes "spawnable" when the player rolls a 6 on the die.
 *
 * Data is read from game-board-data.ts
 */

import { _decorator, Component, Node, Sprite, UITransform, instantiate, Prefab, resources } from "cc";
import { Base, Horse } from "../game-board-data";
import { WALKWAY_ROW_COUNT, CELL_DIMENSION, BaseID } from "../global-constants";
import { HorsePlaceholderComponent } from "./horse-placeholder-component";
import { gameDataService } from "../services/game-data-service";
import { getBaseColor } from "../utils/color-utils";
import { Logger } from "../utils/logger";
import { AnimationManager } from "../services/animation-manager";

const { ccclass, property, menu } = _decorator;

/**
 * Public props for the Base component
 */
export interface IBaseComponentProps {
    /** Unique identifier for this base (BASE_1, BASE_2, etc.) */
    baseID: string;

    /** Whether this base is enabled/active in the current game */
    enabled?: boolean;

    /** Whether the player of this base has won the game */
    hasWon?: boolean;
}

@ccclass("BaseComponent")
@menu("LudoGame/BaseComponent")
export class BaseComponent extends Component {
    /** Unique identifier for this base (BASE_1, BASE_2, etc.) */
    @property({ type: String, tooltip: "Base ID (e.g., BASE_1, BASE_2, BASE_3, BASE_4)" })
    baseID = "";

    /** Whether the player of this base has won the game */
    @property({ type: Boolean, tooltip: "Whether the player has won" })
    hasWon = false;

    /** Whether the base is spawnable (player rolled a 6) */
    @property({ type: Boolean, tooltip: "Whether base is spawnable (rolled 6)" })
    spawnable = false;

    /** Whether this base is enabled/active in the current game */
    @property({ type: Boolean, tooltip: "Whether this base is enabled/active" })
    isBaseEnabled = true;

    /** Container node for the outer base border */
    @property({ type: Node, tooltip: "Outer container node (colored border)" })
    nodeOuterContainer: Node = null;

    /** Container node for the inner base area */
    @property({ type: Node, tooltip: "Inner container node (horse area)" })
    nodeInnerContainer: Node = null;

    /** Horse placeholder prefab (will be instantiated dynamically) */
    @property({ type: Prefab, tooltip: "Horse placeholder prefab (will be instantiated for each horse)" })
    horsePlaceholderPrefab: Prefab = null;

    /** Container node for horse placeholders (if null, uses nodeInnerContainer or this.node) */
    @property({ type: Node, tooltip: "Container node for horse placeholders (if null, uses nodeInnerContainer)" })
    horsePlaceholdersContainer: Node = null;

    @property({ type: Node })
    diceContainerNode: Node = null;

    /** Sprite component for the outer container (for color) */
    private outerSprite: Sprite = null;

    /** Base data from gameBoardData */
    private baseData: Base | null = null;

    /** Map of horse IDs to their data */
    private readonly horsesMap: Map<string, Horse> = new Map();

    /** Map of horse IDs to their placeholder component instances */
    private readonly horsePlaceholdersMap: Map<string, HorsePlaceholderComponent> = new Map();

    /** Animation manager for handling animations */
    private animationManager: AnimationManager;

    /** Path to horse placeholder prefab resource */
    private readonly HORSE_PLACEHOLDER_PREFAB_PATH = "ludo-game-code/prefabs/horse-placeholder-prefab";

    /** Zoom animation configuration */
    private readonly ZOOM_CONFIG = {
        MIN_SCALE: 1.0,
        MAX_SCALE: 1.15,
        DURATION: 0.6, // seconds for one zoom cycle (in + out)
    };

    /** Player index mapping for bases */
    private readonly BASE_TO_PLAYER_MAP: { [key: string]: number } = {
        [BaseID.BASE_1]: 0, // YELLOW
        [BaseID.BASE_2]: 3, // GREEN
        [BaseID.BASE_3]: 1, // BLUE
        [BaseID.BASE_4]: 2, // RED
    };

    onLoad() {
        this.animationManager = new AnimationManager();
        this.initializeBase();
    }

    /**
     * Initialize the base with data from gameBoardData
     */
    private initializeBase() {
        if (!this.baseID) {
            Logger.warn("BaseComponent", "baseID is not set");
            return;
        }

        // Find base data using service
        this.baseData = gameDataService.getBase(this.baseID);

        if (!this.baseData) {
            Logger.warn("BaseComponent", `Base data not found for ${this.baseID}`);
            return;
        }

        // Build horses map using service
        const horses = gameDataService.getHorsesForBase(this.baseID);
        horses.forEach((horse) => {
            this.horsesMap.set(horse.horseID, horse);
            Logger.debug("BaseComponent", `Added horse ${horse.horseID} to base ${this.baseID}`);
        });

        // Get sprite component for outer container
        if (this.nodeOuterContainer) {
            this.outerSprite = this.nodeOuterContainer.getComponent(Sprite);
        }

        // Update base node size
        this.updateBaseNodeSize();

        // Load and create horse placeholders
        this.loadAndCreateHorsePlaceholders();
    }

    /**
     * Update the base node size based on walkway dimensions
     */
    private updateBaseNodeSize() {
        const transform = this.node.getComponent(UITransform);
        if (!transform) {
            Logger.warn("BaseComponent", `No UITransform found on base node ${this.baseID}`);
            return;
        }

        // Calculate base size: (WALKWAY_ROW_COUNT - 1) * CELL_DIMENSION
        const baseSize = (WALKWAY_ROW_COUNT - 1) * CELL_DIMENSION;
        transform.setContentSize(baseSize, baseSize);
        Logger.debug("BaseComponent", `Updated base node size to ${baseSize}x${baseSize} for ${this.baseID}`);
    }

    /**
     * Update the visual state of the base and horses
     */
    public updateVisualState() {
        if (!this.baseData) {
            return;
        }

        // Update outer container color
        this.updateOuterContainerColor();

        // Update inner container spawnable state
        this.updateInnerContainerState();

        // Update horse placeholders
        this.updateHorsePlaceholders();
    }

    /**
     * Update the color of the outer container based on base color
     */
    private updateOuterContainerColor() {
        if (!this.baseData || !this.outerSprite) {
            return;
        }

        const color = getBaseColor(this.baseData.color);
        if (color) {
            this.outerSprite.color = color;
        }
    }

    /**
     * Update the inner container state (spawnable styling)
     */
    private updateInnerContainerState() {
        if (!this.nodeInnerContainer) {
            return;
        }

        // Add spawnable class or visual indicator
        // In Cocos Creator, you might use a different approach like:
        // - Changing opacity
        // - Adding a glow effect
        // - Changing scale
        if (this.spawnable && this.isBaseEnabled) {
            // Make it more visible when spawnable
            this.nodeInnerContainer.setScale(1.1, 1.1, 1);
        } else {
            this.nodeInnerContainer.setScale(1, 1, 1);
        }
    }

    /**
     * Load horse placeholder prefab and create instances dynamically
     */
    private loadAndCreateHorsePlaceholders() {
        // Get container for horse placeholders
        const container = this.horsePlaceholdersContainer || this.nodeInnerContainer || this.node;

        if (!container) {
            Logger.warn("BaseComponent", `No container available for horse placeholders`);
            return;
        }

        // Try to load prefab if not assigned
        if (!this.horsePlaceholderPrefab) {
            Logger.debug("BaseComponent", `Horse placeholder prefab not assigned, attempting to load from resources`);
            resources.load(this.HORSE_PLACEHOLDER_PREFAB_PATH, Prefab, (err, prefab) => {
                if (err) {
                    Logger.warn(
                        "BaseComponent",
                        `Failed to load horse placeholder prefab from ${this.HORSE_PLACEHOLDER_PREFAB_PATH}: ${err.message}`
                    );
                    return;
                }

                if (prefab) {
                    this.horsePlaceholderPrefab = prefab;
                    Logger.debug("BaseComponent", `Successfully loaded horse placeholder prefab`);
                }

                this.createHorsePlaceholders(container);
            });
        } else {
            this.createHorsePlaceholders(container);
        }
    }

    /**
     * Create horse placeholder instances from prefab
     */
    private createHorsePlaceholders(container: Node) {
        if (!this.baseData) {
            Logger.warn("BaseComponent", `Cannot create placeholders, base data not available`);
            return;
        }

        Logger.debug("BaseComponent", `Creating ${this.baseData.horseIDs.length} horse placeholders for base ${this.baseID}`);

        // Clear existing placeholders map
        this.horsePlaceholdersMap.clear();

        // Don't remove all children - this would destroy the positioned horse_{index} nodes!
        // Instead, we'll clear children inside each horse node individually

        // Create a placeholder for each horse
        this.baseData.horseIDs.forEach((horseID, index) => {
            const horse = this.horsesMap.get(horseID);
            if (!horse) {
                Logger.warn("BaseComponent", `Horse data not found for ${horseID}`);
                return;
            }

            // Find the horse_{index} node in the container (horse_1, horse_2, horse_3, horse_4)
            const horseNodeName = `horse_${index + 1}`;
            const horseContainerNode = container.getChildByName(horseNodeName);

            if (!horseContainerNode) {
                // If node doesn't exist, warn and skip this horse
                Logger.warn(
                    "BaseComponent",
                    `Node ${horseNodeName} not found in container. Please ensure it exists in the scene with proper position set.`
                );
                return;
            }

            // Log the position of the found node
            Logger.debug(
                "BaseComponent",
                `Found existing node ${horseNodeName} for ${horseID} at position (${horseContainerNode.position.x}, ${horseContainerNode.position.y})`
            );

            // Clear only the children of this horse node (old placeholders)
            horseContainerNode.removeAllChildren();

            // Instantiate from prefab (required)
            if (!this.horsePlaceholderPrefab) {
                Logger.warn("BaseComponent", `horsePlaceholderPrefab is not assigned. Please assign the prefab in the editor.`);
                return;
            }

            const placeholderNode = instantiate(this.horsePlaceholderPrefab);
            placeholderNode.name = "horse-placeholder";
            Logger.debug("BaseComponent", `Instantiated placeholder prefab for ${horseID}`);

            // Get HorsePlaceholderComponent (should exist on prefab)
            const placeholderComponent = placeholderNode.getComponent(HorsePlaceholderComponent);
            if (!placeholderComponent) {
                Logger.warn("BaseComponent", `HorsePlaceholderComponent not found on prefab. Please add it to the prefab.`);
                return;
            }

            // Configure the placeholder component
            // Set base color from base data
            placeholderComponent.setBaseColor(this.baseData.color);

            // Set horse ID
            placeholderComponent.setHorseID(horseID);

            // Store reference
            this.horsePlaceholdersMap.set(horseID, placeholderComponent);

            // Add placeholder to horse_{index} node instead of directly to container
            horseContainerNode.addChild(placeholderNode);
            Logger.debug("BaseComponent", `Added placeholder to ${horseNodeName} for ${horseID}`);
        });

        // Update visual state after creating all placeholders
        this.updateVisualState();
    }

    /**
     * Update horse placeholders visibility and state
     * Uses HorsePlaceholderComponent to render horses with HorseComponent
     */
    private updateHorsePlaceholders() {
        if (!this.baseData) {
            return;
        }

        this.baseData.horseIDs.forEach((horseID) => {
            const placeholderComponent = this.horsePlaceholdersMap.get(horseID);
            const horse = this.horsesMap.get(horseID);

            if (!placeholderComponent) {
                Logger.warn("BaseComponent", `Placeholder component not found for ${horseID}`);
                return;
            }

            if (!horse) {
                Logger.warn("BaseComponent", `Horse data not found for ${horseID}`);
                return;
            }

            // Configure the placeholder component with horse data
            // Set base color from base data (in case it changed)
            placeholderComponent.setBaseColor(this.baseData.color);

            // Set horse ID (in case it changed)
            placeholderComponent.setHorseID(horseID);

            // Determine if horse should be hidden:
            // Hide if base is disabled OR horse is already spawned/retired
            const isHorseHidden = !this.isBaseEnabled || horse.isSpawned || horse.isRetired;
            placeholderComponent.setHorseHidden(isHorseHidden);

            // Update visual state to apply changes
            placeholderComponent.updateVisualState();

            Logger.debug("BaseComponent", `Updated placeholder for ${horseID}: hidden=${isHorseHidden}, baseColor=${this.baseData.color}`);
        });
    }

    /**
     * Set the enabled state of the base
     */
    public setEnabled(enabled: boolean) {
        this.isBaseEnabled = enabled;
        this.updateVisualState();
    }

    /**
     * Set the hasWon state of the base
     */
    public setHasWon(hasWon: boolean) {
        this.hasWon = hasWon;
        this.updateVisualState();
    }

    /**
     * Set the spawnable state of the base
     */
    public setSpawnable(spawnable: boolean) {
        this.spawnable = spawnable;
        this.updateVisualState();
    }

    /**
     * Get the base data
     */
    public getBaseData(): Base | null {
        return this.baseData;
    }

    /**
     * Get a horse by ID
     */
    public getHorse(horseID: string): Horse | undefined {
        return this.horsesMap.get(horseID);
    }

    /**
     * Get all horses for this base
     */
    public getHorses(): Horse[] {
        if (!this.baseData) {
            return [];
        }
        return this.baseData.horseIDs.map((horseID) => this.horsesMap.get(horseID)).filter((horse): horse is Horse => horse !== undefined);
    }

    /**
     * Get count of horses in base (not spawned, not retired)
     */
    public getHorsesInBaseCount(): number {
        if (!this.baseData) {
            return 0;
        }
        return this.baseData.horseIDs.filter((horseID) => {
            const horse = this.horsesMap.get(horseID);
            return horse && !horse.isSpawned && !horse.isRetired;
        }).length;
    }

    /**
     * Get count of spawned horses
     */
    public getSpawnedHorsesCount(): number {
        if (!this.baseData) {
            return 0;
        }
        return this.baseData.horseIDs.filter((horseID) => {
            const horse = this.horsesMap.get(horseID);
            return horse && horse.isSpawned && !horse.isRetired;
        }).length;
    }

    /**
     * Get count of horses that reached home
     */
    public getHorsesHomeCount(): number {
        if (!this.baseData) {
            return 0;
        }
        return this.baseData.horseIDs.filter((horseID) => {
            const horse = this.horsesMap.get(horseID);
            return horse && horse.isRetired;
        }).length;
    }

    /**
     * Refresh horse data from game data service
     * Call this when horse states change
     */
    public refreshHorseData() {
        // Rebuild horses map using service
        this.horsesMap.clear();
        const horses = gameDataService.getHorsesForBase(this.baseID);
        horses.forEach((horse) => {
            this.horsesMap.set(horse.horseID, horse);
        });

        // Update visual state
        this.updateVisualState();
    }

    /**
     * Get the player index for this base
     * @returns Player index (0-3) or -1 if not found
     */
    public getPlayerIndex(): number {
        return this.BASE_TO_PLAYER_MAP[this.baseID] ?? -1;
    }

    /** Track if zoom animation is currently active */
    private isZoomAnimationActive = false;

    /**
     * Update border highlight based on next player (now uses zoom animation)
     * @param nextPlayer Player index (0-3) of the next player
     */
    public updateBorderHighlight(nextPlayer: number): void {
        const thisPlayerIndex = this.getPlayerIndex();
        const shouldHighlight = thisPlayerIndex === nextPlayer;

        // Only update if the state has changed to avoid unnecessary resets
        if (shouldHighlight && !this.isZoomAnimationActive) {
            this.startZoomAnimation();
            this.isZoomAnimationActive = true;
        } else if (!shouldHighlight && this.isZoomAnimationActive) {
            this.stopZoomAnimation();
            this.isZoomAnimationActive = false;
        }
    }

    /**
     * Start zoom in/out animation for this base
     */
    private startZoomAnimation(): void {
        if (!this.animationManager) {
            this.animationManager = new AnimationManager();
        }
        // Only start if not already active to avoid resetting
        if (!this.isZoomAnimationActive) {
            this.animationManager.playZoomAnimation(
                this.node,
                this.ZOOM_CONFIG.MIN_SCALE,
                this.ZOOM_CONFIG.MAX_SCALE,
                this.ZOOM_CONFIG.DURATION
            );
            this.isZoomAnimationActive = true;
            Logger.debug("BaseComponent", `Started zoom animation for base ${this.baseID}`);
        }
    }

    /**
     * Stop zoom animation and reset scale to normal
     */
    private stopZoomAnimation(): void {
        if (!this.animationManager) {
            this.animationManager = new AnimationManager();
        }
        // Only stop if currently active to avoid unnecessary resets
        if (this.isZoomAnimationActive) {
            this.animationManager.stopZoomAnimation(this.node, this.ZOOM_CONFIG.MIN_SCALE);
            this.isZoomAnimationActive = false;
            Logger.debug("BaseComponent", `Stopped zoom animation for base ${this.baseID}`);
        }
    }

    /**
     * Cleanup on destroy
     */
    onDestroy(): void {
        if (this.animationManager) {
            this.animationManager.stopZoomAnimation(this.node, this.ZOOM_CONFIG.MIN_SCALE);
        }
    }
}
