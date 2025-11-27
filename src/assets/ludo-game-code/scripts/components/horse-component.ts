/**
 * Horse Component
 *
 * Represents a single game horse/piece in the Ludo game.
 * Horses are the pieces that players move around the board.
 * Each horse belongs to a specific player (represented by baseColor).
 *
 * This component renders the horse icon (Unicode chess knight).
 * For horses in the base, use HorsePlaceholderComponent which wraps this component.
 *
 * Data is read from game-board-data.ts
 */

import { _decorator, Component, Node, Label, UITransform, Vec3, Sprite, Button, SpriteFrame } from "cc";
import { BaseColor, Cell, gameBoardData, Horse } from "../game-board-data";
import { WalkwayComponent } from "./walkway-component";
import { CellComponent } from "./cell-component";
import { CELL_DIMENSION } from "../global-constants";
import { gameDataService } from "../services/game-data-service";
import { PathfindingService } from "../services/pathfinding-service";
import { AnimationManager } from "../services/animation-manager";
import { CELL_CONFIG } from "../utils/cell-config";
import { Logger } from "../utils/logger";
import { BaseComponent } from "./base-component";

const { ccclass, property, menu } = _decorator;

/**
 * Public props for the Horse component
 */
export interface IHorseComponentProps {
    /** The color of the horse (matches the player's base color) */
    baseColor: BaseColor;
    /** Optional custom size for the horse (defaults to CELL_DIMENSION) */
    horseSize?: number;
    /** Whether the horse is currently jumping (for animation) */
    isJumping?: boolean;
    /** Whether the horse is currently flying to base (for kick animation) */
    isFlyingToBase?: boolean;
    /** Whether the horse is being hovered (for action selection highlighting) */
    isHovered?: boolean;
    /** Optional horse ID */
    horseID?: string;
}

@ccclass("HorseComponent")
@menu("LudoGame/HorseComponent")
export class HorseComponent extends Component {
    /** The color of the horse (matches the player's base color) */
    @property({ type: String, tooltip: "Base color (YELLOW, GREEN, BLUE, RED)" })
    baseColor: BaseColor = "YELLOW";

    /** Optional custom size for the horse (defaults to CELL_DIMENSION) */
    @property({ type: Number, tooltip: "Horse size in pixels (defaults to CELL_DIMENSION)" })
    horseSize: number = CELL_DIMENSION;

    /** Whether the horse is currently jumping (for animation) */
    @property({ type: Boolean, tooltip: "Whether the horse is jumping" })
    isJumping = false;

    /** Whether the horse is currently flying to base (for kick animation) */
    @property({ type: Boolean, tooltip: "Whether the horse is flying to base" })
    isFlyingToBase = false;

    /** Whether the horse is being hovered (for action selection highlighting) */
    @property({ type: Boolean, tooltip: "Whether the horse is hovered" })
    isHovered = false;

    /** Whether the horse is highlighted as a possible move candidate */
    private isHighlightedAsPossibleMove = false;

    /** Original scale of the horse icon before highlighting (to restore after clearing) */
    private originalHorseIconScale: Vec3 | null = null;

    /** Optional horse ID */
    @property({ type: String, tooltip: "Horse ID (e.g., BASE_1_HORSE_1)" })
    horseID = "";

    /** Array of sprite frames for horses, indexed by base color: [YELLOW, GREEN, BLUE, RED] */
    @property({ type: [SpriteFrame], tooltip: "Horse sprite frames array: [YELLOW, GREEN, BLUE, RED]" })
    HorseSpriteFrames: SpriteFrame[] = [];

    /** Node for the horse icon (Unicode character) */
    @property({ type: Node, tooltip: "Horse icon label node" })
    nodeHorseIcon: Node = null;

    /** Horse icon label component */
    private horseIconLabel: Label = null;

    /** Unicode character for chess knight (♞) */
    private readonly HORSE_UNICODE = "\u265E";

    /** Pathfinding service instance */
    private pathfindingService: PathfindingService;

    /** Animation manager instance */
    private animationManager: AnimationManager;

    /** Cached top layer node (game-board-prefab) for reparenting */
    private cachedTopLayer: Node = null;

    onLoad() {
        this.pathfindingService = new PathfindingService(gameDataService);
        this.animationManager = new AnimationManager();
        this.initializeHorse();
    }

    /**
     * Initialize the horse component
     */
    private setupHorseTransform() {
        const transform = this.node.getComponent(UITransform);
        if (!transform) {
            const newTransform = this.node.addComponent(UITransform);
            newTransform.setContentSize(this.horseSize, this.horseSize);
            newTransform.setAnchorPoint(0.5, 0.5);
        } else {
            transform.setContentSize(this.horseSize, this.horseSize);
            transform.setAnchorPoint(0.5, 0.5);
        }
    }

    private createHorseIconNode(): Node {
        const iconNode = new Node("HorseIcon");
        this.node.addChild(iconNode);
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(this.horseSize * 0.8, this.horseSize * 0.8);
        iconTransform.setAnchorPoint(0.5, 0.5);
        iconNode.setPosition(0, 0, 0);
        return iconNode;
    }

    private ensureHorseIconNode() {
        if (!this.nodeHorseIcon) {
            this.nodeHorseIcon = this.node.getChildByName("HorseIcon");
            if (!this.nodeHorseIcon) {
                this.nodeHorseIcon = this.createHorseIconNode();
            }
        } else if (this.nodeHorseIcon.parent !== this.node) {
            const existingNode = this.node.getChildByName("HorseIcon");
            this.nodeHorseIcon = existingNode || this.createHorseIconNode();
        }
    }

