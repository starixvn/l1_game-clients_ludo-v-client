/**
 * Border Light Highlight Component
 *
 * A reusable component that renders animated border lights around any node.
 * Supports both circular and rectangular paths for the lights to follow.
 * The lights move continuously around the node's border.
 */

import { _decorator, Component, Node, Sprite, UITransform, instantiate, tween, Color, Enum, Graphics, SpriteFrame } from "cc";
import { Logger } from "../utils/logger";

const { ccclass, property, menu } = _decorator;

/**
 * Shape type enum for border light path
 */
export enum BorderLightShapeType {
    CIRCLE = "circle",
    RECTANGLE = "rectangle",
}

/**
 * Constants for border light animation
 */
const BORDER_LIGHT_CONFIG = {
    DEFAULT_LIGHT_SIZE: 20,
    NUMBER_OF_LIGHTS: 2,
    ROTATION_DURATION: 2.0, // seconds for one full rotation
    LIGHT_COLOR: new Color(255, 255, 150, 255), // Bright yellow/white
    DEFAULT_NODE_SIZE: 80, // Default size when dimensions cannot be determined
} as const;

@ccclass("BorderLightHighlightComponent")
@menu("LudoGame/BorderLightHighlightComponent")
export class BorderLightHighlightComponent extends Component {
    /** Custom node template for border light (optional, will create default if not provided) */
    @property({ type: Node, tooltip: "Custom node template for border light (optional)" })
    lightNodeTemplate: Node = null;

    /** Number of lights to display around the border (default: 2) */
    @property({ tooltip: "Number of lights to display around the border" })
    numberOfLights: number = BORDER_LIGHT_CONFIG.NUMBER_OF_LIGHTS;

    /** Rotation duration in seconds for one full rotation (default: 2.0) */
    @property({ tooltip: "Rotation duration in seconds for one full rotation" })
    rotationDuration: number = BORDER_LIGHT_CONFIG.ROTATION_DURATION;

    /** Shape type: 'circle' or 'rectangle' (default: 'circle') */
    @property({ type: Enum(BorderLightShapeType), tooltip: "Shape type: 'circle' for circular path, 'rectangle' for rectangular path" })
    shapeType: BorderLightShapeType = BorderLightShapeType.CIRCLE;

    /** Whether the highlight is currently active */
    private isActive = false;

    /** Array of light nodes */
    private lightNodes: Node[] = [];

    /** Map of light nodes to their animation tweens */
    private readonly lightTweens: Map<Node, any> = new Map();

    onLoad() {}

    /**
     * Start the border light highlight animation
     */
    public startHighlight(): void {
        if (this.isActive) {
            Logger.warn("BorderLightHighlightComponent", "Highlight is already active");
            return;
        }

        if (!this.node?.isValid) {
            Logger.warn("BorderLightHighlightComponent", "Node is invalid, cannot start highlight");
            return;
        }

        try {
            const dimensions = this.getNodeDimensions();
            this.initializeHighlight(dimensions);
            this.isActive = true;
            Logger.debug(
                "BorderLightHighlightComponent",
                `Started border light highlight with ${this.lightNodes.length} lights, shape: ${this.shapeType}`
            );
        } catch (error) {
            Logger.error("BorderLightHighlightComponent", `Failed to start highlight: ${error}`, error);
        }
    }

    /**
     * Initialize highlight by creating, positioning, and animating lights
     */
    private initializeHighlight(dimensions: { width: number; height: number }): void {
        this.lightNodes = this.createLightNodes();
        this.positionLightNodes(dimensions);
        this.animateLights(dimensions);
    }

    /**
     * Stop the border light highlight animation
     */
    public stopHighlight(): void {
        if (!this.isActive) {
            return;
        }

        this.stopAllAnimations();
        this.destroyLightNodes();
        this.isActive = false;
        Logger.debug("BorderLightHighlightComponent", "Stopped border light highlight");
    }

