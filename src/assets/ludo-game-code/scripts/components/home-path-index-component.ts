/**
 * Home Path Index Component
 *
 * Displays the home path index using SpriteFrames.
 * Gets the home path index from the parent CellComponent and uses it to select
 * the appropriate SpriteFrame from the spriteFrames array.
 */

import { _decorator, Component, Sprite, SpriteFrame } from "cc";
import { CellComponent } from "./cell-component";
import { Logger } from "../utils/logger";
import { GAME_CONSTANTS } from "../game-board-data";

const { ccclass, property, menu } = _decorator;

@ccclass("HomePathIndexComponent")
@menu("LudoGame/HomePathIndexComponent")
export class HomePathIndexComponent extends Component {
    /** Array of sprite frames for home path indices (index 0 = first home path cell, etc.) */
    @property({ type: [SpriteFrame], tooltip: "Sprite frames array for home path indices" })
    spriteFrames: SpriteFrame[] = [];

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
            Logger.warn("HomePathIndexComponent", "Sprite component not found, added one");
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
            Logger.warn("HomePathIndexComponent", "CellComponent not found in parent hierarchy");
        }
    }

    /**
     * Update sprite frame based on home path index
     */
    public updateSpriteFrame() {
        if (!this.sprite) {
            Logger.warn("HomePathIndexComponent", "Sprite component not available");
            return;
        }

        if (!this.cellComponent) {
            this.findCellComponent();
            if (!this.cellComponent) {
                Logger.warn("HomePathIndexComponent", "Cannot update sprite frame: CellComponent not found");
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
            Logger.warn("HomePathIndexComponent", "Home path index is undefined");
            this.node.active = false;
            return;
        }

        // Map home path index to sprite frame index (index 1 -> spriteFrame[0], index 2 -> spriteFrame[1], etc.)
        const spriteFrameIndex = homePathIndex - 1;

        // Check if sprite frames array has enough elements
        if (spriteFrameIndex < 0 || spriteFrameIndex >= this.spriteFrames.length) {
            Logger.warn(
                "HomePathIndexComponent",
                `Home path index ${homePathIndex} (mapped to spriteFrame index ${spriteFrameIndex}) is out of range. SpriteFrames array has ${this.spriteFrames.length} elements`
            );
            this.node.active = false;
            return;
        }

        // Set the sprite frame
        const spriteFrame = this.spriteFrames[spriteFrameIndex];
        if (spriteFrame) {
            this.sprite.spriteFrame = spriteFrame;
            this.node.active = true;
            this.updateRotation(cellData.position);
            Logger.debug(
                "HomePathIndexComponent",
                `Updated sprite frame: homePathIndex ${homePathIndex} -> spriteFrame[${spriteFrameIndex}]`
            );
        } else {
            Logger.warn("HomePathIndexComponent", `SpriteFrame at index ${spriteFrameIndex} is null or undefined`);
            this.node.active = false;
        }
    }

    /**
     * Update node rotation based on cell position
     * @param position Cell position (NORTH, SOUTH, EAST, WEST)
     */
    private updateRotation(position: string) {
        let rotationAngle = 0;

        switch (position) {
            case GAME_CONSTANTS.POSITION_EAST:
                rotationAngle = 90;
                break;
            case GAME_CONSTANTS.POSITION_WEST:
                rotationAngle = -90;
                break;
            case GAME_CONSTANTS.POSITION_NORTH:
                rotationAngle = 180;
                break;
            case GAME_CONSTANTS.POSITION_SOUTH:
                rotationAngle = 0;
                break;
            default:
                rotationAngle = 0;
                break;
        }

        this.node.setRotationFromEuler(0, 0, rotationAngle);
        Logger.debug("HomePathIndexComponent", `Set rotation to ${rotationAngle} degrees for position ${position}`);
    }

    /**
     * Refresh the sprite frame (useful when cell data changes)
     */
    public refresh() {
        this.updateSpriteFrame();
    }
}
