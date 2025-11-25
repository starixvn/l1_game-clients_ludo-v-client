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

    eventHandleList = [
        {
            name: GameServiceMessage.BoardState.eventName,
            handle: this.handleBoardState,
        },
    ];
}
