/**
 * Horse Node Positioning Utility
 *
 * Utility functions for managing horse node positioning and reparenting
 */

import { Node, Vec3 } from "cc";
import { CELL_CONFIG } from "./cell-config";
import { Logger } from "./logger";

export class HorseNodePositioning {
    private cachedTopLayer: Node | null = null;

    /**
     * Recursively find a node by name in the scene tree
     * @param parent Parent node to search from
     * @param name Name of the node to find
     * @returns Found node or null
     */
    findNodeRecursive(parent: Node, name: string): Node | null {
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
    getTopLayer(scene: Node): Node | null {
        // Return cached value if available
        if (this.cachedTopLayer && this.cachedTopLayer.isValid) {
            return this.cachedTopLayer;
        }

        // Find recursively if not cached
        if (!scene) {
            Logger.warn("HorseNodePositioning", "Scene not available");
            return null;
        }

        this.cachedTopLayer = this.findNodeRecursive(scene, "game-board-prefab");

        if (!this.cachedTopLayer) {
            Logger.warn("HorseNodePositioning", "game-board-prefab not found in scene");
            return null;
        }

        return this.cachedTopLayer;
    }

    /**
     * Reparent HorseIcon to top layer for rendering on top
     */
    reparentToTopLayer(nodeHorseIcon: Node, scene: Node): void {
        if (!nodeHorseIcon) {
            return;
        }

        const topLayer = this.getTopLayer(scene);
        if (!topLayer) {
            return;
        }

        if (topLayer === nodeHorseIcon.parent) {
            return;
        }

        const worldPos = new Vec3();
        nodeHorseIcon.getWorldPosition(worldPos);

        const localPos = new Vec3();
        topLayer.inverseTransformPoint(localPos, worldPos);
        localPos.z = CELL_CONFIG.TOP_LAYER_Z_INDEX;
        nodeHorseIcon.setPosition(localPos);
        topLayer.addChild(nodeHorseIcon);
    }

    /**
     * Ensure HorseIcon renders on top by moving to end of parent's children
     */
    ensureRenderOnTop(nodeHorseIcon: Node): void {
        if (!nodeHorseIcon?.parent) {
            return;
        }

        const parent = nodeHorseIcon.parent;
        parent.removeChild(nodeHorseIcon);
        parent.addChild(nodeHorseIcon);
    }

    /**
     * Convert world position to local position relative to HorseIcon's parent
     */
    convertToLocalPosition(nodeHorseIcon: Node, worldPos: Vec3): Vec3 {
        const localPos = new Vec3();
        nodeHorseIcon.parent?.inverseTransformPoint(localPos, worldPos);
        localPos.z = CELL_CONFIG.TOP_LAYER_Z_INDEX;
        return localPos;
    }
}