    private setupHorseIconComponents() {
        this.horseIconLabel = this.nodeHorseIcon.getComponent(Label);
        if (!this.horseIconLabel) {
            this.horseIconLabel = this.nodeHorseIcon.addComponent(Label);
        }

        if (!this.nodeHorseIcon.getComponent(Sprite)) {
            this.nodeHorseIcon.addComponent(Sprite);
        }
    }

    private initializeHorse() {
        this.setupHorseTransform();
        this.ensureHorseIconNode();
        this.setupHorseIconComponents();

        // Add Button component to HorseIcon for click events
        let iconButton = this.nodeHorseIcon.getComponent(Button);
        if (!iconButton) {
            iconButton = this.nodeHorseIcon.addComponent(Button);
        }

        // Set up click event handler
        iconButton.node.on(Button.EventType.CLICK, this.onHorseIconClick, this);

        // Hide horse by default - will be shown when initial position is set
        this.node.active = false;
        if (this.nodeHorseIcon) {
            this.nodeHorseIcon.active = false;
        }

        // Update visual state
        this.updateVisualState();
    }

    /**
     * Extract the last number from a horse ID
     * Example: "BASE_1_HORSE_1" -> "1"
     */
    private extractHorseNumber(horseID?: string): string | null {
        if (!horseID) {
            return null;
        }
        // Match the last number in the horse ID (e.g., "1" from "BASE_1_HORSE_1")
        const match = horseID.match(/_(\d+)$/);
        return match ? match[1] : null;
    }

    /**
     * Update the visual state of the horse
     */
    public updateVisualState() {
        // Update horse icon
        this.updateHorseIcon();

        // Update animations
        this.updateAnimations();
    }

    /**
     * Get index for base color in sprite frames array
     * Mapping: YELLOW -> 0, GREEN -> 1, BLUE -> 2, RED -> 3
     */
    private getBaseColorIndex(baseColor: BaseColor): number {
        const colorIndexMap: { [key in BaseColor]: number } = {
            YELLOW: 0,
            GREEN: 1,
            BLUE: 2,
            RED: 3,
        };
        return colorIndexMap[baseColor] ?? 0;
    }

    /**
     * Update the sprite frame of the HorseIcon node based on base color
     */
    private updateHorseIconSpriteFrame() {
        if (!this.nodeHorseIcon) {
            return;
        }

        // Get or add Sprite component to HorseIcon node
        let iconSprite = this.nodeHorseIcon.getComponent(Sprite);
        if (!iconSprite) {
            this.nodeHorseIcon.addComponent(Sprite);
            iconSprite = this.nodeHorseIcon.getComponent(Sprite);
        }

        // Use HorseSpriteFrames array if available
        if (this.HorseSpriteFrames && this.HorseSpriteFrames.length > 0) {
            const colorIndex = this.getBaseColorIndex(this.baseColor);
            if (colorIndex >= 0 && colorIndex < this.HorseSpriteFrames.length && this.HorseSpriteFrames[colorIndex]) {
                iconSprite.spriteFrame = this.HorseSpriteFrames[colorIndex];
                return;
            }
        }
    }

    /**
     * Update the horse icon (Unicode character)
     */
    private updateHorseIcon() {
        if (!this.nodeHorseIcon) {
            return;
        }

        // Update sprite frame first
        this.updateHorseIconSpriteFrame();

        // Note: Sprite color is not set here as sprites are used for rendering
        // The sprite frame should already contain the correct visual representation

        // Update label if it exists
        if (!this.horseIconLabel) {
            this.horseIconLabel = this.nodeHorseIcon.getComponent(Label);
        }

        if (this.horseIconLabel) {
            // Set Unicode character
            this.horseIconLabel.string = this.HORSE_UNICODE;

            // Note: Label color is not set here as sprites are used for rendering
            // The sprite frame should already contain the correct visual representation

            // Configure label
            this.horseIconLabel.fontSize = Math.floor(this.horseSize * 0.6);
            this.horseIconLabel.fontFamily = "Arial";
            this.horseIconLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            this.horseIconLabel.verticalAlign = Label.VerticalAlign.CENTER;
            this.horseIconLabel.overflow = Label.Overflow.SHRINK;
            (this.horseIconLabel as any)._isSystemFontUsed = true;
            (this.horseIconLabel as any)._font = null;
        }
    }

    /**
     * Update animations based on state
     */
    private updateAnimations() {
        // Ensure animationManager is initialized (onLoad might not have completed yet)
        if (!this.animationManager) {
            this.animationManager = new AnimationManager();
        }

        // Don't override highlight animation if horse is highlighted as possible move
        if (this.isHighlightedAsPossibleMove) {
            return;
        }

        if (this.isFlyingToBase) {
            this.animationManager.playFlyingToBaseAnimation(this.node);
        } else if (this.isJumping) {
            this.animationManager.playJumpingAnimation(this.node);
        } else if (this.isHovered) {
            this.animationManager.playHoveredAnimation(this.node);
        } else {
            this.animationManager.resetScale(this.node);
        }
    }

    /**
     * Set the base color
     */
    public setBaseColor(baseColor: BaseColor) {
        this.baseColor = baseColor;
        this.updateVisualState();
    }

    /**
     * Set the horse size
     */
    public setHorseSize(size: number) {
        this.horseSize = size;
        this.initializeHorse();
    }

    /**
     * Set jumping state
     */
    public setJumping(jumping: boolean) {
        this.isJumping = jumping;
        this.updateAnimations();
    }

