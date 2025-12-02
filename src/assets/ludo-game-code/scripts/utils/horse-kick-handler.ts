/**
 * Horse Kick Handler
 *
 * Utility class for handling horse kick logic
 */

import { Node, Vec3 } from "cc";
import { Cell, Horse } from "../game-board-data";
import { gameDataService } from "../services/game-data-service";
import { BaseComponent } from "../components/base-component";
import { HorseComponent } from "../components/horse-component";
import { Logger } from "./logger";

export class HorseKickHandler {
    /**
     * Find horses at a specific cell (before moving to it)
     */
    findHorsesAtCell(targetCell: Cell, currentHorseID: string): Horse[] {
        // Find horses at this cell by checking all horses' cellID property
        const allHorses = gameDataService.getBases().flatMap((base) => gameDataService.getHorsesForBase(base.ID));
        return allHorses.filter((horse) => horse.cellID === targetCell.cellID && horse.isSpawned && horse.horseID !== currentHorseID);
    }

    /**
     * Update horse data to base state
     */
    updateHorseDataToBase(horseData: Horse): void {
        horseData.isSpawned = false;
        horseData.cellID = null;
        horseData.position = null;
        horseData.steps = 0;
        horseData.isRetired = false;
    }

    /**
     * Find HorseComponent by horseID in the scene
     */
    findHorseComponentByID(scene: Node, horseID: string): HorseComponent | null {
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
     * Find BaseComponent by baseID in the scene
     */
    findBaseComponent(scene: Node, baseID: string): BaseComponent | null {
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
     * Get base position for flying animation
     */
    getBasePosition(scene: Node, baseID: string): Vec3 | null {
        const baseComponent = this.findBaseComponent(scene, baseID);
        if (baseComponent) {
            const baseNode = baseComponent.node;
            const baseWorldPos = new Vec3();
            baseNode.getWorldPosition(baseWorldPos);
            baseWorldPos.y += 12; // Add offset for horse positioning
            return baseWorldPos;
        }
        return null;
    }

    /**
     * Kick horses that were at a cell
     */
    kickHorses(scene: Node, horsesToKick: Horse[], targetCell: Cell, currentHorseID: string, onComplete?: () => void): void {
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
            const kickedHorseComponent = this.findHorseComponentByID(scene, horseData.horseID);
            if (kickedHorseComponent) {
                Logger.debug("HorseKickHandler", `Kicking horse ${horseData.horseID} from cell ${targetCell.cellID}`);
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
                Logger.debug("HorseKickHandler", `Horse component not found for ${horseData.horseID}, updating data only`);
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
}

