/**
 * Game Runner Component
 *
 * Handles replaying game states from game-state-stub.ts
 * Manages the progression through game states and coordinates horse movements
 */

import { _decorator, Component, Node, Label, Button, Color } from "cc";
import gc from "@sg/game-client-base";
import { Logger } from "../utils/logger";
import { GAME_STATES, GameState } from "../stubs/game-state-stub";
import { HorseComponent } from "./horse-component";
import { gameDataService } from "../services/game-data-service";
import { getBaseColor } from "../utils/color-utils";
import { DiceResultHandler } from "../../../game/scripts/handlers/dice-result-handler";
import { DiceResultData } from "../../../game/scripts/stores/dice-result-store";

const { ccclass, property, menu } = _decorator;

@ccclass("GameRunnerComponent")
@menu("LudoGame/GameRunnerComponent")
export class GameRunnerComponent extends Component {
    /** Label to display dice results */
    @property(Label)
    diceLabel: Label = null;

    /** Button to manually go to next state */
    @property(Button)
    nextButton: Button = null;

    /** Button to start auto replay */
    @property(Button)
    autoButton: Button = null;

    /** Current state index being played */
    private currentStateIndex: number = 0;

    /** Whether state replay is active */
    private isReplaying: boolean = false;

    /** Whether auto replay is active */
    private isAutoReplaying: boolean = false;

    /** Whether animations are complete and waiting for next button click (manual mode) */
    private isWaitingForNext: boolean = false;

    /** Auto replay interval duration in seconds */
    private readonly AUTO_REPLAY_INTERVAL: number = 2;

    /** Player to Base mapping */
    private readonly playerToBaseMap: { [key: number]: string } = {
        0: "BASE_1", // YELLOW
        1: "BASE_3", // BLUE
        2: "BASE_4", // RED
        3: "BASE_2", // GREEN
    };

    /** Map of horseID to HorseComponent for quick lookup */
    private horseComponentsMap: Map<string, HorseComponent> = new Map();

    /** Dice result handler instance */
    private diceResultHandler: DiceResultHandler | null = null;

    /** Player names mapping */
    private readonly playerNames: string[] = ["Yellow", "Blue", "Red", "Green"];

    /** Initial game state to start from (optional) */
    private initialGameState: GameState | null = null;

    start() {
        // Initialize dice result handler from container
        try {
            const container = gc.getContainer?.();
            if (container) {
                this.diceResultHandler = container.get(DiceResultHandler);
            }
        } catch (e) {
            Logger.warn("GameRunnerComponent", "Could not get DiceResultHandler from container: " + e);
        }

        // Set initial game state from provided state
        this.setInitialGameStateFromProvidedState();

        // Initialize horse components in start() to ensure scene is fully loaded
        this.initializeHorseComponents();
        this.setupUI();

        // Apply initial state immediately after a short delay to ensure everything is initialized
        this.scheduleOnce(() => {
            this.applyInitialGameState();
        }, 0.2);
    }

    /**
     * Set initial game state from the provided state format
     */
    private setInitialGameStateFromProvidedState(): void {
        const providedState = {
            board: {
                "0": [62, 61, 57, 6],
                "1": [157, 28, 13, 4],
                "2": [262, 261, 260, 11],
                "3": [362, 361, 360, 8],
            },
            currentTurnCount: 527,
            action: {
                oldPosition: 24,
                newPosition: 28,
                playerColor: 1,
            },
            nextPlayerColor: 2,
            possibleActions: [
                {
                    oldPosition: 11,
                    newPosition: 13,
                },
                {
                    oldPosition: 62,
                    newPosition: 62,
                },
            ],
        };

        this.setInitialGameState(providedState);
    }

