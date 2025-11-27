/**
 * Cell Component
 *
 * Represents a single cell/space on the Ludo game board walkway.
 * Cells can contain horses, have different types (normal, spawn, homepath, etc.).
 *
 * Data is read from game-board-data.ts
 */

import { _decorator, Component, Node, Sprite, Label, UITransform, Button, Graphics } from "cc";
import { Cell, GAME_CONSTANTS } from "../game-board-data";
import { CELL_DIMENSION, WALKWAY_LENGTH } from "../global-constants";
import { gameDataService } from "../services/game-data-service";
import { Logger } from "../utils/logger";
import { AnimationManager } from "../services/animation-manager";
import { getCellColor } from "../utils/color-utils";

const { ccclass, property, menu } = _decorator;

@ccclass("CellComponent")
@menu("LudoGame/CellComponent")
export class CellComponent extends Component {
    /** Cell ID (e.g., NORTH_0_0, EAST_1_5, etc.) */
    @property({ type: String, tooltip: "Cell ID (e.g., NORTH_0_0, EAST_1_5)" })
    cellID = "";

    /** Circle border node (for SPAWN and NORMAL cells) */
    @property({ type: Node, tooltip: "Circle border node" })
    nodeCircleBorder: Node = null;

    /** Normal node (for NORMAL cell type) */
    @property({ type: Node, tooltip: "Normal node (for NORMAL cell type)" })
    nodeNormal: Node = null;

    /** Home-path node (for HOMEPATH cell type) */
    @property({ type: Node, tooltip: "Home-path node (for HOMEPATH cell type)" })
    nodeHomePath: Node = null;

    /** Release node (for SPAWN cell type) */
    @property({ type: Node, tooltip: "Release node (for SPAWN cell type)" })
    nodeRelease: Node = null;

    /** Enter-home node (for specific NORMAL cells: WEST_1_0, SOUTH_6_1, EAST_1_6, NORTH_0_1) */
    @property({ type: Node, tooltip: "Enter-home node (for specific NORMAL cells)" })
    nodeEnterHome: Node = null;

    /** Debug info container node */
    @property({ type: Node, tooltip: "Debug info container node" })
    nodeDebugInfo: Node = null;

    /** Homepath index label node */
    @property({ type: Node, tooltip: "Homepath index label node" })
    nodeHomepathIndex: Node = null;

    /** Button component for click handling */
    private button: Button = null;

    /** Circle graphics component */
    private readonly circleGraphics: Graphics = null;

    /** Cell data from gameBoardData */
    private cellData: Cell | null = null;

    /** Homepath index (calculated) */
    private homePathIndex: number | undefined = undefined;

    /** Animation manager instance */
    private animationManager: AnimationManager;

    onLoad() {
        this.animationManager = new AnimationManager();
        this.initializeCell();
    }

    /**
     * Initialize the cell with data from gameBoardData
     */
    private initializeCell() {
        if (!this.cellID) {
            Logger.warn("CellComponent", "cellID is not set");
            return;
        }

        this.cellData = gameDataService.getCell(this.cellID);
        if (!this.cellData) {
            Logger.warn("CellComponent", `Cell data not found for ${this.cellID}`);
            return;
        }

        this.findChildNodes();
        this.setupButton();
        this.calculateHomepathIndex();
        this.updateVisualState();
    }

    /**
     * Find child nodes by name if not assigned
     */
    private findChildNodes() {
        if (!this.nodeNormal) {
            this.nodeNormal = this.node.getChildByName("normal");
        }

        if (!this.nodeHomePath) {
            this.nodeHomePath = this.node.getChildByName("home-path");
        }

        if (!this.nodeRelease) {
            this.nodeRelease = this.node.getChildByName("release");
        }

        if (!this.nodeCircleBorder) {
            this.nodeCircleBorder = this.node.getChildByName("circle");
        }

        if (!this.nodeEnterHome) {
            this.nodeEnterHome = this.node.getChildByName("enter-home");
        }

        if (!this.nodeHomepathIndex && this.nodeHomePath) {
            this.nodeHomepathIndex = this.nodeHomePath.getChildByName("home-path-index-value");
        }
    }

