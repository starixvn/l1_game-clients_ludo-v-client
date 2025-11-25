export namespace GameServiceMessage {
    export class BoardState {
        board: { [key: string]: number[] };
        currentTurnCount?: number;
        action: { oldPosition: number; newPosition: number; playerColor: number };
        nextPlayerColor?: number;
        possibleActions?: Array<{ oldPosition: number; newPosition: number }>;

        static eventName = "gameState";
    }
}