    /**
     * Setup UI elements and event handlers
     */
    private setupUI(): void {
        // Setup Next button
        if (this.nextButton) {
            this.nextButton.node.on(Button.EventType.CLICK, this.onNextButtonClick, this);
            this.updateNextButtonText();
        }

        // Setup Auto button
        if (this.autoButton) {
            this.autoButton.node.on(Button.EventType.CLICK, this.onAutoButtonClick, this);
            this.updateAutoButtonText();
        }

        // Initialize dice display
        this.updateDiceDisplay(null);
    }

    /**
     * Update dice display label
     */
    private updateDiceDisplay(gameState: GameState | null): void {
        if (!this.diceLabel) {
            return;
        }

        if (!gameState || !gameState.dice || gameState.dice.length === 0) {
            this.diceLabel.string = "Dice: -";
            // Reset to default color (white)
            this.diceLabel.color = new Color(255, 255, 255, 255);

            // Send null to handler to clear dice result
            if (this.diceResultHandler) {
                this.diceResultHandler.handle(null);
            }
            return;
        }

        const diceValues = gameState.dice.join(", ");
        const currentPlayer = gameState.currentPlayer;
        const playerName = this.playerNames[currentPlayer] || `Player ${currentPlayer}`;

        // Check if there's a move (oldPosition !== newPosition means a move was made)
        const hasMove = gameState.playerAction && gameState.playerAction.oldPosition !== gameState.playerAction.newPosition;

        // Build the display string
        let displayText = `Player: ${playerName} | Dice: [${diceValues}]`;
        if (!hasMove) {
            displayText += " | No Move";
        }

        this.diceLabel.string = displayText;

        // Update label color based on current player's base color
        const baseID = this.playerToBaseMap[currentPlayer];
        if (baseID) {
            const base = gameDataService.getBase(baseID);
            if (base && base.color) {
                const color = getBaseColor(base.color);
                if (color) {
                    this.diceLabel.color = color;
                } else {
                    // Fallback to white if color not found
                    this.diceLabel.color = new Color(255, 255, 255, 255);
                }
            } else {
                // Fallback to white if base not found
                this.diceLabel.color = new Color(255, 255, 255, 255);
            }
        } else {
            // Fallback to white if player mapping not found
            this.diceLabel.color = new Color(255, 255, 255, 255);
        }

        // Send dice result to handler/store
        if (this.diceResultHandler) {
            const diceResultData: DiceResultData = {
                dice: gameState.dice,
                currentPlayer: gameState.currentPlayer,
                playerName: playerName,
                hasMove: hasMove,
            };
            this.diceResultHandler.handle(diceResultData);
        }
    }

    /**
     * Update Next button text based on current state
     */
    private updateNextButtonText(): void {
        if (!this.nextButton) {
            return;
        }

        const label = this.nextButton.getComponentInChildren(Label);
        if (label) {
            if (this.isReplaying) {
                if (this.isWaitingForNext) {
                    label.string = "Next";
                    this.nextButton.interactable = true;
                } else {
                    label.string = "Animating...";
                    this.nextButton.interactable = false;
                }
            } else {
                label.string = "Start";
                this.nextButton.interactable = true;
            }
        }
    }

    /**
     * Update Auto button text based on auto replay state
     */
    private updateAutoButtonText(): void {
        if (!this.autoButton) {
            return;
        }

        const label = this.autoButton.getComponentInChildren(Label);
        if (label) {
            if (this.isAutoReplaying) {
                label.string = "Stop Auto";
            } else {
                label.string = "Auto";
            }
        }
    }

    /**
     * Handle Next button click
     */
    private onNextButtonClick(): void {
        if (this.isAutoReplaying) {
            Logger.warn("GameRunnerComponent", "Cannot use Next button while auto replay is active");
            return;
        }

        if (!this.isReplaying) {
            // Start replay from first state
            this.startStateReplay();
        } else if (this.isWaitingForNext) {
            // Animations are complete, advance to next state
            this.isWaitingForNext = false;
            this.nextState();
        } else {
            // Animations are still running, do nothing
            Logger.debug("GameRunnerComponent", "Animations still running, please wait...");
        }
    }