    /**
     * Set flying to base state
     */
    public setFlyingToBase(flying: boolean) {
        this.isFlyingToBase = flying;
        this.updateAnimations();
    }

    /**
     * Set hovered state
     */
    public setHovered(hovered: boolean) {
        this.isHovered = hovered;
        this.updateAnimations();
    }

    /**
     * Set horse ID
     */
    public setHorseID(horseID: string) {
        this.horseID = horseID;
        this.updateVisualState();
    }

    /**
     * Find sprite component in the horse nodes
     * @returns Sprite component or null if not found
     */
    private findHorseSprite(): Sprite | null {
        // Try nodeHorseIcon first
        if (this.nodeHorseIcon?.isValid) {
            try {
                const sprite = this.nodeHorseIcon.getComponent(Sprite);
                if (sprite) {
                    return sprite;
                }
            } catch (error) {
                Logger.warn("HorseComponent", `Error getting sprite from nodeHorseIcon: ${error}`);
            }
        }

        // Try main node
        if (this.node?.isValid) {
            try {
                const sprite = this.node.getComponent(Sprite);
                if (sprite) {
                    return sprite;
                }
            } catch (error) {
                Logger.warn("HorseComponent", `Error getting sprite from node: ${error}`);
            }

            // Try child nodes
            try {
                for (const child of this.node.children) {
                    if (child?.isValid) {
                        const sprite = child.getComponent(Sprite);
                        if (sprite) {
                            return sprite;
                        }
                    }
                }
            } catch (error) {
                Logger.warn("HorseComponent", `Error searching for sprite in children: ${error}`);
            }
        }

        return null;
    }

    /**
     * Get the target node for animation (prefers nodeHorseIcon)
     * @returns Target node or null if invalid
     */
    private getAnimationTargetNode(): Node | null {
        if (this.nodeHorseIcon?.isValid) {
            return this.nodeHorseIcon;
        }
        if (this.node?.isValid) {
            return this.node;
        }
        return null;
    }

    /**
     * Stop animations on all horse nodes
     */
    private stopAllHorseAnimations(): void {
        if (!this.animationManager) {
            this.animationManager = new AnimationManager();
        }

        try {
            if (this.node?.isValid) {
                this.animationManager.stopAnimation(this.node);
            }
            if (this.nodeHorseIcon?.isValid) {
                this.animationManager.stopAnimation(this.nodeHorseIcon);
            }
        } catch (error) {
            Logger.warn("HorseComponent", `Error stopping existing animations: ${error}`);
        }
    }

    /**
     * Store original scale of the target node
     * @param targetNode The node to store scale from
     */
    private storeOriginalScale(targetNode: Node): void {
        if (!this.originalHorseIconScale) {
            const currentScale = targetNode.getScale();
            this.originalHorseIconScale = new Vec3(currentScale.x, currentScale.y, currentScale.z);
            Logger.debug(
                "HorseComponent",
                `Stored original scale for horse ${this.horseID}: (${currentScale.x}, ${currentScale.y}, ${currentScale.z})`
            );
        }
    }

    /**
     * Highlight this horse as a possible move candidate
     * Plays a continuous highlight animation
     */
    public highlightAsPossibleMove(): void {
        if (!this.node?.isValid) {
            Logger.warn("HorseComponent", `Cannot highlight: node is invalid for horse ${this.horseID}`);
            return;
        }

        if (!this.animationManager) {
            this.animationManager = new AnimationManager();
        }

        this.isHighlightedAsPossibleMove = true;
        this.stopAllHorseAnimations();

        const sprite = this.findHorseSprite();
        const targetNode = this.getAnimationTargetNode();

        if (!targetNode) {
            Logger.warn("HorseComponent", `Cannot highlight: target node is invalid for horse ${this.horseID}`);
            this.isHighlightedAsPossibleMove = false;
            return;
        }

        this.storeOriginalScale(targetNode);

        try {
            this.animationManager.playCellHighlightAnimation(targetNode, sprite, 0.5, 9999);
            Logger.debug("HorseComponent", `Started highlight animation for horse ${this.horseID} on node ${targetNode.name}`);
        } catch (error) {
            Logger.error("HorseComponent", `Error playing highlight animation: ${error}`);
            this.isHighlightedAsPossibleMove = false;
            this.originalHorseIconScale = null;
        }
    }

    /**
     * Restore original scale to target node
     * @param targetNode The node to restore scale on
     */
    private restoreOriginalScale(targetNode: Node): void {
        if (!this.animationManager) {
            this.animationManager = new AnimationManager();
        }

        try {
            this.animationManager.stopAnimation(targetNode);

            if (this.originalHorseIconScale) {
                targetNode.setScale(this.originalHorseIconScale.x, this.originalHorseIconScale.y, this.originalHorseIconScale.z);
                Logger.debug(
                    "HorseComponent",
                    `Restored original scale for horse ${this.horseID}: (${this.originalHorseIconScale.x}, ${this.originalHorseIconScale.y}, ${this.originalHorseIconScale.z})`
                );
                this.originalHorseIconScale = null;
            } else {
                this.animationManager.resetScale(targetNode);
            }
        } catch (error) {
            Logger.warn("HorseComponent", `Error resetting scale on target node: ${error}`);
        }
    }

