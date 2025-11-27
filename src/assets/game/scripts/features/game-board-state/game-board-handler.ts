import { IMultipleHandlers } from "@sg/game-client-base/dist/shared";
import inversify from "inversify";
import { GameServiceMessage } from "../game-messages";
import { GameBoardStore } from "./game-board-store";

const { injectable, inject } = inversify;

@injectable()
export class MatchConfigHandler implements IMultipleHandlers {
    @inject(GameBoardStore) private readonly gameBoardStore: GameBoardStore;

    handleBoardState(boardState: GameServiceMessage.BoardState) {
        this.gameBoardStore.boardState = boardState;
    }

    handleFinishBoardState(finishBoardState: GameServiceMessage.FinishBoardState) {
        this.gameBoardStore.finishBoardState = finishBoardState;
    }

    handleNextState(nextState: GameServiceMessage.NextState) {
        this.gameBoardStore.nextState = nextState;
    }

    eventHandleList = [
        {
            name: GameServiceMessage.BoardState.eventName,
            handle: this.handleBoardState,
        },
        {
            name: GameServiceMessage.FinishBoardState.eventName,
            handle: this.handleFinishBoardState,
        },
        {
            name: GameServiceMessage.NextState.eventName,
            handle: this.handleNextState,
        },
    ];
}
