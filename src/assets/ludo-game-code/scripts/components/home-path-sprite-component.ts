/**
 * Home Path Sprite Component
 *
 * Displays different sprites for home path cells based on the home path index.
 * Receives 4 lists of sprites (one per base), each list contains 3 sprites:
 * - Index 0: bottom sprite (for home path index 1)
 * - Index 1: middle sprite (for home path index 2-5)
 * - Index 2: top sprite (for home path index 6)
 *
 * Gets the home path index and baseID from the parent CellComponent to determine
 * which sprite list and which sprite within that list to use.
 */

import { _decorator, Component, Sprite, SpriteFrame } from "cc";
import { CellComponent } from "./cell-component";
import { Logger } from "../utils/logger";
import { GAME_CONSTANTS } from "../game-board-data";
import { BaseID } from "../global-constants";

const { ccclass, property, menu } = _decorator;

@ccclass("HomePathSpriteComponent")
@menu("LudoGame/HomePathSpriteComponent")
export class HomePathSpriteComponent extends Component {
    /** Sprite frames for BASE_1 (YELLOW) - array of 3: [bottom, middle, top] */
    @property({ type: [SpriteFrame], tooltip: "BASE_1 (YELLOW) sprites: [bottom, middle, top]" })
    base1Sprites: SpriteFrame[] = [];

    /** Sprite frames for BASE_2 (GREEN) - array of 3: [bottom, middle, top] */
    @property({ type: [SpriteFrame], tooltip: "BASE_2 (GREEN) sprites: [bottom, middle, top]" })
    base2Sprites: SpriteFrame[] = [];

    /** Sprite frames for BASE_3 (BLUE) - array of 3: [bottom, middle, top] */
    @property({ type: [SpriteFrame], tooltip: "BASE_3 (BLUE) sprites: [bottom, middle, top]" })
    base3Sprites: SpriteFrame[] = [];

    /** Sprite frames for BASE_4 (RED) - array of 3: [bottom, middle, top] */
    @property({ type: [SpriteFrame], tooltip: "BASE_4 (RED) sprites: [bottom, middle, top]" })
    base4Sprites: SpriteFrame[] = [];

    /** Sprite component reference */
    private sprite: Sprite = null;

    /** Reference to parent CellComponent */
    private cellComponent: CellComponent = null;

    onLoad() {
        this.initializeSprite();
        this.findCellComponent();
        this.updateSpriteFrame();
    }

    /**
     * Initialize sprite component
     */
    private initializeSprite() {
        this.sprite = this.node.getComponent(Sprite);
        if (!this.sprite) {
            this.sprite = this.node.addComponent(Sprite);
            Logger.warn("HomePathSpriteComponent", "Sprite component not found, added one");
        }
    }

    /**
     * Find CellComponent in parent hierarchy
     */
    private findCellComponent() {
        // Try to get from parent node
        let parent = this.node.parent;
        while (parent) {
            this.cellComponent = parent.getComponent(CellComponent);
            if (this.cellComponent) {
                break;
            }
            parent = parent.parent;
        }

        if (!this.cellComponent) {
            Logger.warn("HomePathSpriteComponent", "CellComponent not found in parent hierarchy");
        }
    }

    /**
     * Get sprite list for a specific base ID
     * @param baseID The base ID (BASE_1, BASE_2, BASE_3, BASE_4)
     * @returns Array of sprite frames for the base, or null if not found
     */
    private getSpriteListForBase(baseID: string): SpriteFrame[] | null {
        switch (baseID) {
            case BaseID.BASE_1:
                return this.base1Sprites.length === 3 ? this.base1Sprites : null;
            case BaseID.BASE_2:
                return this.base2Sprites.length === 3 ? this.base2Sprites : null;
            case BaseID.BASE_3:
                return this.base3Sprites.length === 3 ? this.base3Sprites : null;
            case BaseID.BASE_4:
                return this.base4Sprites.length === 3 ? this.base4Sprites : null;
            default:
                Logger.warn("HomePathSpriteComponent", `Unknown baseID: ${baseID}`);
                return null;
        }
    }

