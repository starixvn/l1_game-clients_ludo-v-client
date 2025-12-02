/**
 * Horse Animation Handler
 * 
 * Utility class for managing horse animations and highlighting
 */

import { Node, Sprite, Vec3 } from "cc";
import { AnimationManager } from "../services/animation-manager";
import { Logger } from "./logger";

export class HorseAnimationHandler {
    private readonly animationManager: AnimationManager;
    private originalHorseIconScale: Vec3 | null = null;

    constructor() {
        this.animationManager = new AnimationManager();
    }

    /**
     * Try to get sprite component from a node
     */
    private tryGetSpriteFromNode(node: Node | null, nodeName: string): Sprite | null {
        if (!node?.isValid) {
            return null;
        }

        try {
            const sprite = node.getComponent(Sprite);
            return sprite || null;
        } catch (error) {
            Logger.warn("HorseAnimationHandler", `Error getting sprite from ${nodeName}: ${error}`);
            return null;
        }
    }

    /**
     * Try to find sprite in child nodes
     */
    private tryFindSpriteInChildren(parentNode: Node): Sprite | null {
        try {
            for (const child of parentNode.children) {
                if (child?.isValid) {
                    const sprite = child.getComponent(Sprite);
                    if (sprite) {
                        return sprite;
                    }
                }
            }
        } catch (error) {
            Logger.warn("HorseAnimationHandler", `Error searching for sprite in children: ${error}`);
        }
        return null;
    }

    /**
     * Find sprite component in the horse nodes
     */
    findHorseSprite(mainNode: Node, nodeHorseIcon: Node): Sprite | null {
        // Try nodeHorseIcon first
        const iconSprite = this.tryGetSpriteFromNode(nodeHorseIcon, "nodeHorseIcon");
        if (iconSprite) {
            return iconSprite;
        }

        // Try main node
        if (mainNode?.isValid) {
            const nodeSprite = this.tryGetSpriteFromNode(mainNode, "node");
            if (nodeSprite) {
                return nodeSprite;
            }

            // Try child nodes
            const childSprite = this.tryFindSpriteInChildren(mainNode);
            if (childSprite) {
                return childSprite;
            }
        }

        return null;
    }

    /**
     * Get the target node for animation (prefers nodeHorseIcon)
     */
    getAnimationTargetNode(mainNode: Node, nodeHorseIcon: Node): Node | null {
        if (nodeHorseIcon?.isValid) {
            return nodeHorseIcon;
        }
        if (mainNode?.isValid) {
            return mainNode;
        }
        return null;
    }

    /**
     * Stop animations on all horse nodes
     */
    stopAllHorseAnimations(mainNode: Node, nodeHorseIcon: Node): void {
        try {
            if (mainNode?.isValid) {
                this.animationManager.stopAnimation(mainNode);
            }
            if (nodeHorseIcon?.isValid) {
                this.animationManager.stopAnimation(nodeHorseIcon);
            }
        } catch (error) {
            Logger.warn("HorseAnimationHandler", `Error stopping existing animations: ${error}`);
        }
    }

    /**
     * Store original scale of the target node
     */
    storeOriginalScale(targetNode: Node, horseID: string): void {
        if (!this.originalHorseIconScale) {
            const currentScale = targetNode.getScale();
            this.originalHorseIconScale = new Vec3(currentScale.x, currentScale.y, currentScale.z);
            Logger.debug(
                "HorseAnimationHandler",
                `Stored original scale for horse ${horseID}: (${currentScale.x}, ${currentScale.y}, ${currentScale.z})`
            );
        }
    }

    /**
     * Restore original scale to target node
     */
    restoreOriginalScale(targetNode: Node, horseID: string): void {
        try {
            this.animationManager.stopAnimation(targetNode);

            if (this.originalHorseIconScale) {
                targetNode.setScale(
                    this.originalHorseIconScale.x,
                    this.originalHorseIconScale.y,
                    this.originalHorseIconScale.z
                );
                Logger.debug(
                    "HorseAnimationHandler",
                    `Restored original scale for horse ${horseID}: (${this.originalHorseIconScale.x}, ${this.originalHorseIconScale.y}, ${this.originalHorseIconScale.z})`
                );
                this.originalHorseIconScale = null;
            } else {
                this.animationManager.resetScale(targetNode);
            }
        } catch (error) {
            Logger.warn("HorseAnimationHandler", `Error resetting scale on target node: ${error}`);
        }
    }

    /**
     * Highlight this horse as a possible move candidate
     */
    highlightAsPossibleMove(
        mainNode: Node,
        nodeHorseIcon: Node,
        horseID: string,
        onHighlighted?: () => void
    ): boolean {
        if (!mainNode?.isValid) {
            Logger.warn("HorseAnimationHandler", `Cannot highlight: node is invalid for horse ${horseID}`);
            return false;
        }

        this.stopAllHorseAnimations(mainNode, nodeHorseIcon);

        const sprite = this.findHorseSprite(mainNode, nodeHorseIcon);
        const targetNode = this.getAnimationTargetNode(mainNode, nodeHorseIcon);

        if (!targetNode) {
            Logger.warn("HorseAnimationHandler", `Cannot highlight: target node is invalid for horse ${horseID}`);
            return false;
        }

        this.storeOriginalScale(targetNode, horseID);

        try {
            this.animationManager.playCellHighlightAnimation(targetNode, sprite, 0.5, 9999);
            Logger.debug("HorseAnimationHandler", `Started highlight animation for horse ${horseID} on node ${targetNode.name}`);
            if (onHighlighted) {
                onHighlighted();
            }
            return true;
        } catch (error) {
            Logger.error("HorseAnimationHandler", `Error playing highlight animation: ${error}`);
            this.originalHorseIconScale = null;
            return false;
        }
    }

    /**
     * Clear highlight animation
     */
    clearHighlight(mainNode: Node, nodeHorseIcon: Node, horseID: string): void {
        this.stopAllHorseAnimations(mainNode, nodeHorseIcon);

        const targetNode = this.getAnimationTargetNode(mainNode, nodeHorseIcon);
        if (targetNode) {
            this.restoreOriginalScale(targetNode, horseID);
        }

        Logger.debug("HorseAnimationHandler", `Cleared highlight animation for horse ${horseID}`);
    }

    /**
     * Update animations based on state
     */
    updateAnimations(
        mainNode: Node,
        isFlyingToBase: boolean,
        isJumping: boolean,
        isHovered: boolean,
        isHighlighted: boolean,
        onJump?: () => void
    ): void {
        // Don't override highlight animation if horse is highlighted as possible move
        if (isHighlighted) {
            return;
        }

        if (isFlyingToBase) {
            this.animationManager.playFlyingToBaseAnimation(mainNode);
        } else if (isJumping) {
            if (onJump) {
                onJump();
            }
            this.animationManager.playJumpingAnimation(mainNode);
        } else if (isHovered) {
            this.animationManager.playHoveredAnimation(mainNode);
        } else {
            this.animationManager.resetScale(mainNode);
        }
    }

    /**
     * Play movement animation
     */
    playMovementAnimation(nodeHorseIcon: Node, startPos: Vec3, targetPos: Vec3, onComplete?: () => void): void {
        this.animationManager.stopAnimation(nodeHorseIcon);
        this.animationManager.playMovementAnimation(nodeHorseIcon, startPos, targetPos, onComplete);
    }

    /**
     * Stop animation on a node
     */
    stopAnimation(node: Node): void {
        this.animationManager.stopAnimation(node);
    }
}