    /**
     * Clear highlight animation from this horse
     */
    public clearHighlight(): void {
        this.isHighlightedAsPossibleMove = false;

        if (!this.animationManager) {
            this.animationManager = new AnimationManager();
        }

        this.stopAllHorseAnimations();

        const targetNode = this.getAnimationTargetNode();
        if (targetNode) {
            this.restoreOriginalScale(targetNode);
        }

        try {
            this.updateAnimations();
        } catch (error) {
            Logger.warn("HorseComponent", `Error updating animations: ${error}`);
        }

        Logger.debug("HorseComponent", `Cleared highlight animation for horse ${this.horseID}`);
    }

    /** Movement delay between cells in seconds */
    private readonly CELL_MOVE_DELAY: number = 0.1;

    /**
     * Move horse to a specific position index (from game state)
     * Moves cell by cell through the path
     * @param positionIndex Position index from game state (0 = base, >0 = cell index)
     * @param onComplete Optional callback when movement completes
     */
    private moveToBase(onComplete?: () => void) {
        if (!this.horseID) {
            Logger.warn("HorseComponent", "Cannot move to base: horseID is not set");
            if (onComplete) {
                onComplete();
            }
            return;
        }
        const horseData = gameDataService.getHorse(this.horseID);
        horseData.isSpawned = false;
        horseData.cellID = null;
        horseData.position = null;
        horseData.steps = 0;
        horseData.isRetired = false;

        this.node.active = true;
        if (this.nodeHorseIcon) {
            this.nodeHorseIcon.active = true;
        }
        this.updateVisualState();
        this.updateBasePlaceholder();

        Logger.debug("HorseComponent", `Horse ${this.horseID} moved to base (keeping visible)`);
        if (onComplete) {
            onComplete();
        }
    }

    private buildPathFromBase(horseData: Horse, spawnCell: Cell, targetCell: Cell): Cell[] {
        if (spawnCell.cellID === targetCell.cellID) {
            return [spawnCell];
        }

        const pathFromSpawn = this.pathfindingService.findPath(spawnCell.cellID, targetCell.cellID, horseData.baseID);
        return pathFromSpawn.length > 0 ? pathFromSpawn : [spawnCell, targetCell];
    }

    private buildPathFromCurrentPosition(horseData: Horse, targetCell: Cell): Cell[] {
        if (!horseData.cellID) {
            return [];
        }

        const pathFromCurrent = this.pathfindingService.findPath(horseData.cellID, targetCell.cellID, horseData.baseID);

        if (pathFromCurrent.length > 0) {
            if (pathFromCurrent[0].cellID === horseData.cellID) {
                return pathFromCurrent.slice(1);
            }
            return pathFromCurrent;
        }

        return this.buildPathStepByStep(horseData.cellID, targetCell.cellID, horseData.baseID);
    }

    private buildMovementPath(horseData: Horse, targetCell: Cell): Cell[] {
        if (!horseData.cellID || !horseData.isSpawned) {
            const spawnCell = gameDataService.findSpawnCellForBase(horseData.baseID);
            if (!spawnCell) {
                Logger.warn("HorseComponent", `Spawn cell not found for base ${horseData.baseID}`);
                return [];
            }
            return this.buildPathFromBase(horseData, spawnCell, targetCell);
        }

        return this.buildPathFromCurrentPosition(horseData, targetCell);
    }

    public moveToPositionIndex(positionIndex: number, onComplete?: () => void) {
        if (!this.horseID) {
            Logger.warn("HorseComponent", `Cannot move: horseID is not set`);
            if (onComplete) {
                onComplete();
            }
            return;
        }

        const horseData = gameDataService.getHorse(this.horseID);
        if (!horseData) {
            Logger.warn("HorseComponent", `Horse data not found for ${this.horseID}`);
            if (onComplete) {
                onComplete();
            }
            return;
        }

        Logger.debug("HorseComponent", `Moving ${this.horseID} to position index ${positionIndex}`);

        if (positionIndex === 0) {
            this.moveToBase(onComplete);
            return;
        }

        const targetCell = this.findCellByIndex(positionIndex);
        if (!targetCell) {
            Logger.warn("HorseComponent", `Cell not found for index ${positionIndex} (horse: ${this.horseID})`);
            if (onComplete) {
                onComplete();
            }
            return;
        }

        Logger.debug("HorseComponent", `Found cell ${targetCell.cellID} at ${targetCell.position} for index ${positionIndex}`);

        if (horseData.cellID === targetCell.cellID && horseData.position === targetCell.position) {
            Logger.debug("HorseComponent", `Horse ${this.horseID} already at position ${positionIndex} (${targetCell.cellID})`);
            if (onComplete) {
                onComplete();
            }
            return;
        }

        this.node.active = true;

        const path = this.buildMovementPath(horseData, targetCell);

        if (path.length === 0) {
            Logger.warn("HorseComponent", `No path found to ${targetCell.cellID}, moving directly`);
            this.executeMove(targetCell, () => {
                horseData.steps = positionIndex;
                if (onComplete) {
                    onComplete();
                }
            });
            return;
        }

        Logger.debug(
            "HorseComponent",
            `Found path with ${path.length} cells for ${this.horseID}: ${path.map((c) => c.cellID).join(" -> ")}`
        );

        this.moveThroughPath(path, 0, positionIndex, onComplete);
    }

