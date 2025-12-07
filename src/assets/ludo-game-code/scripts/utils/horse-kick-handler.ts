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

/**
 * Configuration for triggering kick animation
 */
export interface KickAnimationConfig {
    kickedPlayerInfo: { player: number; position: number; horseIndex: number };
    gameBoard: { [key: string]: number[] };
    playerToBaseMap: { [key: number]: string };
    horseComponentsMap: Map<string, HorseComponent>;
    scheduleCallback: (callback: () => void, delay: number) => void;
    findCellByIndex: (index: number) => Cell | null;
    kickDelay?: number;
}

export class HorseKickHandler {
    /**
     * Calculate kicked player by comparing board states
     * @param previousBoard Previous board state before the move
     * @param newBoard New board state after the move
     * @param action The move action containing oldPosition, newPosition, and player
     * @returns Kicked player info or null if no kick occurred
     */
    calculateKickedPlayer(
        previousBoard: { [key: string]: number[] } | null,
        newBoard: { [key: string]: number[] },
        action: { oldPosition: number; newPosition: number; player: number }
    ): { player: number; position: number; horseIndex: number } | null {
        // If no previous state, can't detect kicks
        if (!previousBoard) {
            return null;
        }

        // If newPosition is 0 (moving to base) or negative, no kick possible
        if (action.newPosition <= 0) {
            return null;
        }

        // For each player (except the current player who moved)
        for (const playerIDStr in previousBoard) {
            const playerID = parseInt(playerIDStr);

            // Skip the player who just moved
            if (playerID === action.player) {
                continue;
            }

            const previousPositions = previousBoard[playerIDStr];
            const newPositions = newBoard[playerIDStr];

            // Safety check
            if (!previousPositions || !newPositions) {
                continue;
            }

            // Check each horse for this player
            for (let horseIndex = 0; horseIndex < previousPositions.length; horseIndex++) {
                const prevPosition = previousPositions[horseIndex];
                const newPosition = newPositions[horseIndex];

                // Kick detected:
                // 1. Horse was at a valid position (> 0)
                // 2. Horse is now at position 0 (base)
                // 3. The previous position matches where the moving horse landed
                if (prevPosition > 0 && newPosition === 0 && prevPosition === action.newPosition) {
                    Logger.debug(
                        "HorseKickHandler",
                        `Kick detected: Player ${playerID} horse ${horseIndex} was kicked from position ${prevPosition}`
                    );
                    return {
                        player: playerID,
                        position: prevPosition,
                        horseIndex: horseIndex,
                    };
                }
            }
        }

        return null; // No kick occurred
    }

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
     * Trigger kick animation for kicked player
     * @param config Configuration object containing all required parameters
     */
    triggerKickAnimation(config: KickAnimationConfig): void {
        const {
            kickedPlayerInfo,
            gameBoard,
            playerToBaseMap,
            horseComponentsMap,
            scheduleCallback,
            findCellByIndex,
            kickDelay = 0.2,
        } = config;

        const kickedPlayerID = kickedPlayerInfo.player;
        const kickedPosition = kickedPlayerInfo.position;
        const kickedBaseID = playerToBaseMap[kickedPlayerID];

        Logger.debug("HorseKickHandler", `Triggering kick animation for player ${kickedPlayerID} from position ${kickedPosition}`);

        if (!kickedBaseID) {
            Logger.warn("HorseKickHandler", `No base mapping found for player ${kickedPlayerID}`);
            return;
        }

        const kickedBase = gameDataService.getBase(kickedBaseID);
        if (!kickedBase) {
            Logger.warn("HorseKickHandler", `Base not found: ${kickedBaseID}`);
            return;
        }

        // Find the cell where the kick happened
        const kickCell = findCellByIndex(kickedPosition);
        if (!kickCell) {
            Logger.warn("HorseKickHandler", `Cell not found for position ${kickedPosition}`);
            return;
        }

        // Find which horse(s) are at position 0 for this player (they were just kicked back)
        const kickedPlayerPositions = gameBoard[kickedPlayerID.toString()];
        if (!kickedPlayerPositions) {
            Logger.warn("HorseKickHandler", `No board positions found for player ${kickedPlayerID}`);
            return;
        }

        for (let horseIndex = 0; horseIndex < kickedPlayerPositions.length; horseIndex++) {
            const currentPos = kickedPlayerPositions[horseIndex];

            // If horse is at position 0, it was just kicked
            if (currentPos === 0) {
                const horseID = kickedBase.horseIDs[horseIndex];
                const horseComponent = horseComponentsMap.get(horseID);

                if (horseComponent) {
                    // Trigger kick animation after a short delay to let the kicking horse settle
                    scheduleCallback(() => {
                        horseComponent.kickToBase();
                        Logger.debug("HorseKickHandler", `Triggered kick animation for horse ${horseID}`);
                    }, kickDelay);
                }
            }
        }
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
