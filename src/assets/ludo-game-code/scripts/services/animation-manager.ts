/**
 * Animation Manager
 *
 * Handles all animation logic for game components.
 * Extracted to follow Single Responsibility Principle.
 */

import { tween, Vec3, Node, Sprite, Color, UITransform, instantiate } from "cc";
import { ANIMATION_CONFIG } from "../utils/cell-config";
import { Logger } from "../utils/logger";

/**
 * Constants for border light animation
 */
const BORDER_LIGHT_CONFIG = {
    DEFAULT_CELL_SIZE: 80,
    DEFAULT_LIGHT_SIZE: 20,
    NUMBER_OF_LIGHTS: 2,
    ROTATION_DURATION: 2.0, // seconds for one full rotation
    LIGHT_COLOR: new Color(255, 255, 150, 255), // Bright yellow/white
} as const;

/**
 * Animation types
 */
export enum AnimationType {
    FLYING_TO_BASE = "flyingToBase",
    JUMPING = "jumping",
    HOVERED = "hovered",
    MOVEMENT = "movement",
}

/**
 * Animation configuration
 */
export interface AnimationConfig {
    duration?: number;
    easing?: string;
    scale?: Vec3;
    position?: Vec3;
}

/**
 * Animation Manager for handling component animations
 */
export class AnimationManager {
    private readonly activeTweens: Map<Node, any> = new Map();
    private readonly activeBorderLights: Map<Node, Node[]> = new Map();

    /**
     * Stop animation for a node
     */
    stopAnimation(node: Node): void {
        const tween = this.activeTweens.get(node);
        if (tween) {
            tween.stop();
            this.activeTweens.delete(node);
        }
        // Clean up border light
        this.stopBorderLight(node);
    }

    /**
     * Stop border light animation
     */
    private stopBorderLight(node: Node): void {
        const lightNodes = this.activeBorderLights.get(node);
        if (lightNodes && lightNodes.length > 0) {
            lightNodes.forEach((lightNode) => {
                // Stop any tween associated with the light node
                const lightTween = this.activeTweens.get(lightNode);
                if (lightTween) {
                    lightTween.stop();
                    this.activeTweens.delete(lightNode);
                }
                // Deactivate the light node when animation stops
                if (lightNode.isValid) {
                    lightNode.active = false;
                    lightNode.destroy();
                }
            });
            this.activeBorderLights.delete(node);
        }
    }

    /**
     * Stop all animations
     */
    stopAllAnimations(): void {
        this.activeTweens.forEach((tween, node) => {
            tween.stop();
        });
        this.activeTweens.clear();

        // Clean up all border lights
        this.activeBorderLights.forEach((lightNode, node) => {
            this.stopBorderLight(node);
        });
    }

    /**
     * Play flying to base animation
     */
    playFlyingToBaseAnimation(node: Node, onComplete?: () => void): void {
        this.stopAnimation(node);

        const animationTween = tween(node)
            .to(0.5, { scale: new Vec3(1.5, 1.5, 1) }, { easing: "sineOut" })
            .to(0.5, { scale: new Vec3(0, 0, 1) }, { easing: "sineIn" })
            .call(() => {
                this.activeTweens.delete(node);
                if (onComplete) {
                    onComplete();
                }
            })
            .start();

        this.activeTweens.set(node, animationTween);
    }