    /**
     * Build path step by step using findNextCell (fallback method)
     */
    private buildPathStepByStep(sourceCellID: string, targetCellID: string, baseID: string): Cell[] {
        const path: Cell[] = [];
        const visited = new Set<string>();
        let currentCellID = sourceCellID;
        const maxSteps = 200; // Prevent infinite loops
        let steps = 0;

        while (currentCellID !== targetCellID && steps < maxSteps) {
            if (visited.has(currentCellID)) {
                // Circular path detected
                break;
            }
            visited.add(currentCellID);

            const currentCell = gameDataService.getCell(currentCellID);
            if (!currentCell) {
                break;
            }

            // Don't add source cell to path
            if (currentCellID !== sourceCellID) {
                path.push(currentCell);
            }

            // Find next cell
            const nextCell = this.pathfindingService.findNextCell(currentCellID, baseID);
            if (!nextCell) {
                break;
            }

            currentCellID = nextCell.cellID;
            steps++;
        }

        // Add target cell if we reached it
        if (currentCellID === targetCellID) {
            const targetCell = gameDataService.getCell(targetCellID);
            if (targetCell) {
                path.push(targetCell);
            }
        }

        return path;
    }

    /**
     * Move horse through a path cell by cell
     * @param path Array of cells to move through
     * @param currentIndex Current index in the path
     * @param targetSteps Target steps value to set after movement
     * @param onComplete Callback when all movement completes
     */
    private moveThroughPath(path: Cell[], currentIndex: number, targetSteps: number, onComplete?: () => void) {
        if (currentIndex >= path.length) {
            // Path complete
            const horseData = gameDataService.getHorse(this.horseID);
            if (horseData) {
                horseData.steps = targetSteps;
            }
            Logger.debug("HorseComponent", `Path movement completed for ${this.horseID}, steps: ${targetSteps}`);
            if (onComplete) {
                onComplete();
            }
            return;
        }

        const currentCell = path[currentIndex];
        const isLastCell = currentIndex === path.length - 1;

        // Execute move to current cell
        this.executeMove(currentCell, () => {
            if (isLastCell) {
                // Last cell reached
                const horseData = gameDataService.getHorse(this.horseID);
                if (horseData) {
                    horseData.steps = targetSteps;
                }
                Logger.debug("HorseComponent", `Path movement completed for ${this.horseID} at ${currentCell.cellID}`);
                if (onComplete) {
                    onComplete();
                }
            } else {
                // Move to next cell after delay
                this.scheduleOnce(() => {
                    this.moveThroughPath(path, currentIndex + 1, targetSteps, onComplete);
                }, this.CELL_MOVE_DELAY);
            }
        });
    }

    /**
     * Find cell by index number
     */
    private findCellByIndex(index: number): Cell | null {
        for (const position in gameBoardData.cells) {
            const positionCells = gameBoardData.cells[position];
            for (const cellID in positionCells) {
                const cell = positionCells[cellID];
                if (cell.index === index) {
                    Logger.debug("HorseComponent", `Found cell ${cellID} (index ${index}) at ${position}`);
                    return cell;
                }
            }
        }
        Logger.warn("HorseComponent", `Cell with index ${index} not found in gameBoardData`);
        return null;
    }

    /**
     * Set horse position instantly without animation (for initial state setup)
     * @param positionIndex Position index from game state (0 = base, >0 = cell index)
     */
    public setPositionIndexInstantly(positionIndex: number): void {
        if (!this.horseID) {
            Logger.warn("HorseComponent", `Cannot set position: horseID is not set`);
            return;
        }

        const horseData = gameDataService.getHorse(this.horseID);
        if (!horseData) {
            Logger.warn("HorseComponent", `Horse data not found for ${this.horseID}`);
            return;
        }

        Logger.debug("HorseComponent", `Setting ${this.horseID} to position index ${positionIndex} instantly`);

        if (positionIndex === 0) {
            // Horse should be in base (not spawned)
            horseData.isSpawned = false;
            horseData.cellID = null;
            horseData.position = null;
            horseData.steps = 0;
            horseData.isRetired = false;

            this.node.active = true;
            if (this.nodeHorseIcon) {
                this.nodeHorseIcon.active = true;
            }
            this.updateVisualState();
            this.updateBasePlaceholder();

            Logger.debug("HorseComponent", `Horse ${this.horseID} set to base instantly`);
            return;
        }

        // Find target cell by index
        const targetCell = this.findCellByIndex(positionIndex);
        if (!targetCell) {
            Logger.warn("HorseComponent", `Cell not found for index ${positionIndex} (horse: ${this.horseID})`);
            return;
        }

        Logger.debug("HorseComponent", `Found cell ${targetCell.cellID} at ${targetCell.position} for index ${positionIndex}`);

        this.node.active = true;
        if (this.nodeHorseIcon) {
            this.nodeHorseIcon.active = true;
        }

        // Update horse data directly
        horseData.cellID = targetCell.cellID;
        horseData.position = targetCell.position;
        horseData.isSpawned = true;
        horseData.steps = positionIndex;

        // Set position instantly without animation
        const targetPosition = this.findCellNodePosition(targetCell.cellID);
        if (targetPosition) {
            // Reparent to top layer if needed
            this.reparentToTopLayer();
            this.ensureRenderOnTop();

            // Convert to local position and set directly
            const localTargetPos = this.convertToLocalPosition(targetPosition);
            if (this.nodeHorseIcon) {
                this.nodeHorseIcon.active = true;
                this.nodeHorseIcon.setPosition(localTargetPos);
            }
        } else {
            Logger.warn("HorseComponent", `Cell node not found in scene for ${targetCell.cellID}`);
        }

        // Update visual state
        this.updateVisualState();

        Logger.debug("HorseComponent", `Horse ${this.horseID} set to position ${positionIndex} (${targetCell.cellID}) instantly`);
    }