    /**
     * Map home path index to sprite index within the sprite list
     * @param homePathIndex The home path index (1-6)
     * @returns Sprite index (0 = bottom, 1 = middle, 2 = top)
     */
    private mapHomePathIndexToSpriteIndex(homePathIndex: number): number {
        if (homePathIndex === 1) {
            return 0; // bottom sprite
        } else if (homePathIndex >= 2 && homePathIndex <= 5) {
            return 1; // middle sprite
        } else if (homePathIndex === 6) {
            return 2; // top sprite
        } else {
            Logger.warn("HomePathSpriteComponent", `Invalid home path index: ${homePathIndex}`);
            return 1; // default to middle sprite
        }
    }

    /**
     * Update sprite frame based on home path index and base ID
     */
    public updateSpriteFrame() {
        if (!this.sprite) {
            Logger.warn("HomePathSpriteComponent", "Sprite component not available");
            return;
        }

        if (!this.cellComponent) {
            this.findCellComponent();
            if (!this.cellComponent) {
                Logger.warn("HomePathSpriteComponent", "Cannot update sprite frame: CellComponent not found");
                return;
            }
        }

        const homePathIndex = this.cellComponent.getHomepathIndex();
        const cellData = this.cellComponent.getCellData();

        // Check if this is a HOMEPATH cell type
        if (!cellData || cellData.cellType !== GAME_CONSTANTS.CELL_TYPE_HOMEPATH) {
            this.node.active = false;
            return;
        }

        // Check if home path index is valid
        if (homePathIndex === undefined || homePathIndex === null) {
            Logger.warn("HomePathSpriteComponent", "Home path index is undefined");
            this.node.active = false;
            return;
        }

        // Get base ID from cell data
        const baseID = cellData.baseID;
        if (!baseID) {
            Logger.warn("HomePathSpriteComponent", "Base ID not found in cell data");
            this.node.active = false;
            return;
        }

        // Get sprite list for this base
        const spriteList = this.getSpriteListForBase(baseID);
        if (!spriteList) {
            Logger.warn(
                "HomePathSpriteComponent",
                `Sprite list not found or incomplete for baseID: ${baseID}. Expected 3 sprites, got ${this.getSpriteListLength(baseID)}`
            );
            this.node.active = false;
            return;
        }

        // Map home path index to sprite index
        const spriteIndex = this.mapHomePathIndexToSpriteIndex(homePathIndex);

        // Get the sprite frame
        const spriteFrame = spriteList[spriteIndex];
        if (spriteFrame) {
            this.sprite.spriteFrame = spriteFrame;
            this.node.active = true;
            Logger.debug(
                "HomePathSpriteComponent",
                `Updated sprite frame: baseID=${baseID}, homePathIndex=${homePathIndex} -> spriteIndex=${spriteIndex}`
            );
        } else {
            Logger.warn("HomePathSpriteComponent", `SpriteFrame at index ${spriteIndex} is null or undefined for baseID: ${baseID}`);
            this.node.active = false;
        }
    }

    /**
     * Get the length of sprite list for a base (for debugging)
     * @param baseID The base ID
     * @returns Length of the sprite list
     */
    private getSpriteListLength(baseID: string): number {
        switch (baseID) {
            case BaseID.BASE_1:
                return this.base1Sprites.length;
            case BaseID.BASE_2:
                return this.base2Sprites.length;
            case BaseID.BASE_3:
                return this.base3Sprites.length;
            case BaseID.BASE_4:
                return this.base4Sprites.length;
            default:
                return 0;
        }
    }

    /**
     * Refresh the sprite frame (useful when cell data changes)
     */
    public refresh() {
        this.updateSpriteFrame();
    }
}
