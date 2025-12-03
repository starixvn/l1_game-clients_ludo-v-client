/**
 * Game Runner Component
 *
 * Handles replaying game states from game-state-stub.ts
 * Manages the progression through game states and coordinates horse movements
 */

import { _decorator, Component, Node, Vec3, UITransform, tween } from "cc";
import { Logger } from "../utils/logger";
import { GameState } from "../stubs/game-state-stub";
import { HorseComponent } from "./horse-component";
import { CellComponent } from "./cell-component";
import { gameDataService } from "../services/game-data-service";
import { gameBoardData, Cell, Horse } from "../game-board-data";
import { GameServiceMessage } from "../../../game/scripts/features/game-messages";
import { BaseComponent } from "./base-component";
import { BaseID } from "../global-constants";

const { ccclass, property, menu } = _decorator;

@ccclass("GameRunnerComponent")
@menu("LudoGame/GameRunnerComponent")
export class GameRunnerComponent extends Component {
    /** Player to Base mapping */
    private readonly playerToBaseMap: { [key: number]: string } = {
        0: BaseID.BASE_1, // YELLOW
        1: BaseID.BASE_3, // BLUE
        2: BaseID.BASE_4, // RED
        3: BaseID.BASE_2, // GREEN
    };

    /** Map of horseID to HorseComponent for quick lookup */
    private readonly horseComponentsMap: Map<string, HorseComponent> = new Map();

    /** Map of cellID to CellComponent for quick lookup */
    private readonly cellComponentsMap: Map<string, CellComponent> = new Map();

    /** Map of baseID to BaseComponent for quick lookup */
    private readonly baseComponentsMap: Map<string, BaseComponent> = new Map();

    /** Reset state constant - all horses at position 0 (in base) */
    public static readonly RESET_STATE: { [key: string]: number[] } = {
        "0": [0, 0, 0, 0], // Player 0: all 4 horses in base
        "1": [0, 0, 0, 0], // Player 1: all 4 horses in base
        "2": [0, 0, 0, 0], // Player 2: all 4 horses in base
        "3": [0, 0, 0, 0], // Player 3: all 4 horses in base
    };

    /** Initial game state to start from (optional) */
    private initialGameState: GameState | null = null;

    /** SFX enabled state (controls horse sound effects) */
    private sfxEnabled = true;

    /** Whether initial game state has been applied instantly */
    private initialGameStateApplied = false;

    /** Current game state tracking - stores the current positions of all horses */
    private currentGameState: { [key: string]: number[] } | null = null;

    start() {
        // Initialize horse components in start() to ensure scene is fully loaded
        this.initializeHorseComponents();
        // Initialize cell components
        this.initializeCellComponents();
        // Initialize base components
        this.initializeBaseComponents();

        // Apply initial state immediately after a short delay to ensure everything is initialized
        this.scheduleOnce(() => {
            this.applyInitialGameState();
        }, 0.2);
    }