    /**
     * Set up button component for click handling
     */
    private setupButton() {
        this.button = this.node.getComponent(Button);
        if (!this.button) {
            this.button = this.node.addComponent(Button);
        }
    }

    /**
     * Calculate homepath index based on walkway position
     */
    private calculateHomepathIndex() {
        if (!this.cellData || this.cellData.cellType !== GAME_CONSTANTS.CELL_TYPE_HOMEPATH) {
            this.homePathIndex = undefined;
            return;
        }

        const position = this.cellData.position;
        const row = this.cellData.row;
        const column = this.cellData.column;

        // NORTH/SOUTH are vertical, so use row
        // EAST/WEST are horizontal, so use column
        // SOUTH indices are reversed to match logical progression (opposite of NORTH)
        // EAST indices are reversed to match logical progression (opposite of WEST)
        if (position === GAME_CONSTANTS.POSITION_NORTH || position === GAME_CONSTANTS.POSITION_SOUTH) {
            this.homePathIndex = position === GAME_CONSTANTS.POSITION_SOUTH ? WALKWAY_LENGTH - 1 - row : row;
        } else if (position === GAME_CONSTANTS.POSITION_EAST || position === GAME_CONSTANTS.POSITION_WEST) {
            this.homePathIndex = position === GAME_CONSTANTS.POSITION_EAST ? WALKWAY_LENGTH - 1 - column : column;
        }
    }

    /**
     * Check if cell ID is one of the special enter-home cells
     * @param cellID The cell ID to check
     * @returns True if the cell ID matches special enter-home cells
     */
    private isEnterHomeCell(cellID: string): boolean {
        return (GAME_CONSTANTS.ENTER_HOME_CELL_IDS as readonly string[]).includes(cellID);
    }

    /**
     * Get the target node for horse positioning based on cell type
     * @returns The appropriate child node for the cell type, or the cell node itself as fallback
     */
    private getActiveNodeOrFallback(targetNode: Node | null): Node {
        return targetNode && targetNode.active ? targetNode : this.node;
    }

    public getTargetNode(): Node {
        if (!this.cellData) {
            return this.node;
        }

        // Check for special enter-home cells first
        if (this.cellData.cellType === GAME_CONSTANTS.CELL_TYPE_NORMAL && this.isEnterHomeCell(this.cellData.cellID)) {
            return this.getActiveNodeOrFallback(this.nodeEnterHome);
        }

        // Return the appropriate child node based on cell type
        switch (this.cellData.cellType) {
            case GAME_CONSTANTS.CELL_TYPE_NORMAL:
                return this.getActiveNodeOrFallback(this.nodeNormal);
            case GAME_CONSTANTS.CELL_TYPE_HOMEPATH:
                return this.getActiveNodeOrFallback(this.nodeHomePath);
            case GAME_CONSTANTS.CELL_TYPE_SPAWN:
                return this.getActiveNodeOrFallback(this.nodeRelease);
            default:
                return this.node;
        }
    }

    /**
     * Play highlight animation on the cell node with particle effects
     * @param duration Duration of each highlight cycle in seconds (default: 0.2)
     * @param repeatCount Number of times to highlight (default: 3)
     */
    public playBlinkAnimation(duration = 0.2, repeatCount = 2): void {
        // Find the target sprite to highlight
        const targetNode = this.getTargetNode();
        let sprite = targetNode.getComponent(Sprite);

        // If no sprite found, try to find sprite in child nodes
        if (!sprite) {
            const children = this.node.children;
            for (const child of children) {
                sprite = child.getComponent(Sprite);
                if (sprite) {
                    break;
                }
            }
        }

        // If still no sprite, try the cell node itself
        if (!sprite) {
            sprite = this.node.getComponent(Sprite);
        }

        // Use AnimationManager to play the highlight animation
        this.animationManager.playCellHighlightAnimation(this.node, sprite, duration, repeatCount);

        Logger.debug("CellComponent", `Started highlight animation for cell ${this.cellID}, ${repeatCount} times`);
    }