    /**
     * Play jumping animation (bounce loop)
     */
    playJumpingAnimation(node: Node): void {
        this.stopAnimation(node);

        // Reset scale first
        node.setScale(1, 1, 1);

        const animationTween = tween(node)
            .to(0.1, { scale: new Vec3(1.2, 1.2, 1) }, { easing: "sineOut" })
            .to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: "sineIn" })
            .union()
            .repeatForever()
            .start();

        this.activeTweens.set(node, animationTween);
    }

    /**
     * Play hovered animation
     */
    playHoveredAnimation(node: Node): void {
        this.stopAnimation(node);

        const animationTween = tween(node)
            .to(0.2, { scale: new Vec3(1.1, 1.1, 1) }, { easing: "sineOut" })
            .start();

        this.activeTweens.set(node, animationTween);
    }

    /**
     * Play movement animation with jumping motion
     */
    playMovementAnimation(node: Node, startPos: Vec3, targetPos: Vec3, onComplete?: () => void): void {
        this.stopAnimation(node);

        // Calculate jump height (proportional to distance traveled)
        const distance = Vec3.distance(startPos, targetPos);
        const jumpHeight = Math.min(distance * ANIMATION_CONFIG.JUMP_HEIGHT_MULTIPLIER, ANIMATION_CONFIG.MAX_JUMP_HEIGHT);

        // Create jumping animation: move horizontally while jumping vertically
        const midPoint = new Vec3();
        Vec3.lerp(midPoint, startPos, targetPos, 0.5);
        midPoint.y += jumpHeight; // Peak of the jump

        // Animation duration based on distance
        const duration = Math.max(
            ANIMATION_CONFIG.MIN_DURATION,
            Math.min(ANIMATION_CONFIG.MAX_DURATION, distance / ANIMATION_CONFIG.DURATION_DIVISOR)
        );

        // Jump animation: move to midpoint (peak), then to target
        const animationTween = tween(node)
            .to(
                duration / 2,
                {
                    position: midPoint,
                },
                {
                    easing: "sineOut", // Accelerate upward
                }
            )
            .to(
                duration / 2,
                {
                    position: targetPos,
                },
                {
                    easing: "sineIn", // Decelerate downward
                }
            )
            .call(() => {
                this.activeTweens.delete(node);
                if (onComplete) {
                    onComplete();
                }
            })
            .start();

        this.activeTweens.set(node, animationTween);
    }

    /**
     * Reset node scale to default
     */
    resetScale(node: Node): void {
        this.stopAnimation(node);
        node.setScale(1, 1, 1);
    }

    /**
     * Play cell highlight animation with particle effects
     * @param node Cell node to animate
     * @param sprite Sprite component to highlight (optional, will be found if not provided)
     * @param duration Duration of each highlight cycle in seconds (default: 0.2)
     * @param repeatCount Number of times to highlight (default: 3)
     * @param onComplete Optional callback when animation completes
     */
    private findSpriteInNode(node: Node): Sprite | null {
        let sprite = node.getComponent(Sprite);
        if (sprite) {
            return sprite;
        }

        for (const child of node.children) {
            sprite = child.getComponent(Sprite);
            if (sprite) {
                return sprite;
            }
        }
        return null;
    }

    private createHighlightColor(originalColor: Color): Color {
        return new Color(
            Math.min(255, originalColor.r + 100),
            Math.min(255, originalColor.g + 100),
            Math.min(255, originalColor.b + 100),
            originalColor.a
        );
    }

    playCellHighlightAnimation(
        node: Node,
        sprite?: Sprite,
        duration = 0.2,
        repeatCount = 3,
        onComplete?: () => void,
        lightNode?: Node,
        showParticles = false
    ): void {
        this.stopAnimation(node);

        if (!sprite) {
            sprite = this.findSpriteInNode(node);
        }

        const originalColor = sprite ? new Color(sprite.color.r, sprite.color.g, sprite.color.b, sprite.color.a) : null;
        const highlightColor = originalColor ? this.createHighlightColor(originalColor) : null;

        // Create border light effect for possible move cells
        if (showParticles) {
            this.createBorderLightEffect(node, sprite, lightNode);
            // For possible move cells, only show border light, no scale/color animation
            // Store a dummy tween to track this animation
            const dummyTween = tween({}).delay(0).start();
            this.activeTweens.set(node, dummyTween);
            return;
        }

        const animObj = {
            scale: 1.0,
            r: originalColor ? originalColor.r : 0,
            g: originalColor ? originalColor.g : 0,
            b: originalColor ? originalColor.b : 0,
        };

        // Create highlight sequence that updates both scale and color
        const highlightSequence = tween(animObj)
            .to(
                duration,
                {
                    scale: 1.1,
                    r: highlightColor ? highlightColor.r : animObj.r,
                    g: highlightColor ? highlightColor.g : animObj.g,
                    b: highlightColor ? highlightColor.b : animObj.b,
                },
                {
                    onUpdate: () => {
                        node.setScale(animObj.scale, animObj.scale, 1);
                        if (sprite && originalColor) {
                            sprite.color = new Color(animObj.r, animObj.g, animObj.b, originalColor.a);
                        }
                    },
                    easing: "sineOut",
                }
            )
            .to(
                duration,
                {
                    scale: 1.0,
                    r: originalColor ? originalColor.r : animObj.r,
                    g: originalColor ? originalColor.g : animObj.g,
                    b: originalColor ? originalColor.b : animObj.b,
                },
                {
                    onUpdate: () => {
                        node.setScale(animObj.scale, animObj.scale, 1);
                        if (sprite && originalColor) {
                            sprite.color = new Color(animObj.r, animObj.g, animObj.b, originalColor.a);
                        }
                    },
                    easing: "sineIn",
                }
            );

        // Repeat the sequence
        const animationTween = tween(animObj)
            .repeat(repeatCount, highlightSequence)
            .call(() => {
                // Reset to original state
                node.setScale(1, 1, 1);
                if (sprite && originalColor) {
                    sprite.color = originalColor;
                }

                // Stop and remove border light effect (only for non-continuous animations)
                this.stopBorderLight(node);

                this.activeTweens.delete(node);
                if (onComplete) {
                    onComplete();
                }
            })
            .start();

        this.activeTweens.set(node, animationTween);
    }

    /**
     * Create a border light effect that moves around the cell border in a circle
     * @param parentNode Parent node to attach light to
     * @param sprite Sprite component to get dimensions from
     * @param customLightNode Optional custom node for the light (will create a default one if not provided)
     */
    private createBorderLightEffect(parentNode: Node, sprite?: Sprite | null, customLightNode?: Node): void {
        try {
            const radius = this.calculateCellRadius(parentNode, sprite);
            const lightNodes = this.createLightNodes(parentNode, sprite, customLightNode, radius);
            this.positionLightNodes(lightNodes, radius);
            this.activeBorderLights.set(parentNode, lightNodes);
            this.animateBorderLights(lightNodes, radius);
        } catch (error) {
            Logger.error("AnimationManager", "Failed to create border light effect:", error);
        }
    }

    /**
     * Calculate the radius of the cell based on sprite or parent node dimensions
     * @param parentNode Parent node to get dimensions from
     * @param sprite Sprite component to get dimensions from
     * @returns The calculated radius
     */
    private calculateCellRadius(parentNode: Node, sprite?: Sprite | null): number {
        const dimensions = this.getNodeDimensions(parentNode, sprite);
        return Math.max(dimensions.width, dimensions.height) / 2;
    }

    /**
     * Get dimensions from sprite or parent node
     * @param parentNode Parent node to get dimensions from
     * @param sprite Sprite component to get dimensions from
     * @returns Object with width and height
     */
    private getNodeDimensions(parentNode: Node, sprite?: Sprite | null): { width: number; height: number } {
        if (sprite?.node) {
            const transform = sprite.node.getComponent(UITransform);
            if (transform) {
                return { width: transform.width, height: transform.height };
            }
            if (sprite.spriteFrame) {
                return { width: sprite.spriteFrame.width, height: sprite.spriteFrame.height };
            }
        }

        const transform = parentNode?.getComponent(UITransform);
        if (transform) {
            return { width: transform.width, height: transform.height };
        }

        return {
            width: BORDER_LIGHT_CONFIG.DEFAULT_CELL_SIZE,
            height: BORDER_LIGHT_CONFIG.DEFAULT_CELL_SIZE,
        };
    }

    /**
     * Create light nodes for border animation
     * @param parentNode Parent node to attach lights to
     * @param sprite Sprite component for fallback spriteframe
     * @param customLightNode Optional custom node template
     * @param radius Radius for positioning
     * @returns Array of created light nodes
     */
    private createLightNodes(
        parentNode: Node,
        sprite: Sprite | null | undefined,
        customLightNode: Node | undefined,
        radius: number
    ): Node[] {
        const lightNodes: Node[] = [];

        for (let i = 0; i < BORDER_LIGHT_CONFIG.NUMBER_OF_LIGHTS; i++) {
            const lightNode = this.createSingleLightNode(parentNode, sprite, customLightNode, i);
            lightNodes.push(lightNode);
        }

        return lightNodes;
    }

    /**
     * Create a single light node (either custom or default)
     * @param parentNode Parent node to attach to
     * @param sprite Sprite component for fallback spriteframe
     * @param customLightNode Optional custom node template
     * @param index Index of the light node
     * @returns Created light node
     */
    private createSingleLightNode(
        parentNode: Node,
        sprite: Sprite | null | undefined,
        customLightNode: Node | undefined,
        index: number
    ): Node {
        if (customLightNode?.isValid) {
            return this.createCustomLightNode(parentNode, customLightNode, index);
        }
        return this.createDefaultLightNode(parentNode, sprite, index);
    }

    /**
     * Create a custom light node by cloning the provided template
     * @param parentNode Parent node to attach to
     * @param customLightNode Custom node template
     * @param index Index of the light node
     * @returns Cloned light node
     */
    private createCustomLightNode(parentNode: Node, customLightNode: Node, index: number): Node {
        const lightNode = instantiate(customLightNode);
        lightNode.name = `BorderLight_${index}`;
        parentNode.addChild(lightNode);
        lightNode.active = false;
        return lightNode;
    }

    /**
     * Create a default light node with sprite and styling
     * @param parentNode Parent node to attach to
     * @param sprite Sprite component for spriteframe fallback
     * @param index Index of the light node
     * @returns Created default light node
     */
    private createDefaultLightNode(parentNode: Node, sprite: Sprite | null | undefined, index: number): Node {
        const lightNode = new Node(`BorderLight_${index}`);
        parentNode.addChild(lightNode);
        lightNode.active = false;

        this.setupDefaultLightNodeComponents(lightNode, sprite);
        return lightNode;
    }

    /**
     * Setup components for default light node (UITransform and Sprite)
     * @param lightNode Node to setup
     * @param sprite Sprite component for spriteframe fallback
     */
    private setupDefaultLightNodeComponents(lightNode: Node, sprite: Sprite | null | undefined): void {
        const lightTransform = lightNode.addComponent(UITransform);
        lightTransform.setContentSize(BORDER_LIGHT_CONFIG.DEFAULT_LIGHT_SIZE, BORDER_LIGHT_CONFIG.DEFAULT_LIGHT_SIZE);

        const lightSprite = lightNode.addComponent(Sprite);
        this.setLightSpriteFrame(lightSprite, sprite);
        lightSprite.color = BORDER_LIGHT_CONFIG.LIGHT_COLOR.clone();
    }

    /**
     * Set spriteframe for light sprite, using sprite's spriteframe as fallback
     * @param lightSprite Sprite component to set spriteframe on
     * @param sprite Sprite component for fallback spriteframe
     */
    private setLightSpriteFrame(lightSprite: Sprite, sprite: Sprite | null | undefined): void {
        if (sprite?.spriteFrame) {
            lightSprite.spriteFrame = sprite.spriteFrame;
        } else {
            Logger.warn("AnimationManager", "No SpriteFrame available for default border light. Light may not be visible.");
        }
    }

    /**
     * Position light nodes at opposite sides of the circle
     * @param lightNodes Array of light nodes to position
     * @param radius Radius of the circle
     */
    /**
     * Position light nodes at opposite sides of the circle
     * @param lightNodes Array of light nodes to position
     * @param radius Radius of the circle
     */
    private positionLightNodes(lightNodes: Node[], radius: number): void {
        lightNodes.forEach((lightNode, index) => {
            const angle = this.calculateLightStartAngle(index);
            const position = this.calculateCirclePosition(angle, radius);
            lightNode.setPosition(position.x, position.y, 0);
        });
    }

    /**
     * Calculate starting angle for a light node based on its index
     * @param index Index of the light node (0-based)
     * @returns Starting angle in radians
     */
    private calculateLightStartAngle(index: number): number {
        return index * Math.PI; // 0 and π for two lights (180 degrees apart)
    }

    /**
     * Calculate position on circle based on angle and radius
     * @param angle Angle in radians
     * @param radius Radius of the circle
     * @returns Position object with x and y coordinates
     */
    private calculateCirclePosition(angle: number, radius: number): { x: number; y: number } {
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        };
    }

    /**
     * Recursively activate a node and all its children
     * @param node The node to activate
     */
    private activateNodeRecursively(node: Node): void {
        if (node && node.isValid) {
            node.active = true;
            node.children.forEach((child) => {
                this.activateNodeRecursively(child);
            });
        }
    }

    /**
     * Animate multiple light nodes around the border in a circular motion
     * @param lightNodes Array of light nodes to animate
     * @param radius Radius of the circle
     */
    private animateBorderLights(lightNodes: Node[], radius: number): void {
        this.activateLightNodes(lightNodes);
        lightNodes.forEach((lightNode, index) => {
            const startAngle = index * Math.PI;
            this.createLightRotationAnimation(lightNode, startAngle, radius);
        });
    }

    /**
     * Activate all light nodes and their children
     * @param lightNodes Array of light nodes to activate
     */
    private activateLightNodes(lightNodes: Node[]): void {
        lightNodes.forEach((lightNode) => {
            lightNode.active = true;
            this.activateNodeRecursively(lightNode);
        });
    }

    /**
     * Create rotation animation for a single light node
     * @param lightNode Light node to animate
     * @param startAngle Starting angle in radians
     * @param radius Radius of the circle
     */
    private createLightRotationAnimation(lightNode: Node, startAngle: number, radius: number): void {
        const animObj = { angle: startAngle };
        const rotationSequence = this.createRotationSequence(lightNode, animObj, startAngle, radius, BORDER_LIGHT_CONFIG.ROTATION_DURATION);
        const lightTween = tween(animObj).repeatForever(rotationSequence).start();

        this.activeTweens.set(lightNode, lightTween);
    }

    /**
     * Create rotation sequence for light animation
     * @param lightNode Light node being animated
     * @param animObj Animation object tracking angle
     * @param startAngle Starting angle in radians
     * @param radius Radius of the circle
     * @param duration Duration for one full rotation
     * @returns Rotation sequence tween
     */
    private createRotationSequence(lightNode: Node, animObj: { angle: number }, startAngle: number, radius: number, duration: number): any {
        return tween(animObj)
            .to(
                duration,
                { angle: startAngle + Math.PI * 2 },
                {
                    onUpdate: () => this.updateLightPosition(lightNode, animObj.angle, radius),
                    easing: "linear",
                }
            )
            .call(() => {
                animObj.angle = startAngle;
            })
            .union();
    }

    /**
     * Update light node position during animation
     * @param lightNode Light node to update
     * @param angle Current angle in radians
     * @param radius Radius of the circle
     */
    private updateLightPosition(lightNode: Node, angle: number, radius: number): void {
        if (!lightNode?.isValid) {
            return;
        }

        if (!lightNode.active) {
            lightNode.active = true;
        }

        const position = this.calculateCirclePosition(angle, radius);
        lightNode.setPosition(position.x, position.y, 0);
    }
}
