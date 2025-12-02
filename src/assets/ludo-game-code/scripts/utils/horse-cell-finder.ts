/**
 * Horse Cell Finder
 * 
 * Utility class for finding cells and walkway components in the scene
 */

import { Node, Vec3 } from "cc";
import { Cell, gameBoardData } from "../game-board-data";
import { WalkwayComponent } from "../components/walkway-component";
import { CellComponent } from "../components/cell-component";
import { Logger } from "./logger";

export class HorseCellFinder {
    /**
     * Find cell by index number
     */
    findCellByIndex(index: number): Cell | null {
        for (const position in gameBoardData.cells) {
            const positionCells = gameBoardData.cells[position];
            for (const cellID in positionCells) {
                const cell = positionCells[cellID];
                if (cell.index === index) {
                    Logger.debug("HorseCellFinder", `Found cell ${cellID} (index ${index}) at ${position}`);
                    return cell;
                }
            }
        }
        Logger.warn("HorseCellFinder", `Cell with index ${index} not found in gameBoardData`);
        return null;
    }

    /**
     * Find all WalkwayComponents in the scene
     */
    findAllWalkwayComponents(scene: Node): WalkwayComponent[] {
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

    /**
     * Find cell node position in the scene
     */
    findCellNodePosition(scene: Node, cellID: string): Vec3 | null {
        const walkwayComponents = this.findAllWalkwayComponents(scene);

        if (walkwayComponents.length === 0) {
            Logger.warn("HorseCellFinder", "No WalkwayComponents found in scene");
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
                // Add +12 to Y position for horse positioning
                worldPos.y += 12;
                return worldPos;
            }
        }

        return null;
    }

    /**
     * Trigger blink animation on the target cell
     */
    triggerCellBlinkAnimation(scene: Node, cellID: string): void {
        const walkwayComponents = this.findAllWalkwayComponents(scene);

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
}

