/**
 * Game Runner Component
 *
 * Handles replaying game states from game-state-stub.ts
 * Manages the progression through game states and coordinates horse movements
 */

import { _decorator, Component, Node } from "cc";
import { Logger } from "../utils/logger";
import { GameState } from "../stubs/game-state-stub";
import { HorseComponent } from "./horse-component";
import { gameDataService } from "../services/game-data-service";
import { GameServiceMessage } from "../../../game/scripts/features/game-messages";

const { ccclass, property, menu } = _decorator;

@ccclass("GameRunnerComponent")
@menu("LudoGame/GameRunnerComponent")
export class GameRunnerComponent extends Component {
    /** Player to Base mapping */
    private readonly playerToBaseMap: { [key: number]: string } = {
        0: "BASE_1", // YELLOW
        1: "BASE_3", // BLUE
        2: "BASE_4", // RED
        3: "BASE_2", // GREEN
    };

    /** Map of horseID to HorseComponent for quick lookup */
    private readonly horseComponentsMap: Map<string, HorseComponent> = new Map();

    /** Initial game state to start from (optional) */
    private initialGameState: GameState | null = null;

    /** Whether initial game state has been applied instantly */
    private initialGameStateApplied = false;

    start() {
        // Initialize horse components in start() to ensure scene is fully loaded
        this.initializeHorseComponents();

        // Apply initial state immediately after a short delay to ensure everything is initialized
        this.scheduleOnce(() => {
            this.applyInitialGameState();
        }, 0.2);
    }

    /**
     * Initialize horse components map by searching the scene
     */
    private initializeHorseComponents(): void {
        // Clear existing map
        this.horseComponentsMap.clear();

        const findHorseComponents = (node: Node) => {
            const horseComponent = node.getComponent(HorseComponent);
            if (horseComponent) {
                // Try to get horseID from component property or from horse data
                let horseID = horseComponent.horseID;

                // If horseID is not set, try to find it from the node name or other means
                if (!horseID && node.name) {
                    // Try to extract horseID from node name (e.g., "BASE_1_HORSE_1")
                    const nameMatch = node.name.match(/BASE_\d+_HORSE_\d+/);
                    if (nameMatch) {
                        horseID = nameMatch[0];
                        horseComponent.horseID = horseID;
                    }
                }

                if (horseID) {
                    this.horseComponentsMap.set(horseID, horseComponent);
                    Logger.debug("GameRunnerComponent", `Found horse component: ${horseID} (node: ${node.name})`);
                } else {
                    Logger.warn("GameRunnerComponent", `Found HorseComponent but no horseID (node: ${node.name})`);
                }
            }
            for (const child of node.children) {
                findHorseComponents(child);
            }
        };

        const scene = this.node.scene;
        if (scene) {
            findHorseComponents(scene);
            Logger.debug("GameRunnerComponent", `Initialized ${this.horseComponentsMap.size} horse components`);

            // Log all found horse IDs for debugging
            if (this.horseComponentsMap.size > 0) {
                const horseIDs = Array.from(this.horseComponentsMap.keys());
                Logger.debug("GameRunnerComponent", `Found horse IDs: ${horseIDs.join(", ")}`);
            }
        } else {
            Logger.warn("GameRunnerComponent", "Scene not available for horse component initialization");
        }
    }

    /**
     * Set initial game state from external format
     * @param gameState External game state format with action, nextPlayerColor, etc.
     */
    public setInitialGameState(gameState: GameServiceMessage.BoardState): void {
        // Convert external format to GameState format
        const convertedState: GameState = {
            board: gameState.board,
        };

        this.initialGameState = convertedState;
    }

    /**
     * Apply initial game state immediately (without starting replay)
     * Positions horses instantly without animation
     */
    public applyInitialGameState(): void {
        if (!this.initialGameState) {
            Logger.debug("GameRunnerComponent", "No initial game state set, skipping application");
            return;
        }

        // Retry if horses aren't found yet
        if (this.horseComponentsMap.size === 0) {
            Logger.warn("GameRunnerComponent", "No horse components found, retrying initialization...");
            this.initializeHorseComponents();

            // If still no horses after retry, wait a bit more and try again
            if (this.horseComponentsMap.size === 0) {
                Logger.warn("GameRunnerComponent", "Still no horse components found, will retry in 0.5s");
                this.scheduleOnce(() => {
                    this.applyInitialGameState();
                }, 0.5);
                return;
            }
        }

        Logger.debug(
            "GameRunnerComponent",
            `Applying initial game state immediately (found ${this.horseComponentsMap.size} horse components)`
        );

        let horsesPositioned = 0;
        let horsesNotFound = 0;

        // Apply horse positions
        for (const playerIDStr in this.initialGameState.board) {
            const playerID = parseInt(playerIDStr);
            const baseID = this.playerToBaseMap[playerID];

            if (!baseID) {
                Logger.warn("GameRunnerComponent", `No base mapping found for player ${playerID}`);
                continue;
            }

            const base = gameDataService.getBase(baseID);
            if (!base) {
                Logger.warn("GameRunnerComponent", `Base not found: ${baseID}`);
                continue;
            }

            const horsePositions = this.initialGameState.board[playerIDStr];
            Logger.debug(
                "GameRunnerComponent",
                `Applying initial state - Player ${playerID} (${baseID}): positions [${horsePositions.join(", ")}]`
            );

            // Update each horse for this player
            for (let horseIndex = 0; horseIndex < horsePositions.length; horseIndex++) {
                const positionIndex = horsePositions[horseIndex];
                const horseID = base.horseIDs[horseIndex];

                if (!horseID) {
                    continue;
                }

                const horseComponent = this.horseComponentsMap.get(horseID);
                if (horseComponent) {
                    Logger.debug("GameRunnerComponent", `Positioning horse ${horseID} to position ${positionIndex} instantly`);
                    // Set horse position instantly without animation
                    horseComponent.setPositionIndexInstantly(positionIndex);
                    horsesPositioned++;
                } else {
                    Logger.warn("GameRunnerComponent", `Horse component not found: ${horseID} (player ${playerID}, horse ${horseIndex})`);
                    horsesNotFound++;
                }
            }
        }

        Logger.debug(
            "GameRunnerComponent",
            `Initial game state applied: ${horsesPositioned} horses positioned, ${horsesNotFound} not found`
        );

        // Mark initial state as applied
        this.initialGameStateApplied = true;
    }