    /**
     * Handle Auto button click
     */
    private onAutoButtonClick(): void {
        if (this.isAutoReplaying) {
            // Stop auto replay
            this.stopAutoReplay();
        } else {
            // Start auto replay
            this.startAutoReplay();
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
                    Logger.debug("GameRunnerComponent", `Found horse component: ${horseID} (node: ${node.name})`);
                } else {
                    Logger.warn("GameRunnerComponent", `Found HorseComponent but no horseID (node: ${node.name})`);
                }
            }
            for (let i = 0; i < node.children.length; i++) {
                findHorseComponents(node.children[i]);
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
    public setInitialGameState(gameState: {
        board: { [key: string]: number[] };
        currentTurnCount?: number;
        action: { oldPosition: number; newPosition: number; playerColor: number };
        nextPlayerColor?: number;
        possibleActions?: Array<{ oldPosition: number; newPosition: number }>;
    }): void {
        // Convert external format to GameState format
        const convertedState: GameState = {
            board: gameState.board,
            dice: [], // Dice values not available in external format, will be empty
            currentPlayer: gameState.action.playerColor,
            playerAction: {
                oldPosition: gameState.action.oldPosition,
                newPosition: gameState.action.newPosition,
            },
        };

        this.initialGameState = convertedState;
        Logger.debug("GameRunnerComponent", `Initial game state set: currentPlayer=${convertedState.currentPlayer}, board positions set`);
    }

    /**
     * Apply initial game state immediately (without starting replay)
     */
    private applyInitialGameState(): void {
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

        // Update dice display
        this.updateDiceDisplay(this.initialGameState);

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
    }

    /**
     * Start replaying game states
     */
    public startStateReplay(): void {
        if (this.isReplaying && !this.isAutoReplaying) {
            Logger.warn("GameRunnerComponent", "State replay is already running");
            return;
        }

        // Re-initialize horse components in case they weren't ready before
        this.initializeHorseComponents();

        if (this.horseComponentsMap.size === 0) {
            Logger.error("GameRunnerComponent", "No horse components found! Cannot start replay.");
            Logger.error("GameRunnerComponent", "Make sure HorseComponent nodes exist in the scene with horseID property set.");
            return;
        }

        this.isReplaying = true;
        this.currentStateIndex = 0;
        Logger.debug(
            "GameRunnerComponent",
            `Starting state replay with ${GAME_STATES.length} states, found ${this.horseComponentsMap.size} horse components`
        );

        // Update UI
        this.updateNextButtonText();

        // Apply initial state if set, otherwise use first state from GAME_STATES
        const firstState = this.initialGameState || GAME_STATES[0];
        this.applyGameStateAndWait(firstState);
    }

    /**
     * Start auto replay with interval
     */
    public startAutoReplay(): void {
        if (this.isAutoReplaying) {
            Logger.warn("GameRunnerComponent", "Auto replay is already running");
            return;
        }

        // Stop any manual replay first
        if (this.isReplaying) {
            this.stopStateReplay();
        }

        // Start replay
        this.startStateReplay();

        // Enable auto mode
        this.isAutoReplaying = true;
        this.updateAutoButtonText();

        Logger.debug("GameRunnerComponent", "Auto replay started with interval: " + this.AUTO_REPLAY_INTERVAL + "s");
    }

    /**
     * Stop auto replay
     */
    public stopAutoReplay(): void {
        if (!this.isAutoReplaying) {
            return;
        }

        this.isAutoReplaying = false;
        this.updateAutoButtonText();

        Logger.debug("GameRunnerComponent", "Auto replay stopped");
    }

    /**
     * Refresh horse components map (useful if horses are added dynamically)
     */
    public refreshHorseComponents(): void {
        this.initializeHorseComponents();
        Logger.debug("GameRunnerComponent", `Refreshed horse components: ${this.horseComponentsMap.size} found`);
    }

    /**
     * Stop replaying game states
     */
    public stopStateReplay(): void {
        if (!this.isReplaying) {
            return;
        }

        this.isReplaying = false;
        this.isWaitingForNext = false;
        this.updateNextButtonText();
        Logger.debug("GameRunnerComponent", "State replay stopped");
    }

    /**
     * Move to next state (called after previous state animations complete or Next button clicked)
     */
    private nextState(): void {
        if (!this.isReplaying) {
            return;
        }

        // Reset waiting flag
        this.isWaitingForNext = false;

        this.currentStateIndex++;

        if (this.currentStateIndex >= GAME_STATES.length) {
            Logger.debug("GameRunnerComponent", "Reached end of game states");
            this.stopStateReplay();
            if (this.isAutoReplaying) {
                this.stopAutoReplay();
            }
            return;
        }

        const gameState = GAME_STATES[this.currentStateIndex];
        // Update button state before applying state
        this.updateNextButtonText();
        // Apply state immediately (interval is handled in applyGameStateAndWait)
        this.applyGameStateAndWait(gameState);
    }

    /**
     * Apply a game state to update all horses and wait for animations to complete
     */
    private applyGameStateAndWait(gameState: GameState): void {
        Logger.debug(
            "GameRunnerComponent",
            `Applying state ${this.currentStateIndex + 1}/${GAME_STATES.length}, currentPlayer: ${gameState.currentPlayer}`
        );

        // Update dice display
        this.updateDiceDisplay(gameState);

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

        // Wait for all horse movements to complete before moving to next state
        if (movementPromises.length > 0) {
            Promise.all(movementPromises)
                .then(() => {
                    Logger.debug("GameRunnerComponent", `All horse movements completed for state ${this.currentStateIndex + 1}`);
                    // Handle next state based on mode
                    if (this.isAutoReplaying) {
                        // Auto mode: wait for interval then advance automatically
                        this.scheduleOnce(() => {
                            this.nextState();
                        }, this.AUTO_REPLAY_INTERVAL);
                    } else {
                        // Manual mode: wait for Next button click
                        this.isWaitingForNext = true;
                        this.updateNextButtonText();
                        Logger.debug("GameRunnerComponent", "Waiting for Next button click to advance to next state");
                    }
                })
                .catch((error) => {
                    Logger.error("GameRunnerComponent", `Error waiting for horse movements: ${error}`);
                    // Handle next state based on mode even if there's an error
                    if (this.isAutoReplaying) {
                        this.scheduleOnce(() => {
                            this.nextState();
                        }, this.AUTO_REPLAY_INTERVAL);
                    } else {
                        // Manual mode: wait for Next button click
                        this.isWaitingForNext = true;
                        this.updateNextButtonText();
                        Logger.debug("GameRunnerComponent", "Waiting for Next button click to advance to next state");
                    }
                });
        } else {
            // No horses to move, proceed immediately
            Logger.debug("GameRunnerComponent", `No horses to move in state ${this.currentStateIndex + 1}, proceeding immediately`);
            if (this.isAutoReplaying) {
                // Auto mode: wait for interval then advance automatically
                this.scheduleOnce(() => {
                    this.nextState();
                }, this.AUTO_REPLAY_INTERVAL);
            } else {
                // Manual mode: wait for Next button click
                this.isWaitingForNext = true;
                this.updateNextButtonText();
                Logger.debug("GameRunnerComponent", "Waiting for Next button click to advance to next state");
            }
        }
    }

    /**
     * Get current state index
     */
    public getCurrentStateIndex(): number {
        return this.currentStateIndex;
    }

    /**
     * Check if replay is active
     */
    public isReplayActive(): boolean {
        return this.isReplaying;
    }

    /**
     * Get total number of game states
     */
    public getTotalStates(): number {
        return GAME_STATES.length;
    }

    onDestroy() {
        this.stopAutoReplay();
        this.stopStateReplay();
    }
}