    /**
     * Check if highlight is currently active
     */
    public getIsActive(): boolean {
        return this.isActive;
    }

    /**
     * Get node dimensions from UITransform or sprite
     */
    private getNodeDimensions(): { width: number; height: number } {
        const transform = this.node.getComponent(UITransform);
        if (transform) {
            return { width: transform.width, height: transform.height };
        }

        const sprite = this.node.getComponent(Sprite);
        if (sprite?.spriteFrame) {
            return { width: sprite.spriteFrame.width, height: sprite.spriteFrame.height };
        }

        // Try to find sprite in children
        for (const child of this.node.children) {
            const childSprite = child.getComponent(Sprite);
            if (childSprite?.spriteFrame) {
                return {
                    width: childSprite.spriteFrame.width,
                    height: childSprite.spriteFrame.height,
                };
            }
        }

        // Default size if nothing found
        return {
            width: BORDER_LIGHT_CONFIG.DEFAULT_NODE_SIZE,
            height: BORDER_LIGHT_CONFIG.DEFAULT_NODE_SIZE,
        };
    }

    /**
     * Create all light nodes
     */
    private createLightNodes(): Node[] {
        const lightNodes: Node[] = [];

        for (let i = 0; i < this.numberOfLights; i++) {
            const lightNode = this.createSingleLightNode(i);
            lightNodes.push(lightNode);
        }

        return lightNodes;
    }

    /**
     * Create a single light node
     */
    private createSingleLightNode(index: number): Node {
        if (this.lightNodeTemplate?.isValid) {
            return this.createCustomLightNode(index);
        }
        return this.createDefaultLightNode(index);
    }

    /**
     * Create a custom light node by cloning the template
     */
    private createCustomLightNode(index: number): Node {
        const lightNode = instantiate(this.lightNodeTemplate);
        lightNode.name = `BorderLight_${index}`;
        this.node.addChild(lightNode);
        lightNode.active = true;
        return lightNode;
    }

    /**
     * Create a default light node with sprite
     */
    private createDefaultLightNode(index: number): Node {
        const lightNode = new Node(`BorderLight_${index}`);
        this.node.addChild(lightNode);
        lightNode.active = true;

        const transform = lightNode.addComponent(UITransform);
        transform.setContentSize(BORDER_LIGHT_CONFIG.DEFAULT_LIGHT_SIZE, BORDER_LIGHT_CONFIG.DEFAULT_LIGHT_SIZE);

        const sprite = lightNode.addComponent(Sprite);
        const hasSpriteFrame = this.setupDefaultSprite(sprite);

        // If no spriteframe was found, create fallback graphics
        if (!hasSpriteFrame) {
            this.createFallbackGraphics(lightNode);
        }

        return lightNode;
    }

    /**
     * Setup default sprite with color
     * @returns true if spriteframe was found and set, false otherwise
     */
    private setupDefaultSprite(sprite: Sprite): boolean {
        const spriteFrame = this.findSpriteFrameInNodeHierarchy();
        if (!spriteFrame) {
            return false;
        }

        sprite.spriteFrame = spriteFrame;
        sprite.color = BORDER_LIGHT_CONFIG.LIGHT_COLOR.clone();
        return true;
    }

    /**
     * Find spriteframe in node hierarchy (parent or children)
     * @returns SpriteFrame if found, null otherwise
     */
    private findSpriteFrameInNodeHierarchy(): SpriteFrame | null {
        const parentSprite = this.node.getComponent(Sprite);
        if (parentSprite?.spriteFrame) {
            return parentSprite.spriteFrame;
        }

        return this.findSpriteFrameInChildren();
    }

    /**
     * Find spriteframe in child nodes
     * @returns SpriteFrame if found, null otherwise
     */
    private findSpriteFrameInChildren(): SpriteFrame | null {
        for (const child of this.node.children) {
            const childSprite = child.getComponent(Sprite);
            if (childSprite?.spriteFrame) {
                return childSprite.spriteFrame;
            }
        }
        return null;
    }