    /**
     * Update base placeholder to reflect horse state
     * Finds the base component and triggers placeholder update
     */
    private updateBasePlaceholder(): void {
        if (!this.horseID) {
            return;
        }

        const horseData = gameDataService.getHorse(this.horseID);
        if (!horseData || !horseData.baseID) {
            return;
        }

        // Find base component in the scene
        const scene = this.node.scene;
        if (!scene) {
            return;
        }

        const findBaseComponent = (node: Node): BaseComponent | null => {
            const baseComponent = node.getComponent(BaseComponent);
            if (baseComponent && baseComponent.baseID === horseData.baseID) {
                return baseComponent;
            }
            for (const child of node.children) {
                const found = findBaseComponent(child);
                if (found) {
                    return found;
                }
            }
            return null;
        };

        const baseComponent = findBaseComponent(scene);
        if (baseComponent) {
            // Trigger base component to refresh placeholders
            // updateVisualState() will call updateHorsePlaceholders() which checks horse.isSpawned
            baseComponent.updateVisualState();
            Logger.debug("HorseComponent", `Triggered base component update for ${horseData.baseID}`);
        }
    }

    /**
     * Get the horse number from the horse ID
     */
    public getHorseNumber(): string | null {
        return this.extractHorseNumber(this.horseID);
    }

    /**
     * Handle click on HorseIcon - move horse to SPAWN cell or next cell in walkway
     */
    private onHorseIconClick() {
        Logger.debug("HorseComponent", `Horse clicked: ${this.horseID}, baseColor: ${this.baseColor}`);

        const horseData = gameDataService.getHorse(this.horseID);
        if (!horseData) {
            Logger.warn("HorseComponent", `Horse data not found for ${this.horseID}`);
            return;
        }

        const bases = gameDataService.getBases();
        const base = bases.find((b) => b.color === this.baseColor);
        const baseID = base ? base.ID : horseData.baseID;

        if (!baseID) {
            Logger.warn("HorseComponent", `Base ID not found for horse ${this.horseID}`);
            return;
        }

        // Check if horse is already spawned (in a walkway cell)
        if (horseData.isSpawned && horseData.cellID) {
            this.moveToNextCell(horseData.cellID, baseID);
        } else {
            this.moveToSpawnCell(baseID);
        }
    }

    /**
     * Move horse to next cell
     */
    private moveToNextCell(currentCellID: string, baseID: string) {
        const nextCell = this.pathfindingService.findNextCell(currentCellID, baseID);
        if (!nextCell) {
            Logger.warn("HorseComponent", `No next cell found for ${currentCellID}`);
            return;
        }

        Logger.debug("HorseComponent", `Moving to next cell: ${nextCell.cellID}`);
        this.executeMove(nextCell);
    }

    /**
     * Move horse to spawn cell
     */
    private moveToSpawnCell(baseID: string) {
        const spawnCell = gameDataService.findSpawnCellForBase(baseID);
        if (!spawnCell) {
            Logger.warn("HorseComponent", `SPAWN cell not found for base ${baseID}`);
            return;
        }

        Logger.debug("HorseComponent", `Found SPAWN cell: ${spawnCell.cellID} for base ${baseID}`);
        this.executeMove(spawnCell);
    }

    /**
     * Execute movement to target cell
     */
    private executeMove(targetCell: Cell, onComplete?: () => void) {
        const targetPosition = this.findCellNodePosition(targetCell.cellID);
        if (!targetPosition) {
            Logger.warn("HorseComponent", `Cell node not found in scene for ${targetCell.cellID}`);
            return;
        }

        // Find horses that will be kicked BEFORE moving (capture the list)
        const horsesToKick = this.findHorsesAtCell(targetCell);

        // Move horse to target position using tween
        this.moveHorseToPosition(targetPosition, () => {
            // Update horse data after movement completes (occupy the cell)
            this.updateHorseDataAfterMove(targetCell);

            // Trigger blink animation on the target cell
            this.triggerCellBlinkAnimation(targetCell.cellID);

            // Now kick the horses that were at this cell (after occupying it)
            this.kickHorses(horsesToKick, targetCell, () => {
                if (onComplete) {
                    onComplete();
                }
            });
        });
    }

    /**
     * Find horses at a specific cell (before moving to it)
     * @param targetCell The target cell to check
     * @returns Array of horse data for horses at this cell
     */
    private findHorsesAtCell(targetCell: Cell): Horse[] {
        // Find horses at this cell by checking all horses' cellID property
        // This is more reliable than checking cell.horseIDs which might not be updated in real-time
        const allHorses = gameDataService.getBases().flatMap((base) => gameDataService.getHorsesForBase(base.ID));
        return allHorses.filter((horse) => horse.cellID === targetCell.cellID && horse.isSpawned && horse.horseID !== this.horseID);
    }

    /**
     * Kick horses that were at a cell (called after the moving horse has occupied the cell)
     * @param horsesToKick Array of horse data to kick
     * @param targetCell The target cell (for logging)
     * @param onComplete Callback when kicking is complete (or if no horse to kick)
     */
    private kickHorses(horsesToKick: Horse[], targetCell: Cell, onComplete?: () => void) {
        if (horsesToKick.length === 0) {
            // No horses to kick
            if (onComplete) {
                onComplete();
            }
            return;
        }

        // Kick all horses that were at this cell (usually just one)
        let kickCount = 0;
        const totalKicks = horsesToKick.length;

        for (const horseData of horsesToKick) {
            const kickedHorseComponent = this.findHorseComponentByID(horseData.horseID);
            if (kickedHorseComponent) {
                Logger.debug("HorseComponent", `Kicking horse ${horseData.horseID} from cell ${targetCell.cellID}`);
                kickedHorseComponent.kickToBase(() => {
                    kickCount++;
                    if (kickCount >= totalKicks) {
                        // All horses have been kicked
                        if (onComplete) {
                            onComplete();
                        }
                    }
                });
            } else {
                // Horse component not found, just update data
                Logger.debug("HorseComponent", `Horse component not found for ${horseData.horseID}, updating data only`);
                this.updateHorseDataToBase(horseData);
                kickCount++;
                if (kickCount >= totalKicks) {
                    if (onComplete) {
                        onComplete();
                    }
                }
            }
        }
    }

