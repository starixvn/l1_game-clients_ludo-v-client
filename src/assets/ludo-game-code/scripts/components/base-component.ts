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
import { BorderLightHighlightComponent } from "./border-light-highlight-component";
import { Logger } from "../utils/logger";

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

    /** Sprite component for the outer container (for color) */
    private outerSprite: Sprite = null;

    /** Base data from gameBoardData */
    private baseData: Base | null = null;

    /** Map of horse IDs to their data */
    private readonly horsesMap: Map<string, Horse> = new Map();

    /** Map of horse IDs to their placeholder component instances */
    private readonly horsePlaceholdersMap: Map<string, HorsePlaceholderComponent> = new Map();

    /** Array of border light highlight components found recursively */
    private readonly borderHighlightComponents: BorderLightHighlightComponent[] = [];

    /** Path to horse placeholder prefab resource */
    private readonly HORSE_PLACEHOLDER_PREFAB_PATH = "ludo-game-code/prefabs/horse-placeholder-prefab";

    /** Player index mapping for bases */
    private readonly BASE_TO_PLAYER_MAP: { [key: string]: number } = {
        [BaseID.BASE_1]: 0, // YELLOW
        [BaseID.BASE_2]: 3, // GREEN
        [BaseID.BASE_3]: 1, // BLUE
        [BaseID.BASE_4]: 2, // RED
    };

    onLoad() {
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

        // Find border highlight components recursively
        this.findBorderHighlightComponents();
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
                    Logger.debug("BaseComponent", `Will create placeholders programmatically instead`);
                    this.createHorsePlaceholders(container);
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

        // Clear existing placeholders
        this.horsePlaceholdersMap.clear();
        container.removeAllChildren();

        // Create a placeholder for each horse
        this.baseData.horseIDs.forEach((horseID, index) => {
            const horse = this.horsesMap.get(horseID);
            if (!horse) {
                Logger.warn("BaseComponent", `Horse data not found for ${horseID}`);
                return;
            }

            let placeholderNode: Node;

            // Instantiate from prefab if available
            if (this.horsePlaceholderPrefab) {
                placeholderNode = instantiate(this.horsePlaceholderPrefab);
                Logger.debug("BaseComponent", `Instantiated placeholder prefab for ${horseID}`);
            } else {
                // Create programmatically as fallback
                Logger.debug("BaseComponent", `Creating placeholder programmatically for ${horseID} (no prefab available)`);
                placeholderNode = new Node(`HorsePlaceholder_${horseID}`);
                const placeholderComponent = placeholderNode.addComponent(HorsePlaceholderComponent);
                placeholderComponent.baseColor = this.baseData.color;
                placeholderComponent.horseID = horseID;
            }

            // Get or add HorsePlaceholderComponent
            let placeholderComponent = placeholderNode.getComponent(HorsePlaceholderComponent);
            if (!placeholderComponent) {
                placeholderComponent = placeholderNode.addComponent(HorsePlaceholderComponent);
            }

            // Configure the placeholder component
            if (placeholderComponent) {
                // Set base color from base data
                placeholderComponent.setBaseColor(this.baseData.color);

                // Set horse ID
                placeholderComponent.setHorseID(horseID);

                // Store reference
                this.horsePlaceholdersMap.set(horseID, placeholderComponent);
            }

            // Add to container
            container.addChild(placeholderNode);
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
     * Recursively find all border child nodes and get their BorderLightHighlightComponent
     */
    private findBorderHighlightComponents(): void {
        this.borderHighlightComponents.length = 0;
        this.searchBorderNodesRecursively(this.node);
        Logger.debug("BaseComponent", `Found ${this.borderHighlightComponents.length} border highlight components for base ${this.baseID}`);
    }

    /**
     * Recursively search for border nodes with highlight components
     */
    private searchBorderNodesRecursively(node: Node): void {
        if (!this.isNodeValid(node)) {
            return;
        }

        if (this.isBorderNode(node)) {
            this.addBorderHighlightComponentIfExists(node);
        }

        node.children.forEach((child) => {
            this.searchBorderNodesRecursively(child);
        });
    }

    /**
     * Check if node is valid
     */
    private isNodeValid(node: Node | null): boolean {
        return node !== null && node.isValid;
    }

    /**
     * Check if node name contains "border" (case insensitive)
     */
    private isBorderNode(node: Node): boolean {
        return node.name.toLowerCase().includes("border");
    }

    /**
     * Add border highlight component if it exists on the node
     */
    private addBorderHighlightComponentIfExists(node: Node): void {
        const highlightComponent = node.getComponent(BorderLightHighlightComponent);
        if (highlightComponent) {
            this.borderHighlightComponents.push(highlightComponent);
            Logger.debug("BaseComponent", `Found border highlight component on node: ${node.name} for base ${this.baseID}`);
        }
    }

    /**
     * Get the player index for this base
     * @returns Player index (0-3) or -1 if not found
     */
    public getPlayerIndex(): number {
        return this.BASE_TO_PLAYER_MAP[this.baseID] ?? -1;
    }

    /**
     * Update border highlight based on next player
     * @param nextPlayer Player index (0-3) of the next player
     */
    public updateBorderHighlight(nextPlayer: number): void {
        const thisPlayerIndex = this.getPlayerIndex();
        const shouldHighlight = thisPlayerIndex === nextPlayer;

        if (shouldHighlight) {
            this.startBorderHighlight();
        } else {
            this.stopBorderHighlight();
        }
    }

    /**
     * Start border highlight for this base
     */
    private startBorderHighlight(): void {
        this.borderHighlightComponents.forEach((component) => {
            if (this.isComponentValidAndInactive(component)) {
                component.startHighlight();
                Logger.debug("BaseComponent", `Started border highlight for base ${this.baseID}`);
            }
        });
    }

    /**
     * Stop border highlight for this base
     */
    private stopBorderHighlight(): void {
        this.borderHighlightComponents.forEach((component) => {
            if (this.isComponentValidAndActive(component)) {
                component.stopHighlight();
                Logger.debug("BaseComponent", `Stopped border highlight for base ${this.baseID}`);
            }
        });
    }

    /**
     * Check if component is valid and inactive
     */
    private isComponentValidAndInactive(component: BorderLightHighlightComponent): boolean {
        return component?.isValid && !component.getIsActive();
    }

    /**
     * Check if component is valid and active
     */
    private isComponentValidAndActive(component: BorderLightHighlightComponent): boolean {
        return component?.isValid && component.getIsActive();
    }

    /**
     * Refresh border highlight components (call this if border nodes are added/removed dynamically)
     */
    public refreshBorderHighlightComponents(): void {
        this.findBorderHighlightComponents();
    }
}