    /**
     * Create a fallback graphics circle when no spriteframe is available
     */
    private createFallbackGraphics(lightNode: Node): void {
        const graphics = lightNode.addComponent(Graphics);
        const size = BORDER_LIGHT_CONFIG.DEFAULT_LIGHT_SIZE;
        const radius = size / 2;

        graphics.fillColor = BORDER_LIGHT_CONFIG.LIGHT_COLOR.clone();
        graphics.circle(0, 0, radius);
        graphics.fill();
    }

    /**
     * Position light nodes around the border
     */
    private positionLightNodes(dimensions: { width: number; height: number }): void {
        this.lightNodes.forEach((lightNode, index) => {
            const position = this.calculateStartPosition(index, dimensions);
            lightNode.setPosition(position.x, position.y, 0);
        });
    }

    /**
     * Calculate starting position for a light based on its index and shape type
     */
    private calculateStartPosition(index: number, dimensions: { width: number; height: number }): { x: number; y: number } {
        if (this.shapeType === BorderLightShapeType.RECTANGLE) {
            return this.calculateRectangleStartPosition(index, dimensions);
        }
        return this.calculateCircleStartPosition(index, dimensions);
    }

    /**
     * Calculate starting position on circle
     */
    private calculateCircleStartPosition(index: number, dimensions: { width: number; height: number }): { x: number; y: number } {
        const radius = Math.max(dimensions.width, dimensions.height) / 2;
        const angle = (index / this.numberOfLights) * Math.PI * 2;
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        };
    }

    /**
     * Calculate starting position on rectangle perimeter
     */
    private calculateRectangleStartPosition(index: number, dimensions: { width: number; height: number }): { x: number; y: number } {
        const progress = index / this.numberOfLights;
        return this.calculateRectanglePosition(progress, dimensions);
    }

    /**
     * Calculate position on circle based on angle and radius
     */
    private calculateCirclePosition(angle: number, radius: number): { x: number; y: number } {
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        };
    }

    /**
     * Animate all light nodes around the border
     */
    private animateLights(dimensions: { width: number; height: number }): void {
        this.lightNodes.forEach((lightNode, index) => {
            if (this.shapeType === BorderLightShapeType.RECTANGLE) {
                this.createRectangleAnimation(lightNode, index, dimensions);
            } else {
                this.createCircleAnimation(lightNode, index, dimensions);
            }
        });
    }

    /**
     * Create circular rotation animation for a single light node
     */
    private createCircleAnimation(lightNode: Node, index: number, dimensions: { width: number; height: number }): void {
        const radius = Math.max(dimensions.width, dimensions.height) / 2;
        const startAngle = (index / this.numberOfLights) * Math.PI * 2;
        const animObj = { angle: startAngle };
        const rotationSequence = this.createCircleRotationSequence(lightNode, animObj, startAngle, radius);
        const lightTween = tween(animObj).repeatForever(rotationSequence).start();

        this.lightTweens.set(lightNode, lightTween);
    }

    /**
     * Create rectangle perimeter animation for a single light node
     */
    private createRectangleAnimation(lightNode: Node, index: number, dimensions: { width: number; height: number }): void {
        const startProgress = index / this.numberOfLights;
        const animObj = { progress: startProgress };
        const rotationSequence = this.createRectangleRotationSequence(lightNode, animObj, startProgress, dimensions);
        const lightTween = tween(animObj).repeatForever(rotationSequence).start();

        this.lightTweens.set(lightNode, lightTween);
    }

    /**
     * Create rotation sequence for circular path
     */
    private createCircleRotationSequence(lightNode: Node, animObj: { angle: number }, startAngle: number, radius: number): any {
        return tween(animObj)
            .to(
                this.rotationDuration,
                { angle: startAngle - Math.PI * 2 }, // Negative direction for counter-clockwise
                {
                    onUpdate: () => {
                        this.updateCircleLightPosition(lightNode, animObj.angle, radius);
                    },
                    easing: "linear",
                }
            )
            .call(() => {
                animObj.angle = startAngle;
            })
            .union();
    }

    /**
     * Create rotation sequence for rectangle path (counter-clockwise)
     */
    private createRectangleRotationSequence(
        lightNode: Node,
        animObj: { progress: number },
        startProgress: number,
        dimensions: { width: number; height: number }
    ): any {
        return tween(animObj)
            .to(
                this.rotationDuration,
                { progress: startProgress - 1 }, // Negative direction for counter-clockwise
                {
                    onUpdate: () => {
                        this.updateRectangleLightPosition(lightNode, animObj.progress, dimensions);
                    },
                    easing: "linear",
                }
            )
            .call(() => {
                animObj.progress = startProgress;
            })
            .union();
    }

    /**
     * Update light node position during circular animation
     */
    private updateCircleLightPosition(lightNode: Node, angle: number, radius: number): void {
        if (!this.isLightNodeValid(lightNode)) {
            return;
        }

        const position = this.calculateCirclePosition(angle, radius);
        lightNode.setPosition(position.x, position.y, 0);
    }

    /**
     * Update light node position during rectangle animation
     */
    private updateRectangleLightPosition(lightNode: Node, progress: number, dimensions: { width: number; height: number }): void {
        if (!this.isLightNodeValid(lightNode)) {
            return;
        }

        const normalizedProgress = this.normalizeProgress(progress);
        const position = this.calculateRectanglePosition(normalizedProgress, dimensions);
        lightNode.setPosition(position.x, position.y, 0);
    }

    /**
     * Check if light node is valid and active
     */
    private isLightNodeValid(lightNode: Node): boolean {
        if (!lightNode?.isValid) {
            return false;
        }

        if (!lightNode.active) {
            lightNode.active = true;
        }

        return true;
    }

    /**
     * Normalize progress to 0-1 range (handles negative values from counter-clockwise animation)
     */
    private normalizeProgress(progress: number): number {
        let normalized = progress % 1;
        if (normalized < 0) {
            normalized = 1 + normalized; // Convert negative to positive (e.g., -0.2 becomes 0.8)
        }
        return normalized;
    }

    /**
     * Calculate position on rectangle perimeter based on progress (0-1)
     */
    private calculateRectanglePosition(progress: number, dimensions: { width: number; height: number }): { x: number; y: number } {
        const { width, height } = dimensions;
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const perimeter = 2 * (width + height);
        const currentDistance = progress * perimeter;

        // Top edge (left to right)
        if (currentDistance < width) {
            return {
                x: -halfWidth + currentDistance,
                y: halfHeight,
            };
        }
        let remainingDistance = currentDistance - width;

        // Right edge (top to bottom)
        if (remainingDistance < height) {
            return {
                x: halfWidth,
                y: halfHeight - remainingDistance,
            };
        }
        remainingDistance -= height;

        // Bottom edge (right to left)
        if (remainingDistance < width) {
            return {
                x: halfWidth - remainingDistance,
                y: -halfHeight,
            };
        }
        remainingDistance -= width;

        // Left edge (bottom to top)
        return {
            x: -halfWidth,
            y: -halfHeight + remainingDistance,
        };
    }

    /**
     * Stop all light animations
     */
    private stopAllAnimations(): void {
        this.lightTweens.forEach((tween, lightNode) => {
            if (tween) {
                tween.stop();
            }
        });
        this.lightTweens.clear();
    }

    /**
     * Destroy all light nodes
     */
    private destroyLightNodes(): void {
        this.lightNodes.forEach((lightNode) => {
            if (lightNode?.isValid) {
                lightNode.active = false;
                lightNode.destroy();
            }
        });
        this.lightNodes = [];
    }

    onDestroy() {
        this.stopHighlight();
    }
}