    /**
     * Find HorseComponent by horseID in the scene
     * @param horseID The horse ID to find
     * @returns HorseComponent instance or null if not found
     */
    private findHorseComponentByID(horseID: string): HorseComponent | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const findHorseComponent = (node: Node): HorseComponent | null => {
            const horseComponent = node.getComponent(HorseComponent);
            if (horseComponent && horseComponent.horseID === horseID) {
                return horseComponent;
            }
            for (const child of node.children) {
                const found = findHorseComponent(child);
                if (found) {
                    return found;
                }
            }
            return null;
        };

        return findHorseComponent(scene);
    }

    /**
     * Kick this horse to base with flying animation
     * @param onComplete Callback when kick animation completes
     */
    public kickToBase(onComplete?: () => void) {
        if (!this.horseID) {
            Logger.warn("HorseComponent", "Cannot kick to base: horseID is not set");
            if (onComplete) {
                onComplete();
            }
            return;
        }

        const horseData = gameDataService.getHorse(this.horseID);
        if (!horseData) {
            Logger.warn("HorseComponent", `Horse data not found for ${this.horseID}`);
            if (onComplete) {
                onComplete();
            }
            return;
        }

        Logger.debug("HorseComponent", `Kicking horse ${this.horseID} to base`);

        // Set flying animation
        this.setFlyingToBase(true);

        // Find base position for flying animation
        const base = gameDataService.getBase(horseData.baseID);
        if (!base) {
            Logger.warn("HorseComponent", `Base not found for ${horseData.baseID}`);
            // Still update data even if base not found
            this.updateHorseDataToBase(horseData);
            this.setFlyingToBase(false);
            if (onComplete) {
                onComplete();
            }
            return;
        }

        // Find base component to get base position
        const baseComponent = this.findBaseComponent(horseData.baseID);
        if (baseComponent) {
            const baseNode = baseComponent.node;
            const baseWorldPos = new Vec3();
            baseNode.getWorldPosition(baseWorldPos);
            baseWorldPos.y += 12; // Add offset for horse positioning

            // Fly to base position
            this.moveHorseToPosition(baseWorldPos, () => {
                // Update horse data after flying completes
                this.updateHorseDataToBase(horseData);
                this.setFlyingToBase(false);
                this.updateBasePlaceholder();

                Logger.debug("HorseComponent", `Horse ${this.horseID} kicked to base`);
                if (onComplete) {
                    onComplete();
                }
            });
        } else {
            // Base component not found, just update data
            this.updateHorseDataToBase(horseData);
            this.setFlyingToBase(false);
            this.updateBasePlaceholder();
            if (onComplete) {
                onComplete();
            }
        }
    }

    /**
     * Update horse data to base state
     * @param horseData The horse data to update
     */
    private updateHorseDataToBase(horseData: Horse) {
        horseData.isSpawned = false;
        horseData.cellID = null;
        horseData.position = null;
        horseData.steps = 0;
        horseData.isRetired = false;
    }

    /**
     * Find BaseComponent by baseID in the scene
     * @param baseID The base ID to find
     * @returns BaseComponent instance or null if not found
     */
    private findBaseComponent(baseID: string): BaseComponent | null {
        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const findBase = (node: Node): BaseComponent | null => {
            const baseComponent = node.getComponent(BaseComponent);
            if (baseComponent && baseComponent.baseID === baseID) {
                return baseComponent;
            }
            for (const child of node.children) {
                const found = findBase(child);
                if (found) {
                    return found;
                }
            }
            return null;
        };

        return findBase(scene);
    }

    /**
     * Update horse data after movement completes
     */
    private updateHorseDataAfterMove(targetCell: Cell) {
        const horseData = gameDataService.getHorse(this.horseID);
        if (!horseData) {
            Logger.warn("HorseComponent", `Horse data not found for ${this.horseID}`);
            return;
        }

        horseData.cellID = targetCell.cellID;
        horseData.position = targetCell.position;
        horseData.isSpawned = true;
        horseData.steps += 1;

        Logger.debug("HorseComponent", `Updated horse ${this.horseID} to cell ${targetCell.cellID}, steps: ${horseData.steps}`);
    }

    /**
     * Find cell node position in the scene by searching WalkwayComponents
     */
    /**
     * Find all WalkwayComponents in the scene
     * @returns Array of WalkwayComponent instances
     */
    private findAllWalkwayComponents(): WalkwayComponent[] {
        const scene = this.node.scene;
        if (!scene) {
            return [];
        }

        const walkwayComponents: WalkwayComponent[] = [];
        const findWalkways = (node: Node) => {
            const walkway = node.getComponent(WalkwayComponent);
            if (walkway) {
                walkwayComponents.push(walkway);
            }
            for (const child of node.children) {
                findWalkways(child);
            }
        };

        findWalkways(scene);
        return walkwayComponents;
    }

    private findCellNodePosition(cellID: string): Vec3 | null {
        const walkwayComponents = this.findAllWalkwayComponents();

        if (walkwayComponents.length === 0) {
            Logger.warn("HorseComponent", "No WalkwayComponents found in scene");
            return null;
        }

        for (const walkway of walkwayComponents) {
            const cellNode = walkway.getCellNode(cellID);
            if (cellNode) {
                // Get the CellComponent to access the target node based on cell type
                const cellComponent = cellNode.getComponent(CellComponent);
                const worldPos = new Vec3();
                if (cellComponent) {
                    // Get the appropriate target node based on cell type
                    const targetNode = cellComponent.getTargetNode();

                    targetNode.getWorldPosition(worldPos);
                } else {
                    // Fallback to cell node if CellComponent not found
                    cellNode.getWorldPosition(worldPos);
                }
                // Add +5 to Y position for horse positioning

                // Add +5 to Y position for horse positioning
                worldPos.y += 12;
                return worldPos;
            }
        }

        return null;
    }

    /**
     * Trigger blink animation on the target cell
     * @param cellID Cell ID to trigger blink animation on
     */
    private triggerCellBlinkAnimation(cellID: string): void {
        const walkwayComponents = this.findAllWalkwayComponents();

        // Find the cell component and trigger blink animation
        for (const walkway of walkwayComponents) {
            const cellNode = walkway.getCellNode(cellID);
            if (cellNode) {
                const cellComponent = cellNode.getComponent(CellComponent);
                if (cellComponent) {
                    cellComponent.playBlinkAnimation();
                    return;
                }
            }
        }
    }

    /**
     * Move horse icon to target position using tween animation
     * @param targetPosition Target world position to move to
     * @param onComplete Optional callback when movement completes
     */
    private moveHorseToPosition(targetPosition: Vec3, onComplete?: () => void) {
        if (!this.nodeHorseIcon) {
            return;
        }

        // Ensure animationManager is initialized
        if (!this.animationManager) {
            this.animationManager = new AnimationManager();
        }

        // Ensure horse icon is active
        this.nodeHorseIcon.active = true;

        this.animationManager.stopAnimation(this.nodeHorseIcon);
        this.reparentToTopLayer();
        this.ensureRenderOnTop();

        const startPos = new Vec3();
        this.nodeHorseIcon.getPosition(startPos);

        const localTargetPos = this.convertToLocalPosition(targetPosition);

        this.animationManager.playMovementAnimation(this.nodeHorseIcon, startPos, localTargetPos, onComplete);
    }

    /**
     * Recursively find a node by name in the scene tree
     * @param parent Parent node to search from
     * @param name Name of the node to find
     * @returns Found node or null
     */
    private findNodeRecursive(parent: Node, name: string): Node | null {
        if (!parent) {
            return null;
        }

        // Check current node
        if (parent.name === name) {
            return parent;
        }

        // Search children recursively
        for (const child of parent.children) {
            const found = this.findNodeRecursive(child, name);
            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * Get or find the top layer node (game-board-prefab)
     * Caches the result for reuse
     */
    private getTopLayer(): Node | null {
        // Return cached value if available
        if (this.cachedTopLayer && this.cachedTopLayer.isValid) {
            return this.cachedTopLayer;
        }

        // Find recursively if not cached
        const scene = this.node.scene;
        if (!scene) {
            Logger.warn("HorseComponent", "Scene not available");
            return null;
        }

        this.cachedTopLayer = this.findNodeRecursive(scene, "game-board-prefab");

        if (!this.cachedTopLayer) {
            Logger.warn("HorseComponent", "game-board-prefab not found in scene");
            return null;
        }

        return this.cachedTopLayer;
    }

    /**
     * Reparent HorseIcon to top layer for rendering on top
     */
    private reparentToTopLayer(): void {
        if (!this.nodeHorseIcon) {
            return;
        }

        const topLayer = this.getTopLayer();
        if (!topLayer) {
            return;
        }

        if (topLayer === this.nodeHorseIcon.parent) {
            return;
        }

        const worldPos = new Vec3();
        this.nodeHorseIcon.getWorldPosition(worldPos);

        topLayer.addChild(this.nodeHorseIcon);

        const localPos = new Vec3();
        topLayer.inverseTransformPoint(localPos, worldPos);
        localPos.z = CELL_CONFIG.TOP_LAYER_Z_INDEX;
        this.nodeHorseIcon.setPosition(localPos);
    }

    /**
     * Ensure HorseIcon renders on top by moving to end of parent's children
     */
    private ensureRenderOnTop(): void {
        if (!this.nodeHorseIcon?.parent) {
            return;
        }

        const parent = this.nodeHorseIcon.parent;
        parent.removeChild(this.nodeHorseIcon);
        parent.addChild(this.nodeHorseIcon);
    }

    /**
     * Convert world position to local position relative to HorseIcon's parent
     */
    private convertToLocalPosition(worldPos: Vec3): Vec3 {
        const localPos = new Vec3();
        this.nodeHorseIcon.parent?.inverseTransformPoint(localPos, worldPos);
        localPos.z = CELL_CONFIG.TOP_LAYER_Z_INDEX;
        return localPos;
    }

    onDestroy() {
        // Remove click event listener
        if (this.nodeHorseIcon) {
            const iconButton = this.nodeHorseIcon.getComponent(Button);
            if (iconButton) {
                iconButton.node.off(Button.EventType.CLICK, this.onHorseIconClick, this);
            }
        }

        // Stop any running animations
        if (this.animationManager) {
            this.animationManager.stopAnimation(this.node);
            if (this.nodeHorseIcon) {
                this.animationManager.stopAnimation(this.nodeHorseIcon);
            }
        }
    }
}
