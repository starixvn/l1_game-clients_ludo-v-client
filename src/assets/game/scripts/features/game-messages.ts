export namespace GameServiceMessage {
    export class BoardState {
        board: { [key: string]: number[] };
        currentTurnCount?: number;
        action: { oldPosition: number; newPosition: number; player: number; playerColor: number };
        nextPlayer?: number;
        possibleActions?: Array<{ oldPosition: number; newPosition: number }>;

        static eventName = "gameState";
    }

    export class FinishBoardState {
        result: BoardState;

        static eventName = "finish";
    }
}
