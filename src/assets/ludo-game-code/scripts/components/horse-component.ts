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

import { _decorator, Component, Node, Label, Vec3, Button, SpriteFrame, AudioClip, sp } from "cc";
import { BaseColor, Cell, Horse } from "../game-board-data";
import { CELL_DIMENSION } from "../global-constants";
import { gameDataService } from "../services/game-data-service";
import { PathfindingService } from "../services/pathfinding-service";
import { AnimationManager } from "../services/animation-manager";
import { Logger } from "../utils/logger";
import { BaseComponent } from "./base-component";
import { HorseSoundHandler } from "../utils/horse-sound-handler";
import { HorseMovementHandler } from "../utils/horse-movement-handler";
import { HorseNodePositioning } from "../utils/horse-node-positioning";
import { HorseVisualHandler } from "../utils/horse-visual-handler";
import { HorseAnimationHandler } from "../utils/horse-animation-handler";
import { HorseCellFinder } from "../utils/horse-cell-finder";
import { HorseKickHandler } from "../utils/horse-kick-handler";
import { AnimationUtils } from "../../../../extensions/shared-components/assets/shared/utils";

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

    /** Optional horse ID */
    @property({ type: String, tooltip: "Horse ID (e.g., BASE_1_HORSE_1)" })
    horseID = "";

    /** Array of sprite frames for horses, indexed by base color: [YELLOW, GREEN, BLUE, RED] */
    @property({ type: [SpriteFrame], tooltip: "Horse sprite frames array: [YELLOW, GREEN, BLUE, RED]" })
    HorseSpriteFrames: SpriteFrame[] = [];

    /** Sound effect for jump action */
    @property({ type: AudioClip, tooltip: "Sound effect played when horse jumps" })
    jumpSound: AudioClip = null;

    /** Sound effect for kick action */
    @property({ type: AudioClip, tooltip: "Sound effect played when horse is kicked to base" })
    kickSound: AudioClip = null;

    /** Sound effect for spawn action */
    @property({ type: AudioClip, tooltip: "Sound effect played when horse spawns from base" })
    spawnSound: AudioClip = null;

    /** Sound effect for movement action */
    @property({ type: AudioClip, tooltip: "Sound effect played when horse moves to a cell" })
    moveSound: AudioClip = null;

    /** Spine Skeleton component for horse animations */
    @property({ type: sp.Skeleton, tooltip: "Spine Skeleton component for horse animations" })
    horseSkeleton: sp.Skeleton = null;

    /** Animation name for move action */
    @property({ type: String, tooltip: "Spine animation name for move action" })
    moveAnimationName = "move";

    /** Animation name for kick action */
    @property({ type: String, tooltip: "Spine animation name for kick action" })
    kickAnimationName = "kick";

    /** Animation name for spawn action */
    @property({ type: String, tooltip: "Spine animation name for spawn action" })
    spawnAnimationName = "spawn";

    /** Node for the horse icon (Unicode character) */
    @property({ type: Node, tooltip: "Horse icon label node" })
    nodeHorseIcon: Node = null;

    /** Horse icon label component */
    private horseIconLabel: Label = null;

    /** Pathfinding service instance */
    private pathfindingService: PathfindingService;

    /** Movement handler for pathfinding logic */
    private movementHandler: HorseMovementHandler;

    /** Node positioning utility */
    private nodePositioning: HorseNodePositioning;

    /** Visual handler for visual state */
    private visualHandler: HorseVisualHandler;

    /** Animation handler for animations */
    private animationHandler: HorseAnimationHandler;

    /** Cell finder utility */
    private cellFinder: HorseCellFinder;

    /** Kick handler utility */
    private kickHandler: HorseKickHandler;

    /** Animation manager instance */
    private animationManager: AnimationManager;

    /** Sound handler for handling sound effects */
    private soundHandler: HorseSoundHandler = null;

    /** Flag to track if handlers have been initialized */
    private handlersInitialized = false;

    onLoad() {
        this.pathfindingService = new PathfindingService(gameDataService);
        this.movementHandler = new HorseMovementHandler(this.pathfindingService);
        this.nodePositioning = new HorseNodePositioning();
        this.visualHandler = new HorseVisualHandler();
        this.animationHandler = new HorseAnimationHandler();
        this.cellFinder = new HorseCellFinder();
        this.kickHandler = new HorseKickHandler();
        this.animationManager = new AnimationManager();
        this.initializeHorse();
        // Initialize sound handler after horse is set up
        this.soundHandler = new HorseSoundHandler(this.node, this.horseID);
    }

    /**
     * Initialize the horse component
     */
    private setupHorseTransform() {
        this.visualHandler.setupHorseTransform(this.node, this.horseSize);
    }

    private createHorseIconNode(): Node {
        return this.visualHandler.createHorseIconNode(this.node, this.horseSize);
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
        this.horseIconLabel = this.visualHandler.setupHorseIconComponents(this.nodeHorseIcon);
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
        // Ensure handlers are initialized (may be called before onLoad completes)
        this.ensureHandlersInitialized();

        // Update horse icon
        this.updateHorseIcon();

        // Update animations
        this.updateAnimations();
    }

    /**
     * Ensure all handlers are initialized (lazy initialization for methods called before onLoad)
     * Uses a flag to avoid redundant checks after initialization
     */
    private ensureHandlersInitialized(): void {
        // Early return if already initialized (optimization)
        if (this.handlersInitialized) {
            return;
        }

        // Initialize handlers if not already done
        if (!this.visualHandler) {
            this.visualHandler = new HorseVisualHandler();
        }
        if (!this.animationHandler) {
            this.animationHandler = new HorseAnimationHandler();
        }
        if (!this.cellFinder) {
            this.cellFinder = new HorseCellFinder();
        }
        if (!this.kickHandler) {
            this.kickHandler = new HorseKickHandler();
        }
        if (!this.movementHandler) {
            this.pathfindingService = new PathfindingService(gameDataService);
            this.movementHandler = new HorseMovementHandler(this.pathfindingService);
        }
        if (!this.nodePositioning) {
            this.nodePositioning = new HorseNodePositioning();
        }
        if (!this.animationManager) {
            this.animationManager = new AnimationManager();
        }

        // Mark as initialized after all handlers are set up
        this.handlersInitialized = true;
    }

    /**
     * Update the horse icon (Unicode character)
     */
    private updateHorseIcon() {
        if (!this.nodeHorseIcon) {
            return;
        }

        this.visualHandler.updateHorseIcon(this.nodeHorseIcon, this.baseColor, this.HorseSpriteFrames, this.horseSize);
        this.horseIconLabel = this.nodeHorseIcon.getComponent(Label);
    }

    /**
     * Update animations based on state
     */
    private updateAnimations() {
        this.animationHandler.updateAnimations(
            this.node,
            this.isFlyingToBase,
            this.isJumping,
            this.isHovered,
            this.isHighlightedAsPossibleMove,
            () => this.playJumpSound()
        );
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
        this.ensureHandlersInitialized();
        this.horseSize = size;
        this.initializeHorse();
    }

    /**
     * Set jumping state
     */
    public setJumping(jumping: boolean) {
        this.ensureHandlersInitialized();
        this.isJumping = jumping;
        this.updateAnimations();
    }

    /**
     * Set flying to base state
     */
    public setFlyingToBase(flying: boolean) {
        this.ensureHandlersInitialized();
        this.isFlyingToBase = flying;
        this.updateAnimations();
    }

    /**
     * Set hovered state
     */
    public setHovered(hovered: boolean) {
        this.ensureHandlersInitialized();
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
     * Highlight this horse as a possible move candidate
     * Plays a continuous highlight animation
     */
    public highlightAsPossibleMove(): void {
        this.ensureHandlersInitialized();
        const success = this.animationHandler.highlightAsPossibleMove(this.node, this.nodeHorseIcon, this.horseID, () => {
            this.isHighlightedAsPossibleMove = true;
        });
        if (!success) {
            this.isHighlightedAsPossibleMove = false;
        }
    }

    /**
     * Clear highlight animation from this horse
     */
    public clearHighlight(): void {
        this.isHighlightedAsPossibleMove = false;
        this.ensureHandlersInitialized();
        this.animationHandler.clearHighlight(this.node, this.nodeHorseIcon, this.horseID);
        try {
            this.updateAnimations();
        } catch (error) {
            Logger.warn("HorseComponent", `Error updating animations: ${error}`);
        }
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

    private buildMovementPath(horseData: Horse, targetCell: Cell): Cell[] {
        return this.movementHandler.buildMovementPath(horseData, targetCell);
    }

    public moveToPositionIndex(positionIndex: number, onComplete?: () => void) {
        this.ensureHandlersInitialized();
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
        return this.cellFinder.findCellByIndex(index);
    }

    /**
     * Set horse position instantly without animation (for initial state setup)
     * @param positionIndex Position index from game state (0 = base, >0 = cell index)
     */
    public setPositionIndexInstantly(positionIndex: number): void {
        this.ensureHandlersInitialized();
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
        const targetPosition = this.cellFinder.findCellNodePosition(this.node.scene, targetCell.cellID);
        if (targetPosition) {
            // Reparent to top layer if needed
            this.nodePositioning.reparentToTopLayer(this.nodeHorseIcon, this.node.scene);
            this.nodePositioning.ensureRenderOnTop(this.nodeHorseIcon);

            // Convert to local position and set directly
            const localTargetPos = this.nodePositioning.convertToLocalPosition(this.nodeHorseIcon, targetPosition);
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

        // Play spawn sound effect
        this.playSpawnSound();

        // Play spawn animation (don't wait - let it play while moving)
        this.playSpawnAnimation();

        // Execute move immediately without playing move animation (spawn animation already playing)
        this.executeMove(spawnCell, undefined, true);
    }

    /**
     * Execute movement to target cell
     * @param targetCell Target cell to move to
     * @param onComplete Optional callback when movement completes
     * @param skipMoveAnimation If true, skip playing move animation (e.g., when spawn animation already played)
     */
    private executeMove(targetCell: Cell, onComplete?: () => void, skipMoveAnimation = false) {
        const targetPosition = this.findCellNodePosition(targetCell.cellID);
        if (!targetPosition) {
            Logger.warn("HorseComponent", `Cell node not found in scene for ${targetCell.cellID}`);
            return;
        }

        // Play movement sound effect
        this.playMoveSound();

        // Play move animation only if not skipped (e.g., during spawn, spawn animation already played)
        if (!skipMoveAnimation) {
            this.playMoveAnimation();
        }

        // Find horses that will be kicked BEFORE moving (capture the list)
        const horsesToKick = this.kickHandler.findHorsesAtCell(targetCell, this.horseID);

        // Move horse to target position using tween
        this.moveHorseToPosition(targetPosition, () => {
            // Update horse data after movement completes (occupy the cell)
            this.updateHorseDataAfterMove(targetCell);

            // Trigger blink animation on the target cell
            this.triggerCellBlinkAnimation(targetCell.cellID);

            // Now kick the horses that were at this cell (after occupying it)
            this.kickHandler.kickHorses(this.node.scene, horsesToKick, targetCell, this.horseID, () => {
                if (onComplete) {
                    onComplete();
                }
            });
        });
    }

    /**
     * Kick this horse to base with flying animation
     * @param onComplete Callback when kick animation completes
     */
    public kickToBase(onComplete?: () => void) {
        this.ensureHandlersInitialized();
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

        // Play kick sound effect
        this.playKickSound();

        // Play kick animation
        this.playKickAnimation();

        // Set flying animation
        this.setFlyingToBase(true);

        // Find base position for flying animation
        const baseWorldPos = this.kickHandler.getBasePosition(this.node.scene, horseData.baseID);
        if (baseWorldPos) {
            // Fly to base position
            this.moveHorseToPosition(baseWorldPos, () => {
                // Update horse data after flying completes
                this.kickHandler.updateHorseDataToBase(horseData);
                this.setFlyingToBase(false);
                this.updateBasePlaceholder();

                Logger.debug("HorseComponent", `Horse ${this.horseID} kicked to base`);
                if (onComplete) {
                    onComplete();
                }
            });
        } else {
            // Base not found, just update data
            this.kickHandler.updateHorseDataToBase(horseData);
            this.setFlyingToBase(false);
            this.updateBasePlaceholder();
            if (onComplete) {
                onComplete();
            }
        }
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

    private findCellNodePosition(cellID: string): Vec3 | null {
        return this.cellFinder.findCellNodePosition(this.node.scene, cellID);
    }

    /**
     * Trigger blink animation on the target cell
     * @param cellID Cell ID to trigger blink animation on
     */
    private triggerCellBlinkAnimation(cellID: string): void {
        this.cellFinder.triggerCellBlinkAnimation(this.node.scene, cellID);
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

        // Ensure horse icon is active
        this.nodeHorseIcon.active = true;

        this.animationHandler.stopAnimation(this.nodeHorseIcon);
        this.nodePositioning.reparentToTopLayer(this.nodeHorseIcon, this.node.scene);
        this.nodePositioning.ensureRenderOnTop(this.nodeHorseIcon);

        const startPos = new Vec3();
        this.nodeHorseIcon.getPosition(startPos);

        const localTargetPos = this.nodePositioning.convertToLocalPosition(this.nodeHorseIcon, targetPosition);

        this.animationHandler.playMovementAnimation(this.nodeHorseIcon, startPos, localTargetPos, onComplete);
    }

    /**
     * Set SFX enabled state
     * @param enabled Whether SFX is enabled
     */
    public setSfxEnabled(enabled: boolean): void {
        if (this.soundHandler) {
            this.soundHandler.setSfxEnabled(enabled);
        }
    }

    /**
     * Play jump sound effect
     */
    private playJumpSound(): void {
        if (this.soundHandler) {
            this.soundHandler.playSoundEffect(this.jumpSound, "jump");
        }
    }

    /**
     * Play kick sound effect
     */
    private playKickSound(): void {
        if (this.soundHandler) {
            this.soundHandler.playSoundEffect(this.kickSound, "kick");
        }
    }

    /**
     * Play spawn sound effect
     */
    private playSpawnSound(): void {
        if (this.soundHandler) {
            this.soundHandler.playSoundEffect(this.spawnSound, "spawn");
        }
    }

    /**
     * Play movement sound effect
     */
    private playMoveSound(): void {
        if (this.soundHandler) {
            this.soundHandler.playSoundEffect(this.moveSound, "move");
        }
    }

    /**
     * Play move animation using Spine Skeleton
     */
    private async playMoveAnimation(): Promise<void> {
        if (!this.horseSkeleton || !this.moveAnimationName) {
            return;
        }

        try {
            await AnimationUtils.playSpine(this.horseSkeleton, this.moveAnimationName, false);
            Logger.debug("HorseComponent", `Played move animation for horse ${this.horseID}`);
        } catch (error) {
            Logger.warn("HorseComponent", `Failed to play move animation: ${error}`);
        }
    }

    /**
     * Play kick animation using Spine Skeleton
     */
    private async playKickAnimation(): Promise<void> {
        if (!this.horseSkeleton || !this.kickAnimationName) {
            return;
        }

        try {
            await AnimationUtils.playSpine(this.horseSkeleton, this.kickAnimationName, false);
            Logger.debug("HorseComponent", `Played kick animation for horse ${this.horseID}`);
        } catch (error) {
            Logger.warn("HorseComponent", `Failed to play kick animation: ${error}`);
        }
    }

    /**
     * Play spawn animation using Spine Skeleton
     */
    private async playSpawnAnimation(): Promise<void> {
        if (!this.horseSkeleton || !this.spawnAnimationName) {
            return;
        }

        try {
            await AnimationUtils.playSpine(this.horseSkeleton, this.spawnAnimationName, false);
            Logger.debug("HorseComponent", `Played spawn animation for horse ${this.horseID}`);
        } catch (error) {
            Logger.warn("HorseComponent", `Failed to play spawn animation: ${error}`);
        }
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
        if (this.animationHandler) {
            this.animationHandler.stopAnimation(this.node);
            if (this.nodeHorseIcon) {
                this.animationHandler.stopAnimation(this.nodeHorseIcon);
            }
        }
    }
}