    /**
     * Refresh horse components map (useful if horses are added dynamically)
     */
    public refreshHorseComponents(): void {
        this.initializeHorseComponents();
        Logger.debug("GameRunnerComponent", `Refreshed horse components: ${this.horseComponentsMap.size} found`);
    }

    /**
     * Apply game state from external FinishBoardState message
     * @param finishBoardState External game state from FinishBoardState message
     */
    public applyGameState(finishBoardState: GameServiceMessage.BoardState): void {
        // Re-initialize horse components in case they weren't ready before
        if (this.horseComponentsMap.size === 0) {
            this.initializeHorseComponents();
        }

        if (this.horseComponentsMap.size === 0) {
            Logger.error("GameRunnerComponent", "No horse components found! Cannot apply game state.");
            return;
        }

        // Convert external format to internal GameState format
        const gameState = this.convertFinishBoardStateToGameState(finishBoardState);

        // Apply state immediately
        this.applyGameStateAndWait(gameState);
    }

    /**
     * Convert external FinishBoardState to internal GameState format
     */
    private convertFinishBoardStateToGameState(finishBoardState: GameServiceMessage.BoardState): GameState {
        return {
            board: finishBoardState.board, // Dice values not available in external format, will be empty
            currentPlayer: finishBoardState.action.player,
            playerAction: {
                oldPosition: finishBoardState.action.oldPosition,
                newPosition: finishBoardState.action.newPosition,
            },
        };
    }

    /**
     * Apply a game state to update all horses and wait for animations to complete
     */
    private applyGameStateAndWait(gameState: GameState): void {
        Logger.debug("GameRunnerComponent", `Applying state, currentPlayer: ${gameState.currentPlayer}`);

        let horsesUpdated = 0;
        let horsesNotFound = 0;
        const movementPromises: Array<Promise<void>> = [];

        // Update each player's horses
        for (const playerIDStr in gameState.board) {
            const playerID = parseInt(playerIDStr);
            const baseID = this.playerToBaseMap[playerID];

            if (!baseID) {
                Logger.warn("GameRunnerComponent", `No base mapping found for player ${playerID}`);
                continue;
            }

            const base = gameDataService.getBase(baseID);
            if (!base) {
                Logger.warn("GameRunnerComponent", `Base not found: ${baseID}`);
                continue;
            }

            const horsePositions = gameState.board[playerIDStr];
            Logger.debug("GameRunnerComponent", `Player ${playerID} (${baseID}): positions [${horsePositions.join(", ")}]`);

            // Update each horse for this player
            for (let horseIndex = 0; horseIndex < horsePositions.length; horseIndex++) {
                const positionIndex = horsePositions[horseIndex];
                const horseID = base.horseIDs[horseIndex];

                if (!horseID) {
                    continue;
                }

                const horseComponent = this.horseComponentsMap.get(horseID);
                if (horseComponent) {
                    // Create a promise that resolves when horse movement completes
                    const movementPromise = new Promise<void>((resolve) => {
                        Logger.debug("GameRunnerComponent", `Moving horse ${horseID} to position ${positionIndex}`);
                        horseComponent.moveToPositionIndex(positionIndex, () => {
                            Logger.debug("GameRunnerComponent", `Horse ${horseID} completed movement to position ${positionIndex}`);
                            resolve();
                        });
                    });
                    movementPromises.push(movementPromise);
                    horsesUpdated++;
                } else {
                    Logger.warn("GameRunnerComponent", `Horse component not found: ${horseID} (player ${playerID}, horse ${horseIndex})`);
                    horsesNotFound++;
                }
            }
        }

        Logger.debug("GameRunnerComponent", `State applied: ${horsesUpdated} horses updated, ${horsesNotFound} not found`);

        // Handle kicked player if present
        if (gameState.kickedPlayer) {
            const kickedPlayerID = gameState.kickedPlayer.player;
            const kickedBaseID = this.playerToBaseMap[kickedPlayerID];

            if (kickedBaseID) {
                const kickedBase = gameDataService.getBase(kickedBaseID);
                if (kickedBase) {
                    // Find which horse was at the kicked position
                    const kickedPosition = gameState.kickedPlayer.position;
                    // Reset all horses of kicked player that might have been at that position
                    // This is a simplified approach - you may need to track which specific horse was kicked
                    Logger.debug("GameRunnerComponent", `Player ${kickedPlayerID} had a horse kicked from position ${kickedPosition}`);
                }
            }
        }

        // Wait for all horse movements to complete
        if (movementPromises.length > 0) {
            Promise.all(movementPromises)
                .then(() => {
                    Logger.debug("GameRunnerComponent", "All horse movements completed");
                })
                .catch((error) => {
                    Logger.error("GameRunnerComponent", `Error waiting for horse movements: ${error}`);
                });
        } else {
            // No horses to move
            Logger.debug("GameRunnerComponent", "No horses to move");
        }
    }

    onDestroy() {
        // Cleanup if needed
    }
}