    /**
     * Initialize cell components map by searching the scene
     */
    private initializeCellComponents(): void {
        // Clear existing map
        this.cellComponentsMap.clear();

        const findCellComponents = (node: Node) => {
            const cellComponent = node.getComponent(CellComponent);
            if (cellComponent && cellComponent.cellID) {
                this.cellComponentsMap.set(cellComponent.cellID, cellComponent);
                Logger.debug("GameRunnerComponent", `Found cell component: ${cellComponent.cellID} (node: ${node.name})`);
            }
            for (const child of node.children) {
                findCellComponents(child);
            }
        };

        const scene = this.node.scene;
        if (scene) {
            findCellComponents(scene);
            Logger.debug("GameRunnerComponent", `Initialized ${this.cellComponentsMap.size} cell components`);
        } else {
            Logger.warn("GameRunnerComponent", "Scene not available for cell component initialization");
        }
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
                    // Set initial SFX state
                    horseComponent.setSfxEnabled(this.sfxEnabled);
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
    private retryInitializationIfNeeded(): boolean {
        if (this.horseComponentsMap.size === 0) {
            Logger.warn("GameRunnerComponent", "No horse components found, retrying initialization...");
            this.initializeHorseComponents();

            if (this.horseComponentsMap.size === 0) {
                Logger.warn("GameRunnerComponent", "Still no horse components found, will retry in 0.5s");
                this.scheduleOnce(() => {
                    this.applyInitialGameState();
                }, 0.5);
                return false;
            }
        }
        return true;
    }

    private applyHorsePositionsForPlayer(
        playerIDStr: string,
        horsePositions: number[],
        resetState = false,
        currentPositions?: number[]
    ): { positioned: number; notFound: number } {
        const playerID = parseInt(playerIDStr);
        const baseID = this.playerToBaseMap[playerID];
        if (!baseID) {
            Logger.warn("GameRunnerComponent", `No base mapping found for player ${playerID}`);
            return { positioned: 0, notFound: 0 };
        }

        const base = gameDataService.getBase(baseID);
        if (!base) {
            Logger.warn("GameRunnerComponent", `Base not found: ${baseID}`);
            return { positioned: 0, notFound: 0 };
        }

        let positioned = 0;
        let notFound = 0;

        for (let horseIndex = 0; horseIndex < horsePositions.length; horseIndex++) {
            const positionIndex = horsePositions[horseIndex];
            const horseID = base.horseIDs[horseIndex];
            if (!horseID) {
                continue;
            }

            const horseComponent = this.horseComponentsMap.get(horseID);
            if (!horseComponent) {
                Logger.warn("GameRunnerComponent", `Horse component not found: ${horseID}`);
                notFound++;
                continue;
            }

            horseComponent.setPositionIndexInstantly(positionIndex);

            // Animate horse flying to base if resetting from walkway to base
            if (resetState && this.shouldAnimateToBase(currentPositions?.[horseIndex], positionIndex)) {
                this.animateHorseToBase(horseComponent, horseID, baseID, horseIndex);
            }

            positioned++;
        }

        return { positioned, notFound };
    }

    /**
     * Check if horse should animate to base (moving from walkway to base)
     */
    private shouldAnimateToBase(currentPosition: number | undefined, targetPosition: number): boolean {
        return currentPosition !== undefined && currentPosition > 0 && targetPosition === 0;
    }

    /**
     * Animate horse flying back to base
     */
    private animateHorseToBase(horseComponent: HorseComponent, horseID: string, baseID: string, horseIndex: number): void {
        const delay = horseIndex * 0.1;
        this.scheduleOnce(() => {
            if (!horseComponent.node?.scene) {
                Logger.warn("GameRunnerComponent", `Cannot animate horse ${horseID}: node or scene not available`);
                return;
            }

            // Ensure horse data has correct baseID
            const horseData = gameDataService.getHorse(horseID);
            if (horseData && horseData.baseID !== baseID) {
                horseData.baseID = baseID;
            }

            horseComponent.node.active = true;
            horseComponent.kickToBase();
        }, delay);
    }

    public applyInitialGameState(): void {
        if (!this.initialGameState) {
            Logger.debug("GameRunnerComponent", "No initial game state set, skipping application");
            return;
        }

        if (!this.retryInitializationIfNeeded()) {
            return;
        }

        Logger.debug(
            "GameRunnerComponent",
            `Applying initial game state immediately (found ${this.horseComponentsMap.size} horse components)`
        );

        let horsesPositioned = 0;
        let horsesNotFound = 0;

        for (const playerIDStr in this.initialGameState.board) {
            const horsePositions = this.initialGameState.board[playerIDStr];
            const result = this.applyHorsePositionsForPlayer(playerIDStr, horsePositions, false); // No jump animation for initial state
            horsesPositioned += result.positioned;
            horsesNotFound += result.notFound;
        }

        Logger.debug(
            "GameRunnerComponent",
            `Initial game state applied: ${horsesPositioned} horses positioned, ${horsesNotFound} not found`
        );

        // Update current game state tracking after initial state is applied
        this.currentGameState = { ...this.initialGameState.board };

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
     * @returns Promise that resolves when all horse movements are complete
     */
    public applyGameState(finishBoardState: GameServiceMessage.BoardState): Promise<void> {
        // Clear any existing highlights when applying new game state
        this.clearPossibleMoveHighlights();

        // Re-initialize horse components in case they weren't ready before
        if (this.horseComponentsMap.size === 0) {
            this.initializeHorseComponents();
        }

        if (this.horseComponentsMap.size === 0) {
            Logger.error("GameRunnerComponent", "No horse components found! Cannot apply game state.");
            return Promise.resolve();
        }

        // Update current game state tracking
        this.currentGameState = { ...finishBoardState.board };

        // Convert external format to internal GameState format
        const gameState = this.convertFinishBoardStateToGameState(finishBoardState);

        // Apply state immediately and return the promise
        return this.applyGameStateAndWait(gameState);
    }

    /**
     * Finish game with celebration, board cleanup, and next match setup
     * @param boardState Board state with horse positions (defaults to RESET_STATE - all horses in base)
     * @param winningPlayer Optional player index (0-3) who won the game
     * @param nextMatchPlayer Optional player index (0-3) who will start the next match
     * @param durationTime Duration for each phase in seconds (default: 4s for celebration, 3s for cleanup, 3s for next match)
     */
    public finishGame(
        boardState: { [key: string]: number[] } = GameRunnerComponent.RESET_STATE,
        winningPlayer?: number,
        nextMatchPlayer?: number,
        durationTime: { celebration?: number; cleanup?: number; nextMatch?: number } = {}
    ): void {
        const celebrationDuration = durationTime.celebration ?? 4;
        const cleanupDuration = durationTime.cleanup ?? 3;

        Logger.debug(
            "GameRunnerComponent",
            `Finishing game - Winner: ${winningPlayer ?? "none"}, Next match: ${nextMatchPlayer ?? "none"}`
        );

        let currentDelay = 0;

        // Phase 1: Celebrate team win (if winningPlayer provided)
        if (winningPlayer !== undefined && winningPlayer !== null) {
            this.celebrateWin(winningPlayer);
            currentDelay += celebrationDuration;
        }

        // Phase 2: Clean the board - move horses to base
        this.scheduleOnce(() => {
            this.cleanBoard(boardState);
        }, currentDelay);
        currentDelay += cleanupDuration;

        // Phase 3: Decide first team for next match (if nextMatchPlayer provided)
        if (nextMatchPlayer !== undefined && nextMatchPlayer !== null) {
            this.scheduleOnce(() => {
                this.setupNextMatch(nextMatchPlayer);
            }, currentDelay);
        }
    }

    /**
     * Celebrate winning team
     * @param winningPlayer Player index (0-3) who won
     */
    private celebrateWin(winningPlayer: number): void {
        Logger.debug("GameRunnerComponent", `Celebrating win for player ${winningPlayer}`);
        const baseID = this.playerToBaseMap[winningPlayer];
        if (!baseID) {
            Logger.warn("GameRunnerComponent", `No base mapping found for winning player ${winningPlayer}`);
            return;
        }

        const baseComponent = this.findBaseComponent(baseID);
        if (baseComponent) {
            // Highlight winning base
            baseComponent.updateBorderHighlight(winningPlayer);
            // Add celebration animation/effects here
        }
    }

    /**
     * Clean board - move all horses to base
     * @param boardState Target board state (usually all horses at position 0)
     */
    private cleanBoard(boardState: { [key: string]: number[] }): void {
        Logger.debug("GameRunnerComponent", "Cleaning board - moving horses to base");

        this.clearPossibleMoveHighlights();

        if (this.horseComponentsMap.size === 0) {
            this.initializeHorseComponents();
        }

        if (this.horseComponentsMap.size === 0) {
            Logger.error("GameRunnerComponent", "No horse components found! Cannot clean board.");
            return;
        }

        const currentState = this.getCurrentStateFromHorses();
        let horsesPositioned = 0;
        let horsesNotFound = 0;

        for (const playerIDStr in boardState) {
            const result = this.applyHorsePositionsForPlayer(
                playerIDStr,
                boardState[playerIDStr],
                true, // Enable animation for reset state
                currentState[playerIDStr] || [0, 0, 0, 0]
            );
            horsesPositioned += result.positioned;
            horsesNotFound += result.notFound;
        }

        this.currentGameState = { ...boardState };
        Logger.debug("GameRunnerComponent", `Board cleaned: ${horsesPositioned} horses positioned, ${horsesNotFound} not found`);
    }

    /**
     * Setup next match - highlight first player
     * @param nextMatchPlayer Player index (0-3) who will start the next match
     */
    private setupNextMatch(nextMatchPlayer: number): void {
        Logger.debug("GameRunnerComponent", `Setting up next match - first player: ${nextMatchPlayer}`);
        this.updateBaseBorderHighlights(nextMatchPlayer);
        // Add next match setup animation/effects here
    }

    /**
     * Reset game state to a provided state (kept for backward compatibility)
     * @deprecated Use finishGame instead
     * @param boardState Board state with horse positions (defaults to RESET_STATE - all horses in base)
     */
    public resetGameState(boardState: { [key: string]: number[] } = GameRunnerComponent.RESET_STATE): void {
        Logger.warn("GameRunnerComponent", "resetGameState is deprecated, use finishGame instead");
        this.cleanBoard(boardState);
    }

    /**
     * Get current state from horse data (fallback if currentGameState is not available)
     */
    private getCurrentStateFromHorses(): { [key: string]: number[] } {
        // Use tracked state if available
        if (this.currentGameState) {
            return this.currentGameState;
        }

        // Fallback: read from horse data
        const state: { [key: string]: number[] } = {};
        for (let playerID = 0; playerID < 4; playerID++) {
            const baseID = this.playerToBaseMap[playerID];
            if (!baseID) {
                continue;
            }

            const base = gameDataService.getBase(baseID);
            if (!base) {
                continue;
            }

            const positions = base.horseIDs.map((horseID) => {
                const horseData = gameDataService.getHorse(horseID);
                return horseData?.steps || 0;
            });

            state[playerID.toString()] = positions;
        }

        return state;
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
    private createMovementPromise(horseID: string, positionIndex: number, horseComponent: HorseComponent): Promise<void> {
        return new Promise<void>((resolve) => {
            Logger.debug("GameRunnerComponent", `Moving horse ${horseID} to position ${positionIndex}`);
            horseComponent.moveToPositionIndex(positionIndex, () => {
                Logger.debug("GameRunnerComponent", `Horse ${horseID} completed movement to position ${positionIndex}`);
                resolve();
            });
        });
    }

    private processPlayerHorses(
        playerIDStr: string,
        horsePositions: number[],
        movementPromises: Array<Promise<void>>
    ): { updated: number; notFound: number } {
        const playerID = parseInt(playerIDStr);
        const baseID = this.playerToBaseMap[playerID];

        if (!baseID) {
            Logger.warn("GameRunnerComponent", `No base mapping found for player ${playerID}`);
            return { updated: 0, notFound: 0 };
        }

        const base = gameDataService.getBase(baseID);
        if (!base) {
            Logger.warn("GameRunnerComponent", `Base not found: ${baseID}`);
            return { updated: 0, notFound: 0 };
        }

        Logger.debug("GameRunnerComponent", `Player ${playerID} (${baseID}): positions [${horsePositions.join(", ")}]`);

        let updated = 0;
        let notFound = 0;

        for (let horseIndex = 0; horseIndex < horsePositions.length; horseIndex++) {
            const positionIndex = horsePositions[horseIndex];
            const horseID = base.horseIDs[horseIndex];

            if (!horseID) {
                continue;
            }

            const horseComponent = this.horseComponentsMap.get(horseID);
            if (horseComponent) {
                movementPromises.push(this.createMovementPromise(horseID, positionIndex, horseComponent));
                updated++;
            } else {
                Logger.warn("GameRunnerComponent", `Horse component not found: ${horseID} (player ${playerID}, horse ${horseIndex})`);
                notFound++;
            }
        }

        return { updated, notFound };
    }

    private applyGameStateAndWait(gameState: GameState): Promise<void> {
        Logger.debug("GameRunnerComponent", `Applying state, currentPlayer: ${gameState.currentPlayer}`);

        const movementPromises: Array<Promise<void>> = [];
        let horsesUpdated = 0;
        let horsesNotFound = 0;

        for (const playerIDStr in gameState.board) {
            const horsePositions = gameState.board[playerIDStr];
            const result = this.processPlayerHorses(playerIDStr, horsePositions, movementPromises);
            horsesUpdated += result.updated;
            horsesNotFound += result.notFound;
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
            return Promise.all(movementPromises)
                .then(() => {
                    Logger.debug("GameRunnerComponent", "All horse movements completed");
                    // Update current game state tracking after movements complete
                    this.currentGameState = { ...gameState.board };
                })
                .catch((error) => {
                    Logger.error("GameRunnerComponent", `Error waiting for horse movements: ${error}`);
                    // Still update state even if there was an error
                    this.currentGameState = { ...gameState.board };
                    throw error; // Re-throw to maintain promise rejection behavior
                });
        } else {
            // No horses to move, but still update state
            Logger.debug("GameRunnerComponent", "No horses to move");
            this.currentGameState = { ...gameState.board };
            return Promise.resolve();
        }
    }

    /**
     * Handle NextState action to highlight possible move cells
     * @param nextState NextState message containing possible actions
     */
    public handleNextState(nextState: GameServiceMessage.NextState): void {
        if (!nextState.nextAction || !nextState.nextAction.possibleActions) {
            Logger.warn("GameRunnerComponent", "NextState does not contain valid nextAction or possibleActions");
            return;
        }

        // Note: NextState doesn't contain board state, so we don't update currentGameState here
        // The current state should already be tracked from the last applyGameState call

        // Clear previous highlights first
        this.clearPossibleMoveHighlights();

        // Initialize cell components if not already done
        if (this.cellComponentsMap.size === 0) {
            this.initializeCellComponents();
        }

        const possibleActions = nextState.nextAction.possibleActions;
        const nextPlayer = nextState.nextAction.nextPlayer;
        Logger.debug("GameRunnerComponent", `Handling NextState with ${possibleActions.length} possible actions for player ${nextPlayer}`);

        // Get unique new positions to highlight (destination cells)
        const positionsToHighlight = new Set<number>();
        // Get unique old positions to highlight (horses that can move)
        const horsePositionsToHighlight = new Set<number>();

        for (const action of possibleActions) {
            positionsToHighlight.add(action.newPosition);
            // Collect old positions where horses can move from
            if (action.oldPosition !== null && action.oldPosition !== undefined) {
                horsePositionsToHighlight.add(action.oldPosition);
            }
        }

        // Highlight destination cells
        for (const positionIndex of positionsToHighlight) {
            this.highlightCellByIndex(positionIndex);
        }

        // Highlight horses that can move
        for (const positionIndex of horsePositionsToHighlight) {
            this.highlightHorseByPositionIndex(positionIndex, nextPlayer);
        }

        // Update base border highlights based on next player
        this.updateBaseBorderHighlights(nextPlayer);

        Logger.debug(
            "GameRunnerComponent",
            `Highlighted ${positionsToHighlight.size} cells and ${horsePositionsToHighlight.size} horse positions for possible moves`
        );
    }

    /**
     * Highlight a cell by its index
     * @param positionIndex The cell index to highlight
     */
    private highlightCellByIndex(positionIndex: number): void {
        // Find cell by index in gameBoardData
        const cell = this.findCellByIndex(positionIndex);
        if (!cell) {
            Logger.warn("GameRunnerComponent", `Cell with index ${positionIndex} not found`);
            return;
        }

        // Get cell component from map
        const cellComponent = this.cellComponentsMap.get(cell.cellID);
        if (!cellComponent) {
            Logger.warn("GameRunnerComponent", `CellComponent not found for cellID: ${cell.cellID}`);
            return;
        }

        // Use CellComponent's method to handle highlighting based on cell type
        cellComponent.highlightAsPossibleMove();
        Logger.debug("GameRunnerComponent", `Highlighted cell ${cell.cellID} (index ${positionIndex})`);
    }

    /**
     * Find cell by index number
     * @param index The cell index to find
     * @returns Cell data or null if not found
     */
    private findCellByIndex(index: number): Cell | null {
        for (const position in gameBoardData.cells) {
            const positionCells = gameBoardData.cells[position];
            for (const cellID in positionCells) {
                const cell = positionCells[cellID];
                if (cell.index === index) {
                    return cell;
                }
            }
        }
        return null;
    }

    /**
     * Clear all possible move highlights (both cells and horses)
     */
    public clearPossibleMoveHighlights(): void {
        // Initialize cell components if not already done
        if (this.cellComponentsMap.size === 0) {
            this.initializeCellComponents();
        }

        // Clear cell highlights
        let clearedCellCount = 0;
        for (const cellComponent of this.cellComponentsMap.values()) {
            cellComponent.clearHighlight();
            clearedCellCount++;
        }

        // Clear horse highlights
        let clearedHorseCount = 0;
        for (const horseComponent of this.horseComponentsMap.values()) {
            horseComponent.clearHighlight();
            clearedHorseCount++;
        }

        Logger.debug("GameRunnerComponent", `Cleared highlights from ${clearedCellCount} cells and ${clearedHorseCount} horses`);
    }

    /**
     * Highlight horses at a specific position index
     * @param positionIndex The position index (0 = base, >0 = cell index)
     * @param nextPlayer The player whose turn it is (required for base horses)
     */
    private highlightHorseByPositionIndex(positionIndex: number, nextPlayer: number): void {
        let horsesToHighlight: Horse[] = [];

        if (positionIndex === 0) {
            // Position 0 means horses are in base (not spawned yet)
            // Find the base for the current player
            const baseID = this.playerToBaseMap[nextPlayer];
            if (!baseID) {
                Logger.warn("GameRunnerComponent", `No base mapping found for player ${nextPlayer}`);
                return;
            }

            const base = gameDataService.getBase(baseID);
            if (!base) {
                Logger.warn("GameRunnerComponent", `Base not found: ${baseID} for player ${nextPlayer}`);
                return;
            }

            // Find all horses in this base that are not spawned and not retired
            horsesToHighlight = gameDataService.getHorsesForBase(baseID).filter((horse) => !horse.isSpawned && !horse.isRetired);

            Logger.debug("GameRunnerComponent", `Found ${horsesToHighlight.length} horses in base ${baseID} for player ${nextPlayer}`);
        } else {
            // Position > 0 means horses are spawned on a cell
            const cell = this.findCellByIndex(positionIndex);
            if (!cell) {
                Logger.warn("GameRunnerComponent", `Cell with index ${positionIndex} not found for horse highlighting`);
                return;
            }

            // Find all horses at this cell position that are spawned and not retired
            horsesToHighlight = gameDataService
                .getBases()
                .flatMap((base) =>
                    gameDataService
                        .getHorsesForBase(base.ID)
                        .filter((horse) => horse.cellID === cell.cellID && horse.isSpawned && !horse.isRetired)
                );

            Logger.debug(
                "GameRunnerComponent",
                `Found ${horsesToHighlight.length} horses at position ${positionIndex} (cell ${cell.cellID})`
            );
        }

        if (horsesToHighlight.length === 0) {
            Logger.debug("GameRunnerComponent", `No horses found at position ${positionIndex} to highlight`);
            return;
        }

        // Highlight each horse found at this position
        for (const horseData of horsesToHighlight) {
            const horseComponent = this.horseComponentsMap.get(horseData.horseID);
            if (horseComponent) {
                horseComponent.highlightAsPossibleMove();
                Logger.debug("GameRunnerComponent", `Highlighted horse ${horseData.horseID} at position ${positionIndex}`);
            } else {
                Logger.warn("GameRunnerComponent", `HorseComponent not found for horseID: ${horseData.horseID}`);
            }
        }
    }

    /**
     * Initialize base components map
     */
    private initializeBaseComponents(): void {
        const scene = this.node.scene;
        if (!scene) {
            Logger.warn("GameRunnerComponent", "Scene not available, cannot initialize base components");
            return;
        }

        this.searchAndCacheBaseComponents(scene);
        Logger.debug("GameRunnerComponent", `Initialized ${this.baseComponentsMap.size} base components`);
    }

    /**
     * Recursively search and cache base components
     */
    private searchAndCacheBaseComponents(node: Node): void {
        const baseComponent = node.getComponent(BaseComponent);
        if (this.isValidBaseComponent(baseComponent)) {
            this.baseComponentsMap.set(baseComponent.baseID, baseComponent);
            Logger.debug("GameRunnerComponent", `Found base component: ${baseComponent.baseID}`);
        }

        node.children.forEach((child) => {
            this.searchAndCacheBaseComponents(child);
        });
    }

    /**
     * Check if base component is valid
     */
    private isValidBaseComponent(baseComponent: BaseComponent | null): boolean {
        return baseComponent !== null && !!baseComponent.baseID;
    }

    /**
     * Update border highlights for all bases based on next player
     * @param nextPlayer Player index (0-3) of the next player
     */
    private updateBaseBorderHighlights(nextPlayer: number): void {
        this.baseComponentsMap.forEach((baseComponent) => {
            if (baseComponent && baseComponent.isValid) {
                baseComponent.updateBorderHighlight(nextPlayer);
            }
        });
    }

    /**
     * Find BaseComponent by baseID in the scene
     * @param baseID The base ID to find
     * @returns BaseComponent instance or null if not found
     */
    private findBaseComponent(baseID: string): BaseComponent | null {
        // First check the map
        const cached = this.baseComponentsMap.get(baseID);
        if (cached && cached.isValid) {
            return cached;
        }

        // Fallback to searching the scene
        const scene = this.node.scene;
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
     * Position result node near the base with smooth tween animation
     * @param baseComponent The BaseComponent to position near
     * @param resultNode The result node to position
     * @param duration Duration of the animation in seconds (default: 0.5)
     */
    public positionDiceResultNearBase(baseComponent: BaseComponent, resultNode: Node, duration = 0.5): void {
        if (!baseComponent || !resultNode || !baseComponent.node) {
            Logger.warn("GameRunnerComponent", "Cannot position dice result: missing baseComponent or resultNode");
            return;
        }

        const baseNode = baseComponent.node;
        const baseTransform = baseNode.getComponent(UITransform);

        if (!baseTransform) {
            Logger.warn("GameRunnerComponent", "Base node does not have UITransform component");
            return;
        }

        // Get world position of the base center using UITransform
        const baseWorldPos = baseTransform.convertToWorldSpaceAR(Vec3.ZERO);

        // Ensure resultNode is active and visible
        resultNode.active = true;

        // Get current position
        const currentPos = resultNode.position.clone();

        // Convert world position to resultNode's parent local space
        let targetPos: Vec3;
        if (resultNode.parent) {
            const parentTransform = resultNode.parent.getComponent(UITransform);
            if (parentTransform) {
                // Convert world position to parent's local space
                targetPos = parentTransform.convertToNodeSpaceAR(baseWorldPos);
                Logger.debug(
                    "GameRunnerComponent",
                    `Animating dice result node from (${currentPos.x}, ${currentPos.y}) to (${targetPos.x}, ${targetPos.y}) relative to base ${baseComponent.baseID}`
                );
            } else {
                // Fallback: use world position directly
                targetPos = new Vec3(baseWorldPos.x, baseWorldPos.y, baseWorldPos.z);
                Logger.debug("GameRunnerComponent", `Animating dice result node to world position (${targetPos.x}, ${targetPos.y})`);
            }
        } else {
            // If no parent, use world position directly
            targetPos = new Vec3(baseWorldPos.x, baseWorldPos.y, baseWorldPos.z);
            Logger.debug(
                "GameRunnerComponent",
                `Animating dice result node to world position (${targetPos.x}, ${targetPos.y}) - no parent`
            );
        }

        // Animate the position change using tween
        tween(resultNode)
            .to(duration, { position: targetPos }, { easing: "sineOut" })
            .call(() => {
                Logger.debug("GameRunnerComponent", `Dice result node animation completed at (${targetPos.x}, ${targetPos.y})`);
            })
            .start();
    }

    /**
     * Get the player index who rolled the dice from BoardState
     * @param result The BoardState result
     * @returns Player index (0-3) or -1 if cannot determine
     */
    public getPlayerWhoRolled(result: GameServiceMessage.BoardState): number {
        // First try to get from action.player
        if (result.action?.player !== undefined && result.action.player !== null) {
            return result.action.player;
        }

        // Try to get from action.playerColor
        if (result.action?.playerColor !== undefined && result.action.playerColor !== null) {
            return result.action.playerColor;
        }

        // Fallback: calculate from nextPlayer (the player who rolled is before nextPlayer)
        if (result.nextPlayer !== undefined && result.nextPlayer !== null) {
            // The player who rolled is (nextPlayer - 1) mod 4
            return (result.nextPlayer - 1 + 4) % 4;
        }

        return -1;
    }

    /**
     * Move dice result to a specific player's base
     * @param playerIndex Player index (0-3)
     * @param resultNode The result node to move
     * @param duration Duration of the animation in seconds (default: 0.5)
     */
    public moveDiceResultToPlayerBase(playerIndex: number, resultNode: Node, duration = 0.5): void {
        if (playerIndex < 0 || playerIndex > 3) {
            Logger.warn("GameRunnerComponent", `Invalid player index: ${playerIndex}`);
            return;
        }

        const baseID = this.playerToBaseMap[playerIndex];
        if (!baseID) {
            Logger.warn("GameRunnerComponent", `No baseID mapping found for player: ${playerIndex}`);
            return;
        }

        const baseComponent = this.findBaseComponent(baseID);
        if (!baseComponent || !baseComponent.node) {
            Logger.warn("GameRunnerComponent", `BaseComponent not found for baseID: ${baseID}`);
            return;
        }

        Logger.debug("GameRunnerComponent", `Moving dice result to base of player ${playerIndex} (${baseID})`);
        this.positionDiceResultNearBase(baseComponent, resultNode, duration);
    }

    /**
     * Move dice result to the player who rolled the dice (for FinishBoardState)
     * @param result The BoardState result
     * @param resultNode The result node to position
     */
    public moveDiceResultForFinishState(result: GameServiceMessage.BoardState, resultNode: Node): void {
        const playerWhoRolled = this.getPlayerWhoRolled(result);
        Logger.debug("GameRunnerComponent", `Moving dice result to player who rolled: ${playerWhoRolled}`);

        if (playerWhoRolled >= 0 && resultNode) {
            // Use scheduleOnce to ensure scene is fully loaded before finding base
            this.scheduleOnce(() => {
                this.moveDiceResultToPlayerBase(playerWhoRolled, resultNode);
            }, 0.1); // Small delay to ensure scene is ready
        } else {
            Logger.warn("GameRunnerComponent", `Cannot move result: playerWhoRolled=${playerWhoRolled}, resultNode=${!!resultNode}`);
        }
    }

    /**
     * Move dice result to the next player's base (for NextState)
     * @param nextPlayer The next player index
     * @param resultNode The result node to position
     */
    public moveDiceResultForNextState(nextPlayer: number, resultNode: Node): void {
        if (nextPlayer !== undefined && nextPlayer !== null && resultNode) {
            Logger.debug("GameRunnerComponent", `Moving dice result to base of nextPlayer: ${nextPlayer}`);

            // Use scheduleOnce to ensure scene is fully loaded before finding base
            this.scheduleOnce(() => {
                this.moveDiceResultToPlayerBase(nextPlayer, resultNode);
            }, 0.1); // Small delay to ensure scene is ready
        }
    }

    /**
     * Set SFX enabled state and update all horse components
     * @param enabled Whether SFX is enabled
     */
    public setSfxEnabled(enabled: boolean): void {
        this.sfxEnabled = enabled;
        Logger.debug("GameRunnerComponent", `SFX enabled set to: ${enabled}`);

        // Update all horse components
        for (const horseComponent of this.horseComponentsMap.values()) {
            if (horseComponent && horseComponent.isValid) {
                horseComponent.setSfxEnabled(enabled);
            }
        }
    }

    onDestroy() {
        // Cleanup if needed
    }
}
