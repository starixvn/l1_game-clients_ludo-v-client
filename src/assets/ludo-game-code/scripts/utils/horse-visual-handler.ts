/**
 * Horse Visual Handler
 * 
 * Utility class for handling horse visual state, sprite frames, and icon rendering
 */

import { Node, Label, Sprite, SpriteFrame, UITransform } from "cc";
import { BaseColor } from "../game-board-data";

export class HorseVisualHandler {
    private readonly HORSE_UNICODE = "\u265E";

    /**
     * Get index for base color in sprite frames array
     * Mapping: YELLOW -> 0, GREEN -> 1, BLUE -> 2, RED -> 3
     */
    getBaseColorIndex(baseColor: BaseColor): number {
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
    updateHorseIconSpriteFrame(nodeHorseIcon: Node, baseColor: BaseColor, spriteFrames: SpriteFrame[]): void {
        if (!nodeHorseIcon) {
            return;
        }

        // Get or add Sprite component to HorseIcon node
        let iconSprite = nodeHorseIcon.getComponent(Sprite);
        if (!iconSprite) {
            nodeHorseIcon.addComponent(Sprite);
            iconSprite = nodeHorseIcon.getComponent(Sprite);
        }

        // Use sprite frames array if available
        if (spriteFrames && spriteFrames.length > 0) {
            const colorIndex = this.getBaseColorIndex(baseColor);
            if (colorIndex >= 0 && colorIndex < spriteFrames.length && spriteFrames[colorIndex]) {
                iconSprite.spriteFrame = spriteFrames[colorIndex];
                return;
            }
        }
    }

    /**
     * Update the horse icon (Unicode character and label)
     */
    updateHorseIcon(nodeHorseIcon: Node, baseColor: BaseColor, spriteFrames: SpriteFrame[], horseSize: number): void {
        if (!nodeHorseIcon) {
            return;
        }

        // Update sprite frame first
        this.updateHorseIconSpriteFrame(nodeHorseIcon, baseColor, spriteFrames);

        // Update label if it exists
        let horseIconLabel = nodeHorseIcon.getComponent(Label);
        if (!horseIconLabel) {
            horseIconLabel = nodeHorseIcon.getComponent(Label);
        }

        if (horseIconLabel) {
            // Set Unicode character
            horseIconLabel.string = this.HORSE_UNICODE;

            // Configure label
            horseIconLabel.fontSize = Math.floor(horseSize * 0.6);
            horseIconLabel.fontFamily = "Arial";
            horseIconLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
            horseIconLabel.verticalAlign = Label.VerticalAlign.CENTER;
            horseIconLabel.overflow = Label.Overflow.SHRINK;
            (horseIconLabel as any)._isSystemFontUsed = true;
            (horseIconLabel as any)._font = null;
        }
    }

    /**
     * Setup horse transform
     */
    setupHorseTransform(node: Node, horseSize: number): void {
        const transform = node.getComponent(UITransform);
        if (!transform) {
            const newTransform = node.addComponent(UITransform);
            newTransform.setContentSize(horseSize, horseSize);
            newTransform.setAnchorPoint(0.5, 0.5);
        } else {
            transform.setContentSize(horseSize, horseSize);
            transform.setAnchorPoint(0.5, 0.5);
        }
    }

    /**
     * Create horse icon node
     */
    createHorseIconNode(parentNode: Node, horseSize: number): Node {
        const iconNode = new Node("HorseIcon");
        parentNode.addChild(iconNode);
        const iconTransform = iconNode.addComponent(UITransform);
        iconTransform.setContentSize(horseSize * 0.8, horseSize * 0.8);
        iconTransform.setAnchorPoint(0.5, 0.5);
        iconNode.setPosition(0, 0, 0);
        return iconNode;
    }

    /**
     * Setup horse icon components
     */
    setupHorseIconComponents(nodeHorseIcon: Node): Label | null {
        let horseIconLabel = nodeHorseIcon.getComponent(Label);
        if (!horseIconLabel) {
            horseIconLabel = nodeHorseIcon.addComponent(Label);
        }

        if (!nodeHorseIcon.getComponent(Sprite)) {
            nodeHorseIcon.addComponent(Sprite);
        }

        return horseIconLabel;
    }
}

