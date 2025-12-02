/**
 * Horse Movement Manager
 *
 * Utility class for managing horse movement and pathfinding logic
 */

import { Cell, Horse } from "../game-board-data";
import { gameDataService } from "../services/game-data-service";
import { PathfindingService } from "../services/pathfinding-service";
import { Logger } from "./logger";

export class HorseMovementManager {
    private readonly pathfindingService: PathfindingService;

    constructor(pathfindingService: PathfindingService) {
        this.pathfindingService = pathfindingService;
    }

    /**
     * Build path from base to target cell
     */
    buildPathFromBase(horseData: Horse, spawnCell: Cell, targetCell: Cell): Cell[] {
        if (spawnCell.cellID === targetCell.cellID) {
            return [spawnCell];
        }

        const pathFromSpawn = this.pathfindingService.findPath(spawnCell.cellID, targetCell.cellID, horseData.baseID);
        return pathFromSpawn.length > 0 ? pathFromSpawn : [spawnCell, targetCell];
    }

    /**
     * Build path from current position to target cell
     */
    buildPathFromCurrentPosition(horseData: Horse, targetCell: Cell): Cell[] {
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

    /**
     * Build movement path based on horse's current state
     */
    buildMovementPath(horseData: Horse, targetCell: Cell): Cell[] {
        if (!horseData.cellID || !horseData.isSpawned) {
            const spawnCell = gameDataService.findSpawnCellForBase(horseData.baseID);
            if (!spawnCell) {
                Logger.warn("HorseMovementManager", `Spawn cell not found for base ${horseData.baseID}`);
                return [];
            }
            return this.buildPathFromBase(horseData, spawnCell, targetCell);
        }

        return this.buildPathFromCurrentPosition(horseData, targetCell);
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
}