    /**
     * Stop highlight animation
     */
    public stopBlinkAnimation(): void {
        if (this.animationManager) {
            this.animationManager.stopAnimation(this.node);
        }
    }

    /**
     * Update the visual state of the cell
     */
    public updateVisualState() {
        if (!this.cellData) {
            Logger.warn("CellComponent", "No cell data available");
            return;
        }

        this.updateCellTypeUI();
    }

    /**
     * Update cell type specific UI (normal, home-path, release nodes)
     * This method handles enabling/disabling nodes based on cell type
     */
    private updateNormalCellUI() {
        if (!this.cellData) {
            return;
        }
        if (this.isEnterHomeCell(this.cellData.cellID)) {
            // Show enter-home node instead of normal node
            // Note: Enter-home cells do not get their sprite color updated
            if (this.nodeEnterHome) {
                this.nodeEnterHome.active = true;
            }
            if (this.nodeNormal) {
                this.nodeNormal.active = false;
            }
            this.updateEnterHomeNodePosition();
        } else {
            // Regular normal cell - show normal node
            if (this.nodeNormal) {
                this.nodeNormal.active = true;
            }
            if (this.nodeEnterHome) {
                this.nodeEnterHome.active = false;
            }
            this.updateNormalNodePosition();
            this.updateCellSpriteColor(this.nodeNormal);
        }
    }

    /**
     * Update sprite color for cell based on base color using CELL_COLORS
     * Note: Enter-home cells (WEST_1_0, SOUTH_6_1, EAST_1_6, NORTH_0_1) are excluded from color updates
     * @param targetNode The node containing the sprite to update
     */
    private updateCellSpriteColor(targetNode: Node | null) {
        if (!targetNode || !this.cellData) {
            return;
        }

        // Get base data from cell's baseID
        const base = gameDataService.getBase(this.cellData.baseID);
        if (!base) {
            Logger.warn("CellComponent", `Base not found for baseID: ${this.cellData.baseID}`);
            return;
        }

        // Get color from base color using CELL_COLORS constant
        const color = getCellColor(base.color);
        if (!color) {
            Logger.warn("CellComponent", `Color not found for base color: ${base.color}`);
            return;
        }

        // Find sprite component in the target node or its children
        let sprite = targetNode.getComponent(Sprite);
        if (!sprite) {
            // Try to find sprite in child nodes
            const children = targetNode.children;
            for (const child of children) {
                sprite = child.getComponent(Sprite);
                if (sprite) {
                    break;
                }
            }
        }

        // Set sprite color if found
        if (sprite) {
            sprite.color = color;
            Logger.debug("CellComponent", `Updated sprite color for cell ${this.cellID} to ${base.color}`);
        } else {
            Logger.warn("CellComponent", `Sprite component not found in node for cell ${this.cellID}`);
        }
    }

    private updateHomePathCellUI() {
        if (this.nodeHomePath) {
            this.nodeHomePath.active = true;
        }
        this.updateHomePathDimensions();
    }

    private updateSpawnCellUI() {
        if (this.nodeRelease) {
            this.nodeRelease.active = true;
        }
        this.updateReleaseNodePosition();
        this.updateCellSpriteColor(this.nodeRelease);

        // Also update color for star child node if it exists
        if (this.nodeRelease) {
            const starNode = this.nodeRelease.getChildByName("star");
            if (starNode) {
                this.updateCellSpriteColor(starNode);
            }
        }
    }

    private disableNormalAndEnterHomeNodes() {
        if (this.nodeNormal) {
            this.nodeNormal.active = false;
        }
        if (this.nodeEnterHome) {
            this.nodeEnterHome.active = false;
        }
    }

