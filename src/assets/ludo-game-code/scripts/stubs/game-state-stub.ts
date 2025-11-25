/**
 * Game States Data
 * Combined from all game-states-*.json files in the output folder
 */

export interface GameState {
    board: { [key: string]: number[] };
    currentPlayer?: number;
    playerAction?: {
        oldPosition: number;
        newPosition: number;
    };
    kickedPlayer?: {
        player: number;
        position: number;
    };
}