    private updateCellTypeUI() {
        if (!this.cellData) {
            return;
        }

        // Handle NORMAL cell type
        if (this.cellData.cellType === GAME_CONSTANTS.CELL_TYPE_NORMAL) {
            this.updateNormalCellUI();
        } else {
            this.disableNormalAndEnterHomeNodes();
        }

        // Handle HOMEPATH cell type
        if (this.cellData.cellType === GAME_CONSTANTS.CELL_TYPE_HOMEPATH) {
            this.updateHomePathCellUI();
        } else if (this.nodeHomePath) {
            this.nodeHomePath.active = false;
        }

        // Handle SPAWN cell type
        if (this.cellData.cellType === GAME_CONSTANTS.CELL_TYPE_SPAWN) {
            this.updateSpawnCellUI();
        } else if (this.nodeRelease) {
            this.nodeRelease.active = false;
        }
    }

    private checkRange1(cellID: string): { xAdjustment: number; yAdjustment: number } | null {
        const xAdjustment = 2;
        const yAdjustment = 14;
        // Range 1: WEST_2_0 to WEST_2_6
        if (cellID.startsWith("WEST_2_")) {
            const match = cellID.match(/WEST_2_(\d+)/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number >= 0 && number <= 6) {
                    return { xAdjustment, yAdjustment };
                }
            }
        }
        // Range 1: SOUTH_1_0 to SOUTH_6_0
        if (cellID.startsWith("SOUTH_") && cellID.endsWith("_0")) {
            const match = cellID.match(/SOUTH_(\d+)_0/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number >= 1 && number <= 6) {
                    return { xAdjustment, yAdjustment };
                }
            }
        }
        return null;
    }

    private checkRange2(cellID: string): { xAdjustment: number; yAdjustment: number } | null {
        const xAdjustment = -2;
        const yAdjustment = 13;
        // Range 2: SOUTH_1_2 to SOUTH_6_2
        if (cellID.startsWith("SOUTH_") && cellID.endsWith("_2")) {
            const match = cellID.match(/SOUTH_(\d+)_2/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number >= 1 && number <= 6) {
                    return { xAdjustment, yAdjustment };
                }
            }
        }
        // Range 2: EAST_2_0 to EAST_2_6
        if (cellID.startsWith("EAST_2_")) {
            const match = cellID.match(/EAST_2_(\d+)/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number >= 0 && number <= 6) {
                    return { xAdjustment, yAdjustment };
                }
            }
        }
        return null;
    }

    private checkRange3(cellID: string): { xAdjustment: number; yAdjustment: number } | null {
        const xAdjustment = 4;
        const yAdjustment = 1;
        // Range 3: NORTH_0_0 to NORTH_5_0
        if (cellID.startsWith("NORTH_") && cellID.endsWith("_0")) {
            const match = cellID.match(/NORTH_(\d+)_0/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number >= 0 && number <= 5) {
                    return { xAdjustment, yAdjustment };
                }
            }
        }
        // Range 3: WEST_0_0 to WEST_0_6
        if (cellID.startsWith("WEST_0_")) {
            const match = cellID.match(/WEST_0_(\d+)/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number >= 0 && number <= 6) {
                    return { xAdjustment, yAdjustment };
                }
            }
        }
        return null;
    }

    private checkRange4(cellID: string): { xAdjustment: number; yAdjustment: number } | null {
        const xAdjustment = -3;
        const yAdjustment = 2;
        // Range 4: NORTH_0_2 to NORTH_5_2
        if (cellID.startsWith("NORTH_") && cellID.endsWith("_2")) {
            const match = cellID.match(/NORTH_(\d+)_2/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number >= 0 && number <= 5) {
                    return { xAdjustment, yAdjustment };
                }
            }
        }
        // Range 4: EAST_0_0 to EAST_0_6
        if (cellID.startsWith("EAST_0_")) {
            const match = cellID.match(/EAST_0_(\d+)/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number >= 0 && number <= 6) {
                    return { xAdjustment, yAdjustment };
                }
            }
        }
        return null;
    }

    /**
     * Calculate position adjustment based on cell ID
     * Range 1: WEST_2_0 to WEST_2_6, SOUTH_1_0 to SOUTH_6_0 → x+3, y+8
     * Range 2: SOUTH_1_2 to SOUTH_6_2, EAST_2_0 to EAST_2_6 → x-4, y+9
     * Range 3: NORTH_0_0 to NORTH_5_0, WEST_0_0 to WEST_0_6 → x+4, y+1
     * Range 4: NORTH_0_2 to NORTH_5_2, EAST_0_0 to EAST_0_6 → x-3, y+2
     * @param cellID The cell ID to check
     * @returns Object with xAdjustment and yAdjustment values
     */
    private calculatePositionAdjustment(cellID: string): { xAdjustment: number; yAdjustment: number } {
        const range1 = this.checkRange1(cellID);
        if (range1) {
            return range1;
        }

        const range2 = this.checkRange2(cellID);
        if (range2) {
            return range2;
        }

        const range3 = this.checkRange3(cellID);
        if (range3) {
            return range3;
        }

        const range4 = this.checkRange4(cellID);
        if (range4) {
            return range4;
        }

        return { xAdjustment: 0, yAdjustment: 0 };
    }

    /**
     * Update normal node position for specific cell IDs
     * Range 1: WEST_2_0 to WEST_2_6, SOUTH_1_0 to SOUTH_6_0 → x+3, y+8
     * Range 2: SOUTH_1_2 to SOUTH_6_2, EAST_2_0 to EAST_2_6 → x-4, y+9
     * Range 3: NORTH_0_0 to NORTH_5_0, WEST_0_0 to WEST_0_6 → x+4, y+1
     * Range 4: NORTH_0_2 to NORTH_5_2, EAST_0_0 to EAST_0_6 → x-3, y+2
     */
    private updateNormalNodePosition() {
        if (!this.nodeNormal || !this.cellData) {
            return;
        }

        const { xAdjustment, yAdjustment } = this.calculatePositionAdjustment(this.cellData.cellID);

        if (xAdjustment !== 0 || yAdjustment !== 0) {
            const currentPosition = this.nodeNormal.getPosition();
            this.nodeNormal.setPosition(currentPosition.x + xAdjustment, currentPosition.y + yAdjustment, currentPosition.z);
        }
    }

    /**
     * Update enter-home node position for specific cell IDs
     * Uses position adjustments from GAME_CONSTANTS.ENTER_HOME_NODE_POSITIONS
     */
    private updateEnterHomeNodePosition() {
        if (!this.nodeEnterHome || !this.cellData) {
            return;
        }

        const cellID = this.cellData.cellID;
        const positionAdjustment = (GAME_CONSTANTS.ENTER_HOME_NODE_POSITIONS as any)[cellID];

        if (positionAdjustment) {
            const { x: xAdjustment, y: yAdjustment } = positionAdjustment;
            if (xAdjustment !== 0 || yAdjustment !== 0) {
                const currentPosition = this.nodeEnterHome.getPosition();
                this.nodeEnterHome.setPosition(currentPosition.x + xAdjustment, currentPosition.y + yAdjustment, currentPosition.z);
            }
        }
    }

    /**
     * Update release node position for specific cell IDs (SPAWN cells)
     * Range 1: WEST_2_0 to WEST_2_6, SOUTH_1_0 to SOUTH_6_0 → x+3, y+8
     * Range 2: SOUTH_1_2 to SOUTH_6_2, EAST_2_0 to EAST_2_6 → x-4, y+9
     * Range 3: NORTH_0_0 to NORTH_5_0, WEST_0_0 to WEST_0_6 → x+4, y+1
     * Range 4: NORTH_0_2 to NORTH_5_2, EAST_0_0 to EAST_0_6 → x-3, y+2
     */
    private updateReleaseNodePosition() {
        if (!this.nodeRelease || !this.cellData) {
            return;
        }

        const { xAdjustment, yAdjustment } = this.calculatePositionAdjustment(this.cellData.cellID);

        if (xAdjustment !== 0 || yAdjustment !== 0) {
            const currentPosition = this.nodeRelease.getPosition();
            this.nodeRelease.setPosition(currentPosition.x + xAdjustment, currentPosition.y + yAdjustment, currentPosition.z);
        }
    }

    /**
     * Update home path node dimensions based on position
     * POSITION_NORTH/POSITION_SOUTH: width = CELL_DIMENSION * CELL_DIMENSION_MULTIPLIER
     * POSITION_EAST/POSITION_WEST: height = CELL_DIMENSION * CELL_DIMENSION_MULTIPLIER
     */
    private updateHomePathDimensions() {
        if (!this.nodeHomePath || !this.cellData) {
            return;
        }

        const position = this.cellData.position;
        const northSouthWidth = 81;
        const eastWestHeight = 81;
        const northSouthHeight = CELL_DIMENSION + 1;
        const eastWestWidth = CELL_DIMENSION + 1;
        const yNorthSouth = position === GAME_CONSTANTS.POSITION_NORTH ? -5 : 21;
        const xEastWest = position === GAME_CONSTANTS.POSITION_WEST ? 13 : -13; // 4
        const xNorthSouth = 0;
        const yEastWest = 8;

        // Get or add UITransform component
        let transform = this.nodeHomePath.getComponent(UITransform);
        if (!transform) {
            transform = this.nodeHomePath.addComponent(UITransform);
        }

        if (position === GAME_CONSTANTS.POSITION_NORTH || position === GAME_CONSTANTS.POSITION_SOUTH) {
            // For NORTH/SOUTH (vertical walkways), set width
            transform.setContentSize(northSouthWidth, northSouthHeight);
            this.nodeHomePath.setPosition(xNorthSouth, yNorthSouth);
        } else if (position === GAME_CONSTANTS.POSITION_EAST || position === GAME_CONSTANTS.POSITION_WEST) {
            // For EAST/WEST (horizontal walkways), set height
            transform.setContentSize(eastWestWidth, eastWestHeight);
            this.nodeHomePath.setPosition(xEastWest, yEastWest);
        }
    }

    /**
     * Get cell data
     */
    public getCellData(): Cell | null {
        return this.cellData;
    }

    /**
     * Get cell ID
     */
    public getCellID(): string {
        return this.cellID;
    }

    /**
     * Get homepath index
     */
    public getHomepathIndex(): number | undefined {
        return this.homePathIndex;
    }

    /**
     * Get the parent node for background elements based on cell type
     * @returns The parent node (normal, release, or home-path) based on cell type
     */
    private getBackgroundParentNode(): Node | null {
        if (!this.cellData) {
            Logger.warn("CellComponent", `Cell data not available for ${this.cellID}`);
            return null;
        }

        switch (this.cellData.cellType) {
            case GAME_CONSTANTS.CELL_TYPE_NORMAL:
                return this.nodeNormal;
            case GAME_CONSTANTS.CELL_TYPE_SPAWN:
                return this.nodeRelease;
            case GAME_CONSTANTS.CELL_TYPE_HOMEPATH:
                return this.nodeHomePath;
            default:
                Logger.warn("CellComponent", `Unknown cell type: ${this.cellData.cellType} for cell ${this.cellID}`);
                return null;
        }
    }

    /**
     * Highlight this cell as a possible move destination
     * Hides normal-background and shows possible-move-background based on cell type
     * Also plays highlight animation on the possible-move-background
     */
    public highlightAsPossibleMove(): void {
        const parentNode = this.getBackgroundParentNode();
        if (!parentNode) {
            Logger.warn("CellComponent", `Cannot highlight cell ${this.cellID}: parent node not found`);
            return;
        }

        Logger.debug(
            "CellComponent",
            `Highlighting cell ${this.cellID}, parent node: ${parentNode.name}, cell type: ${this.cellData?.cellType}`
        );

        const normalBackground = parentNode.getChildByName("normal-background");
        const possibleMoveBackground = parentNode.getChildByName("possible-move-background");

        if (normalBackground) {
            normalBackground.active = false;
            Logger.debug("CellComponent", `Hid normal-background for cell ${this.cellID}`);
        } else {
            Logger.debug("CellComponent", `normal-background node not found in ${this.cellData?.cellType} node for cell ${this.cellID}`);
        }

        if (possibleMoveBackground) {
            possibleMoveBackground.active = true;
            Logger.debug(
                "CellComponent",
                `Showed possible-move-background for cell ${this.cellID}, node active: ${possibleMoveBackground.active}`
            );

            // Use scheduleOnce to ensure the node is fully activated before playing animation
            this.scheduleOnce(() => {
                // Play highlight animation on the possible-move-background
                if (possibleMoveBackground && possibleMoveBackground.active) {
                    this.playCellHighlightAnimationOnNode(possibleMoveBackground);
                } else {
                    Logger.warn(
                        "CellComponent",
                        `possible-move-background became inactive before animation could start for cell ${this.cellID}`
                    );
                }
            }, 0.01);
        } else {
            Logger.warn(
                "CellComponent",
                `possible-move-background node not found in ${this.cellData?.cellType} node for cell ${
                    this.cellID
                }. Available children: ${parentNode.children.map((c) => c.name).join(", ")}`
            );
        }

        Logger.debug("CellComponent", `Highlighted cell ${this.cellID} as possible move`);
    }

    /**
     * Play highlight animation on a specific node
     * @param targetNode The node to play animation on
     * @param duration Duration of each highlight cycle in seconds (default: 0.2)
     * @param repeatCount Number of times to highlight (use a large number for continuous effect)
     */
    private playCellHighlightAnimationOnNode(targetNode: Node, duration = 0.5, repeatCount = 9999): void {
        if (!targetNode) {
            Logger.warn("CellComponent", `Cannot play animation: targetNode is null for cell ${this.cellID}`);
            return;
        }

        // Ensure the node is active before playing animation
        if (!targetNode.active) {
            Logger.warn("CellComponent", `Cannot play animation: targetNode is not active for cell ${this.cellID}`);
            return;
        }

        // Find sprite component in the target node or its children
        let sprite = targetNode.getComponent(Sprite);

        if (!sprite) {
            // Try to find sprite in child nodes
            for (const child of targetNode.children) {
                sprite = child.getComponent(Sprite);
                if (sprite) {
                    Logger.debug("CellComponent", `Found sprite in child node ${child.name} for cell ${this.cellID}`);
                    break;
                }
            }
        } else {
            Logger.debug("CellComponent", `Found sprite directly on target node for cell ${this.cellID}`);
        }

        // Log if no sprite found (animation will still work with scale)
        if (!sprite) {
            Logger.debug(
                "CellComponent",
                `No sprite found for possible-move-background in cell ${this.cellID}, animation will use scale only`
            );
        }

        // Use AnimationManager to play the highlight animation
        // Use the targetNode as the node parameter, and the sprite if found
        // Note: Animation will work on node scale even without sprite
        try {
            this.animationManager.playCellHighlightAnimation(targetNode, sprite, duration, repeatCount);
            Logger.debug(
                "CellComponent",
                `Started highlight animation on possible-move-background for cell ${
                    this.cellID
                } (repeatCount: ${repeatCount}, hasSprite: ${!!sprite})`
            );
        } catch (error) {
            Logger.error("CellComponent", `Failed to play highlight animation for cell ${this.cellID}: ${error}`);
        }
    }

    /**
     * Clear highlight from this cell
     * Shows normal-background and hides possible-move-background based on cell type
     * Also stops the highlight animation
     */
    public clearHighlight(): void {
        const parentNode = this.getBackgroundParentNode();
        if (!parentNode) {
            // If parent node not found, silently return (cell might not be initialized yet)
            return;
        }

        const normalBackground = parentNode.getChildByName("normal-background");
        const possibleMoveBackground = parentNode.getChildByName("possible-move-background");

        // Stop animation on possible-move-background before hiding it
        if (possibleMoveBackground) {
            this.animationManager.stopAnimation(possibleMoveBackground);
            possibleMoveBackground.active = false;
        }

        if (normalBackground) {
            normalBackground.active = true;
        }

        Logger.debug("CellComponent", `Cleared highlight from cell ${this.cellID}`);
    }

    onDestroy() {
        // Clean up animation
        this.stopBlinkAnimation();
        // Clean up event listeners
    }
}
